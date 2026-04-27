# Skill book + weapon registry inventory

Captured 2026-04-27 against `main`. The goal of this doc is to surface registry shape so dead/unused entries can be evaluated without a fresh enumeration each time. **Re-run the enumeration commands at the bottom on any future audit.**

## Skill books (21)

| # | Name | Class | Assigned to |
|---|---|---|---|
| 1 | `default` | global fallback | (loaded by every adventurer via runtime) |
| 2 | `housekeeping` | global | every adventurer (BosterBio Website Dev, Cat, CJGEO Dev, Nexus Armor Dev, Researcher) |
| 3 | `worker` | operating-mode | every worker (BosterBio Website Dev, CJGEO Dev, Nexus Armor Dev, Researcher) — NOT Cat |
| 4 | `questmaster` | operating-mode | Cat only |
| 5 | `dailies` | local-Claude only | Guildmaster (NOT carried by cursor adventurers, per `60850a2`) |
| 6 | `guildmaster` | local-Claude only | Guildmaster |
| 7 | `roster` | local-Claude only | Guildmaster (roster.spawnAgent etc.) |
| 8 | `blacksmith` | meta | for forging weapons / skill books — used on demand |
| 9 | `bosterbio` | project domain | BosterBio Website Dev |
| 10 | `cjgeo` | project domain | CJGEO Dev |
| 11 | `nexus` | project domain | Nexus Armor Dev |
| 12 | `bigquery` | tool wrapper | (not currently in any adventurer's skill_books — used by Guildmaster ad-hoc) |
| 13 | `asana` | tool wrapper | (not in any adventurer's skill_books) |
| 14 | `gmail` | tool wrapper | (not in any adventurer's skill_books) |
| 15 | `cursor` | tool wrapper | (used by guildmaster + housekeeping internally — NOT in any adventurer's skill_books) |
| 16 | `figma` | tool wrapper | (not in any adventurer's skill_books) |
| 17 | `graphic` | tool wrapper | (not in any adventurer's skill_books) |
| 18 | `zoho` | tool wrapper | (not in any adventurer's skill_books — Nexus uses libs/zoho directly) |
| 19 | `cloudflare` | tool wrapper | (not in any adventurer's skill_books) |
| 20 | `browsercontrol` | tool wrapper | (not in any adventurer's skill_books — local-Claude uses CIC directly) |
| 21 | `supabase_ui` | tool wrapper | (not in any adventurer's skill_books) |
| 22 | `claudeCLI` | tool wrapper (inlined) | Researcher only |

**Candidates for review (zero adventurer assignments):** `bigquery`, `asana`, `gmail`, `figma`, `graphic`, `zoho`, `cloudflare`, `browsercontrol`, `supabase_ui`. These exist as tool wrappers and are plausibly invoked by `claudecli` or local-Claude as needed — confirm before removing. **`cursor` is correctly unassigned** (it spawns / drives the cursor substrate; not a skill the adventurer practices on itself).

## Weapons (35)

Grouped by service category.

**Quest pipeline (3):** `questExecution`, `questPurrview`, `questReview` — script-locked stage transitions. Load-bearing; do not touch.

**Cursor cloud control (1):** `cursor` — spawn/dispatch/follow up; the canonical spawn path enforces GuildOS credential injection (`writeAgent` + `setupBlock.js`).

**Browser / auth (3):** `browserclaw` (legacy CDP, deprecated for new local work), `auth_state` (storageState bundle distribution), `claudecli` (spawns `claude --print`).

**Supabase platform (2):** `supabase_storage` (artifact uploads), `supabase_ui` (dashboard scraping).

**External integrations (live):** `asana`, `gmail`, `bigquery`, `cloudflare`, `figma`, `linkedin`, `pubcompare`, `pigeon`, `bosterbio.comLiveSite`, `bioinvsyncAccess`, `vercel`, `ssh`, `imap`, `openai_images`, `stripe`, `telnyx`, `n8n`, `google_merchant_center`.

**External integrations (cold-storage / dormant):** `highlevel`, `instantly`, `lifesci`, `opensend`, `semrush`, `smartlead`. **Action: confirm each is still wanted; if not, archive.** Marketing-tool weapons like `instantly` / `smartlead` / `opensend` were activated for one-shot campaigns and may not have a current consumer.

**Domain-specific (1):** `zoho` — Books + CRM via shared OAuth; primary consumer is `nexus` skill book.

## Recommended next actions (for the user)

1. **Confirm dormant marketing weapons** (`highlevel`, `instantly`, `lifesci`, `opensend`, `semrush`, `smartlead`) — leave or archive.
2. **Confirm unassigned-to-adventurer skill books** (`bigquery`, `asana`, `gmail`, `figma`, `graphic`, `zoho`, `cloudflare`, `browsercontrol`, `supabase_ui`) — should any be added to an adventurer's `skill_books` array, or are they local-Claude / Cat ad-hoc tools?
3. **Promote tool wrappers used by Cat into Cat's `skill_books`** if Cat actually invokes them via the `claudecli` workflow (e.g. asana for "archive to Asana", openai_images for the now-mandatory per-item judging).

## Re-run the enumeration

```bash
ls libs/skill_book/ | grep -v '\.js$' | sort
ls libs/weapon/ | grep -v '\.js$' | sort
```

For per-adventurer assignment audit:

```bash
node --env-file=.env.local -e "
import('@supabase/supabase-js').then(async ({ createClient }) => {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRETE_KEY);
  const { data } = await c.from('adventurers').select('name, skill_books').order('name');
  data.forEach(a => console.log(a.name, '→', a.skill_books));
});
"
```
