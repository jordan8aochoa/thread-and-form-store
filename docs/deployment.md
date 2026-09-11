# Deploy to Vercel and attach a domain

## Create a staging deployment first

1. Push the repository and lockfile to your own Git provider. Create a Vercel project from that repository.
2. Leave **Root Directory** at the repository root (`.`) and set **Framework Preset** to Next.js. Use `npm ci` for installation and `npm run build` for the build. Let Vercel manage the Next.js output; do not choose a static export. If you deliberately put this app inside another repository, use its folder path instead.
3. Select a Node version satisfying the `engines` field in `package.json`.
4. Add the variables from [environment.md](environment.md), using a separate test Supabase project, Stripe test keys, and EasyPost test mode. Generate independent application secrets.
5. Set `NEXT_PUBLIC_APP_URL` to the exact stable staging URL and redeploy so redirects, links, and origin checks agree. A changing preview URL is inconvenient for external webhooks; a stable staging domain is preferable.
6. Apply database migrations to the staging project, create an authorized admin, and register the HTTPS test webhook destinations with Stripe and EasyPost.
7. Verify that deployment protection does not block the external webhook routes. Preserve signature authentication for both webhook handlers; never remove it to work around protection.
8. Complete the test-mode launch checks before preparing the production project.

## Scheduled jobs are required

`GET /api/jobs` reconciles due checkout reservations and dispatches persisted transactional email. Configure recurring execution at least every five minutes, with monitoring. Verify the checked-in `vercel.json` schedule and adapt it to the hosting plan you choose. If using Vercel Cron, set `CRON_SECRET` in the deployment; Vercel sends it as an `Authorization: Bearer ...` header. Local development does not run this schedule. [Vercel cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

Frequent scheduled jobs may require a paid plan. If your Vercel plan cannot support the cadence, use an authenticated external scheduler calling the same HTTPS endpoint with the Bearer secret, and remove an incompatible Vercel cron configuration before deployment. Do not settle for a daily schedule while expecting timely email or reservation reconciliation. Never place the secret in a public URL/query string.

After deployment, invoke the job manually with the correct Authorization header and inspect the result, deployment logs, reservation states, and email outbox. Verify recurring invocations appear in your scheduler. Set an alert for job errors or a growing queue. Database leases and idempotency protect retries; operational monitoring is still necessary.

## Production environment

Use a separate Supabase production project and separate live webhook secrets. Apply migrations before deploying code that requires them. Configure all production environment variables, but keep payment/shipping in test modes until you intentionally finish [launch-checklist.md](launch-checklist.md).

Never copy production customer data or credentials into previews. Restrict access to Vercel and Supabase project settings, enable account protections, and review backups and usage budgets. Establish a deployment rollback plan and a compatible database migration strategy; rolling back application code does not undo a database migration.

## Custom domain

1. Buy or choose a domain you control.
2. In Vercel Project Settings → Domains, add the apex domain and optionally `www`.
3. At the domain's DNS provider, add exactly the records displayed by Vercel for that project. Do not copy old example IPs or overwrite unrelated email DNS records.
4. Wait for verification and HTTPS issuance. Choose one canonical hostname and redirect the other through the domain settings.
5. Change `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin and redeploy.
6. Update Supabase site/redirect configuration, Stripe webhook URL, EasyPost webhook URL, and any external scheduler destination.
7. Verify checkout return links, order emails, canonical metadata, sitemap, and webhook delivery all use the final domain.
8. Configure the Resend sending-domain DNS independently and verify the sender's domain; web hosting DNS does not automatically authenticate email.

Follow the current project-specific records in [Vercel's domain documentation](https://vercel.com/docs/domains/working-with-domains/add-a-domain), because DNS targets and configuration details can change.
