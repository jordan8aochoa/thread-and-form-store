import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/server/auth';
import { checked } from '@/lib/server/db';
import { money, type Product } from '@/lib/types';
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { db } = await requireAdmin();
  const search = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(search.page) || 1));
  let query = db
    .from('products')
    .select('*,product_images(*),product_variants(*)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (search.q) query = query.ilike('name', `%${search.q.replace(/[%_]/g, '').slice(0, 100)}%`);
  if (search.status === 'active' || search.status === 'archived')
    query = query.eq('active', search.status === 'active');
  const response = await query.range((page - 1) * 50, page * 50 - 1);
  const products = checked(response) as Product[];
  const url = (p: number) =>
    `/admin/products?${new URLSearchParams({ q: search.q || '', status: search.status || '', page: String(p) })}`;
  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Considered pieces, carefully kept</p>
          <h1>Your collection.</h1>
          <p>{response.count || 0} products in your store.</p>
        </div>
        <Link className="admin-button" href="/admin/products/new">
          <Plus size={15} />
          Add product
        </Link>
      </div>
      <section className="admin-panel">
        <form className="admin-toolbar">
          <input
            className="admin-input"
            name="q"
            aria-label="Search products"
            placeholder="Search your collection…"
            defaultValue={search.q}
          />
          <select
            className="admin-input"
            name="status"
            aria-label="Product visibility"
            defaultValue={search.status || ''}
          >
            <option value="">All products</option>
            <option value="active">Published</option>
            <option value="archived">Archived / draft</option>
          </select>
          <button className="admin-button secondary">Search</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Inventory</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {p.product_variants.length} variants
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td>{money(p.sale_price_cents ?? p.price_cents)}</td>
                  <td>
                    {p.product_variants.reduce((sum, v) => sum + v.inventory_quantity, 0)} on hand
                  </td>
                  <td>
                    <span className="admin-status">
                      {p.active ? 'Published' : 'Archived / draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <div className="admin-empty">
            No products found. Add your first piece or try a different search.
          </div>
        )}
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
