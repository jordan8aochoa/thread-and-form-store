'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, X, Package, ShieldCheck } from 'lucide-react';
import { money, unitPrice, type Product } from '@/lib/types';
import { useCart, Quantity } from './cart-provider';
import { colorHex } from './product-card';
export function ProductDetail({ product }: { product: Product }) {
  const [imageIndex, setImageIndex] = useState(0);
  const variants = product.product_variants.filter((v) => v.active);
  const [color, setColor] = useState(variants[0]?.color || '');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const cart = useCart();
  const guide = useRef<HTMLDialogElement>(null);
  const selected = variants.find((v) => v.color === color && v.size === size);
  const colors = [...new Set(variants.map((v) => v.color))];
  const sizes = [...new Set(variants.map((v) => v.size))];
  const image = product.product_images[imageIndex];
  const inBag = selected ? cart.lines.find((l) => l.variant_id === selected.id)?.quantity || 0 : 0;
  const available = Math.max(0, (selected?.inventory_quantity || 0) - inBag);
  const price = unitPrice(product, selected);
  return (
    <div className="product-detail">
      <div>
        <div className="gallery-main">
          {image && (
            <Image
              src={image.url}
              alt={image.alt || product.name}
              fill
              priority
              sizes="(max-width:700px) 100vw,55vw"
            />
          )}
        </div>
        {product.product_images.length > 1 && (
          <div className="thumbnails" aria-label="Product photos">
            {product.product_images.map((image, i) => (
              <button
                key={image.id}
                className="thumbnail"
                aria-label={`View photo ${i + 1}`}
                aria-pressed={imageIndex === i}
                onClick={() => setImageIndex(i)}
              >
                <Image src={image.url} alt={image.alt} fill sizes="85px" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="product-info">
        <p className="eyebrow">{product.category} / An everyday essential</p>
        <h1>{product.name}</h1>
        <div className="price">
          {product.sale_price_cents !== null && selected?.price_override_cents == null && (
            <span className="old-price">{money(product.price_cents)}</span>
          )}
          {money(price)}
        </div>
        <p className="product-description">{product.description}</p>
        <p className="option-label">Color — {color}</p>
        <div className="option-list" role="group" aria-label="Choose a color">
          {colors.map((value) => (
            <button
              className="option-button flex items-center gap-2"
              key={value}
              aria-pressed={color === value}
              onClick={() => {
                setColor(value);
                setQuantity(1);
                setMessage('');
              }}
            >
              <span className="swatch" style={{ background: colorHex[value] || '#a1a493' }} />
              {value}
            </button>
          ))}
        </div>
        <div className="option-label">
          <span>Size {size && `— ${size}`}</span>
          <button className="underline" onClick={() => guide.current?.showModal()}>
            Size guide
          </button>
        </div>
        <div className="option-list" role="group" aria-label="Choose a size">
          {sizes.map((value) => {
            const v = variants.find((v) => v.color === color && v.size === value);
            return (
              <button
                className="option-button"
                key={value}
                disabled={!v}
                aria-pressed={size === value}
                onClick={() => {
                  setSize(value);
                  setQuantity(1);
                  setMessage('');
                }}
                style={
                  v?.inventory_quantity === 0
                    ? { textDecoration: 'line-through', color: '#8b8e84' }
                    : undefined
                }
              >
                {value}
              </button>
            );
          })}
        </div>
        <p className="stock-note" aria-live="polite">
          {!selected
            ? 'Choose your size to check availability.'
            : selected.inventory_quantity === 0
              ? 'This variant is sold out.'
              : available === 0
                ? 'All available pieces are already in your bag.'
                : available <= 5
                  ? `Just ${available} left in this size and color.`
                  : 'In stock. Ready for your everyday.'}
        </p>
        <div className="purchase-row">
          <Quantity
            value={quantity}
            max={available}
            onChange={setQuantity}
            label="Quantity to add"
          />
          <button
            className="button"
            disabled={!!selected && available === 0}
            onClick={() => {
              if (!selected) {
                setMessage('Please choose a size.');
                return;
              }
              const count = Math.min(quantity, available);
              if (count < 1) return;
              cart.add({
                variant_id: selected.id,
                product_id: product.id,
                slug: product.slug,
                name: product.name,
                size: selected.size,
                color: selected.color,
                quantity: count,
                price_cents: price,
                image: product.product_images[0]?.url || '',
                available: selected.inventory_quantity,
              });
              setMessage('Added to your bag.');
            }}
          >
            {selected && available === 0 ? 'Sold out' : 'Add to bag'} <ArrowRight size={16} />
          </button>
        </div>
        <p className="text-xs mt-3" role="status">
          {message}
        </p>
        <div className="flex flex-col gap-2 text-xs muted mt-6">
          <span className="flex items-center gap-2">
            <Package size={14} />
            Shipping services shown at checkout
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} />
            Secure payment with Stripe
          </span>
        </div>
        <div className="product-facts">
          <details>
            <summary>Fit & feel</summary>
            <p>
              See the product description for this style’s fit, fiber content, and measurements. Our
              sample size guide is a starting point; contact us if you need a hand.
            </p>
          </details>
          <details>
            <summary>A little care goes a long way</summary>
            <p>
              Always follow your garment’s care label. Air between wears, fold to store, and use a
              gentle sweater comb for natural pilling.
            </p>
          </details>
          <details>
            <summary>Shipping & returns</summary>
            <p>
              Available shipping services and estimated transit times are shown before payment. Read
              our{' '}
              <Link className="underline" href="/shipping">
                shipping policy
              </Link>{' '}
              and{' '}
              <Link className="underline" href="/returns">
                returns policy
              </Link>{' '}
              for details.
            </p>
          </details>
        </div>
      </div>
      <dialog ref={guide} className="dialog" aria-labelledby="size-guide-title">
        <div className="flex justify-between gap-5">
          <h2 id="size-guide-title">Find your fit.</h2>
          <button
            className="icon-button"
            aria-label="Close size guide"
            onClick={() => guide.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-xs muted">
          Sample body measurements in inches. Replace with your brand’s measurements before launch.
        </p>
        <table>
          <caption className="sr-only">Sample sweater size guide</caption>
          <thead>
            <tr>
              <th>Size</th>
              <th>Chest</th>
              <th>Waist</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['XS', '32–34', '26–28'],
              ['S', '35–37', '29–31'],
              ['M', '38–40', '32–34'],
              ['L', '41–43', '35–37'],
              ['XL', '44–46', '38–40'],
              ['XXL', '47–49', '41–43'],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs muted mt-5">
          Measure around the fullest part of your chest. Between sizes? Choose the larger size for a
          relaxed fit.
        </p>
      </dialog>
    </div>
  );
}
