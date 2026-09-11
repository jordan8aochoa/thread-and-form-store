import { z } from 'zod';
import { after } from 'next/server';
import { checked, serviceDb } from '@/lib/server/db';
import { dispatchEmails, enqueueEmail } from '@/lib/server/email';
import { assertOrigin, errorResponse, jsonBody, rateLimit, token } from '@/lib/server/http';
export const runtime = 'nodejs';
const schema = z.object({
  order_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^TF-[A-F0-9]{12}$/),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
});
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, 'order-lookup', 6);
    const body = schema.parse(await jsonBody(request));
    await rateLimit(request, 'order-lookup-email', 3, 900, body.email);
    const order = checked(
      await serviceDb()
        .from('orders')
        .select('id,email')
        .eq('order_number', body.order_number)
        .eq('email', body.email)
        .maybeSingle(),
    );
    if (order)
      await enqueueEmail({
        key: `lookup:${token()}`,
        kind: 'order_lookup',
        to: order.email,
        payload: { order_id: order.id },
      });
    after(async () => {
      try {
        await dispatchEmails();
      } catch {
        console.error('Order lookup email dispatch deferred to scheduled retry');
      }
    });
    return Response.json(
      {
        ok: true,
        message: 'If those details match an order, a secure link will be emailed to you.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, 'order-lookup');
  }
}
