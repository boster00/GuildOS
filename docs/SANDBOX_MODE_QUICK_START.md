# Sandbox Mode Quick Start

## What I Fixed

Your app **already had** sandbox mode implemented, but it needed better logging. I've enhanced the code to show exactly what's happening when sandbox mode is enabled.

## Your Sandbox Test Prices (Already Configured!)

You already have test mode prices configured in `.env.local`:

```env
STRIPE_PRICE_STARTER_SANDBOX_TEST=price_1SB8XpF6LYYE8X5S5zEdGnwd
STRIPE_PRICE_PRO_SANDBOX_TEST=price_1SB8YNF6LYYE8X5StNF3txWj
STRIPE_PRICE_STARTER_PAYG_SANDBOX_TEST=price_1SztZzF6LYYE8X5ShBpqAl4i
STRIPE_PRICE_PRO_PAYG_SANDBOX_TEST=price_1SztajF6LYYE8X5SD53cbl9Y
```

These are **test mode** price IDs that work with your test API keys.

## How to Test (Step-by-Step)

### 1. Start Dev Server with Auto-Webhook Capture

```bash
npm run dev:stripe
```

Watch for this output:
```
✅ WEBHOOK SECRET CAPTURED SUCCESSFULLY!
   Secret: whsec_4854ab9f7eaf...
   Storage: Injected as STRIPE_WEBHOOK_SECRET environment variable
```

### 2. Verify Price IDs Are Configured

Visit in your browser:
```
http://localhost:3000/api/billing/debug-prices
```

You should see:
- `hasSandboxPrice: true` for Starter and Pro tiers
- All your sandbox test price IDs listed

### 3. Enable Sandbox Mode

1. Go to `http://localhost:3000/billing/subscriptions`
2. Look for the **"Sandbox Mode"** toggle (only visible in dev)
3. Toggle it **ON**
4. Refresh the page

### 4. Subscribe to Starter Plan

1. Click **"Get Started"** on the Starter plan
2. Watch your terminal logs - you should see:
   ```
   [billing/plans] Sandbox mode is ENABLED, replacing price IDs with sandbox test prices
   [billing/plans] Replacing Starter: price_1SzVME... → price_1SB8XpF6LYYE8X5S5zEdGnwd
   [stripe/create-checkout] Starting checkout creation
     isSandboxMode: true
     willUseTestKeys: true
     priceId: price_1SB8XpF6LYYE8X5S5zEdGnwd
   ```

3. Complete checkout with test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits

### 5. Verify Webhook Fires

Watch your terminal for:
```
[webhook/stripe] ===== WEBHOOK REQUEST RECEIVED =====
[webhook/stripe] ✓ Webhook signature verified successfully
[webhook/stripe] Processing subscription checkout
[webhook/stripe] ✓ Profile UPDATE SUCCESSFUL
```

### 6. Check Your Profile

1. Go to `http://localhost:3000/billing`
2. You should see:
   - Current plan: **Starter**
   - Monthly credits updated
   - Subscription status: **active**

## Troubleshooting

### "No such price" error

**Check:**
1. Is sandbox mode toggle **ON**?
2. Visit `/api/billing/debug-prices` - do you see sandbox price IDs?
3. Check terminal logs for `[billing/plans] Sandbox mode is ENABLED`

If sandbox mode is OFF, the app tries to use live price IDs with test keys (won't work).

### Webhook not firing

**Check:**
1. Is `npm run dev:stripe` running (not just `npm run dev`)?
2. Did you see the "✅ WEBHOOK SECRET CAPTURED" message?
3. Look for webhook logs in terminal starting with `[webhook/stripe]`

### Script not capturing webhook secret

The script now handles Stripe CLI's fragmented output. If it still fails after 10 seconds:
1. Make sure Stripe CLI is installed: `stripe --version`
2. Make sure you're logged in: `stripe login`
3. Check the terminal output for the actual secret and copy it manually to `.env.local` line 100

## What Changed

### Enhanced Logging

1. **`/api/billing/plans`**: Now logs when sandbox mode switches price IDs
2. **`/api/stripe/create-checkout`**: Shows sandbox mode status and price ID used
3. **`scripts/dev-with-stripe.js`**: Better handling of Stripe CLI output

### New Debug Endpoint

- **`/api/billing/debug-prices`**: Shows all configured price IDs (dev only)

### Updated Documentation

- **`STRIPE_WEBHOOKS.md`**: Added sandbox mode explanation
- **`STRIPE_TEST_MODE_SETUP.md`**: Updated with your existing setup
- **This file**: Quick start guide

## Summary

Your sandbox mode was already set up! I just added:
- ✅ Better logging to see what's happening
- ✅ Auto-capture webhook secret script
- ✅ Debug endpoint to verify configuration
- ✅ Updated documentation

Now test the flow with sandbox mode **ON** and watch the terminal logs to see it all working!
