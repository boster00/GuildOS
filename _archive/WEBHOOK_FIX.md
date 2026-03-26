<!-- ARCHIVED: Original path was WEBHOOK_FIX.md -->

# Complete Webhook Fix - Step by Step

## The Problem
Stripe CLI is not running, so webhooks aren't being forwarded to your local server.

## Complete Fix (Follow ALL Steps)

### Step 1: Open a NEW Terminal
Open a second terminal window (keep your current Next.js terminal running for now)

### Step 2: Start Stripe CLI
In the NEW terminal, run:
```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

### Step 3: Copy the Webhook Secret
Stripe CLI will output something like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy the entire `whsec_xxxxxxxxxxxxx` value**

### Step 4: Update .env.local
1. Open `.env.local`
2. Go to **line 100**
3. Replace the existing secret with the NEW one:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```
4. Save the file

### Step 5: Restart Next.js Server
In your FIRST terminal (where Next.js is running):
1. Press `Ctrl+C` to stop it
2. Run `npm run dev` to start it again

### Step 6: Test the Flow
1. Go to `/billing/subscriptions`
2. Make sure sandbox mode is **ON**
3. Subscribe to Starter plan
4. Complete checkout with `4242 4242 4242 4242`

### Step 7: Watch for Webhook Logs
In your Next.js terminal, you should now see:
```
[webhook/stripe] ===== WEBHOOK REQUEST RECEIVED =====
[webhook/stripe] ✓ Webhook signature verified successfully
[webhook/stripe] ✓ Profile UPDATE SUCCESSFUL
```

---

## Why These Steps?

1. **Stripe CLI generates a NEW secret** each time you start it
2. **Next.js reads .env.local on startup** - changes don't apply until restart
3. **Both processes must be running** - Stripe CLI forwards events to Next.js

---

## Alternative: Automated Script (Not Working Yet)

The `npm run dev:stripe` script is still being debugged. Use the manual steps above for now.
