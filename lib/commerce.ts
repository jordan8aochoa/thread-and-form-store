import { z } from 'zod';
import type { CartInput, Product, Variant } from './types';

export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  street1: z.string().trim().min(3).max(150),
  street2: z.string().trim().max(100).default(''),
  city: z.string().trim().min(2).max(80),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase()),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.literal('US'),
  phone: z.string().trim().max(30).optional(),
});
export const cartSchema = z
  .array(
    z.object({ variant_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) }).strict(),
  )
  .min(1)
  .max(30)
  .refine(
    (items) => new Set(items.map((i) => i.variant_id)).size === items.length,
    'Choose each variant only once.',
  );
export const checkoutSchema = z
  .object({
    items: cartSchema,
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    address: addressSchema,
    discount_code: z.string().trim().max(40).optional(),
  })
  .strict();
export type SnapshotItem = {
  variant_id: string;
  product_id: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  unit_price_cents: number;
  quantity: number;
  weight_oz: number;
  image_url: string | null;
};
export type DiscountRecord = {
  id: string;
  code: string;
  kind: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  minimum_subtotal_cents: number;
  max_uses: number | null;
  uses: number;
};
export function effectivePrice(
  product: Pick<Product, 'price_cents' | 'sale_price_cents'>,
  variant: Pick<Variant, 'price_override_cents'>,
): number {
  return variant.price_override_cents ?? product.sale_price_cents ?? product.price_cents;
}
export function calculateCart(items: CartInput[], products: Product[]) {
  const snapshots = items.map((item) => {
    const product = products.find(
      (p) => p.active && p.product_variants.some((v) => v.id === item.variant_id),
    );
    const variant = product?.product_variants.find((v) => v.id === item.variant_id && v.active);
    if (!product || !variant)
      throw new Error('An item is no longer available. Please update your bag.');
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > Math.min(20, variant.inventory_quantity)
    )
      throw new Error('An item exceeds available inventory. Please update your bag.');
    return {
      variant_id: variant.id,
      product_id: product.id,
      name: product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      unit_price_cents: effectivePrice(product, variant),
      quantity: item.quantity,
      weight_oz: variant.weight_oz,
      image_url: product.product_images[0]?.url ?? null,
    } satisfies SnapshotItem;
  });
  return {
    items: snapshots,
    subtotal_cents: snapshots.reduce((n, i) => n + i.unit_price_cents * i.quantity, 0),
    weight_oz: snapshots.reduce((n, i) => n + i.weight_oz * i.quantity, 0),
  };
}
export function calculateDiscount(
  discount: DiscountRecord | null,
  subtotal: number,
  now = new Date(),
): number {
  if (!discount) return 0;
  if (
    !discount.active ||
    (discount.starts_at && new Date(discount.starts_at) > now) ||
    (discount.ends_at && new Date(discount.ends_at) <= now) ||
    subtotal < discount.minimum_subtotal_cents ||
    (discount.max_uses !== null && discount.uses >= discount.max_uses)
  )
    throw new Error('This discount is unavailable for your bag.');
  return Math.min(
    subtotal,
    discount.kind === 'percentage' ? Math.floor((subtotal * discount.value) / 100) : discount.value,
  );
}
export function cents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Invalid currency amount.');
  return Math.round(Number(value) * 100);
}
