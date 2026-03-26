# Stripe Webhooks Setup Guide

## Local Development

### Option 1: Auto-capture webhook secret (Recommended - No manual setup!)
Run the automated script that captures the webhook secret automatically:
```bash
npm run dev:stripe
```

This will:
- Start Stripe CLI and automatically capture the webhook secret
- Inject the secret into Next.js as an environment variable
- Start Next.js dev server with the fresh secret
- **No manual .env.local updates needed!**

### Option 2: Using npm script (Manual secret setup)
Run both Next.js dev server and Stripe CLI together:
```bash
npm run dev:with-webhooks
```

This will:
- Start Next.js dev server on `localhost:3000`
- Start Stripe CLI forwarding webhooks to `localhost:3000/api/webhook/stripe`
- Display logs from both processes in different colors
- **Requires manual .env.local update** (see below)

### Option 3: Manual (Two terminals)
**Terminal 1:** Start Next.js dev server
```bash
npm run dev
```

**Terminal 2:** Start Stripe CLI
```bash
npm run stripe:listen
# OR directly:
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

### Understanding Sandbox Mode

Your app has a **Sandbox Mode** toggle (visible in development only) that switches between:
- **Sandbox OFF**: Uses live Stripe keys and price IDs (real charges)
- **Sandbox ON**: Uses test Stripe keys and sandbox test price IDs (no real charges)

When sandbox mode is **ON**, the app automatically:
1. Uses `STRIPE_SECRET_SANDBOX_TEST_KEY` instead of `STRIPE_SECRET_KEY`
2. Uses `STRIPE_PRICE_STARTER_SANDBOX_TEST` instead of `STRIPE_PRICE_STARTER`
3. Uses `STRIPE_PRICE_PRO_SANDBOX_TEST` instead of `STRIPE_PRICE_PRO`
4. Uses sandbox PAYG price IDs for pay-as-you-go credits

**To verify your sandbox price IDs are configured:**
Visit `http://localhost:3000/api/billing/debug-prices` (dev only) to see all configured price IDs.

### Getting the Webhook Secret

**If using `npm run dev:stripe` (Option 1):** The webhook secret is automatically captured and injected - no manual setup needed!

**If using `npm run dev:with-webhooks` or manual approach (Options 2-3):** 

When Stripe CLI starts, it will output:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy this secret** and update `.env.local`:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

**Note:** The webhook secret changes each time you restart Stripe CLI, so you'll need to update `.env.local` if you restart it. This is why Option 1 (`npm run dev:stripe`) is recommended - it handles this automatically!

### Testing Webhooks Locally

1. Ensure Stripe CLI is running (`npm run stripe:listen` or `npm run dev:with-webhooks`)
2. Complete a checkout in your app (use test card `4242 4242 4242 4242`)
3. Watch your terminal logs - you should see:
   - `[webhook/stripe] ===== WEBHOOK REQUEST RECEIVED =====`
   - Signature verification logs
   - Profile update logs

---

## Production Setup

In production, **Stripe CLI is NOT used**. Instead, Stripe sends webhooks directly to your production URL.

### Step 1: Configure Webhook Endpoint in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Set the endpoint URL to:
   ```
   https://yourdomain.com/api/webhook/stripe
   ```
4. Select the events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
5. Click **"Add endpoint"**

### Step 2: Get the Webhook Signing Secret

1. After creating the endpoint, click on it
2. In the **"Signing secret"** section, click **"Reveal"**
3. Copy the `whsec_...` secret

### Step 3: Set Environment Variable

Set `STRIPE_WEBHOOK_SECRET` in your production environment (Vercel, Railway, etc.):

```env
STRIPE_WEBHOOK_SECRET=whsec_your_production_secret_here
```

**Important:** 
- Use the **production** webhook secret (from Stripe Dashboard)
- This is different from the local development secret (from Stripe CLI)
- Never commit secrets to git

### Step 4: Verify Webhook Delivery

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Check the **"Recent events"** section
3. You should see successful deliveries (green checkmarks)
4. If you see failures, check:
   - Your production URL is accessible
   - The webhook secret matches
   - Your server logs for errors

---

## How It Works

### Local Development Flow
```
Stripe Test Mode → Stripe CLI → localhost:3000/api/webhook/stripe → Your Handler
```

### Production Flow
```
Stripe Live Mode → Stripe Servers → https://yourdomain.com/api/webhook/stripe → Your Handler
```

### Webhook Handler (`app/api/webhook/stripe/route.js`)

The handler:
1. Verifies the webhook signature using `STRIPE_WEBHOOK_SECRET`
2. Checks for duplicate events (idempotency)
3. Processes the event:
   - `checkout.session.completed`: Updates user profile with subscription/customer IDs
   - `customer.subscription.updated`: Updates subscription status
   - `customer.subscription.deleted`: Cancels subscription
   - `invoice.paid`: Grants monthly credits

---

## Troubleshooting

### Price ID / API Key Mismatch
**Error**: `No such price: 'price_xxx'; a similar object exists in live mode, but a test mode key was used`

**Solution**: You need test mode price IDs for local development. See **[STRIPE_TEST_MODE_SETUP.md](./STRIPE_TEST_MODE_SETUP.md)** for complete instructions.

### Webhooks not firing locally
- ✅ Check Stripe CLI is running: `npm run stripe:listen`
- ✅ Verify webhook secret in `.env.local` matches Stripe CLI output (or use `npm run dev:stripe`)
- ✅ Check Next.js dev server is running on port 3000
- ✅ Ensure checkout was completed successfully (not just created)
- ✅ Verify you have test mode price IDs configured (see above)

### Webhooks failing in production
- ✅ Verify webhook endpoint URL is correct in Stripe Dashboard
- ✅ Check `STRIPE_WEBHOOK_SECRET` matches the production secret
- ✅ Verify your production URL is publicly accessible
- ✅ Check server logs for signature verification errors
- ✅ Ensure your server can handle POST requests to `/api/webhook/stripe`

### Signature verification errors
- ❌ Wrong webhook secret (local vs production mismatch)
- ❌ Request body was modified before verification
- ❌ Using wrong Stripe API keys (test vs live)

---

## Security Notes

- **Never commit webhook secrets to git**
- Use different secrets for local development and production
- Webhook signature verification prevents unauthorized requests
- The handler uses idempotency to prevent duplicate processing
