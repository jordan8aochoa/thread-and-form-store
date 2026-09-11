import { describe, expect, it } from 'vitest';
import {
  calculateCart,
  calculateDiscount,
  cents,
  checkoutSchema,
  effectivePrice,
  type DiscountRecord,
} from '@/lib/commerce';
import { demoProducts } from '@/lib/demo';
import { serializeJsonLd } from '@/lib/seo';

const product = demoProducts[0];
const variant = product.product_variants[0];
const item = { variant_id: variant.id, quantity: 2 };
const discount: DiscountRecord = {
  id: '10000000-0000-4000-8000-000000000999',
  code: 'WELCOME',
  kind: 'percentage',
  value: 10,
  active: true,
  starts_at: null,
  ends_at: null,
  minimum_subtotal_cents: 5000,
  max_uses: 10,
  uses: 0,
};
describe('authoritative commerce', () => {
  it('uses variant override, then sale price, then regular price', () => {
    expect(
      effectivePrice({ price_cents: 9800, sale_price_cents: 8800 }, { price_override_cents: 7500 }),
    ).toBe(7500);
    expect(
      effectivePrice({ price_cents: 9800, sale_price_cents: 8800 }, { price_override_cents: null }),
    ).toBe(8800);
    expect(
      effectivePrice({ price_cents: 9800, sale_price_cents: null }, { price_override_cents: null }),
    ).toBe(9800);
  });
  it('builds durable item snapshots and parcel weight from database records', () => {
    const result = calculateCart([item], [product]);
    expect(result.subtotal_cents).toBe(effectivePrice(product, variant) * 2);
    expect(result.weight_oz).toBe(variant.weight_oz * 2);
    expect(result.items[0]).toMatchObject({
      name: product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      quantity: 2,
    });
  });
  it('ignores injected browser prices in the domain calculation', () => {
    const injected = { ...item, unit_price_cents: 1, price_cents: 1, name: 'Forged' };
    expect(calculateCart([injected], [product]).items[0].unit_price_cents).toBe(
      effectivePrice(product, variant),
    );
  });
  it.each([0, -1, 1.5, 21, NaN])('rejects invalid quantity %s', (quantity) => {
    expect(() => calculateCart([{ ...item, quantity }], [product])).toThrow();
  });
  it('rejects stock shortages, inactive products, and inactive variants', () => {
    expect(() =>
      calculateCart(
        [item],
        [{ ...product, product_variants: [{ ...variant, inventory_quantity: 1 }] }],
      ),
    ).toThrow();
    expect(() => calculateCart([item], [{ ...product, active: false }])).toThrow();
    expect(() =>
      calculateCart([item], [{ ...product, product_variants: [{ ...variant, active: false }] }]),
    ).toThrow();
  });
  it('rejects a missing variant', () => {
    expect(() => calculateCart([{ variant_id: 'missing', quantity: 1 }], [product])).toThrow();
  });
  it('bounds fixed discounts to subtotal and rounds percentage discounts down to cents', () => {
    expect(calculateDiscount(discount, 9999)).toBe(999);
    expect(calculateDiscount({ ...discount, kind: 'fixed', value: 20000 }, 9800)).toBe(9800);
    expect(calculateDiscount(null, 9800)).toBe(0);
  });
  it.each([
    { active: false },
    { minimum_subtotal_cents: 20000 },
    { uses: 10 },
    { starts_at: '2030-01-01T00:00:00Z' },
    { ends_at: '2020-01-01T00:00:00Z' },
  ])('rejects unavailable discount %j', (change) => {
    expect(() =>
      calculateDiscount({ ...discount, ...change }, 9800, new Date('2026-09-10')),
    ).toThrow();
  });
  it('parses carrier money as integer cents and rejects ambiguous formats', () => {
    expect(cents('12.34')).toBe(1234);
    expect(cents('0')).toBe(0);
    for (const value of ['-1', '12.345', 'NaN', '1e3', '$3']) expect(() => cents(value)).toThrow();
  });
});
describe('checkout trust boundary', () => {
  const input = {
    items: [item],
    email: 'CUSTOMER@example.com',
    address: {
      name: 'Test Shopper',
      street1: '417 Montgomery St',
      city: 'San Francisco',
      state: 'ca',
      zip: '94104',
      country: 'US',
    },
  };
  it('normalizes valid guest information', () => {
    expect(checkoutSchema.parse(input)).toMatchObject({
      email: 'customer@example.com',
      address: { state: 'CA', street2: '' },
    });
  });
  it('rejects duplicate variants and extra browser totals', () => {
    expect(checkoutSchema.safeParse({ ...input, items: [item, item] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...input, total_cents: 1 }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...input, items: [{ ...item, price_cents: 1 }] }).success,
    ).toBe(false);
  });
  it('limits the initial shipping territory to US addresses', () => {
    expect(
      checkoutSchema.safeParse({ ...input, address: { ...input.address, country: 'CA' } }).success,
    ).toBe(false);
  });
});
it('escapes product text before embedding structured data in a script', () => {
  const value = { name: '</script><script>alert(1)</script>' };
  const serialized = serializeJsonLd(value);
  expect(serialized).not.toContain('<');
  expect(JSON.parse(serialized)).toEqual(value);
});
