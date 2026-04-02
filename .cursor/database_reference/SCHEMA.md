# Database schema reference (public API tables)

Auto-generated from the Supabase **PostgREST OpenAPI** document (`GET /rest/v1/`, service role key).
It lists **`public` tables exposed through the Data API** — not `auth.*`, `storage.*`, or other internal schemas.

**Source project:** `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` (not repeated here).  
**Generated (UTC):** 2026-03-29T08:39:21.980Z  
**Tables:** 6

### Regenerate this markdown

```bash
node scripts/pull-database-reference.js
```

Requires `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and a service-role key (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, or `SUPABASE_SECRETE_KEY`).

### Entire schema export (other methods)

| Goal | How |
| --- | --- |
| **Column / FK metadata in SQL** | Run `scripts/sql/export_schema_postgres.sql` in the Supabase **SQL Editor** (or `psql`). Multiple `SELECT` blocks: tables, columns, foreign keys, primary keys. |
| **Full DDL** (`CREATE TABLE`, indexes, etc.) | Use `pg_dump` with the **Database** connection string from Dashboard → Settings → Database (`--schema=public --schema-only`). Or after `supabase login` + `supabase link`: `npx supabase db dump --linked --schema public -f schema.sql`. |

### Supabase CLI (login + link)

1. `npx supabase login` (browser), or `npx supabase login --token <access_token>` from [Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
2. `npx supabase link --project-ref <project_ref>` — ref is the subdomain of `https://<project_ref>.supabase.co`.
3. `npx supabase db push` to apply migrations, or `npx supabase db dump` for DDL.

---

## `adventurers`

> **`skill_books`:** Renamed from `skill_book_ids` in migration `20260402100000_adventurers_rename_skill_book_ids_to_skill_books.sql`. Values are catalog keys (folder names under `libs/skill_book`, e.g. `zoho`), not DB row UUIDs. After `db push`, run `node scripts/pull-database-reference.js` to resync this table from OpenAPI.

| Column | Postgres / API type | Required (in OpenAPI) | Default | Notes |
| --- | --- | --- | --- | --- |
| `backstory` | text |  |  |  |
| `capabilities` | text |  |  |  |
| `created_at` | timestamp with time zone | yes | `"now()"` |  |
| `id` | uuid | yes | `"gen_random_uuid()"` | PK |
| `name` | text | yes |  |  |
| `owner_id` | uuid |  |  |  |
| `skill_books` | text[] |  | `{}` | Catalog keys (e.g. zoho), not row UUIDs. |
| `system_prompt` | text |  |  |  |
| `updated_at` | timestamp with time zone |  | `"now()"` |  |

## `items`

| Column | Postgres / API type | Required (in OpenAPI) | Default | Notes |
| --- | --- | --- | --- | --- |
| `created_at` | timestamp with time zone | yes | `"now()"` |  |
| `id` | uuid | yes | `"gen_random_uuid()"` | PK |
| `item_key` | text | yes |  |  |
| `party_id` | uuid | yes |  | FK → parties.id |
| `payload` | jsonb | yes |  |  |
| `quest_id` | uuid | yes |  | FK → quests.id |
| `updated_at` | timestamp with time zone | yes | `"now()"` |  |

## `parties`

| Column | Postgres / API type | Required (in OpenAPI) | Default | Notes |
| --- | --- | --- | --- | --- |
| `created_at` | timestamp with time zone | yes | `"now()"` |  |
| `id` | uuid | yes | `"gen_random_uuid()"` | PK |
| `owner_id` | uuid | yes |  |  |
| `quest_id` | uuid | yes |  | FK → quests.id |
| `updated_at` | timestamp with time zone | yes | `"now()"` |  |

## `potions`

