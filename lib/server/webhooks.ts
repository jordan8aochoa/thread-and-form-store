import 'server-only';
import type Stripe from 'stripe';
import { checked, serviceDb } from './db';
import { enqueueEmail } from './email';
import { stripeClient } from './stripe';

function stripeId(value: string | { id: string } | null): string {
  return typeof value === 'string' ? value : (value?.id ?? '');
}
export async function processStripeEvent(event: Stripe.Event) {
  const db = serviceDb();
  const prior = checked(
    await db.from('webhook_events').select('id').eq('id', event.id).maybeSingle(),
  );
  if (prior) return { duplicate: true };
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      await enqueueEmail({
        key: `attention:${event.id}`,
        kind: 'payment_attention',
        payload: { message: `Checkout ${session.id} is awaiting confirmed payment.` },
      });
    } else {
      if (
        !session.metadata?.reservation_id ||
        session.currency !== 'usd' ||
        !stripeId(session.payment_intent)
      )
        throw new Error('Invalid paid checkout metadata');
      checked(
        await db.rpc('finalize_checkout', {
          p_event_id: event.id,
          p_event_type: event.type,
          p_reservation_id: session.metadata.reservation_id,
          p_session_id: session.id,
          p_payment_intent_id: stripeId(session.payment_intent),
          p_customer_id: stripeId(session.customer),
          p_subtotal: session.amount_subtotal,
          p_discount: session.total_details?.amount_discount ?? 0,
          p_shipping: session.total_details?.amount_shipping ?? 0,
          p_tax: session.total_details?.amount_tax ?? 0,
          p_total: session.amount_total,
        }),
      );
      return { received: true };
    }
  } else if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.reservation_id) {
      // Re-fetch canonical state: no release because a browser redirected or a clock elapsed.
      const current = await stripeClient().checkout.sessions.retrieve(session.id);
      if (current.status === 'expired' && current.payment_status !== 'paid')
        checked(
          await db.rpc('expire_reservation', {
            p_id: session.metadata.reservation_id,
            p_session_id: session.id,
          }),
        );
    }
  } else if (
    event.type === 'payment_intent.payment_failed' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    await enqueueEmail({
      key: `attention:${event.id}`,
      kind: 'payment_attention',
      payload: {
        message: `Stripe reported ${event.type}. Review provider event ${event.id} in the Stripe dashboard.`,
      },
    });
  } else if (['refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) {
    const object = event.data.object as Stripe.Refund;
    const refund = await stripeClient().refunds.retrieve(object.id);
    await applyRefund(event.id, refund);
    return { received: true };
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    for await (const refund of stripeClient().refunds.list({ charge: charge.id, limit: 100 }))
      await applyRefund(`${event.id}:${refund.id}`, refund);
  }
  checked(
    await db
      .from('webhook_events')
      .upsert(
        { id: event.id, provider: 'stripe', type: event.type },
        { onConflict: 'id', ignoreDuplicates: true },
      ),
  );
  return { received: true };
}
async function applyRefund(eventId: string, refund: Stripe.Refund) {
  if (!stripeId(refund.payment_intent)) return;
  checked(
    await serviceDb().rpc('apply_refund', {
      p_event_id: eventId,
      p_refund_id: refund.id,
      p_payment_intent_id: stripeId(refund.payment_intent),
      p_amount: refund.amount,
      p_status: refund.status ?? 'pending',
    }),
  );
}
