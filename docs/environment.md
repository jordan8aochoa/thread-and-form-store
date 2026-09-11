# Environment reference

Copy `.env.example` to `.env.local` for development. Configure the same variables in Vercel Project Settings → Environment Variables. Keep staging/test and production values separate. Redeploy after changing browser-exposed values; restart locally after any environment change.

Only the three names beginning `NEXT_PUBLIC_` are public. Every other value stays server-side. The application does not need a Stripe publishable key because payment details are collected on Stripe-hosted Checkout.

| Variable                               | Required for                      | Value / purpose                                                                                                                                                  |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | All working flows                 | Exact canonical origin, without a path. Local default `http://127.0.0.1:3006`; deployed value must use HTTPS. Controls links, redirects, SEO, and origin checks. |
| `NEXT_PUBLIC_SUPABASE_URL`             | Database and auth                 | Supabase project API URL; local CLI prints it in status.                                                                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Catalog and auth                  | Public `sb_publishable_...` key. A local legacy anon key is supported where supplied by the local stack.                                                         |
| `SUPABASE_SECRET_KEY`                  | Private server operations         | `sb_secret_...` key; local legacy service-role key can be used locally. Never use as a public key.                                                               |
| `RATE_LIMIT_SALT`                      | Sensitive requests                | Independent random secret used when hashing rate-limit identifiers.                                                                                              |
| `ORDER_TOKEN_SECRET`                   | Secure emailed order links        | Independent persistent random secret. Rotation can invalidate existing order links.                                                                              |
| `CRON_SECRET`                          | Scheduled jobs                    | Independent random secret used as `Authorization: Bearer <value>` on `GET /api/jobs`.                                                                            |
| `COMMERCE_MODE`                        | Payments                          | `test` by default. Switch to `live` only intentionally with live Stripe configuration.                                                                           |
| `STRIPE_SECRET_KEY`                    | Payments and refunds              | Stripe test secret `sk_test_...` during development; production key only for an approved live launch.                                                            |
| `STRIPE_WEBHOOK_SECRET`                | Payment events                    | Endpoint-specific `whsec_...`; Stripe CLI and dashboard endpoints have different secrets.                                                                        |
| `STRIPE_AUTOMATIC_TAX`                 | Tax calculation                   | `true` by default. Complete Stripe Tax setup and registrations for applicable collection. Disable only following your actual tax requirements.                   |
| `STRIPE_PRODUCT_TAX_CODE`              | Stripe product tax classification | Default `txcd_30011000`; verify the code is appropriate for your actual merchandise and jurisdictions.                                                           |
| `EASYPOST_MODE`                        | Rates and labels                  | `test` by default; use `production` only for intentional live shipping. Provider objects are checked against this mode.                                          |
| `EASYPOST_API_KEY`                     | Shipping and verification         | Test key from EasyPost dashboard during development. Key mode must match `EASYPOST_MODE`.                                                                        |
| `EASYPOST_WEBHOOK_SECRET`              | Tracking events                   | Independent random secret also supplied when registering the EasyPost webhook.                                                                                   |
| `SHIPPING_PARCEL_LENGTH`               | Shipping                          | Packed parcel length in inches, default `14`.                                                                                                                    |
| `SHIPPING_PARCEL_WIDTH`                | Shipping                          | Packed parcel width in inches, default `11`.                                                                                                                     |
| `SHIPPING_PARCEL_HEIGHT`               | Shipping                          | Packed parcel height in inches, default `3`.                                                                                                                     |
| `SHIPPING_PACKAGING_WEIGHT_OZ`         | Shipping                          | Packaging weight in ounces added to product weights; default `2`.                                                                                                |
| `RESEND_API_KEY`                       | Email delivery                    | Server-only API key authorized to send from your verified domain.                                                                                                |
| `RESEND_FROM_EMAIL`                    | Email delivery                    | Example `Thread & Form <orders@your-domain.com>`; domain must be verified.                                                                                       |
| `OWNER_NOTIFICATION_EMAIL`             | Owner email alerts                | Deliverable owner mailbox. Review the store's owner-email setting as well.                                                                                       |

`NODE_ENV` and `VERCEL` are runtime variables set by the framework/platform, not application secrets to add to `.env.local`. CLI login tokens and database passwords are setup credentials; use CLI prompts or your secret manager and do not commit them.

Keep key fields blank when running the read-only sample storefront. Invented provider keys do not enable checkout. A partially configured provider should produce a recoverable error, not a fake payment, shipping quote, or email success.

Use a stable staging domain for end-to-end tests so origin checks, callback URLs, and webhook destinations agree. Do not connect preview deployments to the production database or use live payment/shipping credentials in preview environments.
