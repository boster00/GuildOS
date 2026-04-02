# Master of Coins — Reference for AI

Master of Coins is the **single authority** for the subscription credit economy in CJGEO. All business logic for granting, expiring, and prorating subscription credits lives in one file and is accessed only via `monkey.masterOfCoins.*`.

---

## Architecture

- **Single file**: `libs/monkey/tools/masterOfCoins.js` — all logic (scheduleDowngrade, processReset, applyImmediateUpgrade).
- **Single access**: Only `monkey.masterOfCoins.*`; the only place that imports the file is `libs/monkey.js` (attaches to monkey instance).
- **Single API**: `POST /api/master-of-coins` — handles `mode=immediate` (Stripe upgrade), `mode=reset` (cron/worker), `mode=schedule_downgrade`.
- **Worker**: `POST /api/master-of-coins/worker` — calls the single API once with `mode=reset`; the API loops over all due profiles server-side.

---

## How triggers work

### 1. Stripe webhook (immediate mode)

- **Entry**: `app/api/webhook/stripe/route.js` receives Stripe events.
- **checkout.session.completed** (new subscription): Route updates profile with `subscription_plan`, Stripe IDs, and **period columns** (`subscription_period_start_at`, `subscription_renewal_at`) by fetching the subscription from Stripe. No credit grant here; first grant happens on first `invoice.paid` or via worker reset.
- **customer.subscription.updated**, **customer.subscription.deleted**, **invoice.paid**: Route delegates to `libs/stripe/processWebhookEvent.js`.
  - **subscription.updated**: Updates profile with `subscription_plan` (from subscription price), `subscription_renewal_at`, `subscription_period_start_at` (Stripe truth). No credit logic.
  - **invoice.paid**: If **upgrade** (subscription_update + higher plan), `processWebhookEvent` calls the Master of Coins API with `mode=immediate` (profileId, fromPlan, toPlan, period dates, idempotency key). The API runs `monkey.masterOfCoins.applyImmediateUpgrade()` (prorated credit delta only). If renewal (`subscription_cycle`), no grant here; the worker reset handles grants when due.

### 2. Cron trigger (reset mode)

- **Entry**: Vercel cron calls `GET /api/cron/trigger` (or manual POST with `CRON_SECRET`).
- **Step 5** in the cron flow: Instead of the old “monthly credits refresh,” the cron calls **Master of Coins worker**: `POST /api/master-of-coins/worker` with `Authorization: Bearer <CRON_SECRET>` (or `MASTER_OF_COINS_SECRET`).
- The **worker** does a single internal `POST /api/master-of-coins` with body `{ mode: "reset" }` (no `profileId`).
- The **API** fetches all profiles where `subscription_renewal_at <= now()`, then for each calls `monkey.masterOfCoins.processReset(supabase, { profileId }, log)`. `processReset` calls the Postgres RPC `master_of_coins_process_reset`, which in one transaction: locks profile, applies pending downgrade, expires monthly credits only, grants full monthly credits, updates work order idempotency and `credits_reset_at`. Period columns (`subscription_renewal_at`, `subscription_period_start_at`) are **Stripe-owned** and are not advanced by the RPC; they are updated only on `customer.subscription.updated` (or at checkout).

---

## Summary

| Trigger              | Mode / path              | Who calls                         | Effect                                                                 |
|----------------------|--------------------------|------------------------------------|------------------------------------------------------------------------|
| Stripe checkout      | Webhook route            | Stripe → route                     | Set plan, Stripe IDs, period columns; no credits                      |
| Stripe subscription.updated | processWebhookEvent | Route → processWebhookEvent        | Update plan + period columns (Stripe truth)                            |
| Stripe invoice.paid (upgrade) | processWebhookEvent | processWebhookEvent → MoC API      | MoC API runs applyImmediateUpgrade (prorated grant + plan update)      |
| Stripe invoice.paid (renewal) | —                  | —                                  | No grant; worker reset grants when due                                 |
| Cron                 | MoC worker               | Cron trigger → worker → MoC API   | API runs processReset for all due profiles (expire + grant + idempotency) |

---

## Auth and env

- **API** `POST /api/master-of-coins`: `Authorization: Bearer <MASTER_OF_COINS_SECRET | CRON_SECRET>` or header `x-master-of-coins-secret`.
- **Worker** `POST /api/master-of-coins/worker`: Same secret.
- **processWebhookEvent** calls the API with the same secret (server-side).

---

## Key files

- `libs/monkey/tools/masterOfCoins.js` — only file with Master of Coins business logic.
- `libs/monkey.js` — only place that imports masterOfCoins and attaches to monkey.
- `app/api/master-of-coins/route.js` — single API (immediate / reset / schedule_downgrade).
- `app/api/master-of-coins/worker/route.js` — thin worker (one call to API with mode=reset).
- `app/api/webhook/stripe/route.js` — webhook entry; checkout sets period columns; delegates to processWebhookEvent for subscription/invoice events.
- `libs/stripe/processWebhookEvent.js` — subscription.updated (state), invoice.paid (calls MoC API for upgrade).
- `app/api/cron/trigger/route.js` — Step 5 calls MoC worker instead of monthly_credits_refresh.
