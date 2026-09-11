'use client';
/* Product previews use unoptimized <img> because uploaded files are displayed before publication. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload } from 'lucide-react';
import type { Product, Variant } from '@/lib/types';
import { adminRequest, ConfirmAction, Notice } from './controls';

type EditableVariant = Omit<Variant, 'id' | 'product_id'> & { id?: string };
type ImageDraft = { url: string; alt: string; position: number };
const blankVariant = (): EditableVariant => ({
  size: 'M',
  color: 'Oat',
  sku: '',
  price_override_cents: null,
  inventory_quantity: 0,
  weight_oz: 16,
  active: true,
});
const integerMoney = (value: FormDataEntryValue | null) =>
  value === '' || value === null ? null : Math.round(Number(value) * 100);
export function ProductEditor({ product }: { product?: Product }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [variants, setVariants] = useState<EditableVariant[]>(
    product?.product_variants || [blankVariant()],
  );
  const [images, setImages] = useState<ImageDraft[]>(
    product?.product_images.sort((a, b) => a.position - b.position) || [],
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function editVariant(index: number, patch: Partial<EditableVariant>) {
    setVariants((vs) => vs.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const f = new FormData(e.currentTarget);
    const body = {
      ...(product ? { id: product.id } : {}),
      name: f.get('name'),
      slug: f.get('slug'),
      description: f.get('description'),
      category: f.get('category'),
      price_cents: integerMoney(f.get('price')),
      sale_price_cents: integerMoney(f.get('sale')),
      active: f.get('active') === 'on',
      featured: f.get('featured') === 'on',
      seo_title: f.get('seo_title'),
      seo_description: f.get('seo_description'),
      variants,
      images: images.map((im, i) => ({ ...im, position: i })),
    };
    try {
      const saved = await adminRequest('products', body);
      setMessage('Product saved. Your storefront is up to date.');
      if (!product) router.replace(`/admin/products/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setError('');
    try {
      if (images.length + files.length > 30) throw new Error('A product can have up to 30 images.');
      for (const file of Array.from(files)) {
        if (file.size > 4_000_000) throw new Error('Each image must be under 4 MB.');
        const form = new FormData();
        form.set('file', file);
        const result = await adminRequest('upload', form);
        setImages((ims) => [...ims, { url: result.url, alt: '', position: ims.length }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  function reorder(index: number, step: number) {
    setImages((ims) => {
      const updated = [...ims];
      const other = index + step;
      [updated[index], updated[other]] = [updated[other], updated[index]];
      return updated;
    });
  }
  return (
    <form ref={formRef} onSubmit={save}>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">The collection</p>
          <h1>{product ? 'Make it yours.' : 'Something new.'}</h1>
          <p>
            {product
              ? 'Edit your product, imagery, and available variants.'
              : 'Add a thoughtful piece to your collection.'}
          </p>
        </div>
        <button className="admin-button" disabled={busy || uploading}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </div>
      <Notice message={error} error />
      <Notice message={message} />
      <div className="admin-columns">
        <div>
          <section className="admin-panel">
            <h2>Product details</h2>
            <label className="admin-field">
              Product name
              <input name="name" defaultValue={product?.name} required maxLength={180} />
            </label>
            <label className="admin-field">
              URL slug
              <input
                name="slug"
                defaultValue={product?.slug}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                placeholder="the-everyday-crew"
                maxLength={180}
              />
              <small>Lowercase letters, numbers, and hyphens.</small>
            </label>
            <label className="admin-field">
              Description
              <textarea
                name="description"
                defaultValue={product?.description}
                required
                maxLength={10000}
                rows={6}
              />
            </label>
            <label className="admin-field">
              Category
              <input
                name="category"
                defaultValue={product?.category || 'Sweaters'}
                required
                maxLength={80}
              />
            </label>
            <div className="admin-form-grid">
              <label className="admin-field">
                Price (USD)
                <input
                  type="number"
                  name="price"
                  min="0.01"
                  step="0.01"
                  defaultValue={product ? product.price_cents / 100 : ''}
                  required
                />
              </label>
              <label className="admin-field">
                Sale price (optional)
                <input
                  type="number"
                  name="sale"
                  min="0.01"
                  step="0.01"
                  defaultValue={product?.sale_price_cents ? product.sale_price_cents / 100 : ''}
                />
              </label>
            </div>
          </section>
          <section className="admin-panel">
            <h2>Product photography</h2>
            <p className="muted">
              The first image is your collection cover. Reorder with the arrow controls.
            </p>
            <div className="admin-photo-grid">
              {images.map((im, i) => (
                <div className="admin-photo" key={im.url}>
                  <img src={im.url} alt={im.alt || `Product image ${i + 1}`} />
                  <div className="admin-photo-controls">
                    <button
                      type="button"
                      aria-label={`Move image ${i + 1} earlier`}
                      disabled={i === 0 || uploading}
                      onClick={() => reorder(i, -1)}
                    >
                      <ArrowLeft size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move image ${i + 1} later`}
                      disabled={i === images.length - 1 || uploading}
                      onClick={() => reorder(i, 1)}
                    >
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove image ${i + 1}`}
                      onClick={() => setImages((ims) => ims.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input
                    className="admin-input"
                    aria-label={`Alternative text for image ${i + 1}`}
                    placeholder="Describe this photo"
                    value={im.alt}
                    maxLength={180}
                    onChange={(e) =>
                      setImages((ims) =>
                        ims.map((item, j) => (j === i ? { ...item, alt: e.target.value } : item)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <label className="admin-upload">
              <Upload size={22} style={{ margin: 'auto' }} />
              <span>{uploading ? 'Uploading your images…' : 'Add product images'}</span>
              <small>JPEG, PNG, or WebP · Up to 4 MB each · 30 per product</small>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                onChange={(e) => {
                  void upload(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </section>
          <section className="admin-panel">
            <div className="admin-heading">
              <div>
                <h2>Sizes & colors</h2>
                <p>Each combination has its own stock and shipping weight.</p>
              </div>
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => setVariants((vs) => [...vs, blankVariant()])}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            {variants.map((variant, i) => (
              <div className="admin-variant" key={variant.id || `new-${i}`}>
                <div className="admin-variant-grid">
                  <label className="admin-field">
                    Size
                    <input
                      required
                      maxLength={30}
                      value={variant.size}
                      onChange={(e) => editVariant(i, { size: e.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    Color
                    <input
                      required
                      maxLength={60}
                      value={variant.color}
                      onChange={(e) => editVariant(i, { color: e.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    SKU
                    <input
                      required
                      pattern="[A-Za-z0-9_-]+"
                      maxLength={80}
                      value={variant.sku}
                      onChange={(e) => editVariant(i, { sku: e.target.value })}
                    />
                  </label>
                  <label className="admin-field">
                    Weight (oz)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={variant.weight_oz}
                      onChange={(e) => editVariant(i, { weight_oz: Number(e.target.value) })}
                    />
                  </label>
                  <label className="admin-field">
                    Price override (USD)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        variant.price_override_cents === null
                          ? ''
                          : variant.price_override_cents / 100
                      }
                      onChange={(e) =>
                        editVariant(i, {
                          price_override_cents:
                            e.target.value === '' ? null : Math.round(Number(e.target.value) * 100),
                        })
                      }
                    />
                  </label>
                  <label className="admin-field">
                    {variant.id ? 'Current inventory' : 'Opening inventory'}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      readOnly={Boolean(variant.id)}
                      value={variant.inventory_quantity}
                      onChange={(e) =>
                        editVariant(i, { inventory_quantity: Number(e.target.value) })
                      }
                    />
                    {variant.id && <small>Adjust stock in the inventory section below.</small>}
                  </label>
                </div>
                <div className="admin-actions">
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={variant.active}
                      onChange={(e) => editVariant(i, { active: e.target.checked })}
                    />
                    Available variant
                  </label>
                  {!variant.id && variants.length > 1 && (
                    <button
                      type="button"
                      className="admin-button danger"
                      onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}
                    >
                      Remove new variant
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        </div>
        <div>
          <section className="admin-panel">
            <h2>Visibility</h2>
            <label className="admin-check">
              <input type="checkbox" name="active" defaultChecked={product?.active} />
              Published on storefront
            </label>
            <label className="admin-check">
              <input type="checkbox" name="featured" defaultChecked={product?.featured} />
              Featured collection
            </label>
            <p className="muted">
              Unpublished products stay in your studio. Existing orders always retain the original
              item details.
            </p>
          </section>
          <section className="admin-panel">
            <h2>Search appearance</h2>
            <label className="admin-field">
              SEO title
              <input name="seo_title" defaultValue={product?.seo_title} maxLength={180} />
            </label>
            <label className="admin-field">
              SEO description
              <textarea
                name="seo_description"
                defaultValue={product?.seo_description}
                maxLength={320}
              />
            </label>
          </section>
          {product && (
            <section className="admin-panel">
              <h2>Product management</h2>
              <div className="admin-actions">
                <ConfirmAction
                  label="Archive product"
                  title="Archive this product?"
                  description="It will leave your storefront. You can publish it again at any time."
                  onConfirm={async () => {
                    await adminRequest(`products/${product.id}/archive`, { confirmed: true });
                    router.refresh();
                  }}
                />
                <ConfirmAction
                  danger
                  label="Delete product"
                  title="Delete this product?"
                  description="This permanently deletes the product and variants. Historical order snapshots remain intact. Products reserved in open checkouts cannot be deleted."
                  onConfirm={async () => {
                    await adminRequest(`products/${product.id}`, { confirmed: true }, 'DELETE');
                    router.replace('/admin/products');
                    router.refresh();
                  }}
                />
              </div>
            </section>
          )}
        </div>
      </div>
      <div className="admin-actions">
        <button className="admin-button" disabled={busy || uploading}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </form>
  );
}
export type InventoryAdjustment = {
  id: string;
  variant_id: string | null;
  quantity_change: number;
  reason: string;
  created_at: string;
};
export function InventoryEditor({
  product,
  history,
}: {
  product: Product;
  history: InventoryAdjustment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return (
    <section className="admin-panel" style={{ marginTop: 32 }}>
      <h2>Inventory journal</h2>
      <p className="muted">
        Record incoming stock or a correction. Active checkout reservations are protected.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          setBusy(true);
          setError('');
          try {
            await adminRequest('inventory', {
              variant_id: f.get('variant_id'),
              quantity_change: Number(f.get('quantity_change')),
              reason: f.get('reason'),
            });
            setMessage('Inventory adjustment recorded.');
            form.reset();
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="admin-form-grid">
          <label className="admin-field">
            Variant
            <select name="variant_id">
              {product.product_variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} · {v.size} / {v.color} · {v.inventory_quantity} on hand
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            Quantity change
            <input
              name="quantity_change"
              type="number"
              step="1"
              required
              placeholder="10 to add, -2 to remove"
            />
          </label>
        </div>
        <label className="admin-field">
          Reason
          <input
            name="reason"
            minLength={3}
            maxLength={500}
            required
            placeholder="New delivery, stock count correction…"
          />
        </label>
        <button className="admin-button secondary" disabled={busy}>
          {busy ? 'Recording…' : 'Record adjustment'}
        </button>
        <Notice message={error} error />
        <Notice message={message} />
      </form>
      <div className="admin-table-wrap" style={{ marginTop: 24 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>SKU</th>
              <th>Change</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{new Date(h.created_at).toLocaleString('en-US')}</td>
                <td>
                  {product.product_variants.find((v) => v.id === h.variant_id)?.sku ||
                    'Deleted variant'}
                </td>
                <td>
                  {h.quantity_change > 0 ? '+' : ''}
                  {h.quantity_change}
                </td>
                <td>{h.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <p className="admin-empty">No stock adjustments yet.</p>}
      </div>
    </section>
  );
}
