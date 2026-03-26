# AGENTS.md

## Cursor Cloud specific instructions

### Overview
CJGEO is a single Next.js 15 app (not a monorepo). The DB and auth are managed by a hosted SB project (no local DB). Use `npm` as the package manager (per `package-lock.json`).

### Environment Variables
Secrets are injected as env vars by the infrastructure. A `.env.local` file must be created from these before the dev server starts. Critical vars:
- SB URL, anon key, and service-role key env vars (DB/auth) — see `.env.example` for exact names
- `OPENAI_API_KEY`, `AI_MODEL_ADVANCED`, `AI_MODEL_STANDARD`, `AI_MODEL_LARGE_CONTEXT` (AI models)
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET` (billing — optional)

If `.env.local` doesn't exist, create it from injected env vars. See `.env.example` for the full list.

### Commands
See `package.json` scripts:
- **Dev server**: `npm run dev` (Turbopack on port 3000)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Tests**: `npx vitest run`
- **Dev with cron**: `npm run cjdev` (dev server + local cron)
- **Dev with Stripe webhooks**: `npm run dev:with-webhooks` (needs Stripe CLI)

### Gotchas
- `next lint` has a pre-existing failure: invalid regex in `.eslintrc.json` (`no-restricted-syntax` rule). Not an env issue.
- All test files live under `_archive/tests/` with known failures (removed API routes). No active test files outside the archive.
- Turbopack config in `next.config.mjs` sets `root: __dirname` to prevent env-file loading issues with multiple lockfiles.
- Auth uses Magic Link or Google OAuth — no password login. Testing auth flows needs a valid SB project with configured providers.
- Node.js 22.x works with this codebase.
