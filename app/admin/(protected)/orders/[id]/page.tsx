import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/server/auth';
import { checked } from '@/lib/server/db';
import { uuid } from '@/lib/server/admin';
import { money, type Address } from '@/lib/types';
import { OrderActions, type AdminShipment } from '@/components/admin/order-actions';
type Item = {
  id: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price_cents: number;
};
type Payment = {
  id: string;
  stripe_payment_intent_id: string;
  status: string;
  amount_cents: number;
};
type OrderEvent = { id: string; kind: string; message: string; created_at: string };
type Order = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  shipping_address: Address;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  refunded_cents: number;
  discount_code: string | null;
  stripe_checkout_session_id: string;
  stripe_customer_id: string;
  created_at: string;
  order_items: Item[];
  shipments: AdminShipment[];
  payments: Payment[];
  order_events: OrderEvent[];
  refunds: { id: string; amount_cents: number; status: string; created_at: string }[];
};
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { db } = await requireAdmin();
  const order = checked(
    await db
      .from('orders')
      .select('*,order_items(*),shipments(*),payments(*),order_events(*),refunds(*)')
      .eq('id', id)
      .maybeSingle(),
  ) as Order | null;
  if (!order) notFound();
  const a = order.shipping_address;
  return (
    <>
      <Link href="/admin/orders" className="admin-quiet-link">
        ← All orders
      </Link>
      <div className="admin-heading" style={{ marginTop: 24 }}>
        <div>
          <p className="admin-kicker">Order details</p>
          <h1>{order.order_number}</h1>
          <p>{new Date(order.created_at).toLocaleString('en-US')}</p>
        </div>
        <span className={`admin-status ${order.status}`}>{order.status}</span>
      </div>
      <div className="admin-columns">
        <div>
          <section className="admin-panel">
            <h2>What they picked</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.order_items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.name}
                        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                          {i.size} / {i.color} · {i.sku}
                        </div>
                      </td>
                      <td>{i.quantity}</td>
                      <td>{money(i.unit_price_cents * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="admin-detail-list" style={{ marginTop: 24 }}>
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal_cents)}</dd>
              <dt>Discount{order.discount_code ? ` · ${order.discount_code}` : ''}</dt>
              <dd>−{money(order.discount_cents)}</dd>
              <dt>Shipping</dt>
              <dd>{money(order.shipping_cents)}</dd>
              <dt>Tax</dt>
              <dd>{money(order.tax_cents)}</dd>
              <dt>
                <strong>Total paid</strong>
              </dt>
              <dd>
                <strong>{money(order.total_cents)}</strong>
              </dd>
              {order.refunded_cents > 0 && (
                <>
                  <dt>Refunded</dt>
                  <dd>{money(order.refunded_cents)}</dd>
                </>
              )}
            </dl>
          </section>
          <section className="admin-panel">
            <h2>Order timeline</h2>
            <ol className="admin-timeline">
              {order.order_events
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((e) => (
                  <li key={e.id}>
                    {e.message}
                    <time dateTime={e.created_at}>
                      {new Date(e.created_at).toLocaleString('en-US')}
                    </time>
                  </li>
                ))}
            </ol>
            {order.order_events.length === 0 && (
              <p className="admin-empty">No timeline entries yet.</p>
            )}
          </section>
          <section className="admin-panel">
            <h2>Payment record</h2>
            {order.payments.map((p) => (
              <div key={p.id}>
                <dl className="admin-detail-list">
                  <dt>Payment status</dt>
                  <dd>{p.status}</dd>
                  <dt>Amount</dt>
                  <dd>{money(p.amount_cents)}</dd>
                  <dt>Payment Intent</dt>
                  <dd>
                    <code>{p.stripe_payment_intent_id}</code>
                  </dd>
                </dl>
              </div>
            ))}
            <dl className="admin-detail-list">
              <dt>Checkout Session</dt>
              <dd>
                <code>{order.stripe_checkout_session_id}</code>
              </dd>
              <dt>Stripe customer</dt>
              <dd>
                <code>{order.stripe_customer_id || 'Guest'}</code>
              </dd>
            </dl>
            {order.refunds.map((r) => (
              <div key={r.id} className="admin-note">
                Refund {money(r.amount_cents)} · {r.status}
                <br />
                <code>{r.id}</code>
              </div>
            ))}
          </section>
        </div>
        <div>
          <section className="admin-panel">
            <h2>Customer & destination</h2>
            <p style={{ marginBottom: 16 }}>{order.email}</p>
            <address style={{ fontStyle: 'normal', lineHeight: 1.8 }}>
              <strong>{a.name}</strong>
              <br />
              {a.street1}
              {a.street2 && (
                <>
                  <br />
                  {a.street2}
                </>
              )}
              <br />
              {a.city}, {a.state} {a.zip}
              <br />
              {a.country}
              {a.phone && (
                <>
                  <br />
                  {a.phone}
                </>
              )}
            </address>
          </section>
          <OrderActions
            orderId={id}
            status={order.status}
            total={order.total_cents}
            refunded={order.refunded_cents}
            shipments={order.shipments}
          />
        </div>
      </div>
    </>
  );
}
