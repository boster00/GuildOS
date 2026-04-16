import { getZohoWeaponStatus } from "@/libs/weapon/zoho";
import { checkCredentials as checkGmailCredentials } from "@/libs/weapon/gmail";
import { checkCredentials as checkCursorCredentials } from "@/libs/weapon/cursor";
import { checkCredentials as checkFigmaCredentials } from "@/libs/weapon/figma";
import { checkCredentials as checkAsanaCredentials } from "@/libs/weapon/asana";
import { checkCredentials as checkStorageCredentials } from "@/libs/weapon/supabase_storage";
import { checkCredentials as checkAuthStateCredentials } from "@/libs/weapon/auth_state";
import { checkCredentials as checkSshCredentials } from "@/libs/weapon/ssh";
import { checkCredentials as checkCdpCredentials } from "@/libs/weapon/browserclaw/cdp";


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
    tagline: "Search, read, star, and label emails via Google Gmail API.",
    summary:
      "Lets skill books search inboxes, read messages, star important emails, and modify labels using your Gmail account.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Uses GOOGLE_SERVICE_ACCOUNT (service account JSON with domain-wide delegation) to access Gmail via the REST API v1. Also requires GOOGLE_GMAIL_IMPERSONATE set to the target Gmail address.",
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
    id: "auth_state",
    title: "Auth State",
    tagline: "Manage Playwright browser auth state — save, load, check expiry.",
    summary:
      "Manages saved cookies/localStorage for authenticated browser sessions. Detects expired cookies and stale state files.",
    icon: "/images/guildos/chibis/bolt.svg",
    description: [
      "Reads/writes playwright/.auth/user.json. Checks cookie expiry per domain. Use scripts/auth-capture.mjs to refresh.",
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
];

export function getWeaponById(id) {
  return WEAPONS.find((w) => w.id === id) ?? null;
}

/**
 * Activation summary for list cards (one entry per weapon that reports status).
 */
export async function getWeaponActivationSummaries(userId) {
  const summaries = {};
  const checks = {
    zoho: () => getZohoWeaponStatus(userId),
    gmail: () => checkGmailCredentials(userId),
    cursor: () => checkCursorCredentials(userId),
    figma: () => checkFigmaCredentials(userId),
    asana: () => checkAsanaCredentials(userId),
    supabase_storage: () => checkStorageCredentials(),
    auth_state: () => checkAuthStateCredentials(),
    ssh: () => checkSshCredentials(userId),
    browserclaw: () => checkCdpCredentials(),
  };
  for (const w of WEAPONS) {
    if (checks[w.id]) {
      summaries[w.id] = await checks[w.id]();
    }
  }
  return summaries;
}
