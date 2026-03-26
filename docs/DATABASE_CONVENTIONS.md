# Database Conventions

Conventions for Supabase migrations, profiles schema, and tier handling.

## Migration style

### Preferred patterns

- **`ADD COLUMN IF NOT EXISTS`** — Use for new columns when no conditional logic is needed.
- **`DO $$` blocks** — Use only for:
  - Column renames (e.g., `subscription_tier_id` → `subscription_plan`)
  - Conditional logic (check if column exists before altering)
  - Multi-statement operations that require a transaction block

### Idempotency

- Migrations should be safe to run multiple times where possible.
- Use `IF NOT EXISTS` for objects; use conditional checks in `DO $$` for renames.

### Schema sync

To regenerate the exact schema for AI reference:

```bash
supabase db dump --schema public > libs/reference-for-ai/database-schema.sql
```

Run after schema-changing migrations. Requires Supabase CLI and a linked project or local `supabase start`.

**Running migrations:** Apply migrations (e.g. `npx supabase db push` or `supabase migration up`) so that `profiles` has `stripe_customer_id` and `stripe_subscription_id`. Required for test-stripe Phase 5 webhook simulation and for Stripe webhook flows.

---

## Profiles schema (key columns)

| Column | Purpose |
|--------|---------|
| `subscription_plan` | Plan name: free, starter, or pro (see `libs/monkey/registry/subscriptionTiers.js`) |
| `stripe_customer_id` | Stripe customer ID (cus_...) — required for invoice lookups |
| `stripe_subscription_id` | Stripe subscription ID (sub_...) |
| `stripe_price_id` | Stripe price ID (price_...) — optional, plan derived from subscription |
| `credits_reset_at` | Next date when monthly credits are granted |
| `credits_remaining` | Current credit balance (ledger-derived or stored) |
| `payg_wallet` | Pay-as-you-go wallet balance |

---

## Credit usage

- **`api_usage_logs` has been removed.** Usage and balance are in `credit_ledger` and `profiles`. User usage history comes from `credit_ledger` (debit rows, cost > 0).

## Tiers vs DB

- **Tier definitions live in code only**: `libs/monkey/registry/subscriptionTiers.js`
- Do **not** create new tier tables or seed plans in the database.
- `profiles.subscription_plan` stores the plan name (free, starter, pro).
- Limits, Stripe price mapping, and quotas come from the registry, not from DB tables.
