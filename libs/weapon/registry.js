import { readWeaponStatus } from "@/libs/weapon/zoho";
import { checkCredentials as checkCursorCredentials } from "@/libs/weapon/cursor";
import { checkCredentials as checkFigmaCredentials } from "@/libs/weapon/figma";
import { checkCredentials as checkAsanaCredentials } from "@/libs/weapon/asana";
import { checkCredentials as checkStorageCredentials } from "@/libs/weapon/supabase_storage";
import { checkCredentials as checkSupabaseUiCredentials } from "@/libs/weapon/supabase_ui";
import { checkCredentials as checkAuthStateCredentials } from "@/libs/weapon/auth_state";
import { checkCredentials as checkSshCredentials } from "@/libs/weapon/ssh";
import { checkCredentials as checkCdpCredentials } from "@/libs/weapon/browserclaw/cdp";
import { ping as pingBosterBio } from "@/libs/weapon/bosterbio_lifecycle";
import { checkCredentials as checkImapCredentials } from "@/libs/weapon/imap";
import { checkCredentials as checkBioinvsyncCredentials } from "@/libs/weapon/bioinvsync";
import { checkCredentials as checkStripeCredentials } from "@/libs/weapon/stripe";
import { checkCredentials as checkMerchantCredentials } from "@/libs/weapon/google_merchant_center";
import { checkCredentials as checkSemrushCredentials } from "@/libs/weapon/semrush";
import { checkCredentials as checkSmartleadCredentials } from "@/libs/weapon/smartlead";
import { checkCredentials as checkInstantlyCredentials } from "@/libs/weapon/instantly";
import { checkCredentials as checkN8nCredentials } from "@/libs/weapon/n8n";
import { checkCredentials as checkOpensendCredentials } from "@/libs/weapon/opensend";
import { checkCredentials as checkHighlevelCredentials } from "@/libs/weapon/highlevel";
import { checkCredentials as checkLinkedinCredentials } from "@/libs/weapon/linkedin";
import { checkCredentials as checkPubcompareCredentials } from "@/libs/weapon/pubcompare";
import { checkCredentials as checkCloudflareCredentials } from "@/libs/weapon/cloudflare";


/**
 * Weapon blueprints (integrations) defined in code. Until forged, each is only a blueprint—no live OAuth or API calls.
 */
