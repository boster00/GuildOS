/**
 * Writes `.cursor/database_reference/SCHEMA.md` from the live Supabase PostgREST
 * OpenAPI document (same source as the auto-generated Data API docs).
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL + service role key
 * (SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SECRET_KEY | SUPABASE_SECRETE_KEY).
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SECRETE_KEY;

function pgType(prop) {
  if (prop.format) return prop.format;
  if (prop.type === "string" && !prop.format) return "string";
  if (prop.type === "number") return "number";
  if (prop.type === "boolean") return "boolean";
  if (prop.type === "object") return "object (json)";
  if (prop.type === "array") return "array";
  return prop.type || "unknown";
}

function escapeMd(s) {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function cleanDescription(raw) {
  if (!raw) return "";
  const fk = /<fk\s+table='([^']+)'\s+column='([^']+)'\s*\/>/i.exec(raw);
  if (fk) return `FK → ${fk[1]}.${fk[2]}`;
  if (/<pk\s*\/>/i.test(raw) || /Primary Key/i.test(raw)) return "PK";
  return String(raw).replace(/\n/g, " ").trim();
}

async function main() {
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or service-role Supabase secret in .env.local"
    );
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/openapi+json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("OpenAPI fetch failed:", res.status, body);
    process.exit(1);
  }

  const spec = await res.json();
  const definitions = spec.definitions || {};
  const tableNames = Object.keys(definitions)
    .filter((name) => !name.includes("rowFilter"))
    .sort((a, b) => a.localeCompare(b));

  const outDir = path.join(root, ".cursor", "database_reference");
  fs.mkdirSync(outDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const lines = [
    "# Database schema reference (public API tables)",
    "",
    "Auto-generated from the Supabase **PostgREST OpenAPI** document (`GET /rest/v1/`, service role key).",
    "It lists **`public` tables exposed through the Data API** — not `auth.*`, `storage.*`, or other internal schemas.",
    "",
    "**Source project:** `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` (not repeated here).  ",
    `**Generated (UTC):** ${generatedAt}  `,
    `**Tables:** ${tableNames.length}`,
    "",
    "### Regenerate this markdown",
    "",
    "```bash",
    "node scripts/pull-database-reference.js",
    "```",
    "",
    "Requires `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and a service-role key (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, or `SUPABASE_SECRETE_KEY`).",
    "",
    "### Entire schema export (other methods)",
    "",
    "| Goal | How |",
    "| --- | --- |",
    "| **Column / FK metadata in SQL** | Run `scripts/sql/export_schema_postgres.sql` in the Supabase **SQL Editor** (or `psql`). Multiple `SELECT` blocks: tables, columns, foreign keys, primary keys. |",
    "| **Full DDL** (`CREATE TABLE`, indexes, etc.) | Use `pg_dump` with the **Database** connection string from Dashboard → Settings → Database (`--schema=public --schema-only`). Or after `supabase login` + `supabase link`: `npx supabase db dump --linked --schema public -f schema.sql`. |",
    "",
    "### Supabase CLI (login + link)",
    "",
    "1. `npx supabase login` (browser), or `npx supabase login --token <access_token>` from [Account → Access Tokens](https://supabase.com/dashboard/account/tokens).",
    "2. `npx supabase link --project-ref <project_ref>` — ref is the subdomain of `https://<project_ref>.supabase.co`.",
    "3. `npx supabase db push` to apply migrations, or `npx supabase db dump` for DDL.",
    "",
    "---",
    "",
  ];

  for (const table of tableNames) {
    const def = definitions[table];
    const props = def.properties || {};
    const required = new Set(def.required || []);
    const colNames = Object.keys(props).sort((a, b) => a.localeCompare(b));

    lines.push(`## \`${table}\``);
    lines.push("");
    lines.push(
      "| Column | Postgres / API type | Required (in OpenAPI) | Default | Notes |"
    );
    lines.push("| --- | --- | --- | --- | --- |");

    for (const col of colNames) {
      const p = props[col];
      const typ = pgType(p);
      const req = required.has(col) ? "yes" : "";
      const defVal =
        p.default !== undefined && p.default !== null
          ? `\`${escapeMd(JSON.stringify(p.default))}\``
          : "";
      let note = "";
      if (p.description) note = escapeMd(cleanDescription(p.description));
      lines.push(
        `| \`${col}\` | ${escapeMd(typ)} | ${req} | ${defVal} | ${note} |`
      );
    }

    if (table === "quests" && !colNames.includes("execution_plan")) {
      lines.push("");
      lines.push(
        "> **OpenAPI gap:** `execution_plan` (jsonb, ordered `{ skillbook, action }` steps) may be missing until migrations are applied and PostgREST schema is reloaded. Regenerate this doc with `node scripts/pull-database-reference.js`."
      );
    }

    lines.push("");
  }

  const outPath = path.join(outDir, "SCHEMA.md");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log("Wrote", path.relative(root, outPath));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
