import Link from 'next/link';
import Image from 'next/image';
import { money, type Product } from '@/lib/types';
export const colorHex: Record<string, string> = {
  Oat: '#d0c5ae',
  Moss: '#70775b',
  Cloud: '#edece4',
  Charcoal: '#41443d',
  Clay: '#a97f68',
  Walnut: '#76604c',
  Cream: '#e8dec9',
  Black: '#272925',
  Olive: '#6e7658',
  Sand: '#c6b48f',
  Navy: '#353e4c',
};
export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const image = product.product_images[0];
  const soldOut = !product.product_variants.some((v) => v.active && v.inventory_quantity > 0);
  const colors = [...new Set(product.product_variants.map((v) => v.color))];
  return (
    <article className="product-card">
      <Link
        href={`/products/${product.slug}`}
        className="product-image"
        aria-label={`View ${product.name}`}
      >
        <div className="product-tags">
          {soldOut ? (
            <span className="badge">Sold out</span>
          ) : product.sale_price_cents !== null ? (
            <span className="badge">A little less</span>
          ) : product.featured ? (
            <span className="badge">A daily favorite</span>
          ) : null}
        </div>
        {image && (
          <Image
            src={image.url}
            alt={image.alt || product.name}
            fill
            sizes="(max-width: 700px) 46vw, (max-width: 1050px) 40vw, 30vw"
            priority={priority}
          />
        )}
      </Link>
      <div className="product-bottom">
        <div>
          <h3 className="product-name">
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
          </h3>
          <p className="product-category">
            {product.category} · {colors.length} colors
          </p>
        </div>
        <span className="price">
          {product.sale_price_cents !== null && (
            <span className="old-price">{money(product.price_cents)}</span>
          )}
          {money(product.sale_price_cents ?? product.price_cents)}
        </span>
      </div>
      <div className="swatches" aria-label={`Colors: ${colors.join(', ')}`}>
        {colors.map((color) => (
          <span
            className="swatch"
            style={{ background: colorHex[color] || '#a1a493' }}
            title={color}
            key={color}
          />
        ))}
      </div>
    </article>
  );
}
