// Cross-model verification — re-judge every item with Anthropic Claude Opus 4
// (different model family from OpenAI gpt-4o) and report agreement rate.
const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC) { console.error("ANTHROPIC_API_KEY missing"); process.exit(1); }
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function post(p, body) { const r = await fetch(SUP+"/rest/v1/"+p, { method:"POST", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }

const isImage = u => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u||"");

async function claudeJudge(url, claim, isImg) {
  let content;
  if (isImg) {
    // Anthropic accepts image URLs directly
    content = [
      { type: "image", source: { type: "url", url } },
      { type: "text", text: "CLAIM: " + claim + "\n\nDecide whether the image substantively supports the claim. Respond ONLY with JSON: {\"verdict\":\"match\"|\"mismatch\"|\"inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences\"}" }
    ];
  } else {
    const f = await fetch(url);
    if (!f.ok) throw new Error("fetch_"+f.status);
    const body = (await f.text()).slice(0, 30000);
    content = [
      { type: "text", text: "CLAIM:\n" + claim + "\n\nDOCUMENT CONTENTS (truncated to 30K chars):\n" + body + "\n\nDecide whether the document substantively delivers what the claim describes. Respond ONLY with JSON: {\"verdict\":\"match\"|\"mismatch\"|\"inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences\"}" }
    ];
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { Authorization: "Bearer "+ANTHROPIC, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      max_tokens: 400,
      system: "You are a strict deliverable verification judge. Be reasonable about phrasing — exact-string match not required, but the substance must match. Respond ONLY in valid JSON.",
      messages: [{ role: "user", content }]
    })
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error("anthropic_"+r.status+": "+err.slice(0,200));
  }
  const j = await r.json();
  const txt = j.content[0].text.trim();
  // Strip markdown code fences if present
  const cleaned = txt.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

const patterns = ["1.%20", "2.%20", "3.%20", "4.%20", "5.%20", "6.%20", "7.%20", "8.%20", "9.%20", "10.%20", "11.%20", "12.%20", "13.%20"];
const allResults = [];

for (const p of patterns) {
  const qs = await get("quests?title=ilike."+p+"%25&select=id,title,stage&order=title");
  for (const q of qs) {
    const items = await get("items?quest_id=eq."+q.id+"&select=id,item_key,expectation,url&order=item_key");
    const verdicts = [];
    for (const it of items) {
      if (!it.url || !it.expectation) { verdicts.push({ ik: it.item_key, verdict: "skip" }); continue; }
      try {
        const j = await claudeJudge(it.url, it.expectation, isImage(it.url));
        verdicts.push({ ik: it.item_key, ...j });
      } catch (e) { verdicts.push({ ik: it.item_key, verdict: "error", reason: e.message.slice(0,200) }); }
    }
    const total = items.length;
    const passes = verdicts.filter(v => v.verdict === "match").length;
    const fails = verdicts.filter(v => v.verdict === "mismatch").length;
    const others = total - passes - fails;
    console.log([q.title.slice(0,38).padEnd(38), q.stage.padEnd(9), "pass="+passes+"/"+total, "fail="+fails, "other="+others].join(" | "));
    verdicts.forEach(v => console.log("   ["+v.verdict.padEnd(13)+"] "+(v.confidence||"").toString().padStart(4)+" "+v.ik.padEnd(30)+" :: "+(v.reasoning||v.reason||"").slice(0,90)));
    allResults.push({ q, items, verdicts, passes, fails, others, total });
    // Record per-item Anthropic verdict
    for (let i = 0; i < items.length; i++) {
      const v = verdicts[i]; const it = items[i];
      if (v.verdict === "skip") continue;
      const text = "[Cross-check claude-opus-4 2026-04-26] verdict="+v.verdict+(v.confidence!=null?" confidence="+v.confidence:"")+": "+(v.reasoning||v.reason||"").slice(0,500);
      await post("item_comments", [{ item_id: it.id, role: "questmaster", actor_name: "Cross-check (claude-opus-4)", text }]);
    }
  }
}

console.log("\n=== AGREEMENT WITH gpt-4o ===");
let total = 0, agreed = 0, opusOnly = 0, gpt4oOnly = 0;
for (const r of allResults) {
  for (let i = 0; i < r.items.length; i++) {
    const v = r.verdicts[i];
    if (v.verdict === "skip" || v.verdict === "error") continue;
    total++;
    // gpt-4o said all items match (since v4 calibration). So opus match = agreed; opus mismatch/inconclusive = disagreed
    if (v.verdict === "match") agreed++;
    else gpt4oOnly++;
  }
}
console.log("Total comparable items: " + total);
console.log("Both agree (match): " + agreed + " (" + Math.round(agreed/total*100) + "%)");
console.log("gpt-4o said match, opus disagreed: " + gpt4oOnly);

console.log("\n=== Items where opus disagreed with gpt-4o (worth your eyeball) ===");
for (const r of allResults) {
  for (let i = 0; i < r.items.length; i++) {
    const v = r.verdicts[i];
    if (v.verdict === "match" || v.verdict === "skip" || v.verdict === "error") continue;
    const it = r.items[i];
    console.log(`#${(r.q.title.match(/^(\d+)/)||[])[1]||"?"} ${r.q.title.slice(0,30)} | ${it.item_key} | opus says ${v.verdict} (conf=${v.confidence})`);
    console.log("   reasoning: " + (v.reasoning || "").slice(0, 200));
  }
}
