/**
 * Gmail skill book — knowledge registry format.
 *
 * Actions are described as prompt instructions, not executable code.
 * Agents read the registry and use the gmail weapon directly.
 *
 * Legacy JS action functions are preserved at the bottom for backward compat
 * (NPCs and cron still call them).
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import * as gmailWeapon from "@/libs/weapon/gmail/index.js";
import { getAdventurerExecutionContext } from "@/libs/adventurer/advance.js";

// ============================================================================
// KNOWLEDGE REGISTRY (new format — agents read this)
// ============================================================================

export const skillBook = {
  id: "gmail",
  title: "Gmail — Inbox Triage & Email Operations",
  description:
    "Search, read, triage, and star emails. Includes automated inbox triage with scoring rules. Gmail is controlled via the Gmail REST API directly (not MCP, not CDP/browser); the weapon exchanges GOOGLE_GMAIL_REFRESH_TOKEN for a bearer token — do NOT use Chrome/Playwright for Gmail.",
  steps: [],
  toc: {
    searchInbox: {
      description: "Search Gmail messages using a query string.",
      howTo: `
**Weapon:** \`libs/weapon/gmail/index.js\`
**Function:** \`searchMessages({ query, limit }, userId)\`

\`\`\`javascript
import { searchMessages } from '@/libs/weapon/gmail';
const messages = await searchMessages({ query: '-label:important in:unread in:inbox', limit: 50 }, userId);
// Returns: array of { id, threadId, snippet, from, subject, date, labelIds }
\`\`\`

**Tips:**
- Gmail search syntax applies (e.g. \`from:someone@example.com\`, \`subject:invoice\`)
- Default limit is 50, max 500
- Auth is handled internally via GOOGLE_GMAIL_REFRESH_TOKEN
`,
    },
    readMessage: {
      description: "Read a single email message with full body content.",
      howTo: `
**Weapon:** \`libs/weapon/gmail/index.js\`
**Function:** \`readMessage({ messageId }, userId)\`

\`\`\`javascript
import { readMessage } from '@/libs/weapon/gmail';
const message = await readMessage({ messageId: 'abc123' }, userId);
// Returns: full message object with headers and body
\`\`\`
`,
    },
    triageInbox: {
      description: "Automated inbox triage — score unread emails and star the most important ones (~top 2%).",
      howTo: `
**Goal:** Scan unread inbox, skip low-value emails, score the rest, star the top ~2%.

**Step 1: Search**
\`\`\`javascript
import { searchMessages, starMessages } from '@/libs/weapon/gmail';
const messages = await searchMessages({ query: '-label:important in:unread in:inbox -asana', limit: 100 }, userId);
\`\`\`

**Step 2: Skip these senders/patterns (do NOT score):**
- Shared mailboxes: orders@, account@, support@, info@, sales@, products@, project@
- Specific: kybc@kyinno.com, no-reply@asana.com
- Automated: "New Order #", DMARC reports, Search Console, Bing Webmaster
- Utility: PG&E, energy reports
- Marketing: newsletters, webinars, conferences (check for "unsubscribe" in body)

**Step 3: Score remaining emails:**
| Signal | Points |
|--------|--------|
| Wire transfers, invoices, POs, freight quotes | +10 |
| Calendly new/updated events | +9 |
| Customer replies to quotes (Re: quote...) | +9 |
| SalesIQ/live chat/missed chat | +8 |
| Security alerts (new sign-in, 2FA) | +8 |
| Boster sales orders | +7 |
| Meeting requests directed at CJ/Sijie | +7 |
| Addressed directly to CJ/Sijie | +3 |
| Real sender (not noreply/marketing) | +1 |

**Step 4: Star top ~2%**
\`\`\`javascript
const starCount = Math.max(1, Math.ceil(messages.length * 0.02));
// Sort scored messages by score descending, take top starCount
await starMessages({ messageIds: topMessageIds }, userId);
\`\`\`

**Decision framework when unsure:**
1. Addressed directly to CJ/Sijie? No → skip
2. Team member already replied? Yes and CJ just CC'd → skip
3. Automated/system-generated? Yes → skip
4. Requires CJ's personal decision? Yes → star
5. When in doubt, do NOT star. Clean inbox preferred.
`,
    },
    writeStars: {
      description: "Star one or more messages by ID.",
      howTo: `
**Weapon:** \`libs/weapon/gmail/index.js\`
**Function:** \`starMessages({ messageIds }, userId)\`

\`\`\`javascript
import { starMessages } from '@/libs/weapon/gmail';
await starMessages({ messageIds: ['id1', 'id2', 'id3'] }, userId);
\`\`\`
`,
    },
  },
};

// ============================================================================
// LEGACY ACTION FUNCTIONS (backward compat — NPCs and cron still call these)
// ============================================================================

function getUserId(explicit) {
  if (explicit) return explicit;
  const ctx = getAdventurerExecutionContext();
  return ctx?.userId || null;
}

const SKIP_ADDRESSES = new Set([
  "orders@", "account@", "support@", "info@", "sales@", "products@", "project@",
]);

const SKIP_SENDERS = new Set(["kybc@kyinno.com", "no-reply@asana.com"]);

function shouldSkip(msg) {
  const from = (msg.from || "").toLowerCase();
  const subject = (msg.subject || "").toLowerCase();
  for (const sender of SKIP_SENDERS) {
    if (from.includes(sender)) return { skip: true, reason: `Ignored sender: ${sender}` };
  }
  for (const addr of SKIP_ADDRESSES) {
    if (from.includes(addr)) return { skip: true, reason: `Team/shared mailbox: ${addr}` };
  }
  if (from.includes("asana.com")) return { skip: true, reason: "Asana notification" };
  if (/new order #/i.test(subject)) return { skip: true, reason: "Automated order notification" };
  if (/dmarc|search console|bing webmaster/i.test(subject)) return { skip: true, reason: "Automated report" };
  if (/energy report|pg&?e/i.test(subject)) return { skip: true, reason: "Utility report" };
  if (/unsubscribe|webinar|conference|newsletter/i.test(subject.toLowerCase() + " " + (msg.snippet || "").toLowerCase())) {
    return { skip: true, reason: "Marketing/newsletter" };
  }
  return { skip: false, reason: null };
}

function scoreMessage(msg) {
  const from = (msg.from || "").toLowerCase();
  const subject = (msg.subject || "").toLowerCase();
  const snippet = (msg.snippet || "").toLowerCase();
  const combined = `${subject} ${snippet}`;
  let score = 0;
  const reasons = [];
  if (/wire transfer|invoice|purchase order|freight quote/i.test(combined)) { score += 10; reasons.push("Financial document"); }
  if (/calendly.*new|calendly.*updated|new event.*calendly/i.test(combined)) { score += 9; reasons.push("Calendly event"); }
  if (/^re:.*quote/i.test(subject)) { score += 9; reasons.push("Customer reply to quote"); }
  if (/salesiq|live chat|missed chat/i.test(combined)) { score += 8; reasons.push("SalesIQ chat"); }
  if (/new sign-in|verification code|security alert|2fa|two-factor/i.test(combined)) { score += 8; reasons.push("Security alert"); }
  if (/boster.*sales order|new.*boster.*order/i.test(combined)) { score += 7; reasons.push("Boster sales order"); }
  if (/can we meet|meeting.*request|schedule.*meeting/i.test(combined) && /cj|sijie/i.test(combined)) { score += 7; reasons.push("Meeting request for CJ"); }
  if (!from.includes("noreply") && !from.includes("no-reply") && !from.includes("marketing") && !from.includes("newsletter")) { score += 1; reasons.push("Real sender"); }
  if (/\bcj\b|sijie/i.test(combined)) { score += 3; reasons.push("Addressed to CJ/Sijie"); }
  return { score, reasons };
}

export async function searchInbox(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const query = String(inObj.query || "").trim();
  const limit = Number(inObj.limit) || 50;
  if (!query) return skillActionErr("query is required");
  const userId = getUserId(_userId);
  try {
    const messages = await gmailWeapon.searchMessages({ query, limit }, userId);
    return skillActionOk({ items: { messages: JSON.stringify(messages) }, msg: `Found ${messages.length} messages` });
  } catch (e) { return skillActionErr(`Search failed: ${e.message}`); }
}

export async function readMessage(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const messageId = String(inObj.messageId || "").trim();
  if (!messageId) return skillActionErr("messageId is required");
  const userId = getUserId(_userId);
  try {
    const message = await gmailWeapon.readMessage({ messageId }, userId);
    return skillActionOk({ items: { message: JSON.stringify(message) }, msg: `Read message ${messageId}` });
  } catch (e) { return skillActionErr(`Read failed: ${e.message}`); }
}

export async function triageInbox(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const limit = Number(inObj.limit) || 100;
  const dryRun = inObj.dryRun === true || inObj.dryRun === "true";
  const userId = getUserId(_userId);
  const query = "-label:important in:unread in:inbox -asana";
  try {
    const messages = await gmailWeapon.searchMessages({ query, limit }, userId);
    const breakdown = [];
    const toStar = [];
    for (const msg of messages) {
      const skipResult = shouldSkip(msg);
      if (skipResult.skip) { breakdown.push({ id: msg.id, subject: msg.subject, from: msg.from, score: -1, starred: false, reason: `SKIP: ${skipResult.reason}` }); continue; }
      const { score, reasons } = scoreMessage(msg);
      breakdown.push({ id: msg.id, subject: msg.subject, from: msg.from, score, starred: false, reason: reasons.join(", ") || "No signals" });
    }
    const scored = breakdown.filter((b) => b.score > 0).sort((a, b) => b.score - a.score);
    const starCount = Math.max(1, Math.ceil(messages.length * 0.02));
    const starTargets = scored.slice(0, starCount);
    for (const target of starTargets) { target.starred = true; toStar.push(target.id); }
    if (!dryRun && toStar.length > 0) { await gmailWeapon.starMessages({ messageIds: toStar }, userId); }
    return skillActionOk({ items: { scanned: String(messages.length), starred: String(dryRun ? 0 : toStar.length), breakdown: JSON.stringify(breakdown) }, msg: `Triaged ${messages.length} messages, ${dryRun ? "would star" : "starred"} ${toStar.length}` });
  } catch (e) { return skillActionErr(`Triage failed: ${e.message}`); }
}

export async function writeStars(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const messageIds = inObj.messageIds;
  if (!Array.isArray(messageIds) || messageIds.length === 0) return skillActionErr("messageIds array is required");
  const userId = getUserId(_userId);
  try {
    const result = await gmailWeapon.starMessages({ messageIds }, userId);
    return skillActionOk({ items: { starred: String(result.starred) }, msg: `Starred ${result.starred} messages` });
  } catch (e) { return skillActionErr(`Star failed: ${e.message}`); }
}
