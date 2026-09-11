import { OrderStatus } from '@/components/order-status';
export const metadata = {
  title: 'Your order',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  return <OrderStatus token={(await params).token} />;
}
