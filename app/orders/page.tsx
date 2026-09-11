import { OrderLookup } from '@/components/order-lookup';
export const metadata = { title: 'Find your order', robots: { index: false, follow: false } };
export default function OrdersPage() {
  return (
    <div className="container">
      <section className="policy" style={{ maxWidth: 530 }}>
        <p className="eyebrow">From our door to yours</p>
        <h1>Find your order.</h1>
        <p>
          Enter your order details and we’ll email a secure link to your items, fulfillment updates,
          and tracking.
        </p>
        <OrderLookup />
      </section>
    </div>
  );
}
