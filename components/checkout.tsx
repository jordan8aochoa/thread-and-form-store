'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, LockKeyhole, Check, Pencil } from 'lucide-react';
import { useCart } from './cart-provider';
import { cartSubtotal } from '@/lib/cart';
import { money, type ShippingQuote } from '@/lib/types';
export function Checkout({ enabled }: { enabled: boolean }) {
  const cart = useCart();
  const [savedQuote, setQuote] = useState<ShippingQuote | null>(null);
  const [quotedBag, setQuotedBag] = useState('');
  const bagIdentity = JSON.stringify(
    cart.lines.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
  );
  const quote = quotedBag === bagIdentity ? savedQuote : null;
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const selected = quote?.rates.find((r) => r.id === rate);
  async function rates(form: HTMLFormElement) {
    setBusy(true);
    setError('');
    try {
      const data = new FormData(form);
      const payload = {
        items: cart.lines.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
        email: data.get('email'),
        discount_code: data.get('discount_code') || undefined,
        address: {
          name: data.get('name'),
          street1: data.get('street1'),
          street2: data.get('street2') || '',
          city: data.get('city'),
          state: data.get('state'),
          zip: data.get('zip'),
          country: 'US',
          phone: data.get('phone') || '',
        },
      };
      const response = await fetch('/api/checkout/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || 'We couldn’t retrieve shipping rates. Please try again.');
      setQuote(body);
      setQuotedBag(bagIdentity);
      setRate(body.rates[0]?.id || '');
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!quote || !selected || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote_id: quote.quote_id, rate_id: rate }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Checkout couldn’t start. Please try again.');
      const url = new URL(body.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com')
        throw new Error('Unexpected payment destination. Please contact us.');
      window.location.assign(url.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
      setBusy(false);
    }
  }
  if (!cart.lines.length)
    return (
      <div className="center-state">
        <h1>First, find your favorite.</h1>
        <p>Your bag is empty. Add a little warmth before checking out.</p>
        <Link href="/shop" className="button">
          Shop the collection
        </Link>
      </div>
    );
  return (
    <div className="container">
      <div className="page-intro">
        <p className="eyebrow">A few details, then it’s yours</p>
        <h1>Make yourself at home.</h1>
      </div>
      <div className="checkout-layout checkout-page">
        <div>
          <nav className="steps" aria-label="Checkout progress">
            <span className={!quote ? 'active' : ''}>01 &nbsp; Your details</span>
            <span className={quote ? 'active' : ''}>02 &nbsp; Shipping</span>
            <span>03 &nbsp; Secure payment</span>
          </nav>
          {!enabled && (
            <div className="notice">
              This store is in catalog preview. Checkout will be available once the store owner
              connects the payment, database, and shipping services.
            </div>
          )}
          {error && (
            <div className="error-message mb-5" role="alert">
              {error}
            </div>
          )}
          <form
            hidden={!!quote}
            onSubmit={(e) => {
              e.preventDefault();
              void rates(e.currentTarget);
            }}
          >
            <h2 className="text-[30px] mb-6">Where should we send it?</h2>
            <div className="form-grid">
              <label className="field full">
                Email address
                <input name="email" type="email" autoComplete="email" required maxLength={254} />
                <small>We’ll send your receipt and tracking updates here.</small>
              </label>
              <label className="field full">
                Full name
                <input
                  name="name"
                  autoComplete="shipping name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label className="field full">
                Street address
                <input
                  name="street1"
                  autoComplete="shipping address-line1"
                  required
                  minLength={3}
                  maxLength={150}
                />
              </label>
              <label className="field full">
                Apartment, suite, etc. (optional)
                <input name="street2" autoComplete="shipping address-line2" maxLength={100} />
              </label>
              <label className="field">
                City
                <input name="city" autoComplete="shipping address-level2" required maxLength={80} />
              </label>
              <label className="field">
                State
                <select
                  name="state"
                  autoComplete="shipping address-level1"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select state
                  </option>
                  {[
                    'AL',
                    'AK',
                    'AZ',
                    'AR',
                    'CA',
                    'CO',
                    'CT',
                    'DE',
                    'DC',
                    'FL',
                    'GA',
                    'HI',
                    'ID',
                    'IL',
                    'IN',
                    'IA',
                    'KS',
                    'KY',
                    'LA',
                    'ME',
                    'MD',
                    'MA',
                    'MI',
                    'MN',
                    'MS',
                    'MO',
                    'MT',
                    'NE',
                    'NV',
                    'NH',
                    'NJ',
                    'NM',
                    'NY',
                    'NC',
                    'ND',
                    'OH',
                    'OK',
                    'OR',
                    'PA',
                    'RI',
                    'SC',
                    'SD',
                    'TN',
                    'TX',
                    'UT',
                    'VT',
                    'VA',
                    'WA',
                    'WV',
                    'WI',
                    'WY',
                  ].map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                ZIP code
                <input
                  name="zip"
                  autoComplete="shipping postal-code"
                  inputMode="numeric"
                  pattern="[0-9]{5}(-[0-9]{4})?"
                  required
                  maxLength={10}
                />
              </label>
              <label className="field">
                Country
                <input value="United States" readOnly aria-readonly="true" />
              </label>
              <label className="field full">
                Phone (optional)
                <input name="phone" type="tel" autoComplete="shipping tel" maxLength={30} />
              </label>
              <label className="field full">
                Discount code (optional)
                <input
                  name="discount_code"
                  autoComplete="off"
                  maxLength={40}
                  placeholder="Have a little something?"
                />
              </label>
            </div>
            <p className="text-xs muted my-5">
              We’ll verify your address and retrieve available carrier services. You can review
              everything before paying.
            </p>
            <button type="submit" className="button w-full" disabled={busy || !enabled}>
              {busy ? 'Finding your shipping options…' : 'Continue to shipping'}{' '}
              <ArrowRight size={16} />
            </button>
          </form>
          {quote && (
            <section aria-labelledby="shipping-heading">
              <div className="flex justify-between gap-4 items-center mb-6">
                <h2 id="shipping-heading" className="text-[30px] mb-0">
                  The final stretch.
                </h2>
                <button
                  className="text-xs underline flex gap-2 items-center"
                  disabled={busy}
                  onClick={() => {
                    setQuote(null);
                    setError('');
                  }}
                >
                  <Pencil size={12} />
                  Edit details
                </button>
              </div>
              <div className="card">
                <p className="eyebrow mb-3 flex items-center gap-2">
                  <Check size={14} />
                  Verified shipping address
                </p>
                <address className="not-italic text-sm">
                  {quote.address.name}
                  <br />
                  {quote.address.street1}
                  <br />
                  {quote.address.street2 && (
                    <>
                      {quote.address.street2}
                      <br />
                    </>
                  )}
                  {quote.address.city}, {quote.address.state} {quote.address.zip}
                  <br />
                  United States
                </address>
                <label className="flex gap-3 mt-5 text-xs items-start">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[#5d6752]"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I’ve checked this address, including any corrections, and confirm it’s right.
                </label>
              </div>
              <fieldset className="mt-7">
                <legend className="text-sm mb-2">Choose your shipping service</legend>
                {quote.rates.map((option) => (
                  <label className="shipping-rate" key={option.id}>
                    <input
                      type="radio"
                      name="shipping_rate"
                      value={option.id}
                      checked={rate === option.id}
                      onChange={() => setRate(option.id)}
                    />
                    <span>
                      {option.carrier} · {option.service}
                      <small className="block muted">
                        {option.delivery_days
                          ? `Estimated ${option.delivery_days} business days`
                          : 'Carrier estimate at dispatch'}
                      </small>
                    </span>
                    <strong>
                      {option.amount_cents === 0 ? 'Complimentary' : money(option.amount_cents)}
                    </strong>
                  </label>
                ))}
              </fieldset>
              <p className="text-xs muted my-5">
                Transit estimates begin when the carrier receives your parcel. Applicable taxes are
                calculated securely by Stripe on the next step.
              </p>
              <button
                className="button w-full"
                disabled={busy || !selected || !confirmed}
                onClick={() => void checkout()}
              >
                {busy ? 'Opening secure checkout…' : 'Continue to secure payment'}{' '}
                <LockKeyhole size={15} />
              </button>
              <p className="text-xs muted text-center mt-4">
                By continuing, you agree to our{' '}
                <Link href="/terms" className="underline">
                  terms
                </Link>{' '}
                and{' '}
                <Link href="/returns" className="underline">
                  returns policy
                </Link>
                .
              </p>
            </section>
          )}
        </div>
        <aside className="order-summary">
          <h2>In your bag.</h2>
          {(quote
            ? quote.items.map((item) => ({
                ...item,
                image: item.image_url,
                price_cents: item.unit_price_cents,
              }))
            : cart.lines
          ).map((line) => (
            <div className="cart-line" key={line.variant_id}>
              <div className="cart-line-image">
                {line.image && <Image src={line.image} alt={line.name} fill sizes="65px" />}
              </div>
              <div className="cart-line-info">
                <h3>{line.name}</h3>
                <p>
                  {line.color} / {line.size} · Qty {line.quantity}
                </p>
                <span className="text-xs">{money(line.price_cents * line.quantity)}</span>
              </div>
            </div>
          ))}
          <div className="mt-6">
            <div className="subtotal-row">
              <span>Subtotal</span>
              <span>{money(quote?.subtotal_cents ?? cartSubtotal(cart.lines))}</span>
            </div>
            {quote && quote.discount_cents > 0 && (
              <div className="subtotal-row">
                <span>Discount</span>
                <span>−{money(quote.discount_cents)}</span>
              </div>
            )}
            <div className="subtotal-row">
              <span>Shipping</span>
              <span>
                {selected
                  ? selected.amount_cents === 0
                    ? 'Complimentary'
                    : money(selected.amount_cents)
                  : 'Next step'}
              </span>
            </div>
            <div className="subtotal-row">
              <span>Tax</span>
              <span className="text-xs">Calculated at payment</span>
            </div>
            <div className="subtotal-row pt-4 border-t border-[#cdd1c3]">
              <strong>Before tax</strong>
              <strong>
                {money(
                  (quote?.subtotal_cents ?? cartSubtotal(cart.lines)) -
                    (quote?.discount_cents ?? 0) +
                    (selected?.amount_cents ?? 0),
                )}
              </strong>
            </div>
          </div>
          <Link className="text-xs underline" href="/cart">
            Edit your bag
          </Link>
        </aside>
      </div>
    </div>
  );
}
