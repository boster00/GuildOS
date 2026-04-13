# Gmail Processing Preferences

When processing Sijie's Gmail, apply the rules in this document. When Sijie provides feedback during a session, merge it here immediately.

---

## General Rules

- Star emails that need attention; do not mark as important or move/archive anything unless told to.
- Target ~2% of emails in a batch as the star threshold.

---

## Do NOT Star (Skip Rules)

These take priority over scoring signals — if any match, skip the email.

### Shared mailbox / team-handled emails
1. **Team-addressed emails** — anything sent to shared mailboxes (`orders@`, `account@`, `support@`, `info@`, `support@`, `sales@`, `products@`) rather than Sijie directly. Examples: PO26bos04, Abnova PO4500096990, Boster Immunoleader(IBOST) 20260402.
2. **Reply threads not addressed to Sijie** — if the email is part of a reply chain and doesn't explicitly address "CJ" or "Sijie" in the To/CC or body, skip it.
3. **Emails answered by team members** — if the thread shows a Boster team member (Evan/Boster Team `products@`, Mary Ji `info@`, Support `support@`, Serena `serena@`, Wu `wu@`, Sandy `project@`) has already replied and CJ is only CC'd, do not star. CJ does not need to read threads the team is already handling.

### Automated / notification emails
4. **Order notifications** — automated new-order emails (e.g. "New Order # 1000050626").
5. **Confirmation/notification emails** — system confirmations that require no action. Examples: Zoho CRM Notifications, invoice payment confirmations (e.g. "Natalie Xia Invoice - Happy Friends Preschool of Pleasanton (Paid)"), car payment receipts (Dublin Infiniti), Asana digest notifications ("You have unread notifications").
6. **Asana notifications** — all emails from `no-reply@asana.com`.

### Specific senders to ignore
7. **Emails from kybc@kyinno.com** — always ignore.

### Low-priority personal emails
8. **Utility / home reports** — PG&E Home Energy Reports, similar utility digests.
9. **Church / community event invites** — mass event invitations (e.g. Easterfest).
10. **Marketing newsletters / conference spam** — DMARC reports, Google Search Console, Bing Webmaster Tools, conference/webinar invites, investment promotions.

---

## DO Star (Positive Signals)

These are the kinds of emails Sijie DOES want to see:

1. **Emails addressed directly to CJ/Sijie** from external contacts — potential collaborations, partnership follow-ups, customer questions sent to CJ personally.
2. **Wire transfers, invoices, purchase orders, freight quotes** addressed to CJ.
3. **Calendly new/updated events** for CJ.
4. **Customer replies to CJ's quotes** (Re: quote...).
5. **Security alerts** (new sign-in, verification codes).
6. **Meeting scheduling** directed at CJ (e.g. "Can we meet at AACR?").

---

## Decision Framework

When unsure, apply this logic:

1. **Is it addressed directly to CJ/Sijie (To or CC)?** → If no, skip.
2. **Has a team member already replied in the thread?** → If yes and CJ is just CC'd, skip.
3. **Is it automated/system-generated?** → If yes, skip.
4. **Does it require CJ's personal decision or response?** → If yes, star.
5. **When in doubt, do NOT star.** Sijie prefers a clean inbox over catching everything.
