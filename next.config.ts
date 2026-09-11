import type { NextConfig } from 'next';
const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const supabaseHost = storageOrigin?.hostname || '*.supabase.co';
const config: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      {
        protocol: storageOrigin?.protocol === 'http:' ? 'http' : 'https',
        hostname: supabaseHost,
        port: storageOrigin?.port || '',
        pathname: '/storage/v1/object/public/product-images/**',
      },
    ],
    dangerouslyAllowLocalIP:
      process.env.NODE_ENV === 'development' &&
      !!storageOrigin &&
      ['127.0.0.1', 'localhost'].includes(storageOrigin.hostname),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com ${storageOrigin?.origin || 'https://*.supabase.co'}; font-src 'self'; connect-src 'self' ${storageOrigin?.origin || 'https://*.supabase.co'}; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'`,
          },
        ],
      },
    ];
  },
};
export default config;
