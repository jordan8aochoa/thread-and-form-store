import { describe, it, expect } from 'vitest';
import { addCartLine, cartCount, cartSubtotal, setCartQuantity } from '@/lib/cart';
import type { CartLine } from '@/lib/types';
const line: CartLine = {
  variant_id: '20000000-0000-4000-8000-000000000100',
  product_id: '10000000-0000-4000-8000-000000000001',
  name: 'Everyday Crew',
  slug: 'everyday-crew',
  size: 'M',
  color: 'Oat',
  quantity: 2,
  available: 5,
  price_cents: 9800,
  image: '',
};
describe('persistent cart domain', () => {
  it('calculates integer-cent totals and counts', () => {
    expect(
      cartSubtotal([line, { ...line, variant_id: 'second', quantity: 1, price_cents: 8801 }]),
    ).toBe(28401);
    expect(cartCount([line])).toBe(2);
  });
  it('merges a variant and clamps additions to inventory', () => {
    const result = addCartLine([line], { ...line, quantity: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });
  it('enforces the per-line quantity limit', () =>
    expect(setCartQuantity([{ ...line, available: 200 }], line.variant_id, 40)[0].quantity).toBe(
      20,
    ));
  it('removes zero quantities and rejects invalid input', () => {
    expect(setCartQuantity([line], line.variant_id, 0)).toEqual([]);
    expect(setCartQuantity([line], line.variant_id, NaN)).toEqual([line]);
    expect(setCartQuantity([line], line.variant_id, -1)).toEqual([]);
  });
  it('refreshes display price and inventory when re-adding', () => {
    const result = addCartLine([line], { ...line, available: 3, price_cents: 10800 });
    expect(result[0]).toMatchObject({ quantity: 3, available: 3, price_cents: 10800 });
  });
  it('does not merge different variants', () =>
    expect(addCartLine([line], { ...line, variant_id: 'other' })).toHaveLength(2));
});
