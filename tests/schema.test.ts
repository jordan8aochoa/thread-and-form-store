import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

let db: PGlite;
const productId = '10000000-0000-4000-8000-000000000001';
const variantId = '20000000-0000-4000-8000-000000000001';
const adminId = '30000000-0000-4000-8000-000000000001';
const customerId = '30000000-0000-4000-8000-000000000002';
const discountId = '40000000-0000-4000-8000-000000000001';
const item = {
  variant_id: variantId,
  product_id: productId,
  name: 'Original sweater',
  sku: 'TF-M-OAT',
  size: 'M',
  color: 'Oat',
  unit_price_cents: 10000,
  quantity: 2,
  weight_oz: 18,
  image_url: '/images/knit-05.jpg',
};
type Reservation = {
  id: string;
  status: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
};

async function count(table: string) {
  return Number(
    (await db.query<{ n: string }>(`select count(*) as n from public.${table}`)).rows[0].n,
  );
}
async function stock() {
  return (
    await db.query<{ inventory_quantity: number }>(
      'select inventory_quantity from public.product_variants where id=$1',
      [variantId],
    )
  ).rows[0].inventory_quantity;
}
async function quote(quantity = 2, discount = false) {
  const snapshot = { ...item, quantity };
  const result = await db.query<{ id: string }>(
    `insert into public.checkout_quotes(token_hash,email,address,items,subtotal_cents,discount_id,discount_cents,shipping_shipment_id,rates) values(gen_random_uuid()::text,'customer@example.com',$1,$2,$3,$4,$5,'shp_test',$6) returning id`,
    [
      JSON.stringify({
        name: 'Test Customer',
        street1: '417 Montgomery St',
        street2: '',
        city: 'San Francisco',
        state: 'CA',
        zip: '94104',
        country: 'US',
      }),
      JSON.stringify([snapshot]),
      10000 * quantity,
      discount ? discountId : null,
      discount ? 1000 : 0,
      JSON.stringify([
        { id: 'rate_test', carrier: 'USPS', service: 'GroundAdvantage', amount_cents: 800 },
      ]),
    ],
  );
  return result.rows[0].id;
}
async function reserve(quoteId: string) {
  return (
    await db.query<{ value: Reservation }>('select public.reserve_checkout($1,$2) as value', [
      quoteId,
      'rate_test',
    ])
  ).rows[0].value;
}
async function finalize(
  reservation: Reservation,
  event = 'evt_paid',
  session = 'cs_test_paid',
  total = reservation.subtotal_cents - reservation.discount_cents + 800,
) {
  return (
    await db.query<{ id: string }>(
      'select public.finalize_checkout($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as id',
      [
        event,
        'checkout.session.completed',
        reservation.id,
        session,
        `pi_${session}`,
        'cus_test',
        reservation.subtotal_cents,
        reservation.discount_cents,
        800,
        0,
        total,
      ],
    )
  ).rows[0].id;
}
async function asRole(
  role: 'anon' | 'authenticated',
  userId: string | null,
  operation: () => Promise<unknown>,
) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId ?? '']);
  try {
    return await operation();
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
    create table public.unrelated_feature(id integer); grant select on public.unrelated_feature to anon;
    create function public.unrelated_function() returns integer language sql as $$ select 1 $$;`);
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20260910022710_commerce_schema.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        '../supabase/migrations/20260910141043_admin_product_management.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20260910141334_fulfillment_ops.sql', import.meta.url),
      'utf8',
    ),
  );
}, 30000);
beforeEach(async () => {
  await db.exec(`truncate public.admin_profiles, public.products, public.customers, public.discounts, public.store_settings, public.checkout_quotes, public.email_outbox, public.webhook_events, public.rate_limits, auth.users restart identity cascade;
    insert into auth.users values ('${adminId}'),('${customerId}');
    insert into public.admin_profiles(id,role) values('${adminId}','owner');
    insert into public.products(id,name,slug,description,price_cents,active) values('${productId}','Original sweater','original-sweater','A sweater',10000,true);
    insert into public.product_variants(id,product_id,size,color,sku,inventory_quantity,weight_oz) values('${variantId}','${productId}','M','Oat','TF-M-OAT',5,18);
    insert into public.product_images(product_id,url,alt) values('${productId}','/images/knit-05.jpg','Oat sweater');
    insert into public.discounts(id,code,kind,value,max_uses) values('${discountId}','ONCE','fixed',1000,1);`);
});
afterAll(async () => {
  await db?.close();
});

describe('PostgreSQL reservation and payment transactions', () => {
  it('reserves without decrementing physical stock and makes a repeated quote idempotent', async () => {
    const q = await quote();
    const r = await reserve(q);
    expect((await reserve(q)).id).toBe(r.id);
    expect(await stock()).toBe(5);
    expect(await count('checkout_reservations')).toBe(1);
  });
  it('serializes competing reservations so the last units cannot be oversold', async () => {
    const quotes = await Promise.all([quote(3), quote(3)]);
    const result = await Promise.allSettled(quotes.map(reserve));
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(result.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await count('checkout_reservations')).toBe(1);
  });
  it('rechecks current database prices and selected rates before holding inventory', async () => {
    const q = await quote();
    await db.query('update public.products set price_cents=11000 where id=$1', [productId]);
    await expect(reserve(q)).rejects.toThrow('Product changed');
    await expect(
      db.query('select public.reserve_checkout($1,$2)', [q, 'rate_browser_invention']),
    ).rejects.toThrow('Invalid shipping rate');
    expect(await count('checkout_reservations')).toBe(0);
  });
  it('caps discount redemptions across pending checkouts', async () => {
    await reserve(await quote(1, true));
    await expect(reserve(await quote(1, true))).rejects.toThrow('Discount unavailable');
  });
  it('creates one paid order, preserves snapshots, and consumes stock exactly once on duplicate events', async () => {
    const r = await reserve(await quote(2, true));
    await db.query("update public.products set name='Renamed sweater' where id=$1", [productId]);
    const id = await finalize(r);
    expect(await finalize(r)).toBe(id);
    expect(await finalize(r, 'evt_second_delivery')).toBe(id);
    expect(await stock()).toBe(3);
    expect(await count('orders')).toBe(1);
    expect(await count('payments')).toBe(1);
    expect(await count('inventory_adjustments')).toBe(1);
    expect(
      (await db.query<{ name: string }>('select name from public.order_items')).rows[0].name,
    ).toBe('Original sweater');
    expect(
      (
        await db.query<{ uses: number }>('select uses from public.discounts where id=$1', [
          discountId,
        ])
      ).rows[0].uses,
    ).toBe(1);
    expect(await count('email_outbox')).toBe(3);
  });
  it('rolls back all order side effects when confirmed totals do not match the reservation', async () => {
    const r = await reserve(await quote());
    await expect(finalize(r, 'evt_bad_amount', 'cs_bad_amount', 1)).rejects.toThrow(
      'Payment amount mismatch',
    );
    expect(await stock()).toBe(5);
    expect(await count('orders')).toBe(0);
    expect(await count('webhook_events')).toBe(0);
    expect(await count('email_outbox')).toBe(0);
  });
  it('refuses finalization against a different Stripe session', async () => {
    const r = await reserve(await quote());
    await db.query(
      "update public.checkout_reservations set stripe_session_id='cs_original' where id=$1",
      [r.id],
    );
    await expect(finalize(r)).rejects.toThrow('Session mismatch');
    expect(await count('orders')).toBe(0);
  });
  it('releases only the matching confirmed expired session and prevents reducing reserved stock', async () => {
    const r = await reserve(await quote(4));
    await db.query(
      "update public.checkout_reservations set stripe_session_id='cs_held' where id=$1",
      [r.id],
    );
    await expect(
      db.query('select public.adjust_inventory($1,-2,$2,$3)', [
        variantId,
        'Count correction',
        adminId,
      ]),
    ).rejects.toThrow('Inventory is reserved');
    await db.query('select public.expire_reservation($1,$2)', [r.id, 'cs_wrong']);
    await expect(reserve(await quote(2))).rejects.toThrow('Insufficient inventory');
    await db.query('select public.expire_reservation($1,$2)', [r.id, 'cs_held']);
    await expect(reserve(await quote(2))).resolves.toHaveProperty('id');
  });
});

describe('PostgreSQL refund and notification safety', () => {
  it('restocks an authorized successful full refund once and never regresses success on a stale event', async () => {
    const r = await reserve(await quote());
    const order = await finalize(r);
    await db.query(
      'insert into public.refund_requests(order_id,admin_id,restock) values($1,$2,true)',
      [order, adminId],
    );
    await db.query(
      "select public.apply_refund('evt_refund_pending','re_test','pi_cs_test_paid',20800,'pending')",
    );
    expect(await stock()).toBe(3);
    for (const status of ['succeeded', 'succeeded', 'pending', 'failed']) {
      await db.query('select public.apply_refund($1,$2,$3,$4,$5)', [
        `evt_refund_${status}`,
        're_test',
        'pi_cs_test_paid',
        20800,
        status,
      ]);
      expect(await stock()).toBe(5);
    }
    expect(await stock()).toBe(5);
    expect(
      (await db.query<{ status: string }>('select status from public.refunds')).rows[0].status,
    ).toBe('succeeded');
    expect(
      (
        await db.query<{ refunded_cents: number; inventory_restored: boolean }>(
          'select refunded_cents,inventory_restored from public.orders',
        )
      ).rows[0],
    ).toEqual({ refunded_cents: 20800, inventory_restored: true });
    expect(await count('inventory_adjustments')).toBe(2);
  });
  it('does not restock partial refunds or full refunds lacking restock authorization', async () => {
    const r = await reserve(await quote());
    await finalize(r);
    await db.query(
      "select public.apply_refund('evt_part','re_part','pi_cs_test_paid',10000,'succeeded')",
    );
    expect(await stock()).toBe(3);
    await db.query(
      "select public.apply_refund('evt_rest','re_rest','pi_cs_test_paid',10800,'succeeded')",
    );
    expect(await stock()).toBe(3);
  });
  it('rejects refund identity reuse with a different amount', async () => {
    await finalize(await reserve(await quote()));
    await db.query(
      "select public.apply_refund('evt_part','re_part','pi_cs_test_paid',10000,'pending')",
    );
    await expect(
      db.query(
        "select public.apply_refund('evt_conflict','re_part','pi_cs_test_paid',10001,'succeeded')",
      ),
    ).rejects.toThrow('Refund identity mismatch');
    expect(
      (await db.query<{ refunded_cents: number }>('select refunded_cents from public.orders'))
        .rows[0].refunded_cents,
    ).toBe(0);
  });
  it('claims each notification once until its lease expires', async () => {
    await finalize(await reserve(await quote()));
    const first = await db.query('select * from public.claim_emails(50)');
    expect(first.rows).toHaveLength(3);
    expect((await db.query('select * from public.claim_emails(50)')).rows).toHaveLength(0);
    await db.exec("update public.email_outbox set lease_until=now()-interval '1 second'");
    expect((await db.query('select * from public.claim_emails(50)')).rows).toHaveLength(3);
  });
});

describe('PostgreSQL product management transactions', () => {
  const product = {
    name: 'New cardigan',
    slug: 'new-cardigan',
    description: 'A textured cardigan',
    category: 'Cardigans',
    price_cents: 14000,
    sale_price_cents: null,
    active: true,
    featured: false,
    seo_title: 'New cardigan',
    seo_description: 'Everyday knitwear',
  };
  const variant = {
    size: 'L',
    color: 'Moss',
    sku: 'NEW-L-MOSS',
    price_override_cents: null,
    inventory_quantity: 7,
    weight_oz: 20,
    active: true,
  };
  const images = [
    { url: '/images/knit-05.jpg', alt: 'Front', position: 0 },
    { url: '/images/knit-06.jpg', alt: 'Detail', position: 1 },
  ];
  async function save(
    p = product,
    variants: Record<string, unknown>[] = [variant],
    user = adminId,
  ) {
    return (
      await db.query<{ id: string }>('select public.save_product($1,$2,$3,$4) id', [
        JSON.stringify(p),
        JSON.stringify(variants),
        JSON.stringify(images),
        user,
      ])
    ).rows[0].id;
  }
  it('creates a product, variants, image ordering, and opening-stock history atomically', async () => {
    const id = await save();
    expect(
      (
        await db.query<{ inventory_quantity: number }>(
          'select inventory_quantity from public.product_variants where product_id=$1',
          [id],
        )
      ).rows[0].inventory_quantity,
    ).toBe(7);
    expect(
      (
        await db.query<{ alt: string }>(
          'select alt from public.product_images where product_id=$1 order by position',
          [id],
        )
      ).rows.map((x) => x.alt),
    ).toEqual(['Front', 'Detail']);
    expect(
      (
        await db.query<{ reason: string; quantity_change: number }>(
          'select reason,quantity_change from public.inventory_adjustments',
        )
      ).rows,
    ).toEqual([{ reason: 'Opening inventory', quantity_change: 7 }]);
  });
  it('rolls back product creation when variants violate a unique SKU constraint', async () => {
    await expect(save(product, [variant, { ...variant, size: 'XL' }])).rejects.toThrow(
      /duplicate key/,
    );
    expect(await count('products')).toBe(1);
    expect(await count('product_variants')).toBe(1);
    expect(await count('inventory_adjustments')).toBe(0);
  });
  it('rejects a supplied inactive or ordinary user as product administrator', async () => {
    await expect(save(product, [variant], customerId)).rejects.toThrow('Administrator required');
    await db.query('update public.admin_profiles set active=false where id=$1', [adminId]);
    await expect(save()).rejects.toThrow('Administrator required');
    expect(await count('products')).toBe(1);
  });
  it('preserves existing stock during product edits, archives omitted variants, and rejects cross-product variants', async () => {
    const id = await save();
    const savedVariant = (
      await db.query<{ id: string }>('select id from public.product_variants where product_id=$1', [
        id,
      ])
    ).rows[0].id;
    await save({ ...product, id, name: 'Edited cardigan' } as typeof product, [
      { ...variant, id: savedVariant, inventory_quantity: 999 },
    ]);
    expect(
      (
        await db.query<{ inventory_quantity: number }>(
          'select inventory_quantity from public.product_variants where id=$1',
          [savedVariant],
        )
      ).rows[0].inventory_quantity,
    ).toBe(7);
    await expect(
      save({ ...product, id } as typeof product, [{ ...variant, id: variantId }]),
    ).rejects.toThrow('Variant does not belong');
    await save({ ...product, id } as typeof product, [
      { ...variant, sku: 'NEW-XL-MOSS', size: 'XL' },
    ]);
    expect(
      (
        await db.query<{ active: boolean }>(
          'select active from public.product_variants where id=$1',
          [savedVariant],
        )
      ).rows[0].active,
    ).toBe(false);
  });
  it('blocks deleting reserved products and preserves paid order snapshots after allowed deletion', async () => {
    const r = await reserve(await quote());
    await expect(
      db.query('select public.delete_product($1,$2)', [productId, adminId]),
    ).rejects.toThrow('Product is reserved');
    await finalize(r);
    await db.query('select public.delete_product($1,$2)', [productId, adminId]);
    expect(await count('products')).toBe(0);
    expect(
      (
        await db.query<{ name: string; product_id: null; variant_id: null }>(
          'select name,product_id,variant_id from public.order_items',
        )
      ).rows[0],
    ).toEqual({ name: 'Original sweater', product_id: null, variant_id: null });
  });
});

describe('PostgreSQL actual role permissions and RLS', () => {
  it('keeps existing unrelated table/function permissions unchanged', async () => {
    await asRole('anon', null, async () => {
      await expect(db.query('select * from public.unrelated_feature')).resolves.toHaveProperty(
        'rows',
      );
      expect(
        (await db.query<{ n: number }>('select public.unrelated_function() n')).rows[0].n,
      ).toBe(1);
    });
  });
  it('lets the public read only active products, their images, and active variants', async () => {
    await asRole('anon', null, async () => {
      expect(await count('products')).toBe(1);
      expect(await count('product_variants')).toBe(1);
      expect(await count('product_images')).toBe(1);
    });
    await db.exec('update public.products set active=false');
    await asRole('anon', null, async () => {
      expect(await count('products')).toBe(0);
      expect(await count('product_variants')).toBe(0);
      expect(await count('product_images')).toBe(0);
    });
  });
  it('denies anonymous customer/order data and all service transaction functions', async () => {
    await asRole('anon', null, async () => {
      for (const table of [
        'orders',
        'customers',
        'addresses',
        'payments',
        'checkout_quotes',
        'email_outbox',
        'newsletter_subscribers',
      ])
        await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
          /permission denied/,
        );
      await expect(
        db.query('select public.reserve_checkout($1,$2)', [productId, 'rate_test']),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query('select public.claim_emails(1)')).rejects.toThrow(/permission denied/);
      await expect(
        db.query('select public.save_product($1,$2,$3,$4)', ['{}', '[]', '[]', adminId]),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it('does not mistake an ordinary authenticated user for an administrator', async () => {
    await finalize(await reserve(await quote()));
    await asRole('authenticated', customerId, async () => {
      expect(await count('orders')).toBe(0);
      await expect(
        db.query(
          "insert into public.products(name,slug,price_cents) values('Intrusion','intrusion',1)",
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        db.query('select public.adjust_inventory($1,1,$2,$3)', [
          variantId,
          'Unauthorized change',
          customerId,
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("insert into public.admin_profiles(id,role) values($1,'owner')", [customerId]),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it('allows active administrators, and revocation immediately removes row access', async () => {
    await finalize(await reserve(await quote()));
    await asRole('authenticated', adminId, async () => {
      expect(await count('orders')).toBe(1);
      await db.query("update public.products set name='Admin update' where id=$1", [productId]);
    });
    await db.query('update public.admin_profiles set active=false where id=$1', [adminId]);
    await asRole('authenticated', adminId, async () => {
      expect(await count('orders')).toBe(0);
    });
  });
});

describe('PostgreSQL shipping and tracking transactions', () => {
  const shipment = {
    easypost_shipment_id: 'shp_label',
    easypost_tracker_id: 'trk_label',
    label_url: 'https://example.com/label.pdf',
    carrier: 'USPS',
    service: 'GroundAdvantage',
    postage_cents: 800,
    tracking_code: 'EZ1000000001',
    tracking_url: 'https://track.easypost.com/test',
  };
  async function labelQuote(orderId: string) {
    await db.query(
      'insert into public.shipping_quotes(order_id,easypost_shipment_id,rates) values($1,$2,$3)',
      [
        orderId,
        'shp_label',
        JSON.stringify([
          { id: 'rate_label', carrier: 'USPS', service: 'GroundAdvantage', amount_cents: 800 },
        ]),
      ],
    );
  }
  it('binds a label purchase to the order quote and prevents simultaneous purchases/refunds', async () => {
    const order = await finalize(await reserve(await quote()));
    await labelQuote(order);
    await expect(
      db.query('select public.claim_label($1,$2,$3)', [order, 'shp_unrelated', 'rate_label']),
    ).rejects.toThrow('Invalid label rate');
    await db.query('select public.claim_label($1,$2,$3)', [order, 'shp_label', 'rate_label']);
    await expect(
      db.query('select public.claim_label($1,$2,$3)', [order, 'shp_label', 'rate_label']),
    ).rejects.toThrow('Label purchase already running');
    await expect(
      db.query('select public.request_refund($1,true,$2,$3)', [
        order,
        'requested_by_customer',
        adminId,
      ]),
    ).rejects.toThrow('Reconcile pending label purchase');
    await expect(
      db.query('select public.complete_fulfillment($1,$2,$3,true)', [
        order,
        JSON.stringify(shipment),
        adminId,
      ]),
    ).rejects.toThrow('Reconcile existing label purchase');
    await db.exec("update public.label_operations set locked_until=now()-interval '1 second'");
    await expect(
      db.query('select public.claim_label($1,$2,$3)', [order, 'shp_label', 'rate_label']),
    ).resolves.toHaveProperty('rows');
  });
  it('completes fulfillment once and stores a single shipment, event, and customer email', async () => {
    const order = await finalize(await reserve(await quote()));
    await labelQuote(order);
    await db.query('select public.claim_label($1,$2,$3)', [order, 'shp_label', 'rate_label']);
    const params = [order, JSON.stringify(shipment), adminId];
    const first = await db.query<{ id: string }>(
      'select public.complete_fulfillment($1,$2,$3,false) id',
      params,
    );
    const second = await db.query<{ id: string }>(
      'select public.complete_fulfillment($1,$2,$3,false) id',
      params,
    );
    expect(second.rows[0].id).toBe(first.rows[0].id);
    expect(await count('shipments')).toBe(1);
    expect(
      (await db.query<{ status: string }>('select status from public.orders')).rows[0].status,
    ).toBe('shipped');
    expect(
      (await db.query("select id from public.email_outbox where kind='shipping_confirmation'"))
        .rows,
    ).toHaveLength(1);
  });
  it('keeps delivered terminal, ignores duplicate tracking events, and emails delivery once', async () => {
    const order = await finalize(await reserve(await quote()));
    await labelQuote(order);
    await db.query('select public.claim_label($1,$2,$3)', [order, 'shp_label', 'rate_label']);
    await db.query('select public.complete_fulfillment($1,$2,$3,false)', [
      order,
      JSON.stringify(shipment),
      adminId,
    ]);
    for (const [id, status] of [
      ['evt_delivery', 'delivered'],
      ['evt_delivery', 'delivered'],
      ['evt_delayed_transit', 'in_transit'],
      ['evt_delivery_again', 'delivered'],
    ])
      await db.query('select public.apply_tracking($1,$2,$3,$4,now())', [
        id,
        'trk_label',
        status,
        'Carrier scan',
      ]);
    expect(
      (await db.query<{ status: string }>('select status from public.orders')).rows[0].status,
    ).toBe('delivered');
    expect(
      (await db.query<{ status: string }>('select status from public.shipments')).rows[0].status,
    ).toBe('delivered');
    expect(await count('tracking_events')).toBe(3);
    expect(
      (await db.query("select id from public.email_outbox where kind='delivery'")).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "select public.apply_tracking('evt_bad','trk_unknown','delivered','Carrier scan',now())",
      ),
    ).rejects.toThrow('Shipment not ready');
  });
  it('does not ship an order while a refund request is pending', async () => {
    const order = await finalize(await reserve(await quote()));
    await labelQuote(order);
    await db.query('select public.request_refund($1,true,$2,$3)', [
      order,
      'requested_by_customer',
      adminId,
    ]);
    await expect(
      db.query('select public.claim_label($1,$2,$3)', [order, 'shp_label', 'rate_label']),
    ).rejects.toThrow('Order cannot be shipped');
    await expect(
      db.query('select public.complete_fulfillment($1,$2,$3,true)', [
        order,
        JSON.stringify(shipment),
        adminId,
      ]),
    ).rejects.toThrow('Order cannot be fulfilled');
  });
  it('preserves the first refund request and its restock choice on repeated submissions', async () => {
    const order = await finalize(await reserve(await quote()));
    const first = (
      await db.query<{ request: { id: string; restock: boolean } }>(
        'select public.request_refund($1,true,$2,$3) request',
        [order, 'requested_by_customer', adminId],
      )
    ).rows[0].request;
    const second = (
      await db.query<{ request: { id: string; restock: boolean } }>(
        'select public.request_refund($1,false,$2,$3) request',
        [order, 'duplicate', adminId],
      )
    ).rows[0].request;
    expect(first.restock).toBe(true);
    expect(second.id).toBe(first.id);
    expect(second.restock).toBe(true);
    expect(await count('refund_requests')).toBe(1);
  });
});
