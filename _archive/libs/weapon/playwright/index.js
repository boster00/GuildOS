/**
 * @deprecated Use @/libs/weapon/browserclaw/cdp instead.
 *
 * All browser automation now goes through the CDP weapon, which connects to a
 * persistent Chrome instance on port 9222 rather than launching its own browser.
 *
 * This file exists only as a backward-compat shim for any code still importing
 * from this path.
 */
export {
  executeSteps,
  ensureCdpChrome,
  isCdpRunning,
  checkCredentials,
  CDP_PORT,
  CDP_URL,
  CDP_PROFILE_DIR,
} from "@/libs/weapon/browserclaw/cdp";
