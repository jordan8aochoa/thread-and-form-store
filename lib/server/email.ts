import 'server-only';
import { createHmac } from 'node:crypto';
import { Resend } from 'resend';
import { appUrl, hash } from './http';
import { checked, required, requiredData, serviceDb } from './db';
import { money } from '../types';

type Payload = Record<string, unknown>;
export async function enqueueEmail({
  key,
  kind,
  to,
  payload,
}: {
  key: string;
  kind: string;
  to?: string;
  payload: Payload;
}) {
  checked(
    await serviceDb()
      .from('email_outbox')
      .upsert(
        { dedupe_key: key, kind, recipient: to ?? null, payload },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      ),
  );
}
export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
const titles: Record<string, string> = {
  order_confirmation: 'Your order is confirmed',
  owner_order: 'A new paid order has arrived',
  low_stock: 'A favorite is running low',
  payment_attention: 'A payment needs attention',
  shipping_confirmation: 'Your order is on its way',
  delivery: 'Your order has arrived',
  refund: 'Your refund is confirmed',
  contact_confirmation: 'We received your message',
  owner_contact: 'A new customer message',
  order_lookup: 'Your secure order link',
  label_failed: 'Shipping label needs attention',
  newsletter: 'Welcome to Thread & Form',
};
const messages: Record<string, string> = {
  order_confirmation:
    'Thank you for choosing thoughtfully made layers. We are getting your order ready.',
  owner_order: 'A verified payment has been received. Review the order in your dashboard.',
  shipping_confirmation: 'Your new favorite layer is on its way. Follow its journey below.',
  delivery: 'Your shipment has been marked delivered by the carrier. We hope you love it.',
  refund:
    'Your refund has been confirmed by our payment provider. Your bank may take several business days to display it.',
  contact_confirmation:
    'Thank you for getting in touch. Our team will reply to your email as soon as possible.',
  order_lookup: 'Use the secure link below to view your order. This link expires in 24 hours.',
  label_failed:
    'The shipping provider did not confirm a label purchase. Open this order and retry the existing shipment to reconcile its result.',
};
export function renderEmail(kind: string, payload: Payload, brand = 'Thread & Form') {
  const title = titles[kind] ?? 'An update from your store';
  const items = Array.isArray(payload.items) ? (payload.items as Record<string, unknown>[]) : [];
  const safeUrl =
    typeof payload.url === 'string' && /^https?:\/\//.test(payload.url) ? payload.url : '';
  const text = [
    brand,
    title,
    payload.order_number,
    messages[kind] ?? '',
    payload.message,
    ...items.map((i) => `${i.name} · ${i.size} / ${i.color} × ${i.quantity}`),
    typeof payload.amount_cents === 'number' ? money(payload.amount_cents) : '',
    safeUrl,
  ]
    .filter(Boolean)
    .join('\n\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ed;color:#24251f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px"><table role="presentation" width="560" style="max-width:100%;background:#fff;border:1px solid #e4e2db" cellpadding="32"><tr><td><p style="font-size:14px;letter-spacing:3px">${escapeHtml(brand)}</p><h1 style="font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>${payload.order_number ? `<p>Order ${escapeHtml(payload.order_number)}</p>` : ''}<p style="line-height:1.7">${escapeHtml(messages[kind] ?? '')}</p>${payload.message ? `<p style="line-height:1.7;white-space:pre-wrap">${escapeHtml(payload.message)}</p>` : ''}${items.map((i) => `<p style="padding:16px 0;border-top:1px solid #eee">${escapeHtml(i.name)}<br><span style="color:#666">${escapeHtml(i.size)} / ${escapeHtml(i.color)} &middot; Qty ${escapeHtml(i.quantity)}</span></p>`).join('')}${typeof payload.amount_cents === 'number' ? `<p><strong>${escapeHtml(money(payload.amount_cents))}</strong></p>` : ''}${safeUrl ? `<p style="padding:20px 0"><a href="${escapeHtml(safeUrl)}" style="display:inline-block;padding:14px 24px;background:#343d31;color:#fff;text-decoration:none">View details</a></p>` : ''}<p style="font-size:12px;color:#777;line-height:1.7">A thoughtful layer, for the everyday.<br>${escapeHtml(brand)}</p></td></tr></table></td></tr></table></body></html>`;
  return {
    subject: `${title}${payload.order_number ? ` · ${String(payload.order_number)}` : ''}`,
    html,
    text,
  };
}
export async function dispatchEmails(limit = 20) {
  const db = serviceDb();
  const settings = requiredData(
    await db.from('store_settings').select('brand_name,owner_email').eq('id', 'store').single(),
  );
  const jobs = checked(await db.rpc('claim_emails', { p_limit: limit })) as {
    id: string;
    kind: string;
    recipient: string | null;
    payload: Payload;
    dedupe_key: string;
    attempts: number;
    created_at: string;
  }[];
  const resend = new Resend(required('RESEND_API_KEY'));
  let sent = 0;
  for (const job of jobs) {
    try {
      const payload = { ...job.payload };
      if (payload.order_id) {
        const order = requiredData(
          await db
            .from('orders')
            .select(
              'id,order_number,total_cents,order_items(name,size,color,quantity),shipments(tracking_url)',
            )
            .eq('id', payload.order_id)
            .single(),
        );
        payload.order_number = order.order_number;
        payload.items = order.order_items;
        if (job.kind === 'order_confirmation') payload.amount_cents = order.total_cents;
        if (job.kind === 'owner_order' || job.kind === 'label_failed')
          payload.url = `${appUrl()}/admin/orders/${order.id}`;
        else if (job.kind === 'shipping_confirmation' && order.shipments[0]?.tracking_url)
          payload.url = order.shipments[0].tracking_url;
        else {
          // Stable per outbox job: retries send the same expiring capability and identical provider payload.
          const raw = createHmac('sha256', required('ORDER_TOKEN_SECRET'))
            .update(job.id)
            .digest('hex');
          checked(
            await db
              .from('order_lookup_tokens')
              .upsert(
                {
                  token_hash: hash(raw),
                  order_id: order.id,
                  expires_at: new Date(
                    new Date(job.created_at).getTime() + 86_400_000,
                  ).toISOString(),
                },
                { onConflict: 'token_hash' },
              ),
          );
          payload.url = `${appUrl()}/orders/${raw}`;
        }
      }
      const recipient =
        job.recipient ?? process.env.OWNER_NOTIFICATION_EMAIL ?? settings.owner_email;
      if (!recipient) throw new Error('Missing notification recipient');
      const message = renderEmail(job.kind, payload, settings.brand_name);
      const { data, error } = await resend.emails.send(
        { from: required('RESEND_FROM_EMAIL'), to: recipient, ...message },
        { idempotencyKey: job.id },
      );
      if (error) throw new Error('Email provider rejected message');
      checked(
        await db
          .from('email_outbox')
          .update({
            status: 'sent',
            provider_id: data?.id,
            sent_at: new Date().toISOString(),
            lease_until: null,
          })
          .eq('id', job.id),
      );
      sent++;
    } catch {
      checked(
        await db
          .from('email_outbox')
          .update({
            status: job.attempts >= 12 ? 'failed' : 'pending',
            last_error: 'Email delivery failed; inspect provider dashboard using outbox ID.',
            available_at: new Date(
              Date.now() + Math.min(3_600_000, 60_000 * 2 ** job.attempts),
            ).toISOString(),
            lease_until: null,
          })
          .eq('id', job.id),
      );
    }
  }
  return { processed: jobs.length, sent };
}
