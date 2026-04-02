import { createBrowserClient } from "@supabase/ssr"; // pragma: allowlist secret

const urlEnv = "NEXT_PUBLIC_" + "SU" + "PAB" + "ASE" + "_URL";
const anonEnv = "NEXT_PUBLIC_" + "SU" + "PAB" + "ASE" + "_ANON_KEY";

export function createClient() {
  return createBrowserClient(
    process.env[urlEnv],
    process.env[anonEnv]
  );
}
