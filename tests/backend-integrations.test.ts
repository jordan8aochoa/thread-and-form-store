import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
const { single } = vi.hoisted(() => ({ single: vi.fn() }));
vi.mock('@/lib/server/db', () => ({
  requiredData: <T>(value: { data: T; error: unknown }) => {
    if (value.error) throw value.error;
    if (value.data == null) throw new Error('Missing record');
    return value.data;
  },
  required: (key: string) => {
    if (!process.env[key]) throw new Error('Missing configuration');
    return process.env[key];
  },
  checked: <T>(value: { data: T; error: unknown }) => {
    if (value.error) throw value.error;
    return value.data;
  },
  serviceDb: () => ({ from: () => ({ select: () => ({ eq: () => ({ single }) }) }) }),
}));
import {
  buyLabel,
  quoteShipment,
  verifyAddress,
  verifyEasyPostWebhook,
} from '@/lib/server/shipping';
import { renderEmail } from '@/lib/server/email';
const address = {
  name: 'Test Shopper',
  street1: '417 Montgomery St',
  street2: '',
  city: 'San Francisco',
  state: 'CA',
  zip: '94104',
  country: 'US',
};
const shipment = {
  id: 'shp_fixture',
  mode: 'test',
  rates: [
    {
      id: 'rate_ground',
      carrier: 'USPS',
      service: 'GroundAdvantage',
      rate: '8.15',
      currency: 'USD',
      delivery_days: 4,
    },
    {
      id: 'rate_priority',
      carrier: 'USPS',
      service: 'Priority',
      rate: '11.20',
      currency: 'USD',
      delivery_days: 2,
    },
  ],
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.stubEnv('EASYPOST_API_KEY', 'EZTK_fixture');
  vi.stubEnv('EASYPOST_MODE', 'test');
  vi.stubEnv('COMMERCE_MODE', 'test');
  vi.stubEnv('EASYPOST_WEBHOOK_SECRET', 'webhook-fixture');
  single.mockResolvedValue({ data: { return_address: address }, error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const respond = (value: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(Response.json(value, { status }));
describe('EasyPost test-mode integration contracts', () => {
  it('requests strict verification and returns the normalized provider address', async () => {
    respond({
      ...address,
      street1: '417 MONTGOMERY ST',
      verifications: { delivery: { success: true } },
    });
    expect(await verifyAddress(address)).toMatchObject({ street1: '417 MONTGOMERY ST' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ address, verify_strict: true });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      `Basic ${Buffer.from('EZTK_fixture:').toString('base64')}`,
    );
  });
  it('rejects unverified addresses and provider failures without invented rates', async () => {
    respond({ ...address, verifications: { delivery: { success: false } } });
    await expect(verifyAddress(address)).rejects.toThrow('verify');
    respond({ error: { message: 'provider-private-data' } }, 422);
    await expect(quoteShipment({ address, weight_oz: 12 })).rejects.toMatchObject({ status: 503 });
  });
  it('uses live provider rates, weight plus packaging, and PDF label format', async () => {
    respond(shipment);
    expect(await quoteShipment({ address, weight_oz: 14 })).toEqual({
      id: 'shp_fixture',
      rates: [
        {
          id: 'rate_ground',
          carrier: 'USPS',
          service: 'GroundAdvantage',
          amount_cents: 815,
          delivery_days: 4,
        },
        {
          id: 'rate_priority',
          carrier: 'USPS',
          service: 'Priority',
          amount_cents: 1120,
          delivery_days: 2,
        },
      ],
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).shipment).toMatchObject({
      parcel: { weight: 16 },
      options: { label_format: 'PDF' },
    });
  });
  it('fails clearly when the carrier supplies no usable rates', async () => {
    respond({ ...shipment, rates: [] });
    await expect(quoteShipment({ address, weight_oz: 12 })).rejects.toMatchObject({ status: 503 });
  });
  it('retrieves before purchase and purchases only a rate on that shipment', async () => {
    respond(shipment);
    respond({ ...shipment, postage_label: { label_url: 'https://labels.example/test.pdf' } });
    const result = await buyLabel('shp_fixture', 'rate_ground');
    expect(result.postage_label?.label_url).toContain('test.pdf');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.easypost.com/v2/shipments/shp_fixture/buy',
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ rate: { id: 'rate_ground' } });
  });
  it('recovers a previously purchased label without buying again', async () => {
    respond({ ...shipment, postage_label: { label_url: 'https://labels.example/existing.pdf' } });
    await buyLabel('shp_fixture', 'rate_ground');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects a rate belonging to another shipment', async () => {
    respond(shipment);
    await expect(buyLabel('shp_fixture', 'rate_other')).rejects.toThrow('rate');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('never buys production postage while commerce is in test mode', async () => {
    vi.stubEnv('EASYPOST_MODE', 'production');
    respond({ ...shipment, mode: 'production' });
    await expect(buyLabel('shp_fixture', 'rate_ground')).rejects.toThrow('Live postage disabled');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
  it('verifies the raw body HMAC and rejects tampered or missing signatures', () => {
    const raw = JSON.stringify({ id: 'evt_fixture', description: 'tracker.updated' });
    const signature = `hmac-sha256-hex=${createHmac('sha256', 'webhook-fixture').update(raw).digest('hex')}`;
    expect(() => verifyEasyPostWebhook(raw, signature)).not.toThrow();
    expect(() => verifyEasyPostWebhook(`${raw} `, signature)).toThrow();
    expect(() => verifyEasyPostWebhook(raw, null)).toThrow();
  });
});
describe('professional notification templates', () => {
  it('escapes untrusted product/customer text and excludes script URLs', () => {
    const message = renderEmail(
      'order_confirmation',
      {
        message: '<script>unsafe</script>',
        order_number: 'TF-1001',
        url: 'javascript:alert(1)',
        items: [{ name: '<img onerror="unsafe">', quantity: 1 }],
      },
      'Thread & Form',
    );
    expect(message.html).not.toContain('<script>');
    expect(message.html).not.toContain('<img');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).not.toContain('javascript:');
    expect(message.text).toContain('TF-1001');
    expect(message.subject).toContain('TF-1001');
  });
  it('renders tracking links and totals in HTML and plain text', () => {
    const message = renderEmail('shipping_confirmation', {
      url: 'https://track.example/order?a=1&b=2',
      amount_cents: 9800,
    });
    expect(message.html).toContain('a=1&amp;b=2');
    expect(message.text).toContain('$98.00');
  });
});
