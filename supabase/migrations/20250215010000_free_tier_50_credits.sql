-- Free tier: 50 credits upfront (per product); users can earn more via activities later.
UPDATE public.subscription_tiers
SET monthly_credit_quota = 50
WHERE id = 'free';
