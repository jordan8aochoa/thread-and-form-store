import Link from 'next/link';
import { requireAdmin } from '@/lib/server/auth';
import { requiredData } from '@/lib/server/db';
import { money } from '@/lib/types';
const statuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'canceled', 'refunded'];
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const search = await searchParams;
  const { db } = await requireAdmin();
  const page = Math.max(1, Math.min(10000, Number(search.page) || 1));
  let query = db
    .from('orders')
    .select('id,order_number,email,status,total_cents,refunded_cents,created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false });
  const q = search.q?.replace(/[^a-zA-Z0-9@.+ -]/g, '').slice(0, 100);
  if (q) query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%`);
  if (statuses.includes(search.status || '')) query = query.eq('status', search.status!);
  const response = await query.range((page - 1) * 50, page * 50 - 1);
  const orders = requiredData(response);
  const url = (p: number) =>
    `/admin/orders?${new URLSearchParams({ q: search.q || '', status: search.status || '', page: String(p) })}`;
  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">A little care in every parcel</p>
          <h1>Your orders.</h1>
          <p>{response.count || 0} orders · From first payment to their front door.</p>
        </div>
      </div>
      <section className="admin-panel">
        <form className="admin-toolbar">
          <input
            name="q"
            className="admin-input"
            aria-label="Search orders"
            placeholder="Order number or customer email…"
            defaultValue={search.q}
          />
          <select
            name="status"
            aria-label="Filter order status"
            className="admin-input"
            defaultValue={search.status || ''}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button className="admin-button secondary">Search</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Placed</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                  </td>
                  <td>{o.email}</td>
                  <td>{new Date(o.created_at).toLocaleDateString('en-US')}</td>
                  <td>
                    <span className={`admin-status ${o.status}`}>{o.status}</span>
                  </td>
                  <td>
                    {money(o.total_cents)}
                    {o.refunded_cents > 0 && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {money(o.refunded_cents)} refunded
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="admin-empty">No orders match this view.</div>}
        </div>
        <div className="admin-actions" style={{ marginTop: 20 }}>
          {page > 1 && (
            <Link className="admin-button secondary" href={url(page - 1)}>
              Previous
            </Link>
          )}
          {(response.count || 0) > page * 50 && (
            <Link className="admin-button secondary" href={url(page + 1)}>
              Next 50
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
