import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006').replace(/\/$/, '');
  const pages = [
    '',
    '/shop',
    '/about',
    '/contact',
    '/faq',
    '/shipping',
    '/returns',
    '/privacy',
    '/terms',
  ];
  return [
    ...pages.map((path) => ({
      url: `${base}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path ? 0.6 : 1,
    })),
    ...(await getProducts()).map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: new Date(p.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
