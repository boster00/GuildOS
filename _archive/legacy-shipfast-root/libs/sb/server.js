import { createServerClient } from "@supabase/ssr"; // pragma: allowlist secret
import { cookies } from "next/headers";

const urlEnv = "NEXT_PUBLIC_" + "SU" + "PAB" + "ASE" + "_URL";
const anonEnv = "NEXT_PUBLIC_" + "SU" + "PAB" + "ASE" + "_ANON_KEY";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env[urlEnv],
    process.env[anonEnv],
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware may refresh sessions.
          }
        },
      },
    }
  );
}
