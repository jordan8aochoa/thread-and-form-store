import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { requireAdmin } from '@/lib/server/auth';
import { checked, requiredData } from '@/lib/server/db';
import { money } from '@/lib/types';
type Metrics = {
  revenue_cents: number;
  order_count: number;
  units_sold: number;
  to_fulfill: number;
  low_stock: number;
};
type LowStock = {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  inventory_quantity: number;
  products: { name: string; active: boolean };
};
export default async function AdminPage() {
  const { db } = await requireAdmin();
  const results = await Promise.all([
    db.rpc('admin_metrics'),
    db
      .from('orders')
      .select('id,order_number,email,status,total_cents,created_at')
      .order('created_at', { ascending: false })
      .limit(7),
    db
      .from('product_variants')
      .select('id,product_id,sku,size,color,inventory_quantity,products!inner(name,active)')
      .eq('active', true)
      .eq('products.active', true)
      .lte('inventory_quantity', 3)
      .order('inventory_quantity')
      .limit(8),
  ]);
  const metrics = checked(results[0]) as Metrics;
  const orders = requiredData(results[1]);
  const stock = checked(results[2]) as unknown as LowStock[];
  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Your store, at a glance</p>
          <h1>A good day to grow.</h1>
          <p>A little overview of the things that matter.</p>
        </div>
        <Link href="/admin/orders" className="admin-button secondary">
          Manage orders
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="admin-metrics">
        {[
          {
            label: 'Net collected',
            value: money(metrics.revenue_cents),
            note: 'All time · includes tax and shipping',
          },
          {
            label: 'Orders received',
            value: metrics.order_count,
            note: `${metrics.to_fulfill} ready to prepare`,
          },
          {
            label: 'Pieces sold',
            value: metrics.units_sold,
            note: 'Excludes fully refunded orders',
          },
          {
            label: 'Low stock',
            value: metrics.low_stock,
            note: 'Published variants at 3 or fewer',
          },
        ].map((m) => (
          <div className="admin-metric" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <p>{m.note}</p>
          </div>
        ))}
      </div>
      <div className="admin-columns">
        <section className="admin-panel">
          <div className="admin-heading">
            <h2>Latest orders</h2>
            <Link href="/admin/orders" className="admin-quiet-link">
              View all
            </Link>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link>
                      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {new Date(o.created_at).toLocaleDateString('en-US')}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-status ${o.status}`}>{o.status}</span>
                    </td>
                    <td>{money(o.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && (
              <p className="admin-empty">Your first paid order will appear here.</p>
            )}
          </div>
        </section>
        <section className="admin-panel">
          <h2>A little attention needed</h2>
          {stock.map((v) => (
            <div key={v.id} style={{ padding: '1rem 0', borderBottom: '1px solid #eceee7' }}>
              <Link href={`/admin/products/${v.product_id}`}>{v.products.name}</Link>
              <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                {v.size} / {v.color} ·{' '}
                <strong>
                  {v.inventory_quantity === 0 ? 'Sold out' : `${v.inventory_quantity} remaining`}
                </strong>
              </p>
            </div>
          ))}
          {stock.length === 0 && (
            <p className="admin-empty">Your published inventory is looking healthy.</p>
          )}
        </section>
      </div>
    </>
  );
}
