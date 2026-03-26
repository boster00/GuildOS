-- Admin dashboard: SECURITY DEFINER RPC so the app can use the anon key (user session)
-- and still get all profiles + article counts. RLS is bypassed inside the function.
-- api_usage_logs has been removed; lastActiveMap is always {}.
-- Caller must verify admin in application code before calling this RPC.

CREATE OR REPLACE FUNCTION public.admin_get_users_enriched()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'profiles',
    (SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'subscription_plan', coalesce(p.subscription_plan, 'free'),
        'credits_remaining', p.credits_remaining,
        'payg_wallet', p.payg_wallet,
        'credits_reset_at', p.credits_reset_at,
        'stripe_customer_id', p.stripe_customer_id,
        'created_at', p.created_at
      )
    ), '[]'::jsonb) FROM public.profiles p),
    'lastActiveMap',
    '{}'::jsonb,
    'articleCountMap',
    (SELECT coalesce(
      jsonb_object_agg(uid, cnt),
      '{}'::jsonb
    ) FROM (
      SELECT user_id AS uid, count(*)::int AS cnt
      FROM public.content_magic_articles
      GROUP BY user_id
    ) t)
  );
$$;

COMMENT ON FUNCTION public.admin_get_users_enriched() IS
  'Returns all profiles + last-active and article counts for admin dashboard. SECURITY DEFINER bypasses RLS. Call only after verifying admin in app.';

GRANT EXECUTE ON FUNCTION public.admin_get_users_enriched() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users_enriched() TO service_role;
