import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getRates: vi.fn(),
  purchaseLabel: vi.fn(),
  manual: vi.fn(),
  refund: vi.fn(),
  rateLimit: vi.fn(),
  upload: vi.fn(),
  dispatch: vi.fn(),
}));
vi.mock('@/lib/server/auth', () => ({
  requireAdmin: mocks.requireAdmin,
  AuthorizationError: class AuthorizationError extends Error {
    status = 403;
  },
  serverAuth: async () => ({ auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut } }),
}));
vi.mock('@/lib/server/db', () => ({
  required: (key: string) => {
    if (!process.env[key]) throw new Error('Missing configuration');
    return process.env[key];
  },
  checked: <T>(value: { data: T; error: unknown }) => {
    if (value.error) throw value.error;
    return value.data;
  },
  serviceDb: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock('@/lib/server/http', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  rateLimit: mocks.rateLimit,
}));
vi.mock('@/lib/server/fulfillment', () => ({
  getOrderRates: mocks.getRates,
  purchaseOrderLabel: mocks.purchaseLabel,
  fulfillManually: mocks.manual,
  refundOrder: mocks.refund,
}));
vi.mock('@/lib/server/email', () => ({ dispatchEmails: mocks.dispatch }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn() }));
import { handleAdminRequest } from '@/lib/server/admin-api';
import { AuthorizationError } from '@/lib/server/auth';
import {
  acceptedImage,
  discountSchema,
  inventorySchema,
  productSchema,
  settingsSchema,
  variantSchema,
} from '@/lib/server/admin';

