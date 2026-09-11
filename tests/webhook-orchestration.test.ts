import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
const mocks = vi.hoisted(() => ({
  prior: vi.fn(),
  upsert: vi.fn(),
  rpc: vi.fn(),
  email: vi.fn(),
  retrieve: vi.fn(),
  refund: vi.fn(),
}));
vi.mock('@/lib/server/db', () => ({
  checked: <T>(value: { data: T; error: unknown }) => {
    if (value.error) throw value.error;
    return value.data;
  },
  serviceDb: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.prior }) }),
      upsert: mocks.upsert,
    }),
  }),
}));
vi.mock('@/lib/server/email', () => ({ enqueueEmail: mocks.email }));
vi.mock('@/lib/server/stripe', () => ({
  stripeClient: () => ({
    checkout: { sessions: { retrieve: mocks.retrieve } },
    refunds: { retrieve: mocks.refund },
  }),
}));
import { processStripeEvent } from '@/lib/server/webhooks';
const event = (type: string, object: Record<string, unknown>) =>
  ({ id: 'evt_fixture', type, data: { object } }) as unknown as Stripe.Event;
const paid = {
  id: 'cs_test_fixture',
  payment_status: 'paid',
  metadata: { reservation_id: 'reservation_fixture' },
  currency: 'usd',
  payment_intent: 'pi_fixture',
  customer: 'cus_fixture',
  amount_subtotal: 9800,
  amount_total: 10615,
  total_details: { amount_shipping: 815, amount_discount: 0, amount_tax: 0 },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prior.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: 'order_fixture', error: null });
  mocks.upsert.mockResolvedValue({ data: null, error: null });
});
describe('verified Stripe event orchestration', () => {
  it('short-circuits an already committed webhook event', async () => {
    mocks.prior.mockResolvedValue({ data: { id: 'evt_fixture' }, error: null });
    expect(await processStripeEvent(event('checkout.session.completed', paid))).toEqual({
      duplicate: true,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it('sends confirmed payment totals to the atomic order/inventory transaction', async () => {
    await processStripeEvent(event('checkout.session.completed', paid));
    expect(mocks.rpc).toHaveBeenCalledWith(
      'finalize_checkout',
      expect.objectContaining({
        p_event_id: 'evt_fixture',
        p_reservation_id: 'reservation_fixture',
        p_session_id: 'cs_test_fixture',
        p_payment_intent_id: 'pi_fixture',
        p_subtotal: 9800,
        p_total: 10615,
        p_shipping: 815,
      }),
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('does not create an order for unpaid completion or failed payment', async () => {
    await processStripeEvent(
      event('checkout.session.completed', { ...paid, payment_status: 'unpaid' }),
    );
    await processStripeEvent(event('payment_intent.payment_failed', { id: 'pi_fixture' }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.email).toHaveBeenCalledTimes(2);
  });
  it('leaves a failed transaction unacknowledged so Stripe can retry it', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('transaction rolled back') });
    await expect(processStripeEvent(event('checkout.session.completed', paid))).rejects.toThrow(
      'transaction rolled back',
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('rechecks expiration with Stripe before releasing a reservation', async () => {
    mocks.retrieve.mockResolvedValue({ status: 'complete', payment_status: 'paid' });
    await processStripeEvent(event('checkout.session.expired', paid));
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.retrieve.mockResolvedValue({ status: 'expired', payment_status: 'unpaid' });
    await processStripeEvent(event('checkout.session.expired', paid));
    expect(mocks.rpc).toHaveBeenCalledWith('expire_reservation', {
      p_id: 'reservation_fixture',
      p_session_id: 'cs_test_fixture',
    });
  });
  it('retrieves current refund state to tolerate out-of-order events', async () => {
    mocks.refund.mockResolvedValue({
      id: 're_fixture',
      status: 'succeeded',
      amount: 10615,
      payment_intent: 'pi_fixture',
    });
    await processStripeEvent(event('refund.updated', { id: 're_fixture', status: 'pending' }));
    expect(mocks.rpc).toHaveBeenCalledWith(
      'apply_refund',
      expect.objectContaining({
        p_refund_id: 're_fixture',
        p_status: 'succeeded',
        p_amount: 10615,
      }),
    );
  });
});
