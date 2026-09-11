# Verification scope

## Completed local verification — September 10, 2026

`npm run check` completed successfully: ESLint with zero warnings, TypeScript checking, all **120 tests across 11 files**, and the optimized Next.js production build. The build includes storefront, admin, checkout, order lookup, webhook, and scheduled-job routes.

Browser checks covered the desktop home page, mobile shop and product layouts, category filtering, empty search results, cart persistence and stock limits, and the credential-free checkout setup state. Authenticated admin browser flows and actual provider delivery still require the staging acceptance checks below.

Run `npm run check` from the application directory for linting, TypeScript, Vitest, and the production build. The actual command output is the evidence for each run; this guide describes coverage rather than asserting that an unrun deployment test passed.

## Automated tests

- Cart tests cover integer-cent totals, quantity/stock caps, variant merging, removal, and refreshed display data.
- Commerce tests cover database-derived prices, variants, discount calculations and validation, and Zod request limits.
- Provider/API fixture tests exercise Stripe Session construction, signature validation, webhook handling, EasyPost address/rate/label responses, and error handling without external charges or postage.
- HTTP/admin tests cover origin checks, request validation, rate limits, and admin authorization paths.
- `tests/schema.test.ts` runs the actual checked-in schema, admin, and fulfillment migrations in PGlite's PostgreSQL engine. It exercises physical-stock reservation, competing holds, quote/rate and price checks, discount limits, paid-order finalization, duplicate-event handling, transactional rollback, refund restock/terminal-state preservation, email leases, atomic product/variant creation and edits, deletion safeguards, label claims, fulfillment idempotency, tracking status updates, and privacy under anonymous/non-admin/admin roles.

PGlite role tests issue actual SQL using PostgreSQL permissions and RLS, rather than merely searching migration text. The harness supplies lightweight `auth.users` and `auth.uid()` fixtures; it does not emulate Supabase's authentication service or Storage API. PGlite serializes requests on one embedded connection, so competing reservation tests verify logical stock exclusion but do not establish cross-connection performance or production lock timing.

## Credential-dependent acceptance

Before launch, run the end-to-end checklist in [launch-checklist.md](launch-checklist.md) against your configured staging providers. Verify actual Stripe webhook delivery, tax setup, EasyPost carrier rates and test labels, Resend inbox delivery, Supabase Auth/Storage/RLS, Vercel scheduled jobs, and final-domain redirects. These cannot be proven by mocks or an offline build.

No live charges or production postage purchases are required or authorized by the development test suite. Tests that use fixtures should continue to run without production credentials. Keep provider acceptance results and deployment configuration evidence in your own private operational records.
