'use client';
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="admin-error-page">
      <h1>Your studio needs a moment.</h1>
      <p className="admin-note error" role="alert">
        We could not load the store data. Check your connection and server setup, then try again.
      </p>
      <button onClick={reset} className="admin-button">
        Try again
      </button>
    </div>
  );
}
