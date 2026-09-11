import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="center-state">
      <p className="eyebrow">404 / A loose thread</p>
      <h1>This page slipped away.</h1>
      <p>Let’s find your way back to something good.</p>
      <Link className="button" href="/shop">
        Explore the collection
      </Link>
    </div>
  );
}
