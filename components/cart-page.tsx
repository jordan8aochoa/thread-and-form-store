'use client';
import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart, CartItem } from './cart-provider';
import { cartSubtotal } from '@/lib/cart';
import { money } from '@/lib/types';
export function CartPage() {
  const cart = useCart();
  return (
    <div className="container">
      <div className="page-intro">
        <p className="eyebrow">Good choices, all together</p>
        <h1>Your bag.</h1>
      </div>
      {cart.lines.length ? (
        <div className="checkout-layout">
          <div>
            {cart.lines.map((line) => (
              <CartItem key={line.variant_id} line={line} />
            ))}
            <Link href="/shop" className="text-link mt-6">
              Keep exploring
            </Link>
          </div>
          <aside className="order-summary">
            <h2>A little warmth, on its way.</h2>
            <div className="subtotal-row">
              <span>Subtotal</span>
              <strong>{money(cartSubtotal(cart.lines))}</strong>
            </div>
            <p className="muted text-xs">
              Shipping and applicable taxes are calculated at checkout. Current prices and
              availability are confirmed before payment.
            </p>
            <Link href="/checkout" className="button w-full mt-5">
              Continue to checkout <ArrowRight size={16} />
            </Link>
            <p className="muted text-xs text-center mt-4">Secure checkout · Guest friendly</p>
          </aside>
        </div>
      ) : (
        <div className="center-state">
          <ShoppingBag size={34} className="mx-auto mb-5" />
          <h2>Your next favorite is waiting.</h2>
          <p>You haven’t added anything to your bag yet.</p>
          <Link href="/shop" className="button">
            Explore the collection
          </Link>
        </div>
      )}
    </div>
  );
}
