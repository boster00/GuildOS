# Server-Side Tracking MVP — Event Selection

Based on `boster-cbi.analytics_362731773` audit (2026-04-25, 30-day window).

## Scope this MVP to one property: bosterbio.com (GA4 360 property `362731773`)

The other datasets in the project (`CDB`, `GA4`, three hash-named datasets) are derived/curated tables, not raw GA exports. Audit focused on raw GA4 events.

## Tier 1 — replicate first (covers attribution + revenue)

These are the load-bearing events for revenue, attribution, and funnel measurement. Server-side parity here is the entire point of the MVP.

| Event | 30d count | Why it's tier 1 |
|---|---:|---|
| `page_view` | 53,016 | baseline; needed for path analysis + page-level attribution |
| `session_start` | 36,009 | session boundary; required for sessions metric parity |
| `purchase` | 14 | revenue truth; only 14 in window — every miss matters |
| `form_submit` | 5,574 | lead conversion; B2B revenue precursor |
| `GAds Conversion` | 15,952 | paid attribution feedback loop to Google Ads |
| `P4. Add to cart` (+ consolidate `P3.1 Add to cart`) | 691 | mid-funnel intent signal |

## Tier 2 — replicate second (funnel intent)

| Event | 30d count |
|---|---:|
| `P1. Search` | 10,130 |
| `P2. Click product link` (consolidate `P2 Click Product Link`) | 3,924 |
| `P2.2 View Datasheet` | 660 |
| `P3.1.3 Begin Checkout` | 42 |

## Tier 3 — defer (low volume or chat/engagement)

`scroll`, `user_engagement`, `first_visit`, all `Chat *` variants, `Ebook Download`, `Rating Submitted`. Replicate only after T1+T2 parity is proven.

## Required field set (params to capture server-side)

### Identity
- `user_pseudo_id` (GA4 client ID — keep cross-system)
- `user_id` (when logged in — already populated as user property, 1,553 occurrences)

### Attribution
- `first_gclid` (53,809 occurrences — primary paid attribution key)
- `gclid_event`, `gcl_aw`, `gad_source`, `gad_campaignid`
- `srsltid` (44,354 — Google Shopping)
- `traffic_source.{source, medium, name}` (top: google/organic, direct/none, bing/organic, biocompare.com/referral)
- UTM params via `event_params` keys (already passed through)

### Page context
- `page_location`, `page_referrer`, `page_title`

### Commerce (purchase only)
- `transaction_id` (already keyed)
- `value`, `currency`, `tax`, `shipping`, `coupon`
- `items[]`: `item_id`, `item_name`, `item_brand`, `item_category`, `item_variant`, `price`, `quantity`

### Form (form_submit, form_start)
- `form_id`, `form_destination`, `form_length`
- `first_field_id`, `first_field_name`, `first_field_type`, `first_field_position`

## Cleanup recommendations (do BEFORE MVP, not during)

These are GA4-side fixes that will save you from replicating broken state into the server-side pipeline:

1. **Consolidate event-name duplicates** in GTM/GA4 config:
   - `P2. Click product link` ≡ `P2 Click Product Link` (whitespace + period)
   - `P3.1 Add to cart` ≡ `P4. Add to cart` (review intent — are these really the same step?)
   - `Chat Minimized`/`Chat_OfflineMsg`/`Chat Connected`/`Chat_Connected` (underscore vs space variants)
2. **Delete or rename** `ads_conversion_Page_view_Page_load_www_1` — Google-Ads-imported event with leaky naming.
3. **Sessions count is 0** in audit — `ga_session_id` extraction returned NULL for every row. Likely SQL issue (param shape), but worth confirming the field is actually populated. Re-check before relying on session metrics.

## Non-goals for the MVP

- Don't replicate every event. Tier 1 + Tier 2 = ~10 events. That's the comparison surface.
- Don't try to match GA4's modeled metrics (engaged sessions, conversion rate). Compare raw event counts + revenue first.
- Don't replicate user properties beyond `user_id`. There's only one in use anyway.

## Validation harness (suggested)

Run side-by-side for ≥7 days, then diff:

```sql
-- GA4 raw
SELECT event_name, COUNT(*) FROM `boster-cbi.analytics_362731773.events_*`
WHERE _TABLE_SUFFIX = 'YYYYMMDD' AND event_name IN (<tier1 list>)
GROUP BY event_name;

-- vs server-side store, same date
SELECT event_name, COUNT(*) FROM <server_side_table> WHERE date = 'YYYY-MM-DD' GROUP BY event_name;
```

Acceptance: ≤5% drift on `page_view`/`session_start`, ≤1% drift on `purchase`/`form_submit`/`GAds Conversion`. Anything wider — investigate before declaring MVP done.
