import Link from 'next/link';
export const metadata = { title: 'Checkout paused', robots: { index: false, follow: false } };
export default function CheckoutCanceled() {
  return (
    <div className="center-state">
      <p className="eyebrow">Take your time</p>
      <h1>Your bag is still here.</h1>
      <p>
        You left checkout before completing payment. You can review your bag and try again whenever
        you’re ready.
      </p>
      <Link className="button" href="/cart">
        Back to your bag
      </Link>
    </div>
  );
}
