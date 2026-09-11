'use client';
import { useState } from 'react';
export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError('');
        setMessage('');
        try {
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(data)),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Please try again.');
          setMessage(
            'Your note is with us. We’ll send a confirmation to your inbox and be in touch soon.',
          );
          form.reset();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label className="field">
          Your name
          <input name="name" required minLength={2} maxLength={100} autoComplete="name" />
        </label>
        <label className="field">
          Email address
          <input name="email" required type="email" maxLength={254} autoComplete="email" />
        </label>
        <label className="field full">
          What can we help with?
          <select name="subject" defaultValue="Order question">
            <option>Order question</option>
            <option>Sizing & product details</option>
            <option>Returns & exchanges</option>
            <option>Something else</option>
          </select>
        </label>
        <label className="field full">
          Your message
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={5000}
            placeholder="If this is about an order, include your order number. Please don’t send payment card information."
          />
        </label>
        <label className="hidden" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button className="button mt-6" disabled={busy}>
        {busy ? 'Sending…' : 'Send your note'}
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
