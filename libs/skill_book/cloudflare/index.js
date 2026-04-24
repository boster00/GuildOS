/**
 * Cloudflare skill book — audit, smoke-test, and controlled-rollout recipes
 * for Cloudflare zones (primarily bosterbio.com).
 */

import { read as cfRead, search as cfSearch, normalize as cfNormalize } from "@/libs/weapon/cloudflare";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

export const skillBook = {
  id: "cloudflare",
  title: "Cloudflare",
  description: "Audit Cloudflare zones, run controlled rollouts of rule changes, and interpret Cloudflare semantics.",
  steps: [],
  toc: {
    audit: {
      description: "Run a read-only audit of a Cloudflare zone and return the compiled finding set.",
      howTo: [
        "Call weapon cloudflare.read({resource:'tokenCapabilities', zoneName}) first — this is non-obvious but critical: Cloudflare tokens are fine-grained and a valid-looking token may still be denied on zoneSettings / rulesets / botManagement. If any of those come back 403, mark them as MISSING_SCOPE in findings rather than skipping silently.",
        "Call read({resource:'zone'}) — plan tier gates which features/recommendations apply.",
        "Call read({resource:'dns'}) — look for cPanel/webmail/whm/webdisk subdomains that are PROXIED (orange cloud). Those are misconfigured: proxying cPanel breaks AutoSSL and can rate-limit admin logins. Flag. Also look for staging hostnames (dev., stage., staging., jr-staging., *.mobile., *.staging.) — these often leak publicly.",
        "Call read({resource:'firewallRules'}) — these are LEGACY. The action 'bypass' does NOT mean block; it means SKIP all CF security for matching traffic. A rule labeled '[Blacklist] … action=bypass' is inverted from intent. Use normalize({kind:'legacyFirewallAction', data:rule.action}) to annotate each rule with its real meaning in the report.",
        "Call read({resource:'pageRules'}) and read({resource:'rateLimits'}). Zero of either + zero Cache Rules = static/HTML content is at the mercy of origin headers; usually means cache hit is terrible.",
        "Call read({resource:'rulesets'}) if the token has Zone WAF scope. The rule IDs in firewallEventsAdaptiveGroups point at entries in these rulesets, NOT at legacy firewall rule IDs.",
        "Call search({resource:'cacheByContentType', windowHours:24}) and search({resource:'cacheByPath', windowHours:24, limit:50}). cacheStatus values mean: hit=served from edge (origin saved); expired=was cached, revalidating (also saves origin); miss=eligible, not in cache yet; dynamic=CF decided not to cache (usually cookies/Cache-Control); none=origin said no-store; bypass=a rule explicitly skipped cache. Only hit+expired save origin. Bypass+none+dynamic on static assets (CSS/JS/fonts/PDF) or on anonymous HTML is the top cache-related finding.",
        "Call search({resource:'firewallEvents', windowHours:24}). NOTE: this dataset is hard-capped to 1-day windows on Pro plan — the weapon clamps for you. Cross-reference top rule IDs against firewall rules + rulesets.",
        "Fetch https://<zone>/robots.txt and a sample product page with a plain User-Agent and with 'ClaudeBot/1.0' — then call normalize({kind:'httpResponse'}) on each. If ClaudeBot returns classification='challenge', the AI-bot whitelist is not working (a WAF custom rule fires before the legacy skip).",
        "Compile findings: critical (origin-load, inverted rules, blocked AI bots, proxied admin) → material (missing cache/rate-limit policy, dominant skip traffic) → minor.",
        "Return: { findings: [...], scopeMissing: [...], recommendations: [...] }.",
      ].join("\n"),
      input: { zoneName: "string — e.g. bosterbio.com" },
      output: { findings: "array of finding objects", scopeMissing: "array of string", recommendations: "array" },
    },

    smokeTestRule: {
      description: "Run the standard smoke-test ritual after toggling a single Cloudflare rule or setting. Returns GREEN/YELLOW/RED.",
      howTo: [
        "A smoke test has a fixed shape — do NOT improvise, do NOT skip steps:",
        "1. BASELINE (T-0): before the change, capture (a) analytics metrics for affected paths via search({resource:'cacheByPath' or 'firewallEvents', windowHours:1, limit:50}) AND (b) run the SAME curl probes you plan to run post-change. Save both. This catches pre-existing flakiness (e.g. a URL that already times out at origin) so you don't misattribute it to your change.",
        "2. APPLY (T+0): the caller has already applied the change; your job is observation. Record the change description + timestamp.",
        "3. ACTIVE SMOKE (T+0..5): re-run the baseline probes. For each, pass the response to normalize({kind:'httpResponse'}). Expected classifications are in input.probes[i].expect. Compare each result against the pre-change baseline, not against the abstract expectation — a URL that was already slow is not a regression.",
        "4. OBSERVE (T+5..35): DO NOT make other changes in this window.",
        "5. METRICS (T+35): re-run the baseline queries. Compute deltas. Pull a sample of 10 IPs hitting affected paths via firewallEvents — did any go from allow→block unexpectedly?",
        "6. DECIDE: GREEN (all probes classified as expected AND no 5xx spike >2× baseline AND no legit-UA 403 spike >1%). YELLOW (probes OK but one soft signal off — tune, don't revert). RED (any probe misclassified vs baseline OR 5xx spike OR legit-user blocked).",
        "RED triggers immediate revert. Always ask the caller to confirm the revert action before reporting back — agent does not auto-revert.",
        "CASE STUDY — load-bearing 'bypass' rule: A legacy Firewall Rule labeled '[Monitor only] Everyone Else' with wildcard host and action=bypass is NOT monitor-only — it was silently shielding 100% of fall-through traffic from managed WAF. Disabling it in one go causes a surge of previously-skipped traffic to hit managed WAF and Magento origin at once, producing RED smoke (timeouts on high-volume HTML URLs like /new-products). Correct path: phased migration — first narrow the filter scope to specific hostnames/paths, then migrate matches into explicit named Custom Rules, only then retire the catch-all. Never flip a wildcard-host bypass rule off in one step.",
      ].join("\n"),
      input: {
        zoneName: "string",
        changeDescription: "string",
        probes: "array of { url, userAgent?, headers?, expect: 'allow'|'challenge'|'block'|'origin-error' }",
        affectedPaths: "array of string — paths to sample in baseline/post-change analytics",
        baselineWindowMinutes: "int, default 60",
        observeMinutes: "int, default 30",
      },
      output: { decision: "GREEN|YELLOW|RED", probeResults: "array", metricDeltas: "object", notes: "string" },
    },

    runControlledRollout: {
      description: "Execute smokeTestRule for a whole batch of changes one-by-one, waiting observeMinutes between each. Designed for the days-long rollout pattern.",
      howTo: [
        "Process the input.changes array strictly in order. For each change: (a) pause until caller confirms the change is applied, (b) invoke smokeTestRule with the change's probe spec, (c) honor the decision — if RED, halt the batch and surface the revert requirement to the caller. Do not auto-advance on RED.",
        "Between changes, wait input.coolDownMinutes (default 15) even if decision was GREEN, so one change's effects don't contaminate the next change's baseline.",
        "Irreversible or extra-care changes (flagged 🔒 in the rollout plan) must NOT be in the same batch as ordinary changes — require a separate `phase: 'careful'` run.",
      ].join("\n"),
      input: {
        zoneName: "string",
        changes: "array of smokeTestRule inputs",
        coolDownMinutes: "int, default 15",
        phase: "'standard' | 'careful' — gate check",
      },
      output: { batchDecision: "GREEN|PARTIAL|HALTED", perChange: "array of smokeTestRule outputs" },
    },

    interpretLegacyAction: {
      description: "Translate a legacy Firewall Rule action ('bypass', 'skip', 'allow', 'challenge', 'managed_challenge', 'block', 'log') to what it actually does. Use this every time you read firewallRules output.",
      howTo: "Call cloudflare.normalize({kind:'legacyFirewallAction', data:actionString}). Returns { action, meaning }. The most important non-obvious one: 'bypass' is a WHITELIST (skip WAF/Bot/Security-Level checks), not a block. A rule named '[Blacklist] … action=bypass' is inverted from intent.",
      input: { action: "string — action name from legacy firewall rule" },
      output: { action: "string", meaning: "string" },
    },

    classifyCloudflareResponse: {
      description: "Classify an HTTP response as allow/challenge/block/origin-error/other using the right tells. Never guess by HTTP status alone — HTTP 403 with a CSP referencing challenges.cloudflare.com is a Managed Challenge (bot couldn't solve), NOT a block. HTTP 403 with body `<center>nginx</center>` is ORIGIN blocking (e.g. nginx UA blocklist), NOT Cloudflare — fetch the body, don't just check status.",
      howTo: "Capture the response as { status, headers, body } and pass to cloudflare.normalize({kind:'httpResponse', data}). Headers must include `cf-cache-status` and `content-security-policy` (lowercased keys are fine). Body must be at least the first 500 bytes — the origin-vs-CF distinction requires body inspection. Returns { classification, reason, cfCache, cfMitigated }.",
      input: { status: "int", headers: "object", body: "string — first 500+ bytes required for origin-vs-CF distinction" },
      output: { classification: "string", reason: "string", cfCache: "string|null", cfMitigated: "string|null" },
    },

    diagnoseAIBotBlock: {
      description: "When an AI/search bot UA gets 403 from a site behind Cloudflare, determine whether Cloudflare or the origin is blocking it. Do NOT assume Cloudflare.",
      howTo: [
        "Run `curl -sS -A '<bot UA>' -D headers.txt -o body.html https://site/`.",
        "Inspect headers.txt: if `server: cloudflare` AND body contains `<center>nginx</center>` or `<center>apache</center>` — it's ORIGIN blocking. Cloudflare is just proxying the origin's 403. Fix requires SSH/cPanel access to edit the web server's UA blocklist, NOT a CF rule change.",
        "If body contains `challenges.cloudflare.com` CSP directive — it's a Managed Challenge (not a block).",
        "If `cf-mitigated` header is present — Cloudflare mitigated; the header value says why.",
        "Common Magento/nginx pattern: origin explicitly blocks {ClaudeBot, anthropic-ai, CCBot, Bytespider, Amazonbot, Meta-ExternalAgent} in nginx/httpd.conf UA filter. GPTBot, OAI-SearchBot, PerplexityBot, Googlebot typically pass. If the user's goal is to ALLOW certain training bots, editing CF alone will not fix it.",
      ].join("\n"),
      input: { url: "string", botUserAgent: "string" },
      output: { source: "'cloudflare-block'|'cloudflare-challenge'|'origin-block'|'allow'|'other'", fixRequires: "'cf-waf-rule'|'cf-toggle'|'origin-nginx-edit'|'none'", evidence: "string" },
    },
  },
};

