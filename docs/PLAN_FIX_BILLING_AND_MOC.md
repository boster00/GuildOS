# Fix Billing and Master of Coins Issues (Revised Plan)

**Constraint: No new API endpoints.** Use Stripe Billing Portal for plan changes when user has existing subscription.

---

## Acceptance Criteria (must pass all)

### A) Billing UI: buttons + portal behavior ✓

- Billing page shows **two distinct actions**:
  - **"Choose Plan"** navigates to `/billing/subscriptions`.
  - **"Manage Billing in Stripe"** visible **only if** `stripe_customer_id` exists.
- Clicking **"Manage Billing in Stripe"**:
  - Generates portal session **only on click** (no pre-rendered URL in HTML).
  - Opens portal in new tab (`target="_blank"` + `rel="noopener noreferrer"`).
  - No secrets or portal URLs embedded in server-rendered markup before click.
- **Covered by:** Issue 1, UX rule.

### B) Subscriptions page: correct upgrade/downgrade flow ✓

- If `stripe_subscription_id` is **null**: offers "Subscribe" (Checkout) for paid tiers.
- If `stripe_subscription_id` is **present**:
  - Does **not** create second subscription.
  - Guides to **single** plan-change mechanism (Stripe Portal).
- After plan change in Stripe:
  - `profiles.subscription_plan` updated to new tier.
  - Stripe identifiers remain **single** and consistent (no duplicate `stripe_subscription_id`).
- **Covered by:** Issue 2, Issue 4.

### C) Webhook → Master of Coins: credits grant on plan change ✓

- **Upgrade (e.g. starter → pro):**
  - MoC "immediate" triggered **exactly once** per invoice (idempotent).
  - `profiles.credits` increases by expected prorated delta (tier quotas × remaining fraction).
  - Logs: invoice → tier mapping → proration → MoC call → success.
- **Downgrade (e.g. pro → starter):**
  - No immediate credit grant (delta ≤ 0 skipped).
  - Downgrade instruction recorded (`pending_change` without `effective_at`).
  - Logs explicitly state why grant skipped.
- **Covered by:** Issue 2, Issue 5.

### D) Test harness Step B: reflects real production semantics ✓

- **Without subscription:** shows checkout links using `subscriptionTiers` priceIds (sandbox vs live).
- **With active subscription:** does **not** show "subscribe new plan" checkout (no second subscription); shows plan-change path (portal).
- Completing "Upgrade via Stripe" + "Refresh Profile":
  - Profile plan changes via webhook.
  - Credits change when MoC immediate correctly triggered (documented + logged).
- **Covered by:** Issue 2, Test harness section.

### E) Reset schedule: single source of truth + time simulation ✓

- `credits_reset_at` is **only** field for "due for reset":
  - Worker selection.
  - Test page due badge.
  - Reset logic.
- `coins_work_order.pending_change` has **no `effective_at`**; reset applies pending downgrade only when reset runs (`credits_reset_at <= now()`).
- Time simulation works:
  - Fast-forward → `credits_reset_at` moves to past → account "Due for reset".
  - Run reset → monthly credits reset, PAYG untouched, `credits_reset_at` advanced, pending downgrade applied & cleared.
  - Re-run reset in same period → idempotent (skipped with explicit reason).
- **Covered by:** Issue 4, Issue 5, Issue 6.

### F) Schema consolidation: no duplicate/conflicting columns ✓

- After migration:
  - `subscription_renewal_at` removed (or fully unused/absent from code).
  - `subscription_period_start_at` kept for proration only.
  - `credits_reset_at` backfilled for existing subscribed profiles.
  - Webhook updates `credits_reset_at` on subscription create/update.
  - Stripe period timestamps (if needed for debugging) in `subscription_meta` only (read-only reference).
- **Covered by:** Issue 4.

### G) Observability: logs sufficient to debug failures ✓

