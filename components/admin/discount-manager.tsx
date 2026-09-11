'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/lib/types';
import { adminRequest, ConfirmAction, Notice } from './controls';
export type AdminDiscount = {
  id: string;
  code: string;
  kind: 'percentage' | 'fixed';
  value: number;
  minimum_subtotal_cents: number;
  max_uses: number | null;
  uses: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};
function localDate(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function DiscountManager({ discounts }: { discounts: AdminDiscount[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdminDiscount | null>(null);
  const [kind, setKind] = useState<'percentage' | 'fixed'>('percentage');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formKey, setFormKey] = useState(0);
  return (
    <div className="admin-columns">
      <section className="admin-panel">
        <h2>Discount codes</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Offer</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.code}</strong>
                  </td>
                  <td>{d.kind === 'percentage' ? `${d.value}%` : money(d.value)}</td>
                  <td>
                    {d.uses}
                    {d.max_uses ? ` / ${d.max_uses}` : ''}
                  </td>
                  <td>
                    <span className="admin-status">{d.active ? 'Enabled' : 'Disabled'}</span>
                  </td>
                  <td>
                    <button
                      className="admin-quiet-link"
                      type="button"
                      onClick={() => {
                        setSelected(d);
                        setKind(d.kind);
                        setFormKey((n) => n + 1);
                        setError('');
                        setMessage('');
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {discounts.length === 0 && (
          <p className="admin-empty">
            No codes yet. A little something for your community starts here.
          </p>
        )}
      </section>
      <section className="admin-panel">
        <h2>{selected ? `Edit ${selected.code}` : 'Create a discount'}</h2>
        <form
          key={formKey}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setMessage('');
            const f = new FormData(e.currentTarget);
            const starts = String(f.get('starts_at') || '');
            const ends = String(f.get('ends_at') || '');
            const payload = {
              ...(selected ? { id: selected.id } : {}),
              code: f.get('code'),
              kind,
              value:
                kind === 'fixed'
                  ? Math.round(Number(f.get('value')) * 100)
                  : Number(f.get('value')),
              minimum_subtotal_cents: Math.round(Number(f.get('minimum') || 0) * 100),
              max_uses: f.get('max_uses') ? Number(f.get('max_uses')) : null,
              starts_at: starts ? new Date(starts).toISOString() : null,
              ends_at: ends ? new Date(ends).toISOString() : null,
              active: f.get('active') === 'on',
            };
            try {
              await adminRequest('discounts', payload);
              setMessage('Discount saved.');
              setSelected(null);
              setKind('percentage');
              setFormKey((n) => n + 1);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="admin-field">
            Code
            <input
              name="code"
              maxLength={40}
              minLength={2}
              pattern="[A-Za-z0-9_-]+"
              required
              defaultValue={selected?.code}
              placeholder="A_LITTLE_WARMTH"
            />
          </label>
          <label className="admin-field">
            Offer type
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'percentage' | 'fixed')}
            >
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </select>
          </label>
          <label className="admin-field">
            {kind === 'percentage' ? 'Percentage' : 'Discount amount (USD)'}
            <input
              type="number"
              name="value"
              min={kind === 'percentage' ? 1 : 0.01}
              max={kind === 'percentage' ? 100 : undefined}
              step={kind === 'percentage' ? 1 : 0.01}
              required
              defaultValue={
                selected
                  ? selected.kind === 'percentage'
                    ? selected.value
                    : selected.value / 100
                  : ''
              }
            />
          </label>
          <label className="admin-field">
            Minimum order subtotal (USD)
            <input
              type="number"
              name="minimum"
              min="0"
              step="0.01"
              defaultValue={selected ? selected.minimum_subtotal_cents / 100 : 0}
            />
          </label>
          <label className="admin-field">
            Maximum uses (optional)
            <input
              name="max_uses"
              type="number"
              min="1"
              step="1"
              defaultValue={selected?.max_uses || ''}
            />
            <small>Active checkout reservations also count against availability.</small>
          </label>
          <label className="admin-field">
            Starts (local time, optional)
            <input
              type="datetime-local"
              name="starts_at"
              defaultValue={localDate(selected?.starts_at)}
            />
          </label>
          <label className="admin-field">
            Ends (local time, optional)
            <input
              type="datetime-local"
              name="ends_at"
              defaultValue={localDate(selected?.ends_at)}
            />
          </label>
          <label className="admin-check">
            <input type="checkbox" name="active" defaultChecked={selected?.active ?? true} />
            Enabled
          </label>
          <Notice message={error} error />
          <Notice message={message} />
          <div className="admin-actions">
            <button className="admin-button" disabled={busy}>
              {busy ? 'Saving…' : 'Save discount'}
            </button>
            {selected && (
              <button
                type="button"
                className="admin-button secondary"
                onClick={() => {
                  setSelected(null);
                  setKind('percentage');
                  setFormKey((n) => n + 1);
                }}
              >
                New code
              </button>
            )}
          </div>
          {selected && (
            <div style={{ marginTop: 16 }}>
              <ConfirmAction
                danger
                label="Delete discount"
                title="Delete this discount?"
                description="Customers will no longer be able to use this code. Historical order discounts stay unchanged."
                onConfirm={async () => {
                  await adminRequest(`discounts/${selected.id}`, { confirmed: true }, 'DELETE');
                  setSelected(null);
                  setKind('percentage');
                  setFormKey((n) => n + 1);
                  router.refresh();
                }}
              />
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
