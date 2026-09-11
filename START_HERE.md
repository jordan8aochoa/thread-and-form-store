# Make this your store

This repository is a complete application starter for a single-brand sweater store. You own the accounts you connect, the product catalog, the code, and the domain. The included Thread & Form branding and six demo products are replaceable examples.

**No service credentials, original-owner accounts, customer data, payments, or shipping labels are included.** You will create your own accounts below. Keep the app in test mode until you finish the launch checklist.

## 1. Get your own copy

If you received a ZIP, extract it and open a terminal in the extracted folder containing `package.json`. If you have access to the private GitHub repository, clone it:

```sh
git clone https://github.com/jordan8aochoa/thread-and-form-store.git
cd thread-and-form-store
```

The ZIP works without access to the original owner's GitHub account. To put your extracted copy in your own GitHub account, create an empty private repository there, then run these commands in the extracted folder:

```sh
git init -b main
git add .
git commit -m "Initial store"
git remote add origin YOUR_NEW_GITHUB_REPOSITORY_URL
git push -u origin main
```

If you cloned instead of extracting, retain the existing history and change the remote with `git remote set-url origin YOUR_NEW_GITHUB_REPOSITORY_URL` before pushing. Git may ask you to configure your own author name/email. Never commit `.env.local`.

## 2. Preview on your computer

Install Node.js 22.12 or newer. In the project folder:

```sh
npm ci
```

Copy `.env.example` to `.env.local` using your file manager, `Copy-Item .env.example .env.local` in PowerShell, or `cp .env.example .env.local` on macOS/Linux. Then run:

```sh
npm run dev
```

Open **http://127.0.0.1:3006**. The sample storefront works with blank provider keys. Payments and admin access activate after configuration; there is no built-in admin password.

## 3. Connect accounts you control

| Service  | What it provides                                      | Your setup                                                                                             |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Supabase | Database, product-image storage, admin login          | Create a dedicated project, apply migrations/seed, create your first admin, and add your project keys. |
| Stripe   | Hosted payments, refunds, tax calculation             | Start with test keys, register the webhook, and configure applicable tax settings.                     |
| EasyPost | Address verification, carrier rates, labels, tracking | Start with the test API key and configure a signed tracking webhook.                                   |
| Resend   | Receipts, shipping/refund emails, owner notifications | Verify a sending domain and add your API key and sender address.                                       |
| Vercel   | Website hosting and recurring jobs                    | Import your Git repository, add environment variables, and configure the domain and job schedule.      |

Use these guides in order:

1. [Database setup and first administrator](docs/database.md).
2. [Every environment variable](docs/environment.md). Generate your own independent random secrets using the command in the README.
3. [Stripe, EasyPost, and Resend setup and test instructions](docs/providers.md).
4. [Vercel deployment, scheduled jobs, and custom domain](docs/deployment.md). For this standalone repository, the Vercel root directory is **`.`**.

Keep credentials in `.env.local` locally and in Vercel's environment-variable settings when deployed. Do not paste them into GitHub files or chat. Use separate test and production projects/keys.

## 4. Replace the examples

Sign in at `/admin/login` after creating the authorized Supabase admin. The dashboard lets you manage products, images, variants, inventory, orders, shipping labels, refunds, discounts, and store settings.

- **Admin settings:** brand name, logo, announcement, support/owner email, social links, free-shipping threshold, and real return/ship-from address.
- **Admin products:** real photographs, descriptions, prices, SKUs, sizes, colors, weights, and available stock. Archive or delete demo products before launch.
- **Environment variables:** sender email/domain, provider keys, parcel dimensions, and packaging weight. An `OWNER_NOTIFICATION_EMAIL` value overrides the admin owner-mailbox setting.
- **Code content:** edit `lib/content.ts` for the About, FAQ, and draft policy text; update `components/product-detail.tsx` for your actual size guide. Visual styling is in `app/globals.css` and the reusable `components/` files.

Defaults are US shipping, USD, one parcel per order, guest checkout, and full remaining-payment refunds. Checkouts must total at least $0.50 before tax after discounts and shipping. Adjust the parcel model before selling combinations that do not fit the configured packaging.

## 5. Test, then launch

```sh
npm run check
```

This runs linting, type checking, automated tests, and a production build. GitHub Actions runs the same checks on pushes to `main` and pull requests, without provider credentials.

Next, complete a real **test-mode** purchase using your configured providers, receive the verified payment webhook, create a test shipping label, verify email delivery, and test a refund. Local automated checks use fixtures; they cannot validate your accounts or deployed webhook delivery.

Finish [the launch checklist](docs/launch-checklist.md) before deliberately switching to live payment and shipping keys. Frequent scheduled jobs may need a paid Vercel plan or an external scheduler. The [operations guide](docs/operations.md) explains failed emails, held inventory, and ambiguous shipping-label attempts.

## Costs

There is no Shopify platform subscription. Stripe processing/Tax, EasyPost and carrier postage, email usage, hosting, database/storage/egress, domain renewal, and business taxes may still cost money. See the README's provider pricing links and select plans appropriate to your volume.