- **Webhook processing:** invoice id, subscription id, customer id, derived fromPlan/toPlan, computed delta, skip reasons.
- **Reset worker:** count of due profiles, each processed profile id, outcome (ok/skipped/error), why.
- **MoC API:** inbound mode, profileId, idempotency key, result summary.
- **Covered by:** Issue 2, Issue 6.

### H) Safety / non-negotiables ✓

- **No Stripe secret, MoC secret, or service role key** exposed client-side (all in env, server-side only).
- **All MoC calls requiring secrets** executed server-side (server actions / API routes only).
- **No hardcoded plan numbers** in UI labels; display values from `subscriptionTiers` at render time.
- **Covered by:** Implicit throughout; made explicit here.

---

## Non-negotiable UX rule

**All Stripe-related links open in a new tab:** Auth link, Checkout link, Portal link → use `target="_blank"` and `rel="noopener noreferrer"` everywhere.

---

## 0) Non-negotiable: No New Endpoints

- **Do NOT add** `app/api/stripe/update-subscription/route.js` or any new subscription-update endpoint.
- **Replace with:** Use **Stripe Billing Portal** for **any plan change when `stripe_subscription_id` exists** (upgrade/downgrade/switch).
- This avoids double subscriptions, mismatched webhooks, and missing credit grants.

---

## Issue 1: Billing UI — "Manage in Stripe" on-click

**Goal:** Split "Manage subscription" into "Choose Plan" (internal) and "Manage billing in Stripe" (portal, on-click only).

### Changes

**`app/(private)/billing/page.js`**

- Rename current "Manage Subscription" button → **"Choose Plan"** (navigates to `/billing/subscriptions`).
- Add a second button **"Manage billing in Stripe"** (or **"Change plan in Stripe"**):
  - Show **only if** `stripe_customer_id` exists (from plan/credits API or profile).
  - On click: call existing `POST /api/stripe/create-portal` with `returnUrl`, then open returned URL in **new tab** (per UX rule: all Stripe actions in new tab).
- No new endpoints; reuse `create-portal`.
- **Security:** No portal URL or secrets pre-rendered in HTML; generation happens server-side on click only.

**✓ Satisfies: Acceptance criterion A** (two buttons, portal on-click, new tab, no secrets in markup).

---

## Issue 2: Subscription modification — Stripe Portal only (no new endpoints)

**Approach:** Use **Stripe Billing Portal** for **all** plan changes when `stripe_subscription_id` exists. Do **not** add any new API route (e.g. `update-subscription`); that would violate "no new endpoints" and increase surface area.

**Billing UI**

- If `stripe_subscription_id` exists → **hide/disable** "Subscribe via Checkout" for paid tiers; show **"Change plan in Stripe"** (portal) only.
- Wording everywhere: use **"Open Stripe Portal to change plan"** (not "Modify Subscription button").

**Test page Step B**

- Same rule: if profile has subscription → show **portal link only** (new tab). No checkout links when subscribed.
- Wording: **"Open Stripe Portal to change plan"**.

**Webhook credit-grant trigger — event-robust**

- **Do not** rely on `billing_reason === 'subscription_update'` as the only gate.
- Implement upgrade/downgrade detection from **invoice line item priceId(s)** (old vs new) or subscription items diff, then map to tierId via `subscriptionTiers.resolveTierFromPriceId`.
- Handle **both** events: **`invoice.paid`** and **`invoice.payment_succeeded`** (call same handler).
- **Critical:** When calling `mode=immediate`, derive **fromPlan/toPlan from invoice line items**, not from `profile.subscription_plan` (profile may already be updated by `customer.subscription.updated`).

**Logging (sanitized)**

- Log: invoice id, billing_reason, subscription id.
- Log line items: priceId, amount, proration flag.
- Log derived fromPlan/toPlan, computed delta, and **why skipped** (if grant skipped).

**Files to touch**

- `libs/stripe/processWebhookEvent.js`: derive from/to from invoice lines; handle both invoice.paid and invoice.payment_succeeded; add above logs.
- `app/api/webhook/stripe/route.js`: route `invoice.payment_succeeded` to same handler; no new routes.

