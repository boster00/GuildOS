# Billing Subscription Flow

Reference for AI: provisioner, webhook events, profiles, PlanContext.

## Provisioner responsibilities

**File**: `libs/monkey/subscriptionProvisioner.js`

- **provisionSubscription**: Updates `profiles.subscription_plan`, `profiles.credits_reset_at`; calls `meterGrant` for monthly credits; idempotent by `idempotencyKey` (Stripe event id)
- **cancelSubscription**: Sets `profiles.subscription_plan` to `"free"`; no credit grant

## Webhook events

| Event | Effect |
|-------|--------|
| `checkout.session.completed` | provisionSubscription (profile + ledger grant) |
| `customer.subscription.deleted` | cancelSubscription |
| `invoice.paid` | provisionSubscription (recurring grant; idempotent) |

Idempotency: `stripe_webhook_events` table stores `event_id`; duplicates return 200 without re-processing.

## Profiles and PlanContext

- **profiles**: Stores `subscription_plan`, `customer_id`, `price_id`, `credits_reset_at`, `credits_remaining`, `payg_wallet`
- **PlanContext**: Fetched via `getPlanContext(supabase, userId)`; includes tier, limits, has_access
- API routes must use `getPlanContext`; do not query `profiles.subscription_plan` directly

## Tier resolution

- **priceId → tierId**: `getTierIdByPriceId(priceId)` in subscriptionTiers.js
- **tierId → limits**: `getLimitsForTierId(tierId)` in subscriptionTiers.js
- Tier definitions: `libs/monkey/registry/subscriptionTiers.js` (source of truth)
