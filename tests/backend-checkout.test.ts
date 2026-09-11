import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoProducts } from '@/lib/demo';
const mocked = vi.hoisted(() => ({
  customer: vi.fn(),
  coupon: vi.fn(),
  session: vi.fn(),
  retrieve: vi.fn(),
  rpc: vi.fn(),
  verify: vi.fn(),
  shipping: vi.fn(),
  from: vi.fn(),
}));
vi.mock('@/lib/server/stripe', () => ({
  stripeClient: () => ({
    customers: { create: mocked.customer },
    coupons: { create: mocked.coupon },
    checkout: { sessions: { create: mocked.session, retrieve: mocked.retrieve } },
  }),
}));
vi.mock('@/lib/server/shipping', () => ({
  verifyAddress: mocked.verify,
  quoteShipment: mocked.shipping,
}));
vi.mock('@/lib/server/db', () => ({
  requiredData: <T>(value: { data: T; error: unknown }) => {
    if (value.error) throw value.error;
    if (value.data == null) throw new Error('Missing record');
    return value.data;
  },
  required: (key: string) =>
    process.env[key] ||
    (() => {
      throw new Error('Missing configuration');
    })(),
  checked: <T>(value: { data: T; error: unknown }) => {
    if (value.error) throw value.error;
    return value.data;
  },
  serviceDb: () => ({ from: mocked.from, rpc: mocked.rpc }),
}));
import {
  createQuote,
  createReservedSession,
  sessionParameters,
  startCheckout,
  type Reservation,
} from '@/lib/server/checkout';
const address = {
  name: 'Test Shopper',
  street1: '417 Montgomery St',
  street2: '',
  city: 'San Francisco',
  state: 'CA',
  zip: '94104',
  country: 'US',
};
const reservation: Reservation = {
  id: 'reservation_fixture',
  quote_id: 'quote_fixture',
  rate_id: 'rate_ground',
  status: 'creating',
  items: [
    {
      variant_id: demoProducts[0].product_variants[0].id,
      product_id: demoProducts[0].id,
      name: 'Everyday Crew',
      sku: 'TF-OAT-M',
      size: 'M',
      color: 'Oat',
      unit_price_cents: 9800,
      quantity: 2,
      weight_oz: 12,
      image_url: '/images/knit-05.jpg',
    },
  ],
  subtotal_cents: 19600,
  discount_cents: 1000,
  shipping_cents: 815,
  shipping_service: {
    id: 'rate_ground',
    carrier: 'USPS',
    service: 'GroundAdvantage',
    amount_cents: 815,
    delivery_days: 4,
  },
  stripe_session_id: null,
  stripe_customer_id: null,
  session_url: null,
  expires_at: '2026-09-10T15:00:00Z',
  created_at: '2026-09-10T14:25:00Z',
};
let records: Record<string, unknown>;
let writes: { table: string; data: Record<string, unknown> }[];
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://store.example.com');
  vi.stubEnv('STRIPE_AUTOMATIC_TAX', 'true');
  records = {};
  writes = [];
  mocked.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      insert: (data: Record<string, unknown>) => {
        writes.push({ table, data });
        return query;
      },
      update: (data: Record<string, unknown>) => {
        writes.push({ table, data });
        return query;
      },
      single: () => Promise.resolve({ data: records[table], error: null }),
      maybeSingle: () => Promise.resolve({ data: records[table], error: null }),
      then: (resolve: (value: unknown) => void) =>
        Promise.resolve({ data: records[table], error: null }).then(resolve),
    };
    return query;
  });
  mocked.customer.mockResolvedValue({ id: 'cus_fixture' });
  mocked.coupon.mockResolvedValue({ id: 'coupon_fixture' });
  mocked.session.mockResolvedValue({
    id: 'cs_test_fixture',
    url: 'https://checkout.stripe.com/c/pay/fixture',
  });
});
afterEach(() => vi.unstubAllEnvs());
describe('Stripe Checkout creation', () => {
  it('uses immutable database prices, variants, one shipping service, and automatic tax', () => {
    const parameters = sessionParameters(reservation, 'cus_fixture', 'coupon_fixture');
    expect(parameters.line_items?.[0]).toMatchObject({
      quantity: 2,
      price_data: {
        unit_amount: 9800,
        currency: 'usd',
        product_data: {
          name: 'Everyday Crew · M / Oat',
          images: ['https://store.example.com/images/knit-05.jpg'],
        },
      },
    });
    expect(parameters.shipping_options).toHaveLength(1);
    expect(parameters.shipping_options?.[0].shipping_rate_data?.fixed_amount?.amount).toBe(815);
    expect(parameters.automatic_tax?.enabled).toBe(true);
    expect(parameters.discounts).toEqual([{ coupon: 'coupon_fixture' }]);
    expect(parameters.shipping_address_collection).toBeUndefined();
    expect(parameters.allow_promotion_codes).toBeUndefined();
    expect(parameters.payment_method_types).toEqual(['card']);
  });
  it('creates a fresh customer with verified shipping and stable retry keys', async () => {
    expect(
      await createReservedSession(reservation, { email: 'test@example.com', address }),
    ).toEqual({ url: 'https://checkout.stripe.com/c/pay/fixture' });
    expect(mocked.customer).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping: {
          name: address.name,
          address: expect.objectContaining({ line1: address.street1, postal_code: address.zip }),
        },
      }),
      { idempotencyKey: 'customer:reservation_fixture' },
    );
    expect(mocked.session).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_fixture',
        metadata: { reservation_id: reservation.id },
      }),
      { idempotencyKey: 'checkout:reservation_fixture' },
    );
    expect(writes.some((write) => write.data.stripe_session_id === 'cs_test_fixture')).toBe(true);
    expect(writes.every((write) => write.table === 'checkout_reservations')).toBe(true);
  });
  it('omits coupon creation for an undiscounted bag', async () => {
    await createReservedSession(
      { ...reservation, discount_cents: 0 },
      { email: 'test@example.com', address },
    );
    expect(mocked.coupon).not.toHaveBeenCalled();
  });
  it('does not release stock or create an order when Stripe times out', async () => {
    mocked.session.mockRejectedValue(new Error('timeout'));
    await expect(
      createReservedSession(reservation, { email: 'test@example.com', address }),
    ).rejects.toThrow('timeout');
    expect(mocked.rpc).not.toHaveBeenCalled();
    expect(writes.every((write) => write.table === 'checkout_reservations')).toBe(true);
    expect(writes.some((write) => write.data.status === 'expired')).toBe(false);
  });
  it('does not call Stripe when transaction rejects inventory reservation', async () => {
    records.checkout_quotes = { id: 'quote_fixture', email: 'test@example.com', address };
    mocked.rpc.mockResolvedValue({ data: null, error: { message: 'Insufficient inventory' } });
    await expect(startCheckout('secure-capability', 'rate_ground')).rejects.toMatchObject({
      status: 409,
    });
    expect(mocked.session).not.toHaveBeenCalled();
  });
  it('returns the same open session on a repeated checkout request', async () => {
    records.checkout_quotes = { id: 'quote_fixture', email: 'test@example.com', address };
    mocked.rpc.mockResolvedValue({
      data: { ...reservation, stripe_session_id: 'cs_test_fixture' },
      error: null,
    });
    mocked.retrieve.mockResolvedValue({
      status: 'open',
      url: 'https://checkout.stripe.com/c/pay/fixture',
    });
    await startCheckout('secure-capability', 'rate_ground');
    expect(mocked.retrieve).toHaveBeenCalledWith('cs_test_fixture');
    expect(mocked.session).not.toHaveBeenCalled();
  });
});
describe('authoritative shipping quote creation', () => {
  const input = {
    items: [{ variant_id: demoProducts[0].product_variants[0].id, quantity: 2 }],
    email: 'test@example.com',
    address,
  };
  beforeEach(() => {
    records.product_variants = [{ product_id: demoProducts[0].id }];
    records.products = [demoProducts[0]];
    records.store_settings = { free_shipping_threshold_cents: 20000 };
    mocked.verify.mockResolvedValue({ ...address, street1: '417 MONTGOMERY ST' });
    mocked.shipping.mockResolvedValue({ id: 'shp_fixture', rates: [reservation.shipping_service] });
  });
  it('persists server item snapshots and returns a hashed-capability quote', async () => {
    const result = await createQuote(input);
    expect(result.subtotal_cents).toBe(19600);
    expect(result.items[0].unit_price_cents).toBe(9800);
    expect(result.address.street1).toBe('417 MONTGOMERY ST');
    const write = writes.find((write) => write.table === 'checkout_quotes')!;
    expect(result.quote_id).toMatch(/^[a-f0-9]{64}$/);
    expect(write.data.token_hash).not.toBe(result.quote_id);
    expect(write.data.shipping_shipment_id).toBe('shp_fixture');
  });
  it('does not persist a made-up shipping quote after carrier failure', async () => {
    mocked.shipping.mockRejectedValue(new Error('carrier unavailable'));
    await expect(createQuote(input)).rejects.toThrow('carrier unavailable');
    expect(writes).toEqual([]);
  });
  it('offers complimentary cheapest carrier service only above configured threshold', async () => {
    records.store_settings = { free_shipping_threshold_cents: 19000 };
    expect((await createQuote(input)).rates[0].amount_cents).toBe(0);
    expect(mocked.shipping).toHaveBeenCalled();
  });
});
