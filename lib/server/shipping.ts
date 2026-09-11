import 'server-only';
import { createHmac } from 'node:crypto';
import type { Address, ShippingRate } from '../types';
import { cents } from '../commerce';
import { checked, required, serviceDb } from './db';
import { PublicError, secretEqual } from './http';

export type EasyPostShipment = {
  id: string;
  mode: string;
  rates: {
    id: string;
    carrier: string;
    service: string;
    rate: string;
    currency: string;
    delivery_days: number | null;
  }[];
  postage_label?: { label_url: string };
  selected_rate?: { id: string; carrier: string; service: string; rate: string };
  tracking_code?: string;
  tracker?: { id: string; public_url: string; status: string };
};
export async function easyPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://api.easypost.com/v2${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${required('EASYPOST_API_KEY')}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  if (!response.ok)
    throw new PublicError(
      'Shipping is temporarily unavailable. Please check your address or try again shortly.',
      503,
    );
  const data = await response.json();
  if (data.mode && data.mode !== (process.env.EASYPOST_MODE ?? 'test'))
    throw new Error('EasyPost API key mode does not match EASYPOST_MODE');
  if (data.mode === 'production' && process.env.COMMERCE_MODE !== 'live')
    throw new Error('Live postage disabled');
  return data as T;
}
export async function verifyAddress(address: Address): Promise<Address> {
  if (address.country !== 'US')
    throw new PublicError('We currently ship within the United States.');
  const result = await easyPost<Address & { verifications?: { delivery?: { success: boolean } } }>(
    '/addresses',
    { address, verify_strict: true },
  );
  if (result.verifications?.delivery?.success !== true)
    throw new PublicError(
      'We could not verify that shipping address. Please check it and try again.',
    );
  return {
    name: result.name || address.name,
    street1: result.street1,
    street2: result.street2 || '',
    city: result.city,
    state: result.state,
    zip: result.zip,
    country: result.country,
    ...(address.phone ? { phone: address.phone } : {}),
  };
}
function parcelNumber(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid parcel setting ${name}`);
  return n;
}
export async function quoteShipment({
  address,
  weight_oz,
  reference,
}: {
  address: Address;
  weight_oz: number;
  reference?: string;
}): Promise<{ id: string; rates: ShippingRate[] }> {
  const settings = checked(
    await serviceDb().from('store_settings').select('return_address').eq('id', 'store').single(),
  );
  if (!settings?.return_address?.street1 || settings.return_address.country !== 'US')
    throw new Error('Configure a US return address');
  const shipment = await easyPost<EasyPostShipment>('/shipments', {
    shipment: {
      to_address: address,
      from_address: settings.return_address,
      parcel: {
        length: parcelNumber('SHIPPING_PARCEL_LENGTH', 14),
        width: parcelNumber('SHIPPING_PARCEL_WIDTH', 11),
        height: parcelNumber('SHIPPING_PARCEL_HEIGHT', 3),
        weight: weight_oz + parcelNumber('SHIPPING_PACKAGING_WEIGHT_OZ', 2),
      },
      reference,
      options: { label_format: 'PDF' },
    },
  });
  const rates = shipment.rates
    .filter((r) => r.currency.toUpperCase() === 'USD')
    .map((r) => ({
      id: r.id,
      carrier: r.carrier,
      service: r.service,
      amount_cents: cents(r.rate),
      delivery_days: r.delivery_days,
    }))
    .sort((a, b) => a.amount_cents - b.amount_cents);
  if (!rates.length)
    throw new PublicError(
      'No shipping services are available for this address right now. Please try again.',
      503,
    );
  return { id: shipment.id, rates };
}
export async function buyLabel(shipmentId: string, rateId: string): Promise<EasyPostShipment> {
  if (!/^shp_[a-zA-Z0-9]+$/.test(shipmentId) || !/^rate_[a-zA-Z0-9]+$/.test(rateId))
    throw new PublicError('Invalid shipping selection.');
  // A timed-out buy can already have succeeded. Retrieve the same immutable shipment before every retry.
  const existing = await easyPost<EasyPostShipment>(`/shipments/${shipmentId}`);
  if (existing.postage_label?.label_url) return existing;
  if (!existing.rates.some((rate) => rate.id === rateId))
    throw new PublicError('This rate is no longer available.');
  return easyPost<EasyPostShipment>(`/shipments/${shipmentId}/buy`, { rate: { id: rateId } });
}
export function verifyEasyPostWebhook(raw: string, signature: string | null) {
  const expected = `hmac-sha256-hex=${createHmac('sha256', required('EASYPOST_WEBHOOK_SECRET').normalize('NFKD')).update(raw).digest('hex')}`;
  if (!signature || !secretEqual(signature, expected))
    throw new PublicError('Invalid webhook signature.', 400);
}
