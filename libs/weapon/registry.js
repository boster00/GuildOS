import { getZohoWeaponStatus } from "@/libs/weapon/zoho";

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
];

export function getWeaponById(id) {
  return WEAPONS.find((w) => w.id === id) ?? null;
}

/**
 * Activation summary for list cards (one entry per weapon that reports status).
 */
export async function getWeaponActivationSummaries(userId) {
  const summaries = {};
  for (const w of WEAPONS) {
    if (w.id === "zoho") {
      summaries.zoho = await getZohoWeaponStatus(userId);
    }
  }
  return summaries;
}
