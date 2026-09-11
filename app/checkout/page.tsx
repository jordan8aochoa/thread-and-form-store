import type { Metadata } from 'next';
import { Checkout } from '@/components/checkout';
import { configured } from '@/lib/server/db';
export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };
export default function CheckoutPage() {
  return (
    <Checkout
      enabled={configured() && !!process.env.STRIPE_SECRET_KEY && !!process.env.EASYPOST_API_KEY}
    />
  );
}
