import { after } from 'next/server';
import { contactSchema } from '@/lib/submissions';
import { assertOrigin, errorResponse, jsonBody, rateLimit, PublicError } from '@/lib/server/http';
import { checked, configured, serviceDb } from '@/lib/server/db';
import { enqueueEmail, dispatchEmails } from '@/lib/server/email';
export async function POST(request: Request) {
  try {
    if (!configured())
      throw new PublicError(
        'Our contact form is being set up. Please use the support email in the footer.',
        503,
      );
    assertOrigin(request);
    await rateLimit(request, 'contact', 5, 3600);
    const input = contactSchema.parse(await jsonBody(request));
    if (input.website) return Response.json({ ok: true });
    const submission = checked(
      await serviceDb()
        .from('contact_submissions')
        .insert({
          name: input.name,
          email: input.email,
          subject: input.subject,
          message: input.message,
        })
        .select('id')
        .single(),
    );
    const settings = checked(
      await serviceDb()
        .from('store_settings')
        .select('owner_email,support_email')
        .eq('id', 'store')
        .single(),
    );
    if (!submission || !settings) throw new Error('Contact submission could not be saved.');
    await enqueueEmail({
      key: `contact:${submission.id}:customer`,
      kind: 'contact_confirmation',
      to: input.email,
      payload: {
        message:
          'Thank you for getting in touch. Your message has reached us and we’ll reply as soon as we can.',
      },
    });
    await enqueueEmail({
      key: `contact:${submission.id}:owner`,
      kind: 'owner_contact',
      to: process.env.OWNER_NOTIFICATION_EMAIL || settings.owner_email,
      payload: { message: `${input.name} (${input.email}) — ${input.subject}\n\n${input.message}` },
    });
    after(async () => {
      await dispatchEmails();
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'contact');
  }
}
