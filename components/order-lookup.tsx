'use client';
import { useState } from 'react';
export function OrderLookup() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        setMessage('');
        try {
          const response = await fetch('/api/orders/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: data.get('email'),
              order_number: data.get('order_number'),
            }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Please try again.');
          setMessage(
            'If these details match an order, we’ve emailed a private link. Please check your inbox and spam folder.',
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label className="field full">
          Order number
          <input
            name="order_number"
            required
            placeholder="From your confirmation email"
            maxLength={40}
            autoComplete="off"
          />
        </label>
        <label className="field full">
          Email used at checkout
          <input name="email" type="email" required autoComplete="email" maxLength={254} />
        </label>
      </div>
      <button className="button w-full mt-6" disabled={busy}>
        {busy ? 'Sending your link…' : 'Email my order link'}
      </button>
      {message && (
        <p className="success-message mt-5" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-message mt-5" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