**Additional for criteria:**

- **After plan change via Stripe Portal:** Profile will reflect new tier (`subscription_plan` updated), single `stripe_subscription_id` (no duplicates).
- **Downgrade logs:** Explicitly log when grant skipped (e.g. "delta <= 0, skipping grant; downgrade will apply at next reset").
- **Security:** All MoC calls server-side only; no secrets client-side.
- **UI:** Use `subscriptionTiers` for display values (no hardcoded plan names/prices).

**✓ Satisfies: Acceptance criteria B, C, D** (correct upgrade/downgrade flow, credits grant on plan change, test harness reflects production).

---

## Issue 3: Test page Step C — pro→starter works; starter→pro fails

**Clarification:** The Next.js `searchParams` async fix may resolve a warning but is **not** the root cause of "starter→pro" failing. The real issue is upgrade detection and fromPlan/toPlan source of truth.

### Edits

**Logging (required)**

- **Webhook handler:** Log for relevant invoice events:
  - event type, invoice id, billing_reason, subscription id,
  - invoice line items summary (price ids, amount, proration flag),
  - which branch was taken (grant / skip) and why.
- **MoC `applyImmediateUpgrade`:**
  - Log: fromPlan, toPlan, quotas, remainingFraction, creditDelta, idempotencyKey,
  - and "grant skipped reason" when skipped.

**Functional fix**

- **Do not** treat UI-provided fromPlan/toPlan as truth for "simulate invoice.paid upgrade."
- Server action can accept `invoiceId` (idempotency) and optional `toPlan`, but the **real** from/to must be computed from Stripe artifacts (invoice lines or stored price id), not from current profile.
- For test harness "Call MoC Immediate": either feed it invoice-like data (e.g. from a test invoice id or mock line items) so fromPlan/toPlan are derived server-side from price IDs, or clearly document that manual test is "best effort" and production behavior is driven by webhooks with invoice-derived from/to.

**Next.js searchParams (correct detail)**

- Only apply **"await props.searchParams"** if you are actually on a Next.js version where `searchParams` is a Promise (check your version).
- **Safer edit:** Treat `searchParams` as a plain object and avoid async unless proven necessary; the **error log** from your setup is the source of truth. If the log shows sync-dynamic-apis and your Next version documents that searchParams is a Promise, then use `const searchParams = await props.searchParams`; otherwise keep synchronous access.

---

## Issue 4: Schema consolidation — keep period start for proration; migration safety

**Constraint:** Do not drop columns needed for proration or debugging.

### Recommended minimal set

- **Keep:**
  - `credits_reset_at` — MoC scheduler single source of truth (due when `credits_reset_at <= now()`). Nullable; worker **must ignore** rows where null.
  - `subscription_period_start_at` — needed for proration fraction.
  - `subscription_meta` — define contents explicitly: `{ price_id, period_start, period_end, last_invoice_id, ... }` for debugging only.
- **Drop:**
  - `subscription_renewal_at` only, **after** backfill and code change (see migration guard below).

**Rule**

- MoC "due" logic uses **only** `credits_reset_at`; worker ignores profiles with null `credits_reset_at`.
- Webhook **always** sets `credits_reset_at` for paid subscriptions (from Stripe `current_period_end`).
- Proration uses `(period_start, period_end)` — keep canonical (e.g. `subscription_period_start_at` + `credits_reset_at` as period end).

### Migration — tighten safety

1. **Backfill `subscription_meta` before dropping columns:** Preserve `period_start`, `period_end`, and `price_id` (from existing columns or Stripe) into `subscription_meta` for debugging, so nothing is lost.
2. **Migration guard:** Only drop `subscription_renewal_at` **after** confirming no code references it (code change first, deploy, then run migration to drop).
3. **DB constraint/comment:** Document that `credits_reset_at` is nullable but worker must ignore null; webhook must always set it for paid subscriptions. Add comment on column.

### Migration sketch

