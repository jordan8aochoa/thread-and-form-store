import { checked, requiredData, serviceDb } from '@/lib/server/db';
import { errorResponse, hash, PublicError, rateLimit } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    await rateLimit(request, 'order-token', 40);
    const { token } = await context.params;
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new PublicError('This order link is invalid or expired.', 404);
    const db = serviceDb();
    const link = checked(
      await db
        .from('order_lookup_tokens')
        .select('order_id')
        .eq('token_hash', hash(token))
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
    );
    if (!link)
      throw new PublicError('This order link is invalid or expired. Request a new link.', 404);
    const row = requiredData(
      await db
        .from('orders')
        .select(
          'order_number,status,email,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents,refunded_cents,created_at,order_items(name,size,color,sku,quantity,unit_price_cents,image_url),shipments(carrier,service,tracking_code,tracking_url,status)',
        )
        .eq('id', link.order_id)
        .single(),
    );
    const { order_items, ...order } = row;
    return Response.json(
      { order: { ...order, items: order_items } },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer',
          'X-Robots-Tag': 'noindex',
        },
      },
    );
  } catch (error) {
    return errorResponse(error, 'order-details');
  }
}
