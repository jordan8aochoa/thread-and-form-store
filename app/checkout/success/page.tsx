import Link from 'next/link';
import { MailCheck } from 'lucide-react';
export const metadata = { title: 'Thank you', robots: { index: false, follow: false } };
export default function CheckoutSuccess() {
  return (
    <div className="center-state">
      <MailCheck size={34} className="mx-auto mb-6" />
      <p className="eyebrow">Thank you for being here</p>
      <h1>
        A good choice.
        <br />A little more warmth.
      </h1>
      <p>
        Your payment is being confirmed securely. Once confirmed, we’ll send your order receipt and
        a private order link by email. It can take a moment to arrive.
      </p>
      <p>
        This page is a checkout return, not proof of payment. Your confirmation email has the final
        details.
      </p>
      <div className="flex gap-3 justify-center flex-wrap mt-7">
        <Link className="button" href="/orders">
          Find your order
        </Link>
        <Link className="button button-secondary" href="/shop">
          Keep exploring
        </Link>
      </div>
    </div>
  );
}
