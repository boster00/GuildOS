# GuildOS — Agent Instructions

## Cursor Cloud specific instructions

### Services overview

GuildOS runs on Next.js 15 (port **3002**) with a remote DB. <!-- pragma: allowlist secret -->
Env vars for the DB and OpenAI are provided by VM secrets — no `.env.local` is needed. See `libs/council/auth/env.js` for the var names and fallback order.

### Running the dev server

```bash
npm run dev          # Next.js with Turbopack on port 3002
```

Unauthenticated requests to `/town/**` redirect to `/signin`. The sign-in page (`/signin`) and the opening page (`/opening`) are the public entry points.

### Lint / test / build

Standard commands from `package.json`:

```bash
npm run lint         # ESLint (exits 1 on errors; pre-existing warnings are expected)
npm run test         # Vitest (currently 1 test file, 2 tests)
npm run build        # next build (compile + generate + next-sitemap)
```

- **Lint** has pre-existing warnings (mostly `no-img-element`) and 1 pre-existing error in `app/api/weapon/zoho/route.js`. These are not introduced by agent changes.
- **Build** uses a two-phase approach: `--experimental-build-mode=compile` then `generate`, followed by `next-sitemap`.

### Gotchas

- The package is named `ship-fast-code` in `package.json` (fork heritage); the product is **GuildOS**.
- Dev port is **3002**, not the Next.js default 3000. Never hardcode `localhost:3000`.
- `SUPABASE_SECRETE_KEY` (note the typo) is a valid env var name — the auth/env module checks it as a fallback. <!-- pragma: allowlist secret -->
- The `next lint` command is deprecated in Next.js 16+ — a migration notice appears but lint still runs.
- `eslint: { ignoreDuringBuilds: true }` in `next.config.mjs` means `npm run build` will not fail on lint issues.
- No local DB setup is needed in Cloud Agent VMs — the app connects to the hosted instance via the injected secrets. <!-- pragma: allowlist secret -->
