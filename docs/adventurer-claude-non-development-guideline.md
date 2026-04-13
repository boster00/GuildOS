# Adventurer Guideline: Non-Development Tasks (Neo Golden Finger)

You are executing a GuildOS quest as a non-development agent. You may use any tool, library, or approach available to you — but you must follow these constraints.

---

## 1. Deliverables go to Supabase, not local disk

- All final outputs (reports, screenshots, videos, PPTs, CSVs, etc.) must be **uploaded to Supabase Storage**.
- Bucket: `GuildOS_Bucket` (public)
- Path: `neo_golden_finger/{questId}/{filename}`
- You may save files locally as scratch/intermediate work, but the **final deliverable** must be in Supabase Storage.
- After uploading, **deliver the result** to the quest:

```bash
# Add item to quest inventory
curl -X POST "http://localhost:3002/api/pigeon-post?action=deliver" \
  -H "X-Pigeon-Key: browserclaw-test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "questId": "<QUEST_ID>",
    "items": {
      "<ITEM_KEY>": {
        "url": "https://sdrqhejvvmbolqzfujej.supabase.co/storage/v1/object/public/GuildOS_Bucket/neo_golden_finger/<QUEST_ID>/<filename>",
        "filename": "<filename>",
        "description": "<what this file contains>"
      }
    }
  }'
```

- Post a **quest comment** with the viewable link. Use Supabase directly since the comments API requires session auth:

```bash
curl -X POST "https://sdrqhejvvmbolqzfujej.supabase.co/rest/v1/quest_comments" \
  -H "apikey: $SUPABASE_SECRETE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRETE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "quest_id": "<QUEST_ID>",
    "source": "neo_golden_finger",
    "action": "deliver",
    "summary": "<describe what was delivered and include the public URL>",
    "detail": {}
  }'
```

---

## 2. Do NOT modify the GuildOS codebase

- Do not edit, create, or delete files in the GuildOS repository source code (`app/`, `libs/`, `supabase/`, etc.).
- Do not run `git add`, `git commit`, or `git push` on the GuildOS repo.
- You may **read** any file in the repo for context.
- You may create files in `docs/results/` as scratch space only (not as final deliverables).

### When specialized access is needed

If the task requires something you cannot do (database schema changes, new API endpoints, weapon code, etc.):

1. Post a quest comment explaining exactly what is needed:
   ```json
   {
     "quest_id": "<QUEST_ID>",
     "source": "neo_golden_finger",
     "action": "escalate",
     "summary": "This task requires [specific capability]. Recommending reassignment to a specialized adventurer or weapon creation.",
     "detail": { "reason": "<what's needed>", "recommendation": "<which adventurer or weapon type>" }
   }
   ```

2. Transition the quest back to `assign` stage so Cat can re-route.

---

## 3. Self-review before submitting

Before delivering any result, verify your own work:

- **Screenshots**: Open/inspect them. Check for CAPTCHA pages, bot detection, blank/black images, error pages, unexpected redirects. If any screenshot is bad, fix it before delivering.
- **Reports (PPT, PDF, CSV)**: Verify the file is not corrupt, has the expected number of pages/slides, and contains real content — not placeholders or error text.
- **Data**: Spot-check values for obvious errors (wrong units, null fields, impossible numbers).
- **URLs**: Verify uploaded file URLs return HTTP 200, not 404 or error pages.

**If your output does not meet the quest's success criteria, do not deliver it.** Fix the issue or report the failure with a clear explanation of what went wrong.

---

## Environment reference

| Key | Value |
|-----|-------|
| Dev server | `http://localhost:3002` (start with `npm run dev` if not running) |
| Supabase URL | Value of `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` |
| Supabase service key | Value of `SUPABASE_SECRETE_KEY` from `.env.local` |
| Storage bucket | `GuildOS_Bucket` |
| Pigeon API key | Value of `PIGEON_API_KEY` from `.env.local` |

Read these from `.env.local` — never hardcode them in scripts.
