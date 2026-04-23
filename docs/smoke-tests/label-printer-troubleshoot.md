# Label Printer Inventory Data Troubleshoot

**Date:** 2026-04-16
**Reporter:** Operations team
**Module:** Freezer Rack Label Printer (`boster_nexus/app/(private)/freezer/page.js`)

---

## 1. Problem Statement

The Freezer Rack Label Printer module displays wrong inventory quantities. The label printer reads `stock_on_hand` and `reorder_level` from the local Supabase `zb_items` table, but the data is stale — it hasn't been synced from Zoho Books since **2026-03-09**.

## 2. PA1020 Comparison (verified 2026-04-16)

| Field | Supabase `zb_items` | Zoho Books (live) | Delta |
|---|---|---|---|
| `stock_on_hand` | **1** | **2** | -1 |
| `available_stock` | **1** | **2** | -1 |
| `actual_available_stock` | (not in indexes) | **108** | N/A |
| `reorder_level` | **10** | **10** | OK |
| `last_modified_time` | 2026-03-06 | **2026-03-26** | 20 days behind |
| `synced_at` | **2026-03-09** | — | 38 days stale |

**Claim confirmed.** Supabase data is 38 days stale. The `stock_on_hand` shown on labels is wrong.

## 3. Data Flow Analysis

### How the label printer gets data

```
User enters SKU range → POST /api/zoho/books/items/by-sku-range
  → queries Supabase `zb_items` table (indexes->>sku range)
  → maps indexes.qty → stock_on_hand
  → maps indexes.reorder_level → reorder_level
  → label shows max(reorder_level, stock_on_hand) as "space to save"
```

**Key file:** `boster_nexus/app/api/zoho/books/items/by-sku-range/route.js` (lines 85-91)

The route reads from `zb_items.indexes.qty` (mapped from Zoho's `stock_on_hand`) and `zb_items.indexes.reorder_level`. It does **not** call the Zoho API live.

### How data gets into `zb_items`

The Data Synchronizer (`libs/data-synchronizer/`) pulls items via:

1. **Cron trigger** → `runSync()` → `TaskScheduler.enqueueCheckUpdates()` → creates `check_updates` task
2. `SyncProcessor._checkUpdates()` → calls Zoho Books `GET /items?last_modified_time=<cursor>` → fetches modified items
3. `ZbItemsAdapter.extractIndexes()` maps Zoho `stock_on_hand` → `indexes.qty`, `available_stock` → `indexes.available_stock`, etc.
4. Upserted into `zb_items` via `SyncRecordRepository`

### Root cause: sync stopped running

- **Last successful sync log:** 2026-03-09T18:17:05 (trigger: cron)
- **Total `zb_items` rows:** 163 — **all 163 are stale** (synced_at older than 2 weeks)
- **`ds_sync_logs` table:** Empty (logs may have been truncated or the cron route stopped being called)
- **No pending `ds_tasks`** in the queue

The cron job that triggers `runSync()` has not executed since March 9th. This could be because:
- The Vercel cron schedule was disabled or the deployment changed
- The cron API route is erroring silently
- The Zoho access token expired and refresh failed (token was expired when tested — had to manually refresh)

### Secondary issue: `stock_on_hand` vs `actual_available_stock`

Even when sync is working, there's a conceptual problem:

| Zoho Field | PA1020 Value | Meaning |
|---|---|---|
| `stock_on_hand` | 2 | Physical units across all warehouses (sum of `warehouse_stock_on_hand`) |
| `available_stock` | 2 | stock_on_hand minus committed (reserved for open SOs) |
| `actual_available_stock` | 108 | Includes items that can be manufactured/procured |

The label printer uses `stock_on_hand` (physical count) which is correct for freezer space allocation. But the `actual_available_stock` of 108 vs `stock_on_hand` of 2 suggests significant committed/in-transit inventory that is not reflected. Operations may be confusing these metrics.

## 4. Fix Plan

### Phase 1: Immediate — Re-sync all items (today)

1. **Manually trigger a full item sync** by calling the data synchronizer API:
   ```
   POST /api/data-synchronizer/sync
   Body: { "jobKey": "zb_items" }
   ```
   Or run directly:
   ```javascript
   import { runSync } from '@/libs/data-synchronizer/orchestration/runSync';
   await runSync({ jobKey: 'zb_items', triggerType: 'manual' });
   ```

2. **Verify PA1020 after sync** — `zb_items.indexes.qty` should match Zoho's `stock_on_hand` (currently 2).

3. **Verify Zoho token health** — the access token was expired. Check that the token refresh mechanism in `ZohoAuthService` is working and the refresh token is still valid.

### Phase 2: Fix the cron (this week)

1. **Check the cron route** — find and verify the Vercel/Next.js cron route that calls `runSync()`:
   ```
   boster_nexus/app/api/data-synchronizer/cron/route.js (or similar)
   ```

2. **Check Vercel cron config** — verify `vercel.json` has the cron schedule active and the deployment is current.

3. **Add alerting** — the sync has been broken for 38 days with no notification. Add:
   - A staleness check: if the most recent `ds_sync_logs` entry for `zb_items` is older than 24 hours, log a warning
   - Consider a Slack/email alert for sync failures

### Phase 3: Enrich label data (optional, discuss with ops)

1. **Add `actual_available_stock` to the indexes** — `ZbItemsAdapter.extractIndexes()` already captures `available_stock` but not `actual_available_stock`. Consider adding it.

2. **Show warehouse breakdown on labels** — the adapter stores `qty_in_warehouses` but the label printer ignores it. If ops needs per-warehouse quantities, wire this into the label UI.

3. **Consider live Zoho fallback** — for critical use cases like label printing, consider a live Zoho API call as fallback when `synced_at` is older than a threshold (e.g., 24 hours). Display a "stale data" warning on the label printer UI.

## 5. Files Involved

| File | Role |
|---|---|
| `boster_nexus/app/(private)/freezer/page.js` | Label printer UI — reads stock_on_hand, reorder_level |
| `boster_nexus/app/api/zoho/books/items/by-sku-range/route.js` | API route — queries zb_items, maps indexes.qty → stock_on_hand |
| `boster_nexus/libs/data-synchronizer/adapters/zoho/entities/ZbItemsAdapter.js` | Adapter — maps Zoho `stock_on_hand` → `indexes.qty` |
| `boster_nexus/libs/data-synchronizer/orchestration/runSync.js` | Sync orchestrator — enqueues and processes batch |
| `boster_nexus/libs/data-synchronizer/processor/SyncProcessor.js` | Processes check_updates tasks |
| `boster_nexus/libs/data-synchronizer/registry.js` | Registry — defines `zb_items` sync config |
| `boster_nexus/libs/zoho/auth.js` | Zoho OAuth token management |
