/**
 * Gmail skill book — pure text registry.
 *
 * Gmail is agent-driven via the `gmail` MCP server
 * (`@gongrzhe/server-gmail-autoauth-mcp`). Agents call `mcp__gmail__*` tools
 * directly; this file only documents intent and the triage scoring rules.
 * No JS action functions here by design.
 */

export const skillBook = {
  id: "gmail",
  title: "Gmail",
  description: "Search, read, triage, and label emails via the gmail MCP server.",

  toc: {
    searchInbox: "Search Gmail with a query string via MCP tool search_emails.",
    readMessage: "Read a single message with full body via MCP tool read_email.",
    triageInbox: "Score unread inbox and star the top ~2% via MCP tools search_emails + batch_modify_emails.",
    writeStars: "Add STARRED label to one or more messages via MCP tool batch_modify_emails.",
    writeLabels: "Add/remove arbitrary labels via MCP tools modify_email / batch_modify_emails.",
  },

  searchInbox: `
Use MCP tool \`search_emails\` with \`{ query, maxResults }\`.
Gmail query syntax applies: \`from:\`, \`subject:\`, \`in:unread\`, \`-label:important\`, etc.
`.trim(),

  readMessage: `
Use MCP tool \`read_email\` with \`{ messageId }\`. Returns headers + parsed body.
`.trim(),

  triageInbox: `
Goal: scan unread inbox, skip low-value, score the rest, star the top ~2%.

Step 1 — search.
  MCP: search_emails { query: "-label:important in:unread in:inbox -asana", maxResults: 100 }

Step 2 — skip these (do NOT score):
  • Shared mailboxes: orders@, account@, support@, info@, sales@, products@, project@
  • Specific senders: kybc@kyinno.com, no-reply@asana.com, anything at asana.com
  • Automated: "New Order #", DMARC reports, Search Console, Bing Webmaster
  • Utility: PG&E, energy reports
  • Marketing: newsletters, webinars, conferences, anything with "unsubscribe"

Step 3 — score remaining (signals → points):
  +10  wire transfer / invoice / purchase order / freight quote
  +9   Calendly new or updated event
  +9   customer reply to a quote (subject starts "Re: ... quote")
  +8   SalesIQ / live chat / missed chat
  +8   security alert (new sign-in, 2FA, verification code)
  +7   Boster sales order
  +7   meeting request directed at CJ / Sijie
  +3   addressed directly to CJ / Sijie
  +1   real sender (not noreply / marketing / newsletter)

Step 4 — star the top ~2%.
  starCount = max(1, ceil(messages.length * 0.02))
  MCP: batch_modify_emails { messageIds: [...top N...], addLabelIds: ["STARRED"] }

Decision framework when unsure:
  1. Addressed directly to CJ/Sijie? No → skip.
  2. Team member already replied and CJ was just CC'd? → skip.
  3. Automated / system-generated? → skip.
  4. Requires CJ's personal decision? → star.
  5. When in doubt, do NOT star. A clean inbox is preferred.
`.trim(),

  writeStars: `
Use MCP tool \`batch_modify_emails\` with \`{ messageIds, addLabelIds: ["STARRED"] }\`.
For a single message, \`modify_email\` works too.
`.trim(),

  writeLabels: `
Add: MCP tool \`modify_email\` / \`batch_modify_emails\` with \`addLabelIds: [...]\`.
Remove: same tools with \`removeLabelIds: [...]\`.
Resolve label IDs first via \`list_email_labels\` or \`get_or_create_label\`.
`.trim(),
};

export default skillBook;