- Backfill: `UPDATE profiles SET subscription_meta = jsonb_build_object('period_start', subscription_period_start_at, 'period_end', subscription_renewal_at, 'price_id', stripe_price_id) WHERE ...` (and merge with existing subscription_meta if present).
- Sync: `credits_reset_at = subscription_renewal_at` where `subscription_renewal_at` is not null.
- Drop: `subscription_renewal_at` only (in a **separate** migration after code is updated and deployed).
- Do **not** drop `subscription_period_start_at`.
- Comment on `credits_reset_at`: nullable; worker ignores null; webhook sets for paid subs.

### Code updates

- All "due" queries: use `credits_reset_at` only; worker filters `WHERE credits_reset_at IS NOT NULL AND credits_reset_at <= now()`.
- Proration in MoC: use `subscription_period_start_at` and period end (e.g. `credits_reset_at`).
- Webhook: set `credits_reset_at` from Stripe `current_period_end`; set `subscription_period_start_at`; update `subscription_meta` with period/price_id.

**✓ Satisfies: Acceptance criterion F** (schema consolidation, no duplicate columns, credits_reset_at backfilled, webhook updates it, Stripe period in meta only).

---

## Issue 5: Remove `effective_at` from pending_change — explicit logic

- Remove `effective_at` from `coins_work_order.pending_change` schema and from all callers (API, MoC, test page).

**Test page**

- Remove the **effective_at input** and any UI text implying timing control via effective_at (e.g. "Effective At (default: credits_reset_at or renewal_at)").
- UI copy: "Downgrade applies at next reset (credits_reset_at)."

**schedule_downgrade API**

- Update API/docs: downgrade applies on **next reset run** (at the `credits_reset_at` boundary); no client-specified effective_at.

**RPC / reset logic**

- Apply **pending_change unconditionally** during reset when present (no effective_at check).
- **Clear** `pending_change` from work order **after** applying the downgrade (so it is not applied again).

**✓ Satisfies: Acceptance criterion E (part)** (pending_change has no effective_at, reset applies pending downgrade only when reset runs via credits_reset_at).

---

## Issue 6: Reset cron simulation — fix likely cause, not just logging

**Fix likely cause**