// ---------------------------------------------------------------------------
// Orchestration (optional — callable from adventurer runtime).
// ---------------------------------------------------------------------------

/**
 * @param {unknown} [a] userId or input
 * @param {unknown} [b] input when a is userId
 */
export async function audit(a, b) {
  const input = pickInput(a, b);
  const userId = typeof a === "string" ? a : undefined;
  const zoneName = String(input.zoneName ?? "bosterbio.com").trim();

  try {
    const caps = await cfRead({ resource: "tokenCapabilities", zoneName }, userId);
    const scopeMissing = Object.entries(caps.capabilities || {})
      .filter(([, v]) => !v.ok)
      .map(([k]) => k);

    const findings = [];
    const recommendations = [];

    // DNS: cPanel-family proxied, staging exposure
    const { records } = await cfRead({ resource: "dns", zoneName }, userId);
    const adminProxied = records.filter(
      (r) => r.proxied && /^(cpanel|webmail|whm|webdisk|cpcalendars|cpcontacts)\./i.test(r.name || ""),
    );
    if (adminProxied.length) {
      findings.push({
        severity: "critical",
        id: "admin-proxied",
        detail: `${adminProxied.length} cPanel-family records are orange-clouded (proxied). Proxying breaks AutoSSL and risks WAF-rate-limiting admin logins.`,
        records: adminProxied.map((r) => r.name),
      });
      recommendations.push({ id: "unproxy-admin", impact: "hygiene-must-do", effort: "10 min" });
    }

    const stagingHosts = records.filter((r) =>
      /^(dev|stage|staging|jr-staging)\./i.test(r.name || "") || /\.(staging|mobile)\./i.test(r.name || ""),
    );
    if (stagingHosts.length) {
      findings.push({
        severity: "critical",
        id: "staging-exposed",
        detail: `${stagingHosts.length} staging/dev hostnames exist in DNS and may be publicly accessible.`,
        records: stagingHosts.map((r) => r.name),
      });
    }

    // Legacy firewall rules semantic analysis
    const { rules: fwRules } = await cfRead({ resource: "firewallRules", zoneName }, userId);
    for (const rule of fwRules) {
      const n = cfNormalize({ kind: "legacyFirewallAction", data: rule.action });
      const desc = rule.description || "";
      const claimsBlock = /\b(blacklist|ban|block)\b/i.test(desc);
      if (claimsBlock && (n.action === "bypass" || n.action === "skip" || n.action === "allow")) {
        findings.push({
          severity: "critical",
          id: "inverted-firewall-rule",
          detail: `Rule "${desc}" is labeled as blacklist but action="${rule.action}" which means ${n.meaning}`,
          ruleId: rule.id,
        });
      }
    }

    // Page rules / rate limits / cache policy
    const [{ rules: pageRules }, { rules: rateLimits }] = await Promise.all([
      cfRead({ resource: "pageRules", zoneName }, userId),
      cfRead({ resource: "rateLimits", zoneName }, userId),
    ]);
    if (pageRules.length === 0 && rateLimits.length === 0) {
      findings.push({
        severity: "material",
        id: "no-cache-or-rate-policy",
        detail: "Zero Page Rules, zero legacy Rate Limits. All cache/rate policy relies on origin headers + Custom Rules.",
      });
    }

    // Cache analytics — find worst cache=bypass content types
    try {
      const { rows: ctRows } = await cfSearch({ resource: "cacheByContentType", zoneName, limit: 50, windowHours: 24 }, userId);
      const byType = {};
      for (const row of ctRows) {
        const ct = row.dimensions.edgeResponseContentTypeName || "unknown";
        byType[ct] = byType[ct] || { hit: 0, bypass: 0, miss: 0, none: 0, dynamic: 0, totalBytes: 0 };
        const bucket = row.dimensions.cacheStatus;
        if (byType[ct][bucket] !== undefined) byType[ct][bucket] += row.count;
        byType[ct].totalBytes += row.sum?.edgeResponseBytes || 0;
      }
      const leaky = Object.entries(byType)
        .filter(([ct, v]) => ["css", "js", "pdf", "svg", "bin", "woff", "woff2", "ttf"].includes(ct) && v.bypass + v.none > v.hit)
        .map(([ct, v]) => ({ contentType: ct, ...v }));
      if (leaky.length) {
        findings.push({
          severity: "critical",
          id: "static-cache-bypass",
          detail: `Static asset content types where bypass+none exceeds hit — origin is serving cacheable assets`,
          contentTypes: leaky,
        });
        recommendations.push({ id: "static-cache-rule", impact: "cuts ~30+ GB/day off origin", effort: "20 min" });
      }
    } catch (e) {
      findings.push({ severity: "minor", id: "cache-analytics-failed", detail: String(e.message || e) });
    }

    return skillActionOk({ zoneName, findings, scopeMissing, recommendations });
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Classify a live HTTP response (convenience wrapper around normalize + fetch).
 */
export async function classifyCloudflareResponse(a, b) {
  const input = pickInput(a, b);
  try {
    const { status, headers, body } = /** @type {any} */ (input);
    const result = cfNormalize({ kind: "httpResponse", data: { status, headers, body } });
    return skillActionOk(result);
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

export async function interpretLegacyAction(a, b) {
  const input = pickInput(a, b);
  try {
    const result = cfNormalize({ kind: "legacyFirewallAction", data: String(input.action || "").trim() });
    return skillActionOk(result);
  } catch (e) {
    return skillActionErr(e instanceof Error ? e.message : String(e));
  }
}

function pickInput(a, b) {
  if (b !== undefined && typeof b === "object" && b !== null && !Array.isArray(b)) return b;
  if (a !== undefined && typeof a === "object" && a !== null && !Array.isArray(a)) return a;
  return {};
}
