# Stripe Test Mode Setup for Local Development

## The Problem

When developing locally with Stripe CLI, you need **test mode** credentials:
- Test API keys (`sk_test_...`, `pk_test_...`)
- Test mode price IDs (created in Stripe Dashboard while in test mode)

**Your live mode price IDs won't work with test mode keys.**

## How Your App Handles This

Your app has a **Sandbox Mode** system that automatically switches between live and test credentials:

1. **Enable Sandbox Mode** (toggle in UI, dev only)
2. App automatically uses:
   - `STRIPE_SECRET_SANDBOX_TEST_KEY` (test mode API key)
   - `STRIPE_PRICE_STARTER_SANDBOX_TEST` (test mode price ID)
   - `STRIPE_PRICE_PRO_SANDBOX_TEST` (test mode price ID)
3. All checkouts use test mode - no real charges!

**You already have sandbox test price IDs configured in `.env.local` (lines 116-119)!**

## Solution: Create Test Mode Products & Prices

### Step 1: Switch to Test Mode in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Toggle the switch at the top from **"Live mode"** to **"Test mode"**
3. You should see a banner saying "Viewing test data"

### Step 2: Create Test Mode Products

1. In Test mode, go to **Products** → **+ Add Product**
2. Create products matching your tiers:

#### Starter Plan (Test Mode)
- **Name**: Starter Plan (Test)
- **Description**: For solopreneurs and small teams
- **Pricing**: 
  - Model: Recurring
  - Price: $99
  - Billing period: Monthly
- Click **Save product**
- **Copy the price ID** (looks like `price_xxx`) - you'll need this!

#### Pro Plan (Test Mode)
- **Name**: Pro Plan (Test)
- **Description**: For agencies and content operations
- **Pricing**:
  - Model: Recurring
  - Price: $399
  - Billing period: Monthly
- Click **Save product**
- **Copy the price ID**

#### Optional: Test Plan (Minimal Cost)
- **Name**: Test Plan
- **Description**: Test real payments with minimal cost
- **Pricing**:
  - Model: Recurring
  - Price: $1
  - Billing period: Monthly
- Click **Save product**
- **Copy the price ID**

### Step 3: Update .env.local

Add your **test mode price IDs** to `.env.local`:

```env
# TEST MODE Price IDs (for local development):
STRIPE_PRICE_STARTER_SANDBOX_TEST=price_YOUR_TEST_STARTER_PRICE_ID
STRIPE_PRICE_PRO_SANDBOX_TEST=price_YOUR_TEST_PRO_PRICE_ID
```

### Step 4: Verify Your Keys

Make sure you're using test mode keys in `.env.local`:

```env
# These should be test mode keys (sk_test_..., pk_test_...)
STRIPE_PUBLIC_SANDBOX_TEST_KEY=pk_test_xxxxx
STRIPE_SECRET_SANDBOX_TEST_KEY=sk_test_xxxxx
```

### Step 5: Enable Sandbox Mode

Your app has a sandbox mode toggle. Make sure it's enabled when testing locally.

### Step 6: Test the Flow

1. Start dev server: `npm run dev:stripe`
2. Go to billing/subscriptions page
3. Click "Subscribe to Starter"
4. Use test card: `4242 4242 4242 4242`
5. Complete checkout
6. Watch terminal for webhook logs

---

## Quick Fix: Temporarily Use Live Mode Keys (Not Recommended)

If you want to test quickly without creating test products:

1. Comment out test keys in `.env.local`
2. Use live keys as your main keys:
   ```env
   STRIPE_PUBLIC_KEY=pk_live_xxxxx
   STRIPE_SECRET_KEY=sk_live_xxxxx
   ```
3. **DO NOT** use `npm run dev:stripe` (Stripe CLI only works with test mode)
4. Configure webhooks in production Stripe Dashboard

**Warning**: This will create real subscriptions and charges!

---

## Recommended Approach

Create test mode products as described above. This gives you:
- ✅ Free testing with test cards
- ✅ Stripe CLI webhook forwarding
- ✅ No risk of real charges
- ✅ Same flow as production
