import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/server/auth';
import { checked } from '@/lib/server/db';
import { uuid } from '@/lib/server/admin';
import {
  ProductEditor,
  InventoryEditor,
  type InventoryAdjustment,
} from '@/components/admin/product-editor';
import type { Product } from '@/lib/types';
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { db } = await requireAdmin();
  const product = checked(
    await db
      .from('products')
      .select('*,product_images(*),product_variants(*)')
      .eq('id', id)
      .maybeSingle(),
  ) as Product | null;
  if (!product) notFound();
  const ids = product.product_variants.map((v) => v.id);
  const history = ids.length
    ? (checked(
        await db
          .from('inventory_adjustments')
          .select('*')
          .in('variant_id', ids)
          .order('created_at', { ascending: false })
          .limit(100),
      ) as InventoryAdjustment[])
    : [];
  return (
    <>
      <ProductEditor key={JSON.stringify(product)} product={product} />
      <InventoryEditor product={product} history={history} />
    </>
  );
}
