# Architecture and safety boundaries

The application is a server-rendered Next.js store with browser interactions for product choices, a persistent cart, checkout steps, and admin forms. Server-only modules access Supabase, Stripe, EasyPost, and Resend. Supabase publishable access serves the public catalog; private commerce operations use the server secret after request validation and authorization.

## Checkout lifecycle

1. The browser submits only variant identifiers, quantities, email, address, and an optional discount code. Its displayed prices and stock are advisory.
2. The server validates with Zod, reads active products and variants, calculates integer-cent prices and product weights, validates discounts, verifies the address, and asks EasyPost for rates.
3. A private `checkout_quotes` record snapshots items, address, discount, and provider rates. The browser selects a rate belonging to that quote through a private capability.
4. `reserve_checkout` locks the quote, discount, and affected inventory rows. It checks current price/availability and counts other active reservations before creating a unique reservation. Reserving stock does not decrement physical inventory.
5. The server creates a Stripe Checkout Session from the reserved values using a stable idempotency key. The address used for shipping and tax remains tied to the verified checkout destination.
6. The verified Stripe webhook checks the payment and calls `finalize_checkout`. One database transaction creates the customer/address/order/payment records, copies immutable item snapshots, decrements inventory, records the event/timeline, consumes the discount, and queues notification jobs.
7. Duplicate delivery cannot duplicate an order or stock adjustment because the reservation/session/payment identifiers and event records are unique. A success-page redirect never proves payment.
8. Expiration is reconciled against Stripe. The reservation remains held until the provider's session state permits release. A browser cancellation/abandonment alone is not proof that the payment cannot still complete.

The server restricts guest checkout to the documented domestic, single-currency scope. Shipping is the selected verified provider rate or the configured free-shipping benefit; a provider outage does not generate an invented paid rate.

## Fulfillment, tracking, and refunds

Label operations use an existing EasyPost shipment/rate recorded for the order. Buying a label first checks whether that shipment already has postage, which recovers a previous successful purchase whose response was lost. The admin reviews cost before confirming purchase. Labels, tracking, and the timeline are private order records, and notifications are queued separately.

EasyPost tracking webhooks require a valid HMAC signature and a known shipment/Tracker. An event cannot assign tracking to an arbitrary order. Status changes and notification deduplication must tolerate repeated/out-of-order delivery.

Refund requests persist the admin's intention, including whether stock should be restored. Stripe confirms refund state. Successful full refunds can restock once when the request authorizes it; a financial refund does not automatically imply goods were returned. Partial externally created refunds affect financial totals without automatically restocking an entire order.

## Notification delivery

`email_outbox` is written during important business transactions. Webhook routes attempt a post-response dispatch, and `/api/jobs` provides the scheduled retry path. Jobs claim eligible rows using leases and send through Resend with a stable idempotency key per job. Failed sends are retried with backoff and stop after twelve attempts. Email outages do not roll back an already-confirmed payment.

HTML and text templates are in `lib/server/email.ts`. Content is escaped before insertion into HTML. Owner messages use `OWNER_NOTIFICATION_EMAIL` when present, falling back to the configured owner address. Order links use hashed expiring capabilities. Protect the stable order-token secret and treat an emailed link as access to its order.

Provider idempotency retention is finite; the database retains its own dedupe records. A provider send that succeeded but could not be recorded locally may need manual review after the provider's idempotency window. See the runbook before manually resetting an old notification.

## Security and privacy

- Public database access is limited to active catalog data; sensitive tables and service RPCs are not public APIs.
- Admin access requires both a Supabase-verified user and an active `owner`/`admin` profile. User-editable metadata is not an authorization source.
- Mutating browser APIs validate origin and request shape; sensitive routes use database-backed rate limits.
- Server keys are restricted to server-only modules. The browser never receives Stripe/EasyPost/Resend/private Supabase keys or handles card details.
- Order lookup capabilities are hashed at rest and expire. Failed lookup responses should avoid revealing whether a customer email/order combination exists.
- Operational logs identify the operation and error class without including full customer payloads or secrets.
- Product image storage is public by design; customer addresses, order details, and postage labels are not uploaded there.

## Data inventory

Core tables: `admin_profiles`, `products`, `product_images`, `product_variants`, `inventory_adjustments`, `customers`, `addresses`, `orders`, `order_items`, `payments`, `shipments`, `tracking_events`, `discounts`, `store_settings`, `webhook_events`, `contact_submissions`, and `newsletter_subscribers`.

Supporting operational tables: `checkout_quotes`, `checkout_reservations`, `refund_requests`, `refunds`, `order_events`, `shipping_quotes`, `label_operations`, `email_outbox`, `order_lookup_tokens`, and `rate_limits`.

Order item names, SKUs, size/color, unit prices, quantities, weights, and image references are snapshots; product edits do not rewrite the purchased record. Establish a data retention/deletion policy that preserves legally needed financial records while minimizing unnecessary customer data.
