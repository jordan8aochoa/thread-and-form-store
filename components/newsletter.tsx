'use client';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
export function Newsletter() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <p className="eyebrow">A note from us, now and then</p>
      <h2 id="newsletter-title">Keep good company.</h2>
      <p>New knits, small stories, and a little inspiration. Straight to your inbox.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage('');
          const form = e.currentTarget;
          try {
            const response = await fetch('/api/newsletter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: new FormData(form).get('email'), consent: true }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Please try again.');
            setMessage(
              'Thank you for joining us. If you previously unsubscribed, check your inbox to confirm rejoining.',
            );
            form.reset();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="Your email address"
          autoComplete="email"
        />
        <button type="submit" disabled={busy} aria-label="Subscribe to newsletter">
          <ArrowRight size={20} />
        </button>
      </form>
      <p className="text-xs mt-3">
        By subscribing, you agree to receive our newsletter. Unsubscribe anytime.
      </p>
      <p role="status" className="mt-4">
        {message}
      </p>
    </section>
  );
}
