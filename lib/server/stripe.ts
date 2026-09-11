import 'server-only';
import Stripe from 'stripe';
import { required } from './db';
export function stripeClient() {
  const key = required('STRIPE_SECRET_KEY');
  if (process.env.COMMERCE_MODE !== 'live' && !key.startsWith('sk_test_'))
    throw new Error('Live Stripe charges disabled');
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 });
}
export function verifyStripeEvent(raw: string, signature: string | null) {
  if (!signature) throw new Error('Missing Stripe signature');
  const event = stripeClient().webhooks.constructEvent(
    raw,
    signature,
    required('STRIPE_WEBHOOK_SECRET'),
  );
  if (event.livemode !== (process.env.COMMERCE_MODE === 'live'))
    throw new Error('Stripe event mode mismatch');
  return event;
}
