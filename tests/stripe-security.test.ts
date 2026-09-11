import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { stripeClient, verifyStripeEvent } from '@/lib/server/stripe';
const secret = 'whsec_fixture_not_real';
const fixture = JSON.stringify({
  id: 'evt_test_fixture',
  object: 'event',
  type: 'checkout.session.completed',
  livemode: false,
  data: { object: { id: 'cs_test_fixture' } },
});
beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture_not_real');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
  vi.stubEnv('COMMERCE_MODE', 'test');
});
afterEach(() => vi.unstubAllEnvs());
it('verifies a signed webhook using the actual Stripe SDK without a network call', () => {
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: fixture, secret });
  expect(verifyStripeEvent(fixture, signature).id).toBe('evt_test_fixture');
  expect(() => verifyStripeEvent(`${fixture} `, signature)).toThrow();
  expect(() => verifyStripeEvent(fixture, null)).toThrow();
});
it('rejects signed events from the wrong mode', () => {
  const payload = fixture.replace('"livemode":false', '"livemode":true');
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  expect(() => verifyStripeEvent(payload, signature)).toThrow('mode mismatch');
});
it('refuses a live Stripe secret key until live commerce is explicitly enabled', () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_fixture_not_real');
  expect(() => stripeClient()).toThrow('Live Stripe charges disabled');
});
