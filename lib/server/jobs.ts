import 'server-only';
import { checked, serviceDb } from './db';
import { dispatchEmails, enqueueEmail } from './email';
import { stripeClient } from './stripe';
import { type Reservation } from './checkout';
export async function runJobs() {
  const db = serviceDb();
  const stripe = stripeClient();
  const reservations = checked(
    await db
      .from('checkout_reservations')
      .select('*')
      .in('status', ['creating', 'active'])
      .lt('expires_at', new Date().toISOString())
      .order('created_at')
      .limit(50),
  ) as Reservation[];
  let released = 0;
  for (const reservation of reservations) {
    try {
      let sessionId = reservation.stripe_session_id;
      if (!sessionId && reservation.stripe_customer_id) {
        const sessions = await stripe.checkout.sessions.list({
          customer: reservation.stripe_customer_id,
          limit: 100,
        });
        const recovered = sessions.data.find((s) => s.metadata?.reservation_id === reservation.id);
        if (recovered) {
          sessionId = recovered.id;
          checked(
            await db
              .from('checkout_reservations')
              .update({ stripe_session_id: recovered.id, session_url: recovered.url })
              .eq('id', reservation.id),
          );
        }
      }
      if (sessionId) {
        let session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id);
        if (session.status === 'expired' && session.payment_status !== 'paid') {
          checked(
            await db.rpc('expire_reservation', { p_id: reservation.id, p_session_id: session.id }),
          );
          released++;
          continue;
        }
        if (session.payment_status === 'paid') {
          // Only a verified signed webhook creates paid orders. Cron asks the owner to replay missed delivery.
          await enqueueEmail({
            key: `missing-webhook:${reservation.id}`,
            kind: 'payment_attention',
            payload: {
              message: `Paid Checkout ${session.id} is awaiting its verified webhook. Replay checkout.session.completed from the Stripe dashboard. Stock remains held.`,
            },
          });
          continue;
        }
      }
      await enqueueEmail({
        key: `reservation-review:${reservation.id}`,
        kind: 'payment_attention',
        payload: {
          message: `Checkout reservation ${reservation.id} has no confirmed terminal provider state. Inventory remains held. Follow the reservation reconciliation runbook before releasing it.`,
        },
      });
    } catch {
      await enqueueEmail({
        key: `reconcile-failed:${reservation.id}`,
        kind: 'payment_attention',
        payload: {
          message: `Provider reconciliation failed for reservation ${reservation.id}; stock remains held. Retry the scheduled job.`,
        },
      });
    }
  }
  // Keep capability and rate-limit tables bounded. Quotes are retained if referenced by an order/reservation.
  checked(
    await db
      .from('rate_limits')
      .delete()
      .lt('reset_at', new Date(Date.now() - 86_400_000).toISOString()),
  );
  checked(await db.from('order_lookup_tokens').delete().lt('expires_at', new Date().toISOString()));
  return { released, emails: await dispatchEmails() };
}
