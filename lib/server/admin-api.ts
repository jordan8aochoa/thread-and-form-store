import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAdmin, serverAuth } from './auth';
import { checked } from './db';
import { assertOrigin, errorResponse, jsonBody, PublicError, rateLimit } from './http';
import {
  acceptedImage,
  deleteSchema,
  discountSchema,
  inventorySchema,
  labelSchema,
  manualFulfillmentSchema,
  productSchema,
  refundSchema,
  settingsSchema,
  uuid,
} from './admin';
import { getOrderRates, purchaseOrderLabel, fulfillManually, refundOrder } from './fulfillment';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { dispatchEmails } from './email';

export async function handleAdminRequest(request: Request, path: string[]) {
  try {
    assertOrigin(request);
    const [resource, id, action] = path;
    if (resource === 'login' && request.method === 'POST' && path.length === 1) {
      await rateLimit(request, 'admin-login', 8, 900);
      const credentials = z
        .object({ email: z.string().email().max(254), password: z.string().min(1).max(256) })
        .parse(await jsonBody(request));
      const auth = await serverAuth();
      const { error } = await auth.auth.signInWithPassword(credentials);
      if (error) throw new PublicError('Email or password is incorrect.', 401);
      try {
        await requireAdmin();
      } catch {
        await auth.auth.signOut();
        throw new PublicError('This account is not an approved store administrator.', 403);
      }
      return Response.json({ ok: true });
    }
    const { user, db } = await requireAdmin();
    await rateLimit(request, 'admin-mutations', 120, 60, user.id);
    if (resource === 'logout' && request.method === 'POST' && path.length === 1) {
      const auth = await serverAuth();
      const { error } = await auth.auth.signOut();
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (resource === 'upload' && request.method === 'POST' && path.length === 1) {
      if (Number(request.headers.get('content-length') || 0) > 4_200_000)
        throw new PublicError('Images must be smaller than 4 MB.', 413);
      const data = await request.formData();
      const file = data.get('file');
      if (!(file instanceof File) || file.size === 0 || file.size > 4_000_000)
        throw new PublicError('Choose an image smaller than 4 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!acceptedImage(bytes, file.type))
        throw new PublicError('Upload a valid JPEG, PNG, or WebP image.');
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
        file.type
      ];
      const key = `${user.id}/${randomUUID()}.${extension}`;
      checked(
        await db.storage
          .from('product-images')
          .upload(key, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false }),
      );
      const { data: uploaded } = db.storage.from('product-images').getPublicUrl(key);
      return Response.json({ url: uploaded.publicUrl }, { status: 201 });
    }
    const body = await jsonBody(request);
    if (resource === 'products' && request.method === 'POST' && path.length === 1) {
      const { variants, images, ...product } = productSchema.parse(body);
      const productId = checked(
        await db.rpc('save_product', {
          p_product: product,
          p_variants: variants,
          p_images: images,
          p_admin_id: user.id,
        }),
      );
      revalidatePath('/', 'layout');
      return Response.json({ id: productId });
    }
    if (resource === 'products' && id && path.length === 2 && request.method === 'DELETE') {
      uuid.parse(id);
      deleteSchema.parse(body);
      checked(await db.rpc('delete_product', { p_product_id: id, p_admin_id: user.id }));
      revalidatePath('/', 'layout');
      return Response.json({ ok: true });
    }
    if (
      resource === 'products' &&
      id &&
      action === 'archive' &&
      path.length === 3 &&
      request.method === 'POST'
    ) {
      uuid.parse(id);
      deleteSchema.parse(body);
      checked(
        await db
          .from('products')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('id')
          .single(),
      );
      revalidatePath('/', 'layout');
      return Response.json({ ok: true });
    }
    if (resource === 'inventory' && path.length === 1 && request.method === 'POST') {
      const input = inventorySchema.parse(body);
      checked(
        await db.rpc('adjust_inventory', {
          p_variant_id: input.variant_id,
          p_quantity_change: input.quantity_change,
          p_reason: input.reason,
          p_admin_id: user.id,
        }),
      );
      revalidatePath('/', 'layout');
      return Response.json({ ok: true });
    }
    if (resource === 'discounts' && path.length === 1 && request.method === 'POST') {
      const { id: discountId, ...discount } = discountSchema.parse(body);
      const query = discountId
        ? db.from('discounts').update(discount).eq('id', discountId)
        : db.from('discounts').insert(discount);
      const result = checked(await query.select('id').single());
      revalidatePath('/admin/discounts');
      return Response.json(result);
    }
    if (resource === 'discounts' && id && path.length === 2 && request.method === 'DELETE') {
      uuid.parse(id);
      deleteSchema.parse(body);
      const held = checked(
        await db
          .from('checkout_reservations')
          .select('id')
          .eq('discount_id', id)
          .in('status', ['creating', 'active'])
          .limit(1),
      );
      if (held?.length)
        throw new PublicError(
          'This discount is in an open checkout. Disable it first and delete it after the checkout closes.',
        );
      checked(await db.from('discounts').delete().eq('id', id));
      revalidatePath('/admin/discounts');
      return Response.json({ ok: true });
    }
    if (resource === 'settings' && path.length === 1 && request.method === 'POST') {
      const settings = settingsSchema.parse(body);
      checked(await db.from('store_settings').upsert({ id: 'store', ...settings }));
      revalidatePath('/', 'layout');
      return Response.json({ ok: true });
    }
    if (resource === 'orders' && id && path.length === 3 && request.method === 'POST') {
      uuid.parse(id);
      if (['label', 'fulfill', 'refund'].includes(action))
        after(async () => {
          try {
            await dispatchEmails();
          } catch {
            console.error(
              JSON.stringify({
                operation: 'admin-email-dispatch',
                error: 'EmailDispatchUnavailable',
              }),
            );
          }
        });
      let result: unknown;
      if (action === 'rates') {
        z.object({}).parse(body);
        result = await getOrderRates(id);
      } else if (action === 'label') {
        const input = labelSchema.parse(body);
        result = await purchaseOrderLabel(id, input.shipment_id, input.rate_id, user.id);
      } else if (action === 'fulfill') {
        const input = manualFulfillmentSchema.parse(body);
        result = await fulfillManually(
          id,
          {
            carrier: input.carrier,
            tracking_code: input.tracking_code,
            tracking_url: input.tracking_url,
          },
          user.id,
        );
      } else if (action === 'refund') {
        const input = refundSchema.parse(body);
        result = await refundOrder(id, { reason: input.reason, restock: input.restock }, user.id);
      } else if (action === 'processing') {
        deleteSchema.parse(body);
        checked(await db.rpc('start_processing', { p_order_id: id, p_admin_id: user.id }));
        result = { ok: true };
      } else throw new PublicError('Action not found.', 404);
      revalidatePath('/admin');
      return Response.json(result ?? { ok: true });
    }
    throw new PublicError('Action not found.', 404);
  } catch (error) {
    return errorResponse(error, 'admin-request');
  }
}
