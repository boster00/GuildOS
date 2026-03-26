# Stripe Account Mismatch Fix

## Problem Discovered

Webhooks weren't firing for sandbox mode checkouts because of a Stripe account mismatch:

### Before Fix:
- **Checkout sessions** created with: `sk_test_� (redacted)` (Account A)
- **Stripe CLI** listening to: `acct_1SB8U3FISjkZ1PKx` (Account B)  
- **Result**: Webhooks sent to Account A, but CLI listening to Account B = No webhooks received

### Root Cause:
Two different Stripe test accounts were configured:
1. Main account (`acct_1SB8U3FISjkZ1PKx`) - Stripe CLI connected here
2. Sandbox account (`acct_1SB8UIF6LYYE8X5S`) - Used in `.env.local`

## Solution Applied

Updated `.env.local` to use **ONE Stripe account** for both sandbox and regular modes:

```env
# OLD (different accounts)
STRIPE_SECRET_SANDBOX_TEST_KEY=sk_test_� (redacted) ❌

# NEW (same account as Stripe CLI)
STRIPE_SECRET_SANDBOX_TEST_KEY=sk_test_51SB8U3FISjkZ1PKxJ8Q... ✅
```

Now:
- Sandbox mode = Test mode of main account
- Live mode = Live mode of main account
- Stripe CLI = Connected to main account
- **Result**: All webhooks are received correctly

## Updated Files

1. **`.env.local`**:
   - `STRIPE_PUBLIC_SANDBOX_TEST_KEY` → Main account test key
   - `STRIPE_SECRET_SANDBOX_TEST_KEY` → Main account test key
   - `STRIPE_PRICE_*_SANDBOX_TEST` → Main account test prices

2. **Architecture**:
   - Sandbox mode is now just a UI toggle for local development
   - Both modes use the same Stripe account (test vs live)
   - Webhooks work correctly because CLI and app use same account

## How It Works Now

### Local Development:
1. Toggle "Sandbox Mode" ON → Uses test mode keys from main account
2. Create checkout → Session created in test mode
3. Complete payment → Stripe sends webhook to CLI
4. CLI forwards to `localhost:3000/api/webhook/stripe`
5. Webhook handler processes and updates database ✅

### Production:
1. Uses live mode keys from main account
2. Stripe Dashboard webhook endpoint configured
3. Webhooks sent directly to production URL

## Testing

To verify the fix works:

```bash
# 1. Start dev server with Stripe CLI
npm run dev:with-webhooks

# 2. Go to http://localhost:3000/billing/subscriptions
# 3. Toggle "Sandbox Mode" ON
# 4. Click "Get Starter Plan"
# 5. Complete checkout with test card: 4242 4242 4242 4242

# Expected logs:
# [stripe] --> checkout.session.completed [evt_xxx]
# [next] [webhook/stripe] ===== WEBHOOK REQUEST RECEIVED =====
# [next] [webhook/stripe] ✓ Profile UPDATE SUCCESSFUL
```

## Key Takeaway

**You don't need multiple Stripe accounts for local vs production testing.**

Stripe provides:
- **Test Mode** = Sandbox (test cards, no real money)
- **Live Mode** = Production (real cards, real money)

Use the same account, just toggle between test and live mode.
