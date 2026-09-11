import { unsubscribeSchema } from '@/lib/submissions';
import { checked, serviceDb } from '@/lib/server/db';
import {
  assertOrigin,
  errorResponse,
  hash,
  jsonBody,
  PublicError,
  rateLimit,
} from '@/lib/server/http';
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit(request, 'newsletter-confirm', 20, 3600);
    const { token } = unsubscribeSchema.parse(await jsonBody(request));
    const subscriber = checked(
      await serviceDb()
        .from('newsletter_subscribers')
        .select('id')
        .eq('token_hash', hash(token))
        .maybeSingle(),
    );
    if (!subscriber)
      throw new PublicError(
        'This link is no longer valid. Please sign up again to request a new one.',
      );
    checked(
      await serviceDb()
        .from('newsletter_subscribers')
        .update({ unsubscribed_at: null })
        .eq('id', subscriber.id),
    );
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error, 'newsletter-confirm');
  }
}
