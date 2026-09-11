'use client';
import { useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Shirt,
  Package,
  TicketPercent,
  Settings,
  ExternalLink,
  LogOut,
} from 'lucide-react';

export async function adminRequest(path: string, data?: unknown, method = 'POST') {
  const response = await fetch(`/api/admin/${path}`, {
    method,
    headers: data instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const details = result.fields?.fieldErrors
      ? Object.entries(result.fields.fieldErrors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : ''}`)
          .join(' ')
      : '';
    throw new Error(
      `${result.error || 'Unable to complete this action.'}${details ? ` ${details}` : ''}`,
    );
  }
  return result;
}
export function AdminNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState('');
  const links = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/products', label: 'Collection', icon: Shirt },
    { href: '/admin/orders', label: 'Orders', icon: Package },
    { href: '/admin/discounts', label: 'Discounts', icon: TicketPercent },
    { href: '/admin/settings', label: 'Store settings', icon: Settings },
  ];
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand">
        Store studio<small>Your brand, your way</small>
      </Link>
      <nav aria-label="Store administration">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={
              (href === '/admin' ? pathname === href : pathname.startsWith(href))
                ? 'page'
                : undefined
            }
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-bottom">
        <Link href="/" className="admin-quiet-link">
          <ExternalLink size={13} style={{ display: 'inline', marginRight: 6 }} />
          View storefront
        </Link>
        <button
          className="admin-button secondary"
          onClick={async () => {
            try {
              await adminRequest('logout');
              router.replace('/admin/login');
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
export function ConfirmAction({
  label,
  title,
  description,
  onConfirm,
  danger = false,
  disabled = false,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  danger?: boolean;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button
        type="button"
        className={`admin-button ${danger ? 'danger' : 'secondary'}`}
        disabled={disabled}
        onClick={() => {
          setError('');
          dialog.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog ref={dialog} className="admin-modal" aria-label={title}>
        <h2>{title}</h2>
        <p>{description}</p>
        {error && (
          <div role="alert" className="admin-note error">
            {error}
          </div>
        )}
        <div className="admin-actions">
          <button
            type="button"
            className={`admin-button ${danger ? 'danger' : ''}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                dialog.current?.close();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Working…' : 'Confirm'}
          </button>
          <button
            type="button"
            className="admin-button secondary"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Keep editing
          </button>
        </div>
      </dialog>
    </>
  );
}
export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  return message ? (
    <div className={`admin-note${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}>
      {message}
    </div>
  ) : null;
}
export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const form = new FormData(e.currentTarget);
        try {
          await adminRequest('login', { email: form.get('email'), password: form.get('password') });
          router.replace('/admin');
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="admin-field">
        Email
        <input type="email" name="email" autoComplete="username" required disabled={!configured} />
      </label>
      <label className="admin-field">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={!configured}
        />
      </label>
      <Notice message={error} error />
      <button className="admin-button" disabled={!configured || busy} style={{ width: '100%' }}>
        {busy ? 'Signing in…' : 'Sign in to your studio'}
      </button>
    </form>
  );
}
