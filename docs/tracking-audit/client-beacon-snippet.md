# Client-side beacon snippet for bosterbio.com

Drop into bosterbio.com2026 (or current site theme). Hooks into the existing GA4 `dataLayer` so it dual-fires every Tier-1 event to GA4 *and* the SST MVP endpoint without duplicating instrumentation.

## What it does

Listens to `dataLayer.push()` calls. When the pushed event matches the Tier-1+2 allowlist, it forwards a copy to `POST <SST_ENDPOINT>/api/track`. GA4 firing is unchanged.

## Endpoint URL

For now: `https://<guildos-host>/api/track` (this MVP host).
Production: move to a `track.bosterbio.com` proxy on Cloudflare Worker once we promote out of MVP.

## Snippet

```html
<script>
(function () {
  var ENDPOINT = "https://YOUR_GUILDOS_HOST/api/track"; // <- set this
  var ALLOW = {
    "page_view":1,"session_start":1,"purchase":1,"form_submit":1,
    "GAds Conversion":1,"P4. Add to cart":1,"P3.1 Add to cart":1,
    "P1. Search":1,"P2. Click product link":1,"P2 Click Product Link":1,
    "P2.2 View Datasheet":1,"P3.1.3 Begin Checkout":1
  };

  var w = window;
  w.dataLayer = w.dataLayer || [];

  function clientId() {
    // Re-use GA4's _ga cookie client ID when present so SST and GA4 join naturally
    var m = document.cookie.match(/_ga=GA\d\.\d\.([\d.]+)/);
    if (m) return m[1];
    var k = "sst_cid";
    var s = localStorage.getItem(k);
    if (s) return s;
    s = "cid_" + Date.now() + "_" + Math.random().toString(36).slice(2,10);
    try { localStorage.setItem(k, s); } catch(e){}
    return s;
  }

  function sessionId() {
    var k = "sst_sid";
    var raw = sessionStorage.getItem(k);
    if (raw) return raw;
    var s = String(Date.now()).slice(0,10);
    try { sessionStorage.setItem(k, s); } catch(e){}
    return s;
  }

  function eventId() {
    return "evt_" + Date.now() + "_" + Math.random().toString(36).slice(2,10);
  }

  function buildPayload(name, params) {
    var p = params || {};
    return {
      event_name: name,
      event_id: eventId(),
      event_timestamp: Date.now(),
      user_pseudo_id: clientId(),
      session_id: sessionId(),
      page_location: location.href,
      page_referrer: document.referrer || null,
      page_title: document.title,
      page_path: location.pathname,
      language: navigator.language,
      screen_resolution: screen.width + "x" + screen.height,
      // Pass-through commerce + form fields if present
      transaction_id: p.transaction_id,
      value: p.value,
      currency: p.currency,
      tax: p.tax,
      shipping: p.shipping,
      coupon: p.coupon,
      items: p.items,
      form_id: p.form_id,
      form_destination: p.form_destination,
      // Attribution
      first_gclid: p.first_gclid,
      gclid: p.gclid,
      gad_source: p.gad_source,
      gad_campaignid: p.gad_campaignid,
      srsltid: p.srsltid,
      source: p.source,
      medium: p.medium,
      campaign: p.campaign
    };
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      } catch(e){}
    }
    // Fallback
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        mode: "cors",
        credentials: "omit"
      });
    } catch(e){}
  }

  // Hook into dataLayer.push
  var origPush = w.dataLayer.push.bind(w.dataLayer);
  w.dataLayer.push = function () {
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (a && typeof a === "object" && a.event && ALLOW[a.event]) {
        try { send(buildPayload(a.event, a)); } catch(e){}
      }
    }
    return origPush.apply(null, arguments);
  };

  // Also dual-fire whatever's already queued before this snippet ran
  for (var j = 0; j < w.dataLayer.length; j++) {
    var item = w.dataLayer[j];
    if (item && item.event && ALLOW[item.event]) {
      try { send(buildPayload(item.event, item)); } catch(e){}
    }
  }
})();
</script>
```

## Where to inject

In bosterbio.com's GTM container, add a custom HTML tag firing on **All Pages — DOM Ready**, after the GA4 base tag (so the `_ga` cookie is set first). Tag priority: 1 (low) so GA4 fires first.

## What's NOT in this snippet (intentional)

- No PII (email, name) — those should never reach BQ raw, not without a hashing pipeline first
- No retry queue — if the request fails, GA4 still has the event; comparison just shows the gap
- No batching — one event per request keeps the diff math trivial (1 GA4 row ↔ 1 SST row)

## Validation after deploy

```sql
-- Compare counts side by side, last 24h
WITH ga AS (
  SELECT event_name, COUNT(*) c FROM `boster-cbi.analytics_362731773.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  GROUP BY event_name
),
sst AS (
  SELECT event_name, COUNT(*) c FROM `boster-cbi.CDB.events_serverside_mvp`
  WHERE DATE(ingestion_timestamp) = CURRENT_DATE()
  GROUP BY event_name
)
SELECT
  COALESCE(ga.event_name, sst.event_name) AS event_name,
  ga.c AS ga4_count,
  sst.c AS sst_count,
  SAFE_DIVIDE(sst.c - ga.c, ga.c) AS pct_diff
FROM ga FULL OUTER JOIN sst ON ga.event_name = sst.event_name
ORDER BY ga.c DESC;
```

Expected drift after a week: SST should be **≥ GA4** for most events (no ad-blocker losses on server-side path). If SST is materially lower, the snippet isn't reaching all event firings — debug from there.
