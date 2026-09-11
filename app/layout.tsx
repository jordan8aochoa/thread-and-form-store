import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/components/cart-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { getSettings } from '@/lib/catalog';
import { configured } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f8f7f3' };
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const description =
    'Thoughtfully simple sweaters and everyday layers. Discover soft knits, relaxed shapes, and your next daily favorite.';
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3006'),
    title: {
      default: `${settings.brand_name} — Good things, made to stay.`,
      template: `%s | ${settings.brand_name}`,
    },
    description,
    openGraph: {
      type: 'website',
      siteName: settings.brand_name,
      title: settings.brand_name,
      description,
    },
    twitter: { card: 'summary_large_image', title: settings.brand_name, description },
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Header
            brand={settings.brand_name}
            announcement={settings.announcement}
            logo={settings.logo_url}
          />
          {!configured() && (
            <div className="preview-note">
              Catalog preview · Sample products and photography · Checkout opens after store setup
            </div>
          )}
          <main id="main">{children}</main>
          <Footer
            brand={settings.brand_name}
            support={settings.support_email}
            social={settings.social_links}
          />
        </CartProvider>
      </body>
    </html>
  );
}
