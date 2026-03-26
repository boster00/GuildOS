-- Verification for metering schema (20250208100000_metering_credits_ledger).
-- Run in Supabase SQL Editor AFTER applying that migration.
-- Expect: (1) column exists, (2) table exists, (3) second insert fails with unique violation.

-- 1. Column exists on profiles (should return one row; credits_remaining 0 or any number)
SELECT credits_remaining FROM public.profiles LIMIT 1;

-- 2. Table exists (should return empty or existing rows)
SELECT * FROM public.credit_ledger LIMIT 1;

-- 3. Constraint test: duplicate idempotency_key must fail.
-- Uses one user_id from auth.users. First insert succeeds; second must fail.
DO $$
DECLARE
  uid uuid;
  ik uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  SELECT id INTO uid FROM auth.users LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'No auth.users row; skip idempotency test.';
    RETURN;
  END IF;
  INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost)
  VALUES (uid, ik, 'verify_test', 0);
  RAISE NOTICE 'First insert OK. Next insert must fail.';
  BEGIN
    INSERT INTO public.credit_ledger (user_id, idempotency_key, action, cost)
    VALUES (uid, ik, 'verify_test', 0);
    RAISE EXCEPTION 'UNEXPECTED: second insert succeeded (unique should have failed)';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Expected: duplicate idempotency_key rejected.';
  END;
  DELETE FROM public.credit_ledger WHERE idempotency_key = ik;
END $$;
