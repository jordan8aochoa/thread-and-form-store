'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, X, ArrowRight, ShoppingBag } from 'lucide-react';
import { z } from 'zod';
import type { CartLine } from '@/lib/types';
import { money } from '@/lib/types';
import { addCartLine, setCartQuantity, cartSubtotal, cartCount } from '@/lib/cart';
const schema = z
  .array(
    z.object({
      variant_id: z.uuid(),
      product_id: z.uuid(),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string().max(200),
      size: z.string().max(30),
      color: z.string().max(80),
      quantity: z.number().int().min(1).max(20),
      price_cents: z.number().int().nonnegative(),
      image: z.string(),
      available: z.number().int().nonnegative(),
    }),
  )
  .max(50);
const empty: CartLine[] = [];
let snapshot: CartLine[] = empty;
let loaded = false;
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}
function read() {
  if (!loaded && typeof window !== 'undefined') {
    loaded = true;
    try {
      snapshot = schema.parse(JSON.parse(localStorage.getItem('tf-cart-v1') || '[]'));
    } catch {
      snapshot = [];
    }
  }
  return snapshot;
}
function write(value: CartLine[]) {
  snapshot = value;
  try {
    localStorage.setItem('tf-cart-v1', JSON.stringify(value));
  } catch {}
  emit();
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  const storage = () => {
    loaded = false;
    read();
    emit();
  };
  window.addEventListener('storage', storage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', storage);
  };
}
type CartContextValue = {
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQuantity: (id: string, n: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  replace: (lines: CartLine[]) => void;
};
const CartContext = createContext<CartContextValue | null>(null);
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('Cart provider is required');
  return value;
}
export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, read, () => empty);
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  const close = () => dialog.current?.close();
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const cleanup = () => {
      document.body.style.overflow = '';
    };
    el.addEventListener('close', cleanup);
    return () => {
      el.removeEventListener('close', cleanup);
      cleanup();
    };
  }, []);
  const value: CartContextValue = {
    lines,
    add: (line) => {
      write(addCartLine(read(), line));
      setMessage(`${line.name} added to your bag.`);
      dialog.current?.showModal();
      document.body.style.overflow = 'hidden';
    },
    setQuantity: (id, n) => write(setCartQuantity(read(), id, n)),
    clear: () => write([]),
    open: () => {
      dialog.current?.showModal();
      document.body.style.overflow = 'hidden';
    },
    close,
    replace: write,
  };
  return (
    <CartContext value={value}>
      {children}
      <span className="sr-only" role="status">
        {message}
      </span>
      <dialog
        ref={dialog}
        className="drawer"
        aria-labelledby="bag-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX < rect.left) close();
          }
        }}
      >
        <div className="drawer-inner">
          <div className="drawer-header">
            <h2 id="bag-title">
              Your bag <span className="muted">({cartCount(lines)})</span>
            </h2>
            <button className="icon-button" onClick={close} aria-label="Close bag">
              <X size={21} />
            </button>
          </div>
          <div className="drawer-lines">
            {lines.length ? (
              lines.map((line) => <CartItem key={line.variant_id} line={line} onNavigate={close} />)
            ) : (
              <div className="center-state">
                <ShoppingBag size={30} className="mx-auto mb-5" />
                <h2 style={{ fontSize: 30 }}>A little room for warmth.</h2>
                <p>Your bag is waiting for something good.</p>
                <Link className="button" href="/shop" onClick={close}>
                  Explore the collection
                </Link>
              </div>
            )}
          </div>
          {lines.length > 0 && (
            <div className="drawer-footer">
              <div className="subtotal-row">
                <span>Subtotal</span>
                <strong>{money(cartSubtotal(lines))}</strong>
              </div>
              <p className="muted text-xs mb-5">Shipping and taxes calculated at checkout.</p>
              <Link className="button" href="/checkout" onClick={close}>
                Continue to checkout <ArrowRight size={16} />
              </Link>
              <Link
                className="block text-center text-xs underline mt-4"
                href="/cart"
                onClick={close}
              >
                View your bag
              </Link>
            </div>
          )}
        </div>
      </dialog>
    </CartContext>
  );
}
export function CartItem({ line, onNavigate }: { line: CartLine; onNavigate?: () => void }) {
  const cart = useCart();
  return (
    <article className="cart-line">
      <Link className="cart-line-image" href={`/products/${line.slug}`} onClick={onNavigate}>
        {line.image && <Image src={line.image} alt={line.name} fill sizes="100px" />}
      </Link>
      <div className="cart-line-info">
        <div className="flex justify-between gap-3">
          <h3>
            <Link href={`/products/${line.slug}`} onClick={onNavigate}>
              {line.name}
            </Link>
          </h3>
          <span className="text-xs whitespace-nowrap">
            {money(line.price_cents * line.quantity)}
          </span>
        </div>
        <p>
          {line.color} / {line.size}
        </p>
        <div className="cart-line-actions">
          <Quantity
            value={line.quantity}
            max={line.available}
            onChange={(n) => cart.setQuantity(line.variant_id, n)}
            label={`Quantity for ${line.name}, ${line.color}, ${line.size}`}
          />
          <button
            className="remove-button"
            onClick={() => cart.setQuantity(line.variant_id, 0)}
            aria-label={`Remove ${line.name}, ${line.color}, ${line.size}`}
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
export function Quantity({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="quantity-control" role="group" aria-label={label}>
      <button
        aria-label="Decrease quantity"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        <Minus size={12} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        aria-label="Increase quantity"
        disabled={value >= Math.min(max, 20)}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