export const WEAPONS = [
  {
    id: "pigeon",
    title: "Pigeon Post",
    tagline: "Browser action packages via Browserclaw; results land in quest inventory.",
    summary:
      "Creates pigeon letters (navigate, extract text, etc.) and delivers webhook results as inventory items.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Skill books dispatch pigeon letters; Browserclaw lists pending letters via GET /api/pigeon-post, runs actions in the browser, and POSTs results to the same route.",
    ],
    requiresActivation: false,
  },
  {
    id: "claudecli",
    title: "Claude CLI",
    tagline: "Spawns claude --print as a child process to write code and return HTML reports.",
    summary: "Lets the Blacksmith invoke Claude Code non-interactively to forge weapon files, register them, and wire skill book actions.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "The claudeCLI weapon spawns `claude --print --dangerously-skip-permissions` in the project root. The Blacksmith crafts a precise prompt; Claude writes the weapon file, updates the registry, and outputs a complete HTML report.",
    ],
    requiresActivation: false,
  },
  {
    id: "bigquery",
    title: "BigQuery",
    tagline: "Query Google BigQuery tables via the REST API v2 with service-account auth.",
    summary: "Lets skill books fetch recent events from BigQuery datasets using jobs.query.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses GOOGLE_SERVICE_ACCOUNT (service account) to sign JWTs, exchange for access tokens, and run BigQuery SQL queries via the REST API.",
    ],
    requiresActivation: false,
  },
  {
    id: "zoho",
    title: "Zoho Books",
    tagline: "Blueprint: Books API, OAuth, and ledger reads for skill books—forge it to make it real.",
    summary:
      "Lets skill books call Zoho Books (OAuth, invoices, ledger reads). Forge it once to connect your org.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "This blueprint describes how GuildOS would talk to Zoho Books: OAuth, token refresh, and REST calls. Until you forge it, it is only a plan in the archives—no sessions, no tokens.",
      "After forging, skill books can invoke the real integration. The blueprint stays free of quest business logic; forging only arms the connection.",
    ],
    requiresActivation: true,
    oauthDocsUrl: "https://www.zoho.com/accounts/protocol/oauth/web-server-applications.html",
  },
  {
    id: "vercel",
    title: "Vercel",
    tagline: "Manage deployments, projects, domains, and env vars via Vercel REST API.",
    summary:
      "Lets skill books list projects, check deployments, manage env vars, trigger redeploys, and query domains on Vercel.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses VERCEL_API_KEY (bearer token) to call the Vercel REST API. Covers projects, deployments, domains, env vars, and user/team info.",
    ],
    requiresActivation: false,
  },
  {
    id: "gmail",
    title: "Gmail",
    tagline: "Search, read, star, and label emails via the Gmail MCP server.",
    summary:
      "Agent-only weapon — MCP-mounted under the `gmail` namespace. Agents call mcp__gmail__search_emails, read_email, modify_email, batch_modify_emails, etc.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Runs `@gongrzhe/server-gmail-autoauth-mcp` over stdio. Uses GMAIL_MCP_CLIENT_ID + GMAIL_MCP_CLIENT_SECRET (formulary) and GOOGLE_GMAIL_REFRESH_TOKEN (formulary) via ~/.gmail-mcp/. See libs/weapon/gmail/index.js for setup.",
    ],
    requiresActivation: false,
  },
  {
    id: "cursor",
    title: "Cursor Cloud Agents",
    tagline: "Dispatch tasks to Cursor cloud agents and manage their lifecycle.",
    summary:
      "Send work to remote Cursor agents via followup API, check status, read conversation history, and coordinate artifact delivery.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses CURSOR_API_KEY (Basic auth) to call the Cursor API. Agents receive push-based messages and execute tasks autonomously. Model: composer-2.0.",
    ],
    requiresActivation: false,
  },
  {
    id: "figma",
    title: "Figma",
    tagline: "Read files, export assets, and browse projects via Figma REST API.",
    summary:
      "Lets skill books read Figma file structures, export node renderings as images, list projects, and read comments.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses FIGMA_ACCESS_TOKEN (personal access token) to call the Figma REST API v1.",
    ],
    requiresActivation: false,
  },
  {
    id: "asana",
    title: "Asana",
    tagline: "Search, read, and manage tasks and projects via Asana REST API.",
    summary:
      "Unified Asana connector for workspaces, projects, tasks, sections, and comments.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses ASANA_ACCESS_TOKEN (personal access token or OAuth) to call the Asana REST API v1.",
    ],
    requiresActivation: false,
  },
  {
    id: "supabase_storage",
    title: "Supabase Storage",
    tagline: "Upload, download, list, and delete files in Supabase Storage.",
    summary:
      "Shared storage weapon with standardized path conventions (channel/questId/filename). Bucket: GuildOS_Bucket.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses SUPABASE_SECRETE_KEY via the database service role. Default bucket is GuildOS_Bucket (public).",
    ],
    requiresActivation: false,
  },
  {
    id: "supabase_ui",
    title: "Supabase UI",
    tagline: "Control the Supabase web dashboard via Browserclaw CDP.",
    summary:
      "Automates app.supabase.com for UI-only operations (log browsing, settings inspection, storage bucket listing). For programmatic DB access, use the database facade instead.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses CDP browser control via ~/.guildos-cdp-profile (no API key). Falls back to PostgREST for readTable. Run scripts/auth-capture.mjs to capture the Supabase session.",
    ],
    requiresActivation: false,
  },
  {
    id: "auth_state",
    title: "Auth State",
    tagline: "Browser auth state JSON — save, load, check expiry for cloud agents.",
    summary:
      "Manages saved cookies/localStorage exported by scripts/auth-capture.mjs. Used by cloud agents that can't connect to the local CDP Chrome on port 9222.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Reads/writes playwright/.auth/user.json. Checks cookie expiry per domain. Local Guildmaster uses CDP Chrome directly (port 9222); this JSON is for cloud agents only.",
    ],
    requiresActivation: false,
  },
  {
    id: "ssh",
    title: "SSH",
    tagline: "Execute commands on remote machines via SSH.",
    summary:
      "SSH connector with known host presets (Carbon, Boster production) and user-defined hosts. Requires passwordless SSH keys.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses system SSH with BatchMode. Known hosts: carbon (local network), c100h.bosterbio.com (Boster production). Custom hosts via SSH_HOSTS env var.",
    ],
    requiresActivation: false,
  },
  {
    id: "imap",
    title: "IMAP",
    tagline: "Read email from IMAP mailboxes — Zoho Mail Pro and compatible servers.",
    summary:
      "Connects to IMAP servers (default: imappro.zoho.com:993) using per-account credentials stored in IMAP_ACCOUNTS env var.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses imapflow library with TLS. Credentials stored as IMAP_ACCOUNTS JSON (email → password) in profile env_vars or process.env. Actions: readMessages, searchAccounts, checkCredentials.",
    ],
    requiresActivation: false,
  },
  {
    id: "bioinvsync",
    title: "Bioinvsync",
    tagline: "SSH access to the bioinvsync.com legacy server (JetRails hosting).",
    summary:
      "Connects to 69.27.32.79:2223 as bioinvsync via plink + bioinvsync.ppk. Requires Pageant running with the key loaded.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses plink.exe (PuTTY) with bioinvsync.ppk for SSH. Pageant must be running with the key loaded for non-interactive access.",
      "Server hosts legacy Zoho Books PHP integration, FedEx, BigQuery, and ELISA analysis code under /home/bioinvsync/public_html/.",
    ],
    requiresActivation: false,
  },
  { id: "stripe", title: "Stripe", tagline: "Read charges, customers, subscriptions via Stripe REST API.", summary: "Billing and payment data weapon.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses STRIPE_SECRET_KEY (Basic auth) to call Stripe REST API v1."], requiresActivation: false },
  { id: "google_merchant_center", title: "Google Merchant Center", tagline: "Read products, orders, and account info via Content API.", summary: "Merchant Center connector using Google service account.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses GOOGLE_SERVICE_ACCOUNT + GOOGLE_MERCHANT_ID to call Content API v2.1."], requiresActivation: false },
  { id: "semrush", title: "SEMRush", tagline: "Domain overview, keyword research, and backlinks via SEMRush API.", summary: "SEO intelligence weapon.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses SEMRUSH_API_KEY to call SEMRush REST API."], requiresActivation: false },
  { id: "smartlead", title: "Smartlead", tagline: "Manage cold email campaigns and leads via Smartlead API.", summary: "Cold email campaign weapon.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses SMARTLEAD_API_KEY to call Smartlead REST API v1."], requiresActivation: false },
  { id: "instantly", title: "Instantly", tagline: "Manage cold email campaigns via Instantly API.", summary: "Cold email weapon for Instantly platform.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses INSTANTLY_API_KEY to call Instantly REST API v1."], requiresActivation: false },
  { id: "n8n", title: "N8N", tagline: "Trigger and manage N8N automation workflows via REST API.", summary: "Workflow automation weapon.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses N8N_URL + N8N_API_KEY to call N8N REST API v1."], requiresActivation: false },
  { id: "opensend", title: "Opensend", tagline: "Manage contacts and nurture flows via Opensend API.", summary: "Lead nurture weapon.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses OPENSEND_API_KEY to call Opensend REST API."], requiresActivation: false },
  { id: "highlevel", title: "HighLevel", tagline: "CRM contacts and pipeline opportunities via HighLevel REST API.", summary: "HighLevel CRM weapon.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses HIGHLEVEL_API_KEY (Bearer) to call HighLevel REST API v1."], requiresActivation: false },
  { id: "linkedin", title: "LinkedIn", tagline: "Search profiles and read profile info via browser automation.", summary: "LinkedIn profile scraper using Browserclaw CDP.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses Browserclaw CDP (port 9222). Must be logged in via CDP profile."], requiresActivation: false },
  { id: "pubcompare", title: "PubCompare", tagline: "Search publication comparison data via browser automation.", summary: "PubCompare.ai scraper using Browserclaw CDP.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses Browserclaw CDP. Public site — no auth needed."], requiresActivation: false },
  { id: "cloudflare", title: "Cloudflare", tagline: "Read zone + DNS + firewall + cache analytics; interpret legacy action semantics.", summary: "Read/search/normalize connector for Cloudflare zones. Wraps auth + GraphQL scalar nuances + 1-day firewall-event window cap.", icon: "/images/guildos/chibis/bolt.svg", description: ["Uses CLOUDFLARE_API_TOKEN to call the Cloudflare REST API v4 + GraphQL analytics. Resources: zone, zones, dns, firewallRules, accessRules, pageRules, rateLimits, zoneSettings, rulesets, ruleset, botManagement, tokenCapabilities. Analytics: requestsDaily, cacheByHost, cacheByPath, cacheByContentType, firewallEvents, bypassedPaths. normalize kinds: legacyFirewallAction, httpResponse."], requiresActivation: false },
  {
    id: "bosterbio_lifecycle",
    title: "BosterBio Lifecycle",
    tagline: "Read genes and write enrichment via bapi.php on bosterbio.com.",
    summary:
      "Fetches gene records needing enrichment from the bosterbio_m2 database and writes AI-generated HTML back via the BAPI REST endpoint.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Calls https://www.bosterbio.com/?_bapi=1 with BOSTERBIO_BAPI_KEY. Actions: readGenes (top priority genes with empty enrichment), readGene (single gene), writeEnrichment (write HTML to enrichment column), ping (health check).",
    ],
    requiresActivation: false,
  },
];

