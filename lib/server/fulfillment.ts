import 'server-only';
import type { Address } from '../types';
import { cents } from '../commerce';
import { checked, requiredData, serviceDb } from './db';
import { enqueueEmail } from './email';
import { buyLabel, easyPost, quoteShipment, type EasyPostShipment } from './shipping';
import { PublicError } from './http';
import { stripeClient } from './stripe';

export async function getOrderRates(orderId: string) {
  const db = serviceDb();
  const order = requiredData(
    await db
      .from('orders')
      .select('id,status,shipping_address,order_items(weight_oz,quantity),shipments(*)')
      .eq('id', orderId)
      .single(),
  );
  if (order.shipments.length) throw new PublicError('This order already has a shipment.');
  if (!['paid', 'processing'].includes(order.status))
    throw new PublicError('Only paid, unshipped orders can receive a label.');
  const operation = checked(
    await db.from('label_operations').select('*').eq('order_id', orderId).maybeSingle(),
  );
  if (operation) {
    const existing = requiredData(
      await db
        .from('shipping_quotes')
        .select('rates')
        .eq('easypost_shipment_id', operation.easypost_shipment_id)
        .single(),
    );
    return {
      id: operation.easypost_shipment_id,
      rates: existing.rates,
      retry_rate_id: operation.rate_id,
    };
  }
  const shipment = await quoteShipment({
    address: order.shipping_address as Address,
    weight_oz: order.order_items.reduce(
      (sum: number, item: { weight_oz: number; quantity: number }) =>
        sum + Number(item.weight_oz) * item.quantity,
      0,
    ),
    reference: orderId,
  });
  checked(
    await db
      .from('shipping_quotes')
      .insert({ order_id: orderId, easypost_shipment_id: shipment.id, rates: shipment.rates }),
  );
  return shipment;
}
export async function purchaseOrderLabel(
  orderId: string,
  shipmentId: string,
  rateId: string,
  adminId: string,
) {
  const db = serviceDb();
  const claim = await db.rpc('claim_label', {
    p_order_id: orderId,
    p_shipment_id: shipmentId,
    p_rate_id: rateId,
  });
  if (claim.error)
    throw new PublicError(
      'This label is already processing, its quote expired, or the order changed. Reload the order and retry its existing label.',
      409,
    );
  if (claim.data.complete)
    return checked(await db.from('shipments').select('*').eq('order_id', orderId).single());
  try {
    const shipment = await buyLabel(shipmentId, rateId);
    if (!shipment.postage_label?.label_url || !shipment.selected_rate || !shipment.tracker?.id)
      throw new Error('Incomplete shipping label response');
    const result = {
      easypost_shipment_id: shipment.id,
      easypost_tracker_id: shipment.tracker.id,
      label_url: shipment.postage_label.label_url,
      carrier: shipment.selected_rate.carrier,
      service: shipment.selected_rate.service,
      postage_cents: cents(shipment.selected_rate.rate),
      tracking_code: shipment.tracking_code,
      tracking_url: shipment.tracker.public_url,
    };
    checked(
      await db.rpc('complete_fulfillment', {
        p_order_id: orderId,
        p_shipment: result,
        p_admin_id: adminId,
        p_manual: false,
      }),
    );
    return result;
  } catch (error) {
    // Keep the immutable shipment/rate pinned after ambiguous outcomes; retry retrieves this shipment first.
    checked(
      await db.from('label_operations').update({ locked_until: null }).eq('order_id', orderId),
    );
    await enqueueEmail({
      key: `label-failed:${orderId}:${shipmentId}`,
      kind: 'label_failed',
      payload: { order_id: orderId },
    });
    throw error;
  }
}
export async function fulfillManually(
  orderId: string,
  shipment: { carrier: string; tracking_code?: string; tracking_url?: string },
  adminId: string,
) {
  const result = await serviceDb().rpc('complete_fulfillment', {
    p_order_id: orderId,
    p_shipment: { ...shipment, service: 'Manual fulfillment', postage_cents: 0 },
    p_admin_id: adminId,
    p_manual: true,
  });
  if (result.error)
    throw new PublicError(
      'This order has a pending label, refund, or existing shipment. Reload it before continuing.',
      409,
    );
  return { id: result.data };
}
export async function refundOrder(
  orderId: string,
  options: { reason?: string; restock: boolean },
  adminId: string,
) {
  const db = serviceDb();
  const result = await db.rpc('request_refund', {
    p_order_id: orderId,
    p_restock: options.restock,
    p_reason: options.reason ?? null,
    p_admin_id: adminId,
  });
  if (result.error)
    throw new PublicError(
      'This order cannot be refunded right now. Reconcile any pending shipping label first.',
      409,
    );
  const request = result.data as { id: string; restock: boolean };
  const order = requiredData(
    await db
      .from('orders')
      .select('stripe_payment_intent_id,total_cents,refunded_cents')
      .eq('id', orderId)
      .single(),
  );
  const refund = await stripeClient().refunds.create(
    {
      payment_intent: order.stripe_payment_intent_id,
      metadata: {
        refund_request_id: request.id,
        order_id: orderId,
        restock: String(request.restock),
      },
    },
    { idempotencyKey: `refund:${request.id}` },
  );
  // Stripe returns current status; webhook remains authoritative for order state and stock restoration.
  return { id: refund.id, status: refund.status };
}
export type EasyPostTracker = {
  id: string;
  mode: string;
  status: string;
  updated_at: string;
  tracking_details?: { message: string; datetime: string }[];
};
export async function applyTracker(eventId: string, trackerId: string) {
  const tracker = await easyPost<EasyPostTracker>(`/trackers/${trackerId}`);
  const last = tracker.tracking_details?.at(-1);
  checked(
    await serviceDb().rpc('apply_tracking', {
      p_event_id: eventId,
      p_tracker_id: tracker.id,
      p_status: tracker.status,
      p_description: last?.message ?? tracker.status,
      p_occurred_at: tracker.updated_at,
    }),
  );
}
export async function recoverPurchasedLabel(shipmentId: string): Promise<EasyPostShipment> {
  return easyPost<EasyPostShipment>(`/shipments/${shipmentId}`);
}
