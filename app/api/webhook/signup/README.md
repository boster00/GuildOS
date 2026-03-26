# Signup webhook

This endpoint is called by Supabase when a **new row is inserted** into `auth.users` (signup only, not on login). It grants free-tier credits and can be extended with onboarding emails, etc.

## Env

- `SIGNUP_WEBHOOK_SECRET` — Set to a random string or UUID. Used to verify requests. Add to `.env.local` and production.

## Create the webhook in Supabase

### Option A — Dashboard (preferred)

1. Supabase Dashboard → your project → **Database** → **Webhooks** (or **Integrations** → **Webhooks**).
2. Create a new webhook:
   - **Table:** `auth.users` (or "users" in schema **auth**). If the UI does not list `auth.users`, use Option B.
   - **Events:** Insert.
   - **URL:** `https://<your-app-domain>/api/webhook/signup`
   - **Headers:** Add `Authorization: Bearer <SIGNUP_WEBHOOK_SECRET>` or `X-Webhook-Secret: <SIGNUP_WEBHOOK_SECRET>` (same value as in env).

### Option B — Migration (trigger + pg_net)

If the Dashboard does not allow selecting `auth.users`, add a migration that creates an `AFTER INSERT ON auth.users` trigger and uses the `pg_net` extension to POST the new row to your app URL, with the secret in a header. The trigger only forwards the event; all business logic (grantSignup, etc.) stays in this route.
