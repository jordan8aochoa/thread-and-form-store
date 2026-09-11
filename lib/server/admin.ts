import 'server-only';
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const cents = z.number().int().min(0).max(100_000_000);
const safeUrl = z
  .string()
  .url()
  .max(2000)
  .refine((v) => v.startsWith('https://'), 'Use an HTTPS URL');
export const productImageUrl = z
  .string()
  .max(2000)
  .refine((v) => {
    if (/^\/images\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(v)) return true;
    try {
      const url = new URL(v);
      const supabase = new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unconfigured.invalid',
      );
      const allowedProtocol =
        url.protocol === 'https:' ||
        (process.env.NODE_ENV === 'development' &&
          url.protocol === 'http:' &&
          ['127.0.0.1', 'localhost'].includes(url.hostname));
      return (
        allowedProtocol &&
        url.origin === supabase.origin &&
        url.pathname.startsWith('/storage/v1/object/public/product-images/')
      );
    } catch {
      return false;
    }
  }, 'Upload an image to this store’s product-images bucket.');
export const variantSchema = z.object({
  id: z.string().uuid().optional(),
  size: text(30).min(1),
  color: text(60).min(1),
  sku: text(80)
    .min(1)
    .regex(/^[A-Za-z0-9_-]+$/),
  price_override_cents: cents.min(1).nullable(),
  inventory_quantity: z.number().int().min(0).max(1_000_000),
  weight_oz: z.number().positive().max(10000),
  active: z.boolean(),
});
export const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: text(180).min(1),
    slug: text(180)
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: text(10000).min(1),
    category: text(80).min(1),
    price_cents: cents.min(1),
    sale_price_cents: cents.min(1).nullable(),
    active: z.boolean(),
    featured: z.boolean(),
    seo_title: text(180),
    seo_description: text(320),
    variants: z.array(variantSchema).min(1).max(100),
    images: z
      .array(
        z.object({
          url: productImageUrl,
          alt: text(180),
          position: z.number().int().min(0).max(30),
        }),
      )
      .max(30),
  })
  .superRefine((p, ctx) => {
    if (p.sale_price_cents !== null && p.sale_price_cents >= p.price_cents)
      ctx.addIssue({
        code: 'custom',
        path: ['sale_price_cents'],
        message: 'Sale price must be less than the regular price.',
      });
    const skus = new Set<string>();
    const choices = new Set<string>();
    p.variants.forEach((v, i) => {
      const sku = v.sku.toLowerCase();
      const choice = `${v.size.toLowerCase()}:${v.color.toLowerCase()}`;
      if (skus.has(sku) || choices.has(choice))
        ctx.addIssue({
          code: 'custom',
          path: ['variants', i],
          message: 'Each variant needs a unique SKU and size/color combination.',
        });
      skus.add(sku);
      choices.add(choice);
    });
    if (p.active && !p.images.length)
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'Add a product image before publishing.',
      });
  });
export const inventorySchema = z.object({
  variant_id: z.string().uuid(),
  quantity_change: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((n) => n !== 0, 'Enter a nonzero adjustment.'),
  reason: text(500).min(3),
});
export const discountSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: text(40)
      .min(2)
      .regex(/^[A-Za-z0-9_-]+$/)
      .transform((v) => v.toUpperCase()),
    kind: z.enum(['percentage', 'fixed']),
    value: z.number().int().positive().max(100_000_000),
    minimum_subtotal_cents: cents,
    max_uses: z.number().int().positive().max(1_000_000).nullable(),
    starts_at: z.string().datetime().nullable(),
    ends_at: z.string().datetime().nullable(),
    active: z.boolean(),
  })
  .superRefine((d, c) => {
    if (d.kind === 'percentage' && d.value > 100)
      c.addIssue({ code: 'custom', path: ['value'], message: 'Percentage must be 1–100.' });
    if (d.starts_at && d.ends_at && d.starts_at >= d.ends_at)
      c.addIssue({
        code: 'custom',
        path: ['ends_at'],
        message: 'End date must be after start date.',
      });
  });
export const settingsSchema = z.object({
  brand_name: text(100).min(1),
  tagline: text(240),
  logo_url: productImageUrl.or(z.literal('')),
  support_email: z.string().email().max(254),
  owner_email: z.string().email().max(254),
  return_address: z.object({
    name: text(100).min(1),
    street1: text(150).min(1),
    street2: text(150),
    city: text(100).min(1),
    state: text(60).min(1),
    zip: text(20).min(1),
    country: z.string().regex(/^[A-Z]{2}$/),
    phone: text(30).optional(),
  }),
  free_shipping_threshold_cents: cents,
  announcement: text(300),
  social_links: z.record(z.string().max(40), safeUrl),
});
export const labelSchema = z.object({
  shipment_id: z.string().regex(/^shp_[A-Za-z0-9]+$/),
  rate_id: z.string().regex(/^rate_[A-Za-z0-9]+$/),
  confirmed: z.literal(true),
});
export const refundSchema = z.object({
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  restock: z.boolean(),
  confirmed: z.literal(true),
});
export const manualFulfillmentSchema = z.object({
  carrier: text(100).min(1),
  tracking_code: text(150).min(1),
  tracking_url: safeUrl,
  confirmed: z.literal(true),
});
export const deleteSchema = z.object({ confirmed: z.literal(true) });
export const uuid = z.string().uuid();

export function acceptedImage(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  if (contentType === 'image/webp')
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    );
  return false;
}
