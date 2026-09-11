'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import { useCart } from './cart-provider';
import { cartCount } from '@/lib/cart';
import { useRef } from 'react';
export function Header({
  brand,
  announcement,
  logo,
}: {
  brand: string;
  announcement: string;
  logo: string;
}) {
  const cart = useCart();
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {announcement && <div className="announcement">{announcement}</div>}
      <header className="site-header">
        <div className="container nav-inner">
          <nav aria-label="Main navigation" className="nav-left">
            <Link href="/shop">Shop all</Link>
            <Link href="/shop?sort=newest">New arrivals</Link>
            <Link href="/about">Our story</Link>
          </nav>
          <details className="mobile-nav" ref={menu}>
            <summary aria-label="Open navigation">
              <Menu size={21} />
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="mobile-menu"
              onClick={() => {
                if (menu.current) menu.current.open = false;
              }}
            >
              <Link href="/shop">Shop all</Link>
              <Link href="/shop?sort=newest">New arrivals</Link>
              <Link href="/about">Our story</Link>
              <Link href="/orders">Find your order</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </details>
          <Link href="/" className="wordmark" aria-label={`${brand} home`}>
            {logo ? (
              <Image
                src={logo}
                alt={brand}
                width={180}
                height={44}
                style={{ objectFit: 'contain', height: 40 }}
              />
            ) : (
              brand
            )}
          </Link>
          <div className="nav-right">
            <Link className="desktop-link" href="/orders">
              Find your order
            </Link>
            <Link
              href="/shop?focus=search"
              className="icon-button desktop-link"
              aria-label="Search sweaters"
            >
              <Search size={18} />
            </Link>
            <button
              className="icon-button cart-trigger"
              aria-label={`Open bag, ${cartCount(cart.lines)} items`}
              onClick={cart.open}
            >
              <ShoppingBag size={20} />
              {cartCount(cart.lines) > 0 && (
                <span className="cart-dot">{cartCount(cart.lines)}</span>
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