- **ensureCreditsResetAt(profileId) guard in reset path:** Before processing reset for a profile, if `credits_reset_at` is null → set it (e.g. to `now() + 1 month` or to subscription period end if available from profile/meta). This prevents "no due profiles" when the column was never set.
- **Worker:** Ensure `/api/master-of-coins/worker` calls `/api/master-of-coins` with **correct auth + origin**. When response is **non-200**, log **HTTP status + response body** so failures are visible.
- **Reset query in `/api/master-of-coins`:** Select `id, credits_reset_at` for due profiles; **log count**. If count is zero, log **"no due profiles"** explicitly (so it's clear the query returned nothing rather than an auth/routing issue).

**Auth and origin**

- Test page server action: confirm `Authorization` and `origin` (e.g. `getOrigin()`). Log 401/403 explicitly so test page can show "Unauthorized".

**Logging**

- Master-of-coins route (reset): profileId, result, logs.
- Worker: request received; API response status + body (especially when non-200).
- MoC `processReset`: profile loaded, quota, RPC params, RPC result.

**Additional for criteria:**

- **Time simulation:** Fast-forward time (test harness) → `credits_reset_at` in past → "Due for reset" badge. Run reset → monthly credits reset (PAYG untouched), `credits_reset_at` advanced to next period, pending downgrade applied & cleared. Re-run → idempotent (skipped with reason).
- **Observability:** Logs cover: worker due-count + profile ids + outcomes; MoC API mode/profileId/idempotency/result; sufficient to debug failures.

**✓ Satisfies: Acceptance criteria E (full), G** (reset schedule single source of truth, time simulation works, observability logs).

---

## Net: what changed from the first plan

| Item | First plan | Revised plan |
|------|------------|--------------|
| New endpoint | `update-subscription` | **None** — use Stripe Portal only for plan changes when subscribed |
| Plan change for paid users | New API to update subscription | **Stripe Portal only** (UI + test page) |
| Upgrade detection | From profile + webhook | **From invoice line items / priceId** → fromPlan/toPlan |
| Schema | Drop both renewal_at and period_start_at | **Keep subscription_period_start_at and credits_reset_at**; drop only subscription_renewal_at after backfill/sync |
| Proration | Unclear | **Canonical (period_start, period_end)** e.g. subscription_period_start_at + credits_reset_at |
| effective_at | Remove | Same — remove from work order |
| Reset cron | Logging | Logging **plus** auth/origin checks, due-query log, ensureCreditsResetAt guard, verify credits_reset_at set and in past |
| Safety | Implicit | **Explicit:** No secrets client-side; all MoC calls server-side; no hardcoded plan numbers (use subscriptionTiers) |

---

## Files to modify (revised list)

1. **`app/(private)/billing/page.js`** — "Choose Plan" + "Manage billing in Stripe" (on-click, only if stripe_customer_id).
2. **`app/(private)/billing/subscriptions/page.js`** — If `stripe_subscription_id` exists: CTA = open Stripe Portal; no checkout links for plan change.
3. **`app/(private)/tests/master-of-coins/page.js`** — searchParams per Next version; Section B: if subscription exists show only "Open Stripe Portal to change plan"; no new endpoint; **do not use /api/billing/plans** — use subscriptionTiers + sandbox cookie only; Stripe links `target="_blank"`.
4. **`app/api/webhook/stripe/route.js`** — Route `invoice.payment_succeeded` if needed; set `credits_reset_at` from Stripe period end; keep period_start.
5. **`libs/stripe/processWebhookEvent.js`** — Derive fromPlan/toPlan from invoice lines; handle invoice.paid + invoice.payment_succeeded; add logging.
6. **`libs/monkey/tools/masterOfCoins.js`** — Remove effective_at from scheduleDowngrade; add logging in applyImmediateUpgrade and processReset; proration uses period_start + period end.
7. **`app/api/master-of-coins/route.js`** — Use credits_reset_at for due query; add logging; log 401/403 in reset path if applicable.
8. **`app/api/master-of-coins/worker/route.js`** — Log due-query result and `now`; log API response.
9. **`supabase/migrations/`** — One migration: sync credits_reset_at from subscription_renewal_at, drop subscription_renewal_at only, keep subscription_period_start_at; define subscription_meta shape in comment.
10. **`supabase/migrations/20250219010000_master_of_coins_process_reset_rpc.sql`** — Remove effective_at from pending_change application logic.

**No new files** for subscription update; no `update-subscription` route.

---

## Test harness: no /api/billing/plans

**Remove plan's internal contradiction:** The test page must **not** use `/api/billing/plans` for priceIds or plan data. Use **subscriptionTiers** (from `@/libs/monkey/registry/subscriptionTiers`) plus **sandbox cookie** logic only when building checkout links or tier options. Remove any `fetch("/api/billing/plans")` or `/api/tiers` usage from the test-master-of-coins page and its server actions (e.g. createCheckoutLinks and any code that builds tier/price lists).

---

## Safety & Non-negotiables (explicit statement for criterion H)

**Security:**

- **No Stripe secret, MoC secret, or service role key exposed client-side.** All secrets stored in `.env.local` (server-side only); never in client components, HTML source, or browser JavaScript.
- **All MoC API calls requiring secrets executed server-side only:** Server actions (in test page, billing page) or API routes (`/api/master-of-coins`, `/api/stripe/*`). Client never calls MoC directly with secrets.

**Data integrity:**

- **No hardcoded plan numbers in UI labels.** All tier names, prices, quotas, and credit allocations rendered from `subscriptionTiers.TIERS` at runtime (both production app and test page). If tier definitions change in code, UI updates automatically without code changes.

**✓ Satisfies: Acceptance criterion H** (safety/non-negotiables: no secrets client-side, all MoC calls server-side, no hardcoded plan numbers).
