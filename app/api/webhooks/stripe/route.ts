import { errorResponse, PublicError } from '@/lib/server/http';
import { verifyStripeEvent } from '@/lib/server/stripe';
import { processStripeEvent } from '@/lib/server/webhooks';
import { after } from 'next/server';
import { dispatchEmails, enqueueEmail } from '@/lib/server/email';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1_048_576) throw new PublicError('Payload too large.', 413);
    let event;
    try {
      event = verifyStripeEvent(raw, request.headers.get('stripe-signature'));
    } catch {
      throw new PublicError('Invalid webhook signature or mode.', 400);
    }
    try {
      const result = await processStripeEvent(event);
      after(async () => {
        try {
          await dispatchEmails();
        } catch {
          console.error('Order email dispatch deferred to scheduled retry');
        }
      });
      return Response.json(result);
    } catch (error) {
      await enqueueEmail({
        key: `webhook-failed:${event.id}`,
        kind: 'payment_attention',
        payload: {
          message: `Verified Stripe event ${event.id} could not be applied. Stripe will retry. Inspect the event and order state before fulfillment.`,
        },
      });
      throw error;
    }
  } catch (error) {
    return errorResponse(error, 'stripe-webhook');
  }
}
