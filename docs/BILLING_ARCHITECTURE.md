# Billing Architecture

Stripe flow, provisioner, webhook events, PlanContext, and profiles schema.

## Flow

```
Checkout → Webhook → Provisioner → profiles → PlanContext
```

1. User completes Stripe Checkout (or pays recurring invoice)
2. Stripe sends webhook event
3. Webhook handler calls `provisionSubscription` or `cancelSubscription`
4. Provisioner updates `profiles` and optionally grants credits via ledger
5. API routes use `getPlanContext(supabase, userId)` to obtain plan context; no direct `profiles.subscription_plan` queries

## Webhook events

| Event | Handler action |
|-------|----------------|
| `checkout.session.completed` | Resolve tier from priceId → call `provisionSubscription` (profile + ledger grant) |
| `customer.subscription.deleted` | Call `cancelSubscription` (profile → free) |
| `invoice.paid` | Call `provisionSubscription` (recurring grant; idempotent by event.id) |
| `checkout.session.expired` | No action |
| `customer.subscription.updated` | No action (Stripe will send `deleted` when done) |
| `invoice.payment_failed` | No action (Stripe retries; we get `deleted` when subscription lapses) |

**Idempotency**: Events are recorded in `stripe_webhook_events` by `event_id`. Duplicate deliveries return 200 without re-processing.

## Provisioner

- **Location**: `libs/monkey/subscriptionProvisioner.js`
- **provisionSubscription**: Updates `profiles.subscription_plan`, `profiles.credits_reset_at`; calls `meterGrant` for monthly credits; accepts `customerId` and `priceId` (for future profile linkage)
- **cancelSubscription**: Sets `profiles.subscription_plan` to `"free"`; no credit grant

## PlanContext

- **Location**: `libs/monkey/planContext.js`
- **getPlanContext(supabase, userId)**: Fetches profile, resolves tier via `getTierById(profile.subscription_plan)`, returns PlanContext with limits
- **assertPlan(plan, feature)**: Throws `PlanAssertionError` if plan does not allow the feature (e.g. `image_generation`, `metering_spend`, `max_pending_external`, `projects.create`, `scheduler.daily`)

**Rule**: API routes must not query `profiles.subscription_plan` directly; use `getPlanContext` and consume PlanContext.

## Profiles columns (billing-related)

| Column | Purpose |
|--------|---------|
| `subscription_plan` | free, starter, or pro (see `libs/monkey/registry/subscriptionTiers.js`) |
| `customer_id` | Stripe customer id |
| `price_id` | Stripe price id for current plan |
| `credits_reset_at` | Next date when monthly credits are granted |
| `credits_remaining` | Current credit balance |
| `payg_wallet` | Pay-as-you-go wallet balance |

## Tier source of truth

Tier definitions live in **code only**: `libs/monkey/registry/subscriptionTiers.js`. No tier tables or seeds in the database.
