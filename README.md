# Thread & Form

A single-brand sweater store built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, Stripe Checkout, EasyPost, Resend, and Zod. Guest checkout is the default. The starter brand, products, photographs, policies, and address are examples to replace before launch.

The application runs locally without provider credentials as a sample storefront. Real checkout, admin access, database writes, shipping, and email require configuration. Sample browsing is not a simulated payment system: no order should be described as paid because a customer reached a success page.

**Setting this up for your own brand? Start with [START_HERE.md](START_HERE.md).** It walks through creating your own service accounts, connecting the store, and deploying it. No original owner's service accounts or credentials are included.

## Start locally

Requirements: Node.js 22.12 or newer, npm, and a Supabase project. Docker Desktop is needed only for the optional local Supabase stack. Stripe CLI is needed for forwarding payment webhooks to a local server.

Open a terminal in this standalone repository's root (the folder containing `package.json`):

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open **http://127.0.0.1:3006**. Use that same host in `NEXT_PUBLIC_APP_URL`; switching between `localhost` and `127.0.0.1` changes the origin used by sensitive request checks.

On macOS/Linux, use `cp .env.example .env.local` instead of `Copy-Item`. The npm commands are the same. The example file has blank provider keys; browsing works before you connect accounts.

Generate a separate random value for each of `RATE_LIMIT_SALT`, `ORDER_TOKEN_SECRET`, `CRON_SECRET`, and `EASYPOST_WEBHOOK_SECRET`:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy values directly into your local environment or deployment secret manager, not source files. Restart the development server after changing environment variables.

## Configure a working store

1. Follow [database setup](docs/database.md) to apply migrations, seed demo products, and create the first authorized administrator.
2. Fill every required entry in [.env.example](.env.example), using the [environment reference](docs/environment.md).
3. Follow [provider setup and test payments](docs/providers.md) for Stripe, EasyPost, and Resend.
4. Sign in at `/admin/login`, replace branding and return address in store settings, add accurate inventory and packed weights, and replace product content and images.
5. Run the checks below and complete a full test-mode purchase, payment webhook, label purchase, tracking update, and refund.
6. Deploy with [Vercel instructions](docs/deployment.md), configure the scheduled job, then complete the [launch checklist](docs/launch-checklist.md).

## Development checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run check` runs the same sequence. `npm run start` serves the production build on port 3006. Unit and database fixture tests do not need real payment or shipping keys and must not use live credentials. Provider-backed tests remain a separate launch requirement; mocks cannot prove that your accounts, carrier contracts, tax registrations, domain, or production webhooks are configured correctly. See [verification scope](docs/verification.md) for test coverage and limitations.

The lockfile pins the installed dependencies. TypeScript 7 provides the native `tsc` command through the `@typescript/native` alias; the `typescript` package points to TypeScript 6 for tools that still consume its JavaScript API. This follows [Microsoft's side-by-side guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0). ESLint 10 uses `@eslint/compat` around the Next.js plugin configuration. Keep those compatibility choices together when upgrading.

## Project map

```text
app/                    Storefront routes, protected admin routes, server API routes
components/             Responsive storefront and admin components
lib/cart.ts             Browser cart calculations; checkout reprices on the server
lib/types.ts            Shared application models and money helpers
lib/catalog.ts          Public catalog access and sample catalog fallback
lib/content.ts          Editable brand and draft supporting-page copy
lib/server/             Server-only database, auth, payments, shipping, email logic
public/images/          Replaceable local sample photographs
supabase/migrations/    Versioned PostgreSQL schema, functions, grants, and RLS
supabase/seed.sql        Demo catalog and initial settings
tests/                  Critical-flow tests and provider fixtures
docs/                   Setup, environment, launch, and operations documentation
```

See [architecture and safety boundaries](docs/architecture.md) and the [operator runbook](docs/operations.md) for payment reconciliation, failed notifications, and shipping recovery.

## Store defaults and scope

The starter uses US addresses, USD, a single return/ship-from address, guest checkout, variant inventory, and one parcel per shipment. Parcel dimensions come from environment variables; item weights come from variants. Replace the packaging assumptions with measured values. International duties/customs, customer accounts, and marketplace sellers are outside this single-brand implementation.

The payable subtotal after discounts and shipping must be at least $0.50 before tax. Zero-value checkouts are rejected before inventory is reserved. Admin refunds return the full remaining payment; inventory is restored only after a confirmed full refund when the administrator explicitly requests restocking.

Legal/policy copy is draft content in `lib/content.ts`, and the product size guide is in `components/product-detail.tsx`. Review both against your actual products and business practices. Brand, support email, announcement, social links, free-shipping threshold, and return address are configurable in admin settings. Email sender authentication is configured separately through Resend.

## Costs

There is no Shopify subscription or Shopify platform fee in this implementation. Separate costs can apply for Stripe processing and Tax, refunds/disputes, EasyPost services and carrier postage, Resend usage, Supabase database/storage/egress/backups, Vercel compute/bandwidth/scheduling, a domain, and your business taxes. Free tiers are not a promise of a free production store. Confirm your own account plans and usage limits before launch: [Stripe](https://stripe.com/pricing), [EasyPost](https://www.easypost.com/pricing/), [Resend](https://resend.com/pricing), [Supabase](https://supabase.com/pricing), [Vercel](https://vercel.com/pricing).