| Column | Postgres / API type | Required (in OpenAPI) | Default | Notes |
| --- | --- | --- | --- | --- |
| `created_at` | timestamp with time zone | yes | `"now()"` |  |
| `expires_at` | timestamp with time zone |  |  |  |
| `id` | uuid | yes | `"gen_random_uuid()"` | PK |
| `kind` | text | yes |  |  |
| `owner_id` | uuid | yes |  |  |
| `secrets` | jsonb | yes |  |  |
| `updated_at` | timestamp with time zone | yes | `"now()"` |  |

## `profiles`

| Column | Postgres / API type | Required (in OpenAPI) | Default | Notes |
| --- | --- | --- | --- | --- |
| `avatar_url` | text |  |  |  |
| `coins_work_order` | jsonb | yes |  |  |
| `council_settings` | jsonb | yes |  | Council JSON: dungeon_master { api_key, base_url, model_id }, etc. Merge via API; never return api_key to client in plaintext. |
| `created_at` | timestamp with time zone | yes | `"now()"` |  |
| `credits_remaining` | numeric | yes | `0` |  |
| `credits_reset_at` | timestamp with time zone |  |  |  |
| `env_vars` | jsonb | yes |  | Non-public app credentials and integration config per user/tenant (e.g. Zoho Books OAuth client id/secret). Merge via API; never return secrets to client in plaintext except on write. |
| `full_name` | text |  |  |  |
| `id` | uuid | yes |  | PK |
| `override_quota` | boolean | yes | `false` |  |
| `payg_wallet` | numeric | yes | `0` |  |
| `stripe_customer_id` | text |  |  |  |
| `subscription_meta` | jsonb | yes |  |  |
| `subscription_period_start_at` | timestamp with time zone |  |  |  |
| `subscription_renewal_at` | timestamp with time zone |  |  |  |
| `subscription_status` | text | yes | `"active"` |  |
| `subscription_tier_id` | text |  |  |  |
| `trial_ends_at` | timestamp with time zone |  |  |  |
| `updated_at` | timestamp with time zone | yes | `"now()"` |  |

## `quests`

| Column | Postgres / API type | Required (in OpenAPI) | Default | Notes |
| --- | --- | --- | --- | --- |
| `assigned_to` | text |  |  |  |
| `assignee_id` | uuid |  |  | FK → adventurers.id |
| `created_at` | timestamp with time zone | yes | `"now()"` |  |
| `deliverables` | text |  |  |  |
| `description` | text |  |  |  |
| `due_date` | timestamp with time zone |  |  |  |
| `id` | uuid | yes | `"gen_random_uuid()"` | PK |
| `inventory` | jsonb | yes | `"[]"` (jsonb) | Jsonb array of `{ item_key, payload?, created_at? }` for step inputs/outputs. Added in `20260403120000_quests_inventory.sql`. Runtime still uses `items` today for the same shape until app code is switched. |
| `next_steps` | jsonb | yes | `"[]"` (jsonb) | Ordered follow-on steps; `advanceClosing` pops head and spawns child with tail. Added in `20260401120000_quests_next_steps.sql`. |
| `owner_id` | uuid | yes |  |  |
| `parent_quest_id` | uuid |  |  | FK → quests.id |
| `stage` | text | yes | `"idea"` |  |
| `success_criteria` | jsonb | yes |  |  |
| `title` | text | yes |  |  |
| `updated_at` | timestamp with time zone | yes | `"now()"` |  |

> **OpenAPI gap:** Pull may omit columns until migrations are applied and `node scripts/pull-database-reference.js` is re-run. Known `quests` columns from migrations may include: `items` (jsonb default `[]`, inlined quest artifacts — `20260329250000`), `execution_plan` (jsonb default `[]`: each step is `{ skillbook, action }`; inputs/outputs per skill book TOC — not duplicated on the row), `inventory` (jsonb default `[]` — `20260403120000`), `next_steps` (jsonb default `[]` — `20260401120000_quests_next_steps.sql`). `agent_execution` was dropped in `20260401140000_drop_quests_agent_execution.sql` in favor of `execution_plan` plus activity/inventory.
