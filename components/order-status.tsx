'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { money } from '@/lib/types';
type CustomerOrder = {
  order_number: string;
  status: string;
  email: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: string;
  items: {
    name: string;
    size: string;
    color: string;
    sku: string;
    quantity: number;
    unit_price_cents: number;
    image_url: string | null;
  }[];
  shipments: {
    carrier: string;
    service: string;
    tracking_code: string;
    tracking_url: string;
    status: string;
  }[];
};
export function OrderStatus({ token }: { token: string }) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/orders/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || 'This link is invalid or has expired. Please request a new order link.',
          );
        setOrder(body.order);
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError')
          setError(err instanceof Error ? err.message : 'Please try again.');
      });
    return () => controller.abort();
  }, [token, attempt]);
  if (error)
    return (
      <div className="center-state">
        <h1>Let’s find your order.</h1>
        <p role="alert">{error}</p>
        <div className="flex gap-3 justify-center">
          <Link className="button" href="/orders">
            Get a new link
          </Link>
          <button className="button button-secondary" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      </div>
    );
  if (!order)
    return (
      <div className="container section" role="status">
        <div className="skeleton h-12 w-64 mb-8" />
        <div className="skeleton h-80" />
        <span className="sr-only">Loading your order…</span>
      </div>
    );
  return (
    <div className="container">
      <div className="page-intro">
        <p className="eyebrow">Good things are on their way</p>
        <h1>Your order.</h1>
        <p>
          {order.order_number} · Placed{' '}
          {new Date(order.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>
      <div className="checkout-layout">
        <div>
          <div className="card mb-6">
            <div className="flex gap-4 items-center">
              {order.status === 'delivered' ? <CheckCircle2 size={28} /> : <Package size={28} />}
              <div>
                <p className="eyebrow mb-1">Current status</p>
                <h2 className="text-[30px] mb-0 capitalize">{order.status.replaceAll('_', ' ')}</h2>
              </div>
            </div>
            {order.shipments.map((shipment, i) => (
              <div
                key={`${shipment.tracking_code}-${i}`}
                className="mt-6 border-t border-[#dcded5] pt-5"
              >
                <p className="text-sm mb-2">
                  {shipment.carrier} · {shipment.service}
                </p>
                <p className="text-xs muted">
                  Tracking {shipment.tracking_code || 'will be added shortly'} · {shipment.status}
                </p>
                {/^https:\/\//.test(shipment.tracking_url || '') && (
                  <a
                    className="text-link mt-2"
                    href={shipment.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Follow your parcel <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
          <h2 className="text-[30px] mt-8">Your everyday favorites.</h2>
          {order.items.map((item, i) => (
            <div key={`${item.sku}-${i}`} className="cart-line">
              <div className="cart-line-info">
                <div className="flex justify-between gap-3">
                  <h3>{item.name}</h3>
                  <strong className="text-sm">
                    {money(item.unit_price_cents * item.quantity)}
                  </strong>
                </div>
                <p>
                  {item.color} / {item.size} · Qty {item.quantity}
                  <br />
                  SKU {item.sku}
                </p>
              </div>
            </div>
          ))}
        </div>
        <aside className="order-summary">
          <h2>The details.</h2>
          <div className="subtotal-row">
            <span>Items</span>
            <span>{money(order.subtotal_cents)}</span>
          </div>
          {order.discount_cents > 0 && (
            <div className="subtotal-row">
              <span>Discount</span>
              <span>−{money(order.discount_cents)}</span>
            </div>
          )}
          <div className="subtotal-row">
            <span>Shipping</span>
            <span>{money(order.shipping_cents)}</span>
          </div>
          <div className="subtotal-row">
            <span>Tax</span>
            <span>{money(order.tax_cents)}</span>
          </div>
          <div className="subtotal-row border-t border-[#cdd1c3] pt-4">
            <strong>Order total</strong>
            <strong>{money(order.total_cents)}</strong>
          </div>
          <p className="text-xs muted mt-6">Updates are sent to {order.email}.</p>
          <Link className="text-link" href="/contact">
            Need a hand?
          </Link>
        </aside>
      </div>
    </div>
  );
}
