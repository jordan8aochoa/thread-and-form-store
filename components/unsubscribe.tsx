'use client';
import { useState } from 'react';
export function Unsubscribe({ token, rejoin = false }: { token: string; rejoin?: boolean }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  return (
    <div className="center-state">
      <p className="eyebrow">Your inbox, your choice</p>
      <h1>{rejoin ? 'Good company, again.' : 'A little less mail.'}</h1>
      <p>
        {rejoin
          ? 'Confirm below to receive new knits, small stories, and occasional updates. You can unsubscribe anytime.'
          : 'Confirm below to stop receiving our newsletter. You’ll still receive essential updates for any orders you place.'}
      </p>
      <button
        className="button"
        disabled={busy || complete}
        onClick={async () => {
          setBusy(true);
          try {
            const response = await fetch(
              `/api/newsletter/${rejoin ? 'resubscribe' : 'unsubscribe'}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
              },
            );
            const body = await response.json();
            if (!response.ok) throw new Error(body.error);
            setMessage(
              rejoin
                ? 'You’re back on the list. Welcome back.'
                : 'You’ve been unsubscribed. Thank you for spending a little time with us.',
            );
            setComplete(true);
          } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Updating…' : rejoin ? 'Confirm subscription' : 'Unsubscribe'}
      </button>
      <p role="status" className="mt-5">
        {message}
      </p>
    </div>
  );
}