export function getWeaponById(id) {
  return WEAPONS.find((w) => w.id === id) ?? null;
}

/**
 * Activation summary for list cards (one entry per weapon that reports status).
 */
export async function readActivationSummaries(userId) {
  const summaries = {};
  const checks = {
    zoho: () => readWeaponStatus(userId),
    cursor: () => checkCursorCredentials(userId),
    figma: () => checkFigmaCredentials(userId),
    asana: () => checkAsanaCredentials(userId),
    supabase_storage: () => checkStorageCredentials(),
    supabase_ui: () => checkSupabaseUiCredentials(),
    auth_state: () => checkAuthStateCredentials(),
    ssh: () => checkSshCredentials(userId),
    browserclaw: () => checkCdpCredentials(),
    bosterbio_lifecycle: () => pingBosterBio({ userId }).catch((e) => ({ ok: false, msg: e.message })),
    imap: () => checkImapCredentials({}, userId),
    bioinvsync: () => checkBioinvsyncCredentials(),
    stripe: () => checkStripeCredentials(),
    google_merchant_center: () => checkMerchantCredentials(),
    semrush: () => checkSemrushCredentials(),
    smartlead: () => checkSmartleadCredentials(),
    instantly: () => checkInstantlyCredentials(),
    n8n: () => checkN8nCredentials(),
    opensend: () => checkOpensendCredentials(),
    highlevel: () => checkHighlevelCredentials(),
    linkedin: () => checkLinkedinCredentials(),
    pubcompare: () => checkPubcompareCredentials(),
    cloudflare: () => checkCloudflareCredentials(),
  };
  for (const w of WEAPONS) {
    if (checks[w.id]) {
      summaries[w.id] = await checks[w.id]();
    }
  }
  return summaries;
}
