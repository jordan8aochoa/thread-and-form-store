import 'server-only';
import { cache } from 'react';
import { configured, publicDb, serviceDb } from '@/lib/server/db';
import { demoProducts, defaultSettings } from '@/lib/demo';
import type { Product, StoreSettings } from '@/lib/types';
export const getProducts = cache(async (): Promise<Product[]> => {
  if (!configured()) return demoProducts;
  const { data, error } = await publicDb()
    .from('products')
    .select('*,product_images(*),product_variants(*)')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error('The collection is temporarily unavailable. Please try again.');
  return (data as Product[]).map((p) => ({
    ...p,
    product_images: p.product_images.sort((a, b) => a.position - b.position),
    product_variants: p.product_variants.filter((v) => v.active),
  }));
});
export async function getProduct(slug: string) {
  return (await getProducts()).find((p) => p.slug === slug);
}
export const getSettings = cache(async (): Promise<StoreSettings> => {
  if (!configured()) return defaultSettings;
  const { data, error } = await serviceDb()
    .from('store_settings')
    .select('*')
    .eq('id', 'store')
    .single();
  if (error) throw new Error('Store settings are temporarily unavailable.');
  return { ...defaultSettings, ...data } as StoreSettings;
});
