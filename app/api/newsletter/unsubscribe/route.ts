import { unsubscribeSchema } from '@/lib/submissions';
import { assertOrigin, errorResponse, jsonBody, rateLimit, hash } from '@/lib/server/http';
import { checked, serviceDb } from '@/lib/server/db';
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, 'unsubscribe', 20, 3600);
    const input = unsubscribeSchema.parse(await jsonBody(request));
    checked(
      await serviceDb()
        .from('newsletter_subscribers')
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq('token_hash', hash(input.token)),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'unsubscribe');
  }
}