const id = '11111111-1111-4111-8111-111111111111';
const variant = {
  size: 'M',
  color: 'Oat',
  sku: 'CREW-OAT-M',
  price_override_cents: null,
  inventory_quantity: 12,
  weight_oz: 16,
  active: true,
};
const product = {
  name: 'The Everyday Crew',
  slug: 'everyday-crew',
  description: 'A considered everyday layer.',
  category: 'Sweaters',
  price_cents: 12800,
  sale_price_cents: null,
  active: true,
  featured: false,
  seo_title: '',
  seo_description: '',
  variants: [variant],
  images: [{ url: '/images/knit01.jpg', alt: 'Oat crewneck sweater', position: 0 }],
};
const discount = {
  code: 'warmth',
  kind: 'percentage',
  value: 10,
  minimum_subtotal_cents: 5000,
  max_uses: 100,
  starts_at: null,
  ends_at: null,
  active: true,
};
const storage = {
  upload: mocks.upload,
  getPublicUrl: () => ({
    data: {
      publicUrl: 'https://store.supabase.co/storage/v1/object/public/product-images/admin/test.png',
    },
  }),
};
function request(
  path: string,
  body: unknown = {},
  method = 'POST',
  origin = 'http://localhost:3006',
) {
  return handleAdminRequest(
    new Request(`http://localhost:3006/api/admin/${path}`, {
      method,
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    path.split('/'),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3006';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://store.supabase.co';
  mocks.requireAdmin.mockResolvedValue({
    user: { id },
    profile: { role: 'owner' },
    db: { rpc: mocks.rpc, from: mocks.from, storage: { from: () => storage } },
  });
  mocks.rpc.mockResolvedValue({ data: id, error: null });
  mocks.rateLimit.mockResolvedValue(undefined);
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.purchaseLabel.mockResolvedValue({ id: 'shp_fixture' });
  mocks.refund.mockResolvedValue({ id: 're_fixture', status: 'pending' });
  mocks.upload.mockResolvedValue({ data: { path: 'admin/test.png' }, error: null });
});

describe('admin input validation', () => {
  it('validates product and variant creation without trusting extra browser fields', () => {
    const parsed = productSchema.parse({ ...product, stripe_price_id: 'forged' });
    expect(parsed).not.toHaveProperty('stripe_price_id');
    expect(parsed.variants[0].inventory_quantity).toBe(12);
  });
  it('rejects invalid inventory, fractional cents, free overrides, and nonpositive weight', () => {
    expect(variantSchema.safeParse({ ...variant, inventory_quantity: -1 }).success).toBe(false);
    expect(variantSchema.safeParse({ ...variant, price_override_cents: 0 }).success).toBe(false);
    expect(variantSchema.safeParse({ ...variant, price_override_cents: 10.5 }).success).toBe(false);
    expect(variantSchema.safeParse({ ...variant, weight_oz: 0 }).success).toBe(false);
  });
  it('rejects duplicate variants and invalid sale prices before writing', () => {
    expect(
      productSchema.safeParse({ ...product, variants: [variant, { ...variant, sku: 'OTHER' }] })
        .success,
    ).toBe(false);
    expect(productSchema.safeParse({ ...product, sale_price_cents: 12800 }).success).toBe(false);
  });
  it('rejects an active product without an image', () => {
    expect(productSchema.safeParse({ ...product, images: [] }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, active: false, images: [] }).success).toBe(true);
  });
  it('only accepts local demo assets or images in this store’s storage bucket', () => {
    for (const url of [
      'https://attacker.example/photo.jpg',
      'javascript:alert(1)',
      '/images/../secret.png',
      'https://store.supabase.co.evil.test/storage/v1/object/public/product-images/a.png',
      'https://store.supabase.co/storage/v1/object/public/other/a.png',
    ])
      expect(
        productSchema.safeParse({ ...product, images: [{ url, alt: '', position: 0 }] }).success,
      ).toBe(false);
    expect(
      productSchema.safeParse({
        ...product,
        images: [
          {
            url: 'https://store.supabase.co/storage/v1/object/public/product-images/admin/a.png',
            alt: '',
            position: 0,
          },
        ],
      }).success,
    ).toBe(true);
  });
  it('validates discount limits and date ordering and protects the usage counter', () => {
    expect(discountSchema.parse({ ...discount, uses: 0 })).toEqual({ ...discount, code: 'WARMTH' });
    expect(discountSchema.safeParse({ ...discount, value: 101 }).success).toBe(false);
    expect(
      discountSchema.safeParse({
        ...discount,
        starts_at: '2026-10-01T00:00:00Z',
        ends_at: '2026-09-01T00:00:00Z',
      }).success,
    ).toBe(false);
  });
  it('requires an explained nonzero stock delta', () => {
    expect(
      inventorySchema.safeParse({ variant_id: id, quantity_change: 0, reason: 'Adjustment' })
        .success,
    ).toBe(false);
    expect(
      inventorySchema.safeParse({ variant_id: id, quantity_change: -2, reason: 'Damaged stock' })
        .success,
    ).toBe(true);
  });
  it('refuses executable and disguised product uploads', () => {
    expect(
      acceptedImage(new TextEncoder().encode('<svg onload="alert(1)"></svg>'), 'image/svg+xml'),
    ).toBe(false);
    expect(acceptedImage(new TextEncoder().encode('<html>not a PNG</html>'), 'image/png')).toBe(
      false,
    );
    expect(acceptedImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png')).toBe(
      true,
    );
  });
  it('requires HTTPS social URLs and a trusted logo in store settings', () => {
    const settings = {
      brand_name: 'Thread',
      tagline: '',
      logo_url: '',
      support_email: 'support@example.com',
      owner_email: 'owner@example.com',
      return_address: {
        name: 'Store',
        street1: '417 Montgomery St',
        street2: '',
        city: 'San Francisco',
        state: 'CA',
        zip: '94104',
        country: 'US',
      },
      free_shipping_threshold_cents: 15000,
      announcement: '',
      social_links: { instagram: 'https://www.instagram.com/store' },
    };
    expect(settingsSchema.safeParse(settings).success).toBe(true);
    expect(
      settingsSchema.safeParse({ ...settings, social_links: { instagram: 'javascript:alert(1)' } })
        .success,
    ).toBe(false);
  });
});
describe('admin authorization and mutation routes', () => {
  it('blocks a customer before any privileged mutation or shipping provider call', async () => {
    mocks.requireAdmin.mockRejectedValue(new AuthorizationError('Administrator access required.'));
    const response = await request('products', product);
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.purchaseLabel).not.toHaveBeenCalled();
  });
  it('rejects cross-origin administrative requests before authentication', async () => {
    const response = await request('products', product, 'POST', 'https://attacker.example');
    expect(response.status).toBe(403);
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
  });
  it('logs out an authenticated customer who tries to use admin login', async () => {
    mocks.requireAdmin.mockRejectedValue(new AuthorizationError('Not approved'));
    const response = await request('login', {
      email: 'guest@example.com',
      password: 'test-password',
    });
    expect(response.status).toBe(403);
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('creates a product and its variants/images through one transaction', async () => {
    const response = await request('products', product);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_product', {
      p_product: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        category: product.category,
        price_cents: 12800,
        sale_price_cents: null,
        active: true,
        featured: false,
        seo_title: '',
        seo_description: '',
      },
      p_variants: product.variants,
      p_images: product.images,
      p_admin_id: id,
    });
  });
  it('rejects invalid product data before invoking the transaction', async () => {
    const response = await request('products', {
      ...product,
      variants: [{ ...variant, weight_oz: -1 }],
    });
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('requires explicit confirmation for permanent deletion', async () => {
    expect((await request(`products/${id}`, {}, 'DELETE')).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await request(`products/${id}`, { confirmed: true }, 'DELETE')).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('delete_product', { p_product_id: id, p_admin_id: id });
  });
  it('records inventory changes through reservation-aware database adjustment', async () => {
    expect(
      (await request('inventory', { variant_id: id, quantity_change: -2, reason: 'Damaged stock' }))
        .status,
    ).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('adjust_inventory', {
      p_variant_id: id,
      p_quantity_change: -2,
      p_reason: 'Damaged stock',
      p_admin_id: id,
    });
  });
  it('never passes browser label prices to the shipping provider', async () => {
    expect(
      (
        await request(`orders/${id}/label`, {
          shipment_id: 'shp_fixture',
          rate_id: 'rate_fixture',
          confirmed: true,
          amount_cents: 1,
        })
      ).status,
    ).toBe(200);
    expect(mocks.purchaseLabel).toHaveBeenCalledExactlyOnceWith(
      id,
      'shp_fixture',
      'rate_fixture',
      id,
    );
  });
  it('requires confirmation before purchase and refund', async () => {
    expect(
      (await request(`orders/${id}/label`, { shipment_id: 'shp_fixture', rate_id: 'rate_fixture' }))
        .status,
    ).toBe(400);
    expect((await request(`orders/${id}/refund`, { restock: true })).status).toBe(400);
    expect(mocks.purchaseLabel).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it('submits refund intent without marking paid orders refunded in the API', async () => {
    const response = await request(`orders/${id}/refund`, {
      reason: 'requested_by_customer',
      restock: true,
      confirmed: true,
      amount_cents: 1,
    });
    expect(response.status).toBe(200);
    expect(mocks.refund).toHaveBeenCalledExactlyOnceWith(
      id,
      { reason: 'requested_by_customer', restock: true },
      id,
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects spoofed images before touching product storage', async () => {
    const form = new FormData();
    form.set('file', new File(['<svg onload="alert(1)"/>'], 'photo.png', { type: 'image/png' }));
    const response = await handleAdminRequest(
      new Request('http://localhost:3006/api/admin/upload', {
        method: 'POST',
        headers: { origin: 'http://localhost:3006' },
        body: form,
      }),
      ['upload'],
    );
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('returns a generated public path for valid admin product images', async () => {
    const form = new FormData();
    form.set(
      'file',
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'photo.png', {
        type: 'image/png',
      }),
    );
    const response = await handleAdminRequest(
      new Request('http://localhost:3006/api/admin/upload', {
        method: 'POST',
        headers: { origin: 'http://localhost:3006' },
        body: form,
      }),
      ['upload'],
    );
    expect(response.status).toBe(201);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect((await response.json()).url).toContain('/product-images/');
  });
});
