import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/orders', '/checkout', '/cart', '/newsletter'],
    },
    sitemap: `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006').replace(/\/$/, '')}/sitemap.xml`,
  };
}
