// ARCHIVED: Original path was libs/apiMiddleware.js

/**
 * API route middleware for usage metering.
 * Extracts the authenticated user and passes userId to the handler so monkey calls can log and enforce quota.
 */
import { createClient } from '@/libs/supabase/server';

/**
 * Wrap an API route handler to inject the current user's id.
 * Use this so monkey options can include userId for usage metering.
 *
 * @param {Request} request - Next.js request
 * @param {function(Request, string|null): Promise<Response>} handler - Async handler(request, userId)
 * @returns {Promise<Response>} Response from handler
 */
export async function withUserContext(request, handler) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return handler(request, user?.id ?? null);
}
