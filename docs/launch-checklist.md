# Before accepting real orders

This is the configuration and operational acceptance checklist. Local tests and a passing build do not substitute for configuring and testing your actual provider accounts.

## Store and product readiness

- [ ] Replace Thread & Form branding, logo, announcement, social links, and support address.
- [ ] Replace the example ship-from/return address with a verified staffed address and real contact information.
- [ ] Replace sample photographs and descriptions with accurate product photographs, materials, care instructions, category, size guide, and fit information.
- [ ] Confirm prices, sale prices, every variant SKU, available inventory, and measured item weights.
- [ ] Confirm the single-parcel dimensions and packaging weight match packed orders; adjust the packaging model before accepting orders that do not fit it.
- [ ] Review free-shipping threshold and discount terms with actual margin and carrier costs.
- [ ] Review About, FAQ, shipping, returns/refunds, privacy, and terms pages against your actual business practices.
- [ ] Check small-phone, tablet, desktop, keyboard navigation, focus visibility, error states, and image alt text.

## Accounts, domain, and security

- [ ] Deploy to a Vercel project with the application directory as its root and a Node version satisfying `package.json`.
- [ ] Configure the canonical domain and HTTPS; update `NEXT_PUBLIC_APP_URL` and redeploy.
- [ ] Apply migrations to the intended production Supabase project; enable backups and test a restore procedure.
- [ ] Create an authorized owner login; use a strong unique password and secure the Supabase project account.
- [ ] Verify a signed-in non-admin and a signed-out visitor cannot access `/admin` or admin APIs.
- [ ] Verify anonymous database access cannot retrieve orders, customer details, addresses, payments, discounts, webhook payloads, or email queue contents.
- [ ] Configure each private variable from `environment.md` in the server environment only; use independent random application secrets.
- [ ] Configure a working owner notification mailbox and a verified Resend sending domain.
- [ ] Keep test/preview and production databases, credentials, and webhook endpoints separate.

## Test-mode acceptance

- [ ] Run lint, type checking, tests, and production build successfully on the final code and lockfile.
- [ ] Complete guest checkout using Stripe test card `4242 4242 4242 4242`, an EasyPost-verified test address, and an actual test-mode rate.
- [ ] Confirm paid order creation, item snapshots, payment identifiers, inventory decrease, and confirmation emails.
- [ ] Replay the same Stripe payment event and verify there is still exactly one order and one inventory reduction.
- [ ] Attempt checkout with insufficient inventory and an invalid/expired discount; confirm server rejection.
- [ ] Confirm a failed/empty EasyPost rates response displays an error with retry rather than a substitute shipping price.
- [ ] Purchase a test label from admin after viewing service and cost; download/print it and verify tracking was stored and emailed.
- [ ] Deliver a verified EasyPost test tracking webhook and confirm the order's delivery status and customer notification.
- [ ] Submit an admin test refund, verify its Stripe status, and verify authorized restocking happens at most once.
- [ ] Verify the order lookup flow with correct and incorrect credentials and a secure emailed link.
- [ ] Submit contact and newsletter forms and inspect the private stored records and confirmations.
- [ ] Verify notification retries and reservation reconciliation by calling the authenticated job endpoint.

## Activate production intentionally

- [ ] Complete Stripe business verification, payout details, receipt/support settings, and applicable Tax registration configuration.
- [ ] Verify Stripe product and shipping tax classifications; establish how filing/remittance will be handled.
- [ ] Configure a **live** Stripe webhook with its own signing secret and all handled event types.
- [ ] Connect/fund the relevant EasyPost carrier accounts, verify production origin address and rates, and configure a production tracking webhook.
- [ ] Only now set `COMMERCE_MODE=live`, the Stripe live secret, `EASYPOST_MODE=production`, and the matching production shipping key.
- [ ] Redeploy and verify the configured provider modes agree before opening checkout to customers.
- [ ] Enable frequent scheduled execution of `/api/jobs` and monitor failures/backlogs; confirm the chosen hosting plan supports the required cadence.
- [ ] Check provider dashboards for live webhook delivery and email delivery; monitor the first orders closely.
- [ ] Establish handling for chargebacks, failed payments, shipping exceptions, returns, refunds, tax records, and customer data requests.
- [ ] Review provider usage budgets and recurring costs; there is no Shopify fee, but this store is not free to operate.

Do not buy real postage or charge a real card as part of development. Switching modes is a business launch action performed after this checklist, not an automated setup step.
