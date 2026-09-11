# Operator runbook

Use the protected admin dashboard and provider dashboards for ordinary operations. SQL diagnostics below are read-only and must run in a private, authorized database context. Never expose their results in public logs or support tickets containing customer data.

## Daily checks

- Review new paid orders, low stock, payment alerts, and orders awaiting fulfillment.
- Check Stripe/EasyPost webhook delivery health and recent scheduled-job executions.
- Check email outbox backlog and Resend delivery/bounce results.
- Review carrier exceptions, returns, refunds, and configured provider usage budgets.

## Paid in Stripe but missing from admin

1. Locate the exact Checkout Session and Payment Intent in the correct Stripe test/live environment. Confirm payment status directly; a customer screenshot of the success page is insufficient.
2. Inspect webhook delivery for that Session and the application's reservation. Check the signing secret, destination URL, deployment protection, and mode configuration.
3. Fix delivery/configuration errors and resend the original Stripe event. The idempotent database finalizer is designed for retries.
4. If the webhook reports inventory or amount reconciliation failure, retain the reservation and investigate the snapshot, actual provider amount, and current stock. Do not fabricate an order or manually mark it paid to bypass the validation.
5. Resolve actual payment/stock conflicts through an audited refund or inventory correction, then replay the verified event as appropriate. Customer notifications should describe the verified outcome.

```sql
select id, status, stripe_session_id, expires_at, created_at
from public.checkout_reservations
where status in ('creating', 'active')
order by created_at;

select id, provider, type, processed_at
from public.webhook_events
order by processed_at desc limit 50;
```

## Abandoned checkout holds stock

Call authenticated `GET /api/jobs` or inspect the scheduler's latest run. The job reconciles due reservations with Stripe. If Stripe is unavailable, keep stock reserved and retry; releasing a hold without knowing whether the Session was paid creates an oversell risk. Visiting the cancellation page does not expire a Stripe Session. A Session must be expired/confirmed nonpayable before its hold is released.

Investigate unusually old `creating` reservations as potential interrupted Session creation. Reuse the recorded reservation and idempotency identifiers when reconciling; do not start an unrelated replacement payment. If a provider request's result remains unknown, inspect Stripe before making a final decision.

## Shipping label purchase failed or timed out

1. Read the order's existing `label_operations` and shipment records. Find that exact shipment in EasyPost.
2. If it has a postage label, recover the existing label/tracking rather than purchasing again. A transport error can occur after a successful buy.
3. Retry the order action using the same shipment/rate once configuration or provider availability is restored. Do not create a second shipment merely to bypass a pending operation.
4. If the rate is no longer purchasable, verify the previous shipment has no purchased postage before replacing the quote. Review the new service and cost before buying.
5. If postage was genuinely purchased twice, request the appropriate unused-label refund through EasyPost/carrier policies and record the resolution. A customer Stripe refund does not refund carrier postage.

```sql
select order_id, easypost_shipment_id, rate_id, status, locked_until
from public.label_operations order by created_at desc limit 50;
```

## Tracking appears stale

Confirm EasyPost's webhook is enabled, its secret matches, and the latest delivery received 2xx. Inspect the actual Tracker and carrier scan history. Tracking codes are recycled; identify the stored Tracker/shipment, not just its text tracking number. Replay the relevant provider delivery after fixing a webhook issue. Do not mark a package delivered based on an unrelated test Tracker or an older scan.

## Transactional emails are not arriving

1. Verify `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, domain verification, and owner mailbox configuration.
2. Inspect the scheduler. A queued email cannot send if `/api/jobs` never runs.
3. Inspect outbox rows without dumping payloads or recipient addresses:

```sql
select id, kind, status, attempts, available_at, lease_until,
       provider_id, last_error, created_at, sent_at
from public.email_outbox
where status <> 'sent'
order by created_at;
```

4. `sending` rows have a five-minute lease; expired leases can be reclaimed. Pending failures retry with backoff. Twelve failed attempts require operator investigation.
5. Search Resend using the provider ID/outbox idempotency key before retrying an old uncertain send. Preserve the same job ID. If already delivered, reconcile the record rather than sending a new message. If definitely unsent, an authorized operator can reset that specific failed row after fixing the cause; record the reason and avoid bulk resets.
6. Order links expire. If a notification sat undelivered long enough for its link to expire, use the order lookup flow to issue a fresh link instead of extending a potentially exposed token indefinitely.

## Refund or restock mismatch

Check the refund object in Stripe and the `refunds`/`refund_requests` records. Only a succeeded refund affects refunded totals. A pending/failed refund must not trigger successful-refund email or stock restoration. The full-refund restock is guarded by `orders.inventory_restored` and should happen once. Confirm actual returned/unshipped stock before authorizing restock.

For a partial Stripe Dashboard refund, wait for the refund webhook and verify the financial total. Reconcile inventory separately using the admin inventory adjustment with a clear reason; a partial amount does not identify which physical units returned.

## Account revocation, backups, and data requests

Deactivate the administrator's `admin_profiles` record and revoke provider/auth sessions when needed. Rotate compromised keys, redeploy, update webhook secrets at both ends, and review recent actions. Rotation of order-token secrets can invalidate emailed links; customers can request fresh lookup links.

Maintain Supabase backups appropriate to your plan and periodically test restoration to an isolated project. Never restore over an operating database without a reconciliation plan for payments, shipping, and notifications created since the backup. Keep financial records and retention obligations distinct from optional marketing/contact records when handling deletion requests.
