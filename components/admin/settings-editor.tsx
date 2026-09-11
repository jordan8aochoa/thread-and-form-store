'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StoreSettings } from '@/lib/types';
import { adminRequest, Notice } from './controls';
export function SettingsEditor({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logo, setLogo] = useState(settings.logo_url);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const a = settings.return_address;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        setMessage('');
        const f = new FormData(e.currentTarget);
        const value = (name: string) => String(f.get(name) || '');
        const socials: Record<string, string> = {};
        for (const name of ['instagram', 'pinterest', 'tiktok', 'facebook'])
          if (value(name)) socials[name] = value(name);
        const body = {
          brand_name: value('brand_name'),
          tagline: value('tagline'),
          logo_url: logo,
          support_email: value('support_email'),
          owner_email: value('owner_email'),
          announcement: value('announcement'),
          free_shipping_threshold_cents: Math.round(Number(f.get('threshold')) * 100),
          social_links: socials,
          return_address: {
            name: value('return_name'),
            street1: value('street1'),
            street2: value('street2'),
            city: value('city'),
            state: value('state'),
            zip: value('zip'),
            country: value('country'),
            phone: value('phone'),
          },
        };
        try {
          await adminRequest('settings', body);
          setMessage('Store settings saved.');
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">The details that make it yours</p>
          <h1>Your store.</h1>
          <p>A few thoughtful touches, all in one place.</p>
        </div>
        <button className="admin-button" disabled={busy || uploading}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
      <Notice message={error} error />
      <Notice message={message} />
      <div className="admin-columns">
        <div>
          <section className="admin-panel">
            <h2>Brand identity</h2>
            <label className="admin-field">
              Store name
              <input
                name="brand_name"
                defaultValue={settings.brand_name}
                required
                maxLength={100}
              />
            </label>
            <label className="admin-field">
              Tagline
              <input name="tagline" defaultValue={settings.tagline} maxLength={240} />
            </label>
            <label className="admin-field">
              Announcement banner
              <input name="announcement" defaultValue={settings.announcement} maxLength={300} />
              <small>Leave blank to hide the banner.</small>
            </label>
            <h3 style={{ marginTop: 24 }}>Store logo</h3>
            {logo && (
              <div className="admin-actions" style={{ margin: '16px 0' }}>
                <img
                  src={logo}
                  alt="Current store logo"
                  style={{ width: 120, maxHeight: 80, objectFit: 'contain' }}
                />
                <button
                  type="button"
                  className="admin-button secondary"
                  onClick={() => setLogo('')}
                >
                  Use brand name instead
                </button>
              </div>
            )}
            <label className="admin-upload">
              <span>{uploading ? 'Uploading…' : 'Upload a logo'}</span>
              <small>JPEG, PNG, or WebP · Up to 4 MB</small>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setError('');
                  try {
                    if (file.size > 4_000_000) throw new Error('Logo must be under 4 MB.');
                    const form = new FormData();
                    form.set('file', file);
                    const result = await adminRequest('upload', form);
                    setLogo(result.url);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </section>
          <section className="admin-panel">
            <h2>Shipping origin & return address</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              EasyPost uses this address to quote and purchase labels. Replace every placeholder
              before accepting orders.
            </p>
            <label className="admin-field">
              Business / sender name
              <input name="return_name" defaultValue={a.name} maxLength={100} required />
            </label>
            <label className="admin-field">
              Address line 1
              <input name="street1" defaultValue={a.street1} maxLength={150} required />
            </label>
            <label className="admin-field">
              Address line 2<input name="street2" defaultValue={a.street2} maxLength={150} />
            </label>
            <div className="admin-form-grid">
              <label className="admin-field">
                City
                <input name="city" defaultValue={a.city} maxLength={100} required />
              </label>
              <label className="admin-field">
                State
                <input name="state" defaultValue={a.state} maxLength={60} required />
              </label>
              <label className="admin-field">
                Postal code
                <input name="zip" defaultValue={a.zip} maxLength={20} required />
              </label>
              <label className="admin-field">
                Country
                <select name="country" defaultValue={a.country || 'US'}>
                  <option value="US">United States</option>
                </select>
              </label>
            </div>
            <label className="admin-field">
              Phone
              <input name="phone" type="tel" defaultValue={a.phone} maxLength={30} />
            </label>
            <label className="admin-field">
              Free shipping threshold (USD)
              <input
                name="threshold"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={settings.free_shipping_threshold_cents / 100}
              />
              <small>
                Set to 0 to disable free shipping. Eligible orders receive the cheapest live carrier
                service free; faster services retain their quoted price.
              </small>
            </label>
          </section>
        </div>
        <div>
          <section className="admin-panel">
            <h2>Contact & notifications</h2>
            <label className="admin-field">
              Customer support email
              <input
                name="support_email"
                type="email"
                defaultValue={settings.support_email}
                maxLength={254}
                required
              />
            </label>
            <label className="admin-field">
              Store owner notifications
              <input
                name="owner_email"
                type="email"
                defaultValue={settings.owner_email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || ''}
                maxLength={254}
                required
              />
              <small>
                Paid orders, low inventory, payment issues, and label failures are sent here. An
                OWNER_NOTIFICATION_EMAIL environment override takes priority if configured.
              </small>
            </label>
          </section>
          <section className="admin-panel">
            <h2>Social links</h2>
            {['instagram', 'pinterest', 'tiktok', 'facebook'].map((name) => (
              <label key={name} className="admin-field">
                {name[0].toUpperCase() + name.slice(1)}
                <input
                  name={name}
                  type="url"
                  placeholder="https://…"
                  defaultValue={settings.social_links[name] || ''}
                />
              </label>
            ))}
          </section>
          <section className="admin-panel">
            <h2>Before opening your doors</h2>
            <p className="muted" style={{ lineHeight: 1.8 }}>
              Payment, shipping, email, tax, and webhook credentials are managed through server
              environment variables. Follow the launch checklist in your project’s README before
              enabling production mode.
            </p>
          </section>
        </div>
      </div>
      <button className="admin-button" disabled={busy || uploading}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
