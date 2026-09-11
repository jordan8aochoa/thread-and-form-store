import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getProducts, getSettings } from '@/lib/catalog';
import { ProductDetail } from '@/components/product-detail';
import { ProductCard } from '@/components/product-card';
import { serializeJsonLd } from '@/lib/seo';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: 'Product not found' };
  return {
    title: product.seo_title || product.name,
    description: product.seo_description || product.description.slice(0, 160),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.seo_description || product.description.slice(0, 160),
      images: product.product_images.map((i) => ({ url: i.url, alt: i.alt })),
    },
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const settings = await getSettings();
  const related = (await getProducts()).filter((p) => p.id !== product.id).slice(0, 3);
  const app = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3006';
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.product_images.map((i) => new URL(i.url, app).toString()),
    brand: { '@type': 'Brand', name: settings.brand_name },
    offers: {
      '@type': 'Offer',
      price: ((product.sale_price_cents ?? product.price_cents) / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: product.product_variants.some((v) => v.inventory_quantity > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${app}/products/${product.slug}`,
    },
  };
  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structured) }}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/shop">The collection</Link>
        <span>/</span>
        <span>{product.name}</span>
      </nav>
      <ProductDetail product={product} />
      <section className="section border-t border-[#dcded5]">
        <div className="section-heading">
          <h2>Good together.</h2>
          <Link className="text-link" href="/shop">
            Explore the collection
          </Link>
        </div>
        <div className="product-grid featured-grid">
          {related.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
