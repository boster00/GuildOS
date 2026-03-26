<!-- ARCHIVED: Original path was RESTART_REQUIRED.md -->

# Restart Required

## What Was Fixed

Your `.env.local` had **test keys from a different Stripe account** than what Stripe CLI was using:

- **OLD (wrong account)**: `sk_test_51SB8UI...` → Account `acct_1SB8UI...`  
- **NEW (correct)**: `sk_test_51SB8U3...` → Account `acct_1SB8U3FISjkZ1PKx` ✅

This is why webhooks never fired - you were creating checkouts in one account but listening to webhooks from another!

## Next Steps

1. **Stop the dev server**: Press `Ctrl+C` in terminal
2. **Restart**: Run `npm run dev:stripe`
3. **Test the flow**:
   - Go to `/billing/subscriptions`
   - Make sure sandbox mode is ON
   - Subscribe to Starter plan
   - Complete checkout with `4242 4242 4242 4242`
   - Watch terminal for webhook logs

You should now see:
```
[webhook/stripe] checkout.session.completed event received
[webhook/stripe] ✓ Profile UPDATE SUCCESSFUL
```

And your profile will be updated to "starter" plan.
