# GuildOS — Agent Instructions

## Cursor Cloud specific instructions

### What runs

See `CLAUDE.md` and `README.md` for the full tech stack. The app runs on port **3002** via `npm run dev`. Env vars are pre-injected — no `.env.local` needed.

### Running the dev server

```bash
npm run dev          # Next.js dev with Turbopack on port 3002
```

All `app/town/**` routes require authentication — unauthenticated requests redirect (307) to `/signin`. The `/signin` page renders without auth. API routes under `/api/` return 500 for unauthenticated calls that use `database.init("server")` because no session cookies are present.

### Lint / Test / Build

See `package.json` scripts. Key commands:

```bash
npm run lint         # ESLint via next lint (warnings for <img> usage are pre-existing)
npx vitest run       # Unit tests (vitest, currently 1 test file under libs/council/ai/)
npm run build        # Production build (two-pass: compile then generate, plus next-sitemap)
```

### Gotchas

- The `next lint` command is deprecated in Next.js 16+; output includes a deprecation notice but still works.
- A DB credential env var has a legacy typo (extra 'e'). The auth env helper (`libs/council/auth/env.js`) tries several key name variants, so it works regardless.
- The build uses `--experimental-build-mode=compile` then `--experimental-build-mode=generate` (two-pass). This is intentional.
- ESLint config is in `.eslintrc.json` (flat config files like `eslint.config.js` are not used).
- No Docker, no Makefile, no setup scripts — `npm install` is the only dependency step.

### Cron (quest pipeline)

The 5-minute cron loop auto-advances quests. Use `npm run cjdev` to run dev server + cron concurrently, or `npm run cj:cron:run-once` for a single pass. The cron requires `OPENAI_API_KEY` and valid DB credentials with quest data.
