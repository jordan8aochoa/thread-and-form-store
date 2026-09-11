import { z } from 'zod';
import { checked, serviceDb } from '@/lib/server/db';
import { applyTracker } from '@/lib/server/fulfillment';
import { errorResponse, PublicError } from '@/lib/server/http';
import { verifyEasyPostWebhook } from '@/lib/server/shipping';
import { after } from 'next/server';
import { dispatchEmails } from '@/lib/server/email';
export const runtime = 'nodejs';
const schema = z.object({
  id: z.string().startsWith('evt_'),
  description: z.string(),
  mode: z.enum(['test', 'production']),
  result: z.object({ id: z.string() }),
});
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1_048_576) throw new PublicError('Payload too large.', 413);
    verifyEasyPostWebhook(raw, request.headers.get('x-hmac-signature'));
    const event = schema.parse(JSON.parse(raw));
    if (event.mode !== (process.env.EASYPOST_MODE ?? 'test'))
      throw new PublicError('Webhook mode mismatch.', 400);
    if (event.description === 'tracker.updated' && /^trk_[a-zA-Z0-9]+$/.test(event.result.id))
      await applyTracker(event.id, event.result.id);
    else
      checked(
        await serviceDb()
          .from('webhook_events')
          .upsert(
            { id: event.id, provider: 'easypost', type: event.description },
            { onConflict: 'id', ignoreDuplicates: true },
          ),
      );
    after(async () => {
      try {
        await dispatchEmails();
      } catch {
        console.error('Tracking email dispatch deferred to scheduled retry');
      }
    });
    return Response.json({ received: true });
  } catch (error) {
    return errorResponse(error, 'easypost-webhook');
  }
}
