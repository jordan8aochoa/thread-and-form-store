import { after } from 'next/server';
import { newsletterSchema } from '@/lib/submissions';
import {
  appUrl,
  assertOrigin,
  errorResponse,
  jsonBody,
  rateLimit,
  PublicError,
  hash,
  token,
} from '@/lib/server/http';
import { checked, configured, serviceDb } from '@/lib/server/db';
import { enqueueEmail, dispatchEmails } from '@/lib/server/email';
export async function POST(request: Request) {
  try {
    if (!configured())
      throw new PublicError('Our newsletter is being set up. Please check back soon.', 503);
    assertOrigin(request);
    await rateLimit(request, 'newsletter', 5, 3600);
    const input = newsletterSchema.parse(await jsonBody(request));
    const capability = token();
    const existing = checked(
      await serviceDb()
        .from('newsletter_subscribers')
        .select('id,unsubscribed_at')
        .eq('email', input.email)
        .maybeSingle(),
    );
    if (existing) {
      if (existing.unsubscribed_at) {
        checked(
          await serviceDb()
            .from('newsletter_subscribers')
            .update({ token_hash: hash(capability) })
            .eq('id', existing.id),
        );
        await enqueueEmail({
          key: `newsletter-rejoin:${hash(capability)}`,
          kind: 'newsletter',
          to: input.email,
          payload: {
            message:
              'You asked to rejoin our newsletter. Confirm using the secure link below. If you did not request this, ignore this email; your subscription remains paused.',
            url: `${appUrl()}/newsletter/resubscribe?token=${capability}`,
          },
        });
        after(async () => {
          await dispatchEmails();
        });
      }
      return Response.json({ ok: true });
    }
    const result = await serviceDb()
      .from('newsletter_subscribers')
      .insert({ email: input.email, token_hash: hash(capability) })
      .select('id')
      .single();
    if (result.error?.code === '23505') return Response.json({ ok: true });
    const subscriber = checked(result);
    if (!subscriber) throw new Error('Subscription could not be saved.');
    await enqueueEmail({
      key: `newsletter:${subscriber.id}`,
      kind: 'newsletter',
      to: input.email,
      payload: {
        message:
          'Welcome to our little corner. You’re subscribed for new knits, small stories, and occasional updates. Use the link below if you ever want to unsubscribe.',
        url: `${appUrl()}/newsletter/unsubscribe?token=${capability}`,
      },
    });
    after(async () => {
      await dispatchEmails();
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'newsletter');
  }
}
