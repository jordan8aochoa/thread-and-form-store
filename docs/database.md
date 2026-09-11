# Supabase database and first administrator

Use a dedicated Supabase project for this store. The migration configures explicit grants and Row Level Security for the store's public schema; do not apply it to an unrelated database that shares application tables or functions.

## Hosted development database

1. Create a new Supabase project in your own account and retain its database password in your password manager.
2. From the repository root (the folder containing `package.json`), use the installed CLI:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
```

The last command applies the checked-in migrations and loads `supabase/seed.sql`. Use seed data only for a new development/staging database; do not reseed an operating store casually. The initial commerce migration is `supabase/migrations/20260910022710_commerce_schema.sql`; additional migrations must be applied in order, including storage policies.

3. In Project Settings/API, copy the project URL, publishable key, and server secret into the corresponding variables in `.env.local`. Never put the secret key in a `NEXT_PUBLIC_` variable.
4. In Authentication URL Configuration, set the site URL to `http://127.0.0.1:3006` for your development project. Add the deployed domain when configuring a separate production project. There is no customer signup requirement; disable public signup if you do not otherwise need it.
5. Create the first administrator as described below.

If CLI login is unavailable, you can run the checked-in SQL files in the Supabase SQL editor in filename order, then run `seed.sql` once. This does not automatically establish CLI migration history. Before subsequently using CLI migration pushes, reconcile that history with Supabase's documented migration-repair workflow; never re-run schema creation blindly.

## Optional local Supabase stack

Start Docker Desktop first. The repository already includes `supabase/config.toml`, so do not initialize a second configuration.

```powershell
npx supabase start
npx supabase db reset --local
npx supabase status
```

`db reset --local` rebuilds the **local** database and loads migrations plus seed data; it deletes local data. It is appropriate for a disposable development database, not production. Never run `db reset --linked` on a live store.

The CLI prints the API URL, Studio URL, and local keys. Put its API URL and keys in `.env.local`. Use local Studio, usually `http://127.0.0.1:54323`, for the first admin steps. Local services also need Docker resources and open local ports. A failed Docker startup is separate from an application code/test failure. Stop the stack with `npx supabase stop` when done. [Supabase local setup](https://supabase.com/docs/guides/local-development/cli/getting-started)

## Create the first owner

1. Open Supabase Dashboard/Studio → Authentication → Users → Add user. Create an email/password user you control; use a strong unique password and confirm its email according to your environment. Do not insert directly into `auth.users` or place an admin password in the seed.
2. Copy that user's UUID.
3. In the SQL editor for the same project, replace the UUID below and run:

```sql
insert into public.admin_profiles (id, role, active)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid, 'owner', true)
on conflict (id) do update set role = excluded.role, active = true;
```

4. Visit `/admin/login` and sign in with that user. A normal Supabase user without an active `owner` or `admin` profile must remain unauthorized.
5. Change the seeded placeholder return address, support/owner emails, and brand settings before testing checkout.

To revoke a store administrator, set `admin_profiles.active = false` in the private management context and revoke their Supabase sessions as appropriate. The app verifies the user and reads the active role on server-side admin actions; authorization is not based on user-editable metadata.

## Security model and validation

Public catalog clients can read only active products, their images, and active variants. Customer/order/payment/shipping/contact/newsletter data is private. Administrative APIs require verified Supabase authentication plus an active admin profile. Service-only functions implement reservation, payment finalization, stock adjustment, refunds, and email claiming.

The public `product-images` storage bucket contains merchandise photography, not customer information or shipping labels. Uploads require admin authorization, and the UI uploads one JPEG, PNG, or WebP file at a time with a 4 MB per-file limit. Product images have preview, alt text, and ordering controls. Keep labels and other customer documents out of the public image bucket.

Run `npm test` for the schema/security fixture suite. On the actual configured project, also verify anonymous direct reads of `orders` and `customers` are denied, non-admin authenticated writes are denied, and an active admin can perform intended actions. Inspect Supabase's Security Advisor after migrations; fixture tests cannot prove that the deployed project retained its RLS, grants, storage configuration, or secrets.

Application record models are in `lib/database-models.ts` and shared UI models are in `lib/types.ts`. To regenerate exact PostgREST types after schema changes, inspect the installed CLI's current `gen types --help` and use its TypeScript generator against the chosen local/linked project. Do not overwrite the handwritten domain models without updating their consumers.
