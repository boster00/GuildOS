// Layer-by-layer attribution: for each item, gather verdicts from each judging layer.
const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }

const patterns = ["1.%20", "2.%20", "3.%20", "4.%20", "5.%20", "6.%20", "7.%20", "8.%20", "9.%20", "10.%20", "11.%20", "12.%20", "13.%20"];

// Truth from my direct visual inspection — derived from this session
// Format: 'qXX/item_key' → 'right' | 'wrong'
const myGroundTruth = {
  // q05/account-levels-screenshot is wrong (different work session, not Telnyx)
  "q05/account-levels-screenshot": "wrong",
  // q06/00-live-evidence-zoho-invoice is HTML login redirect — calibrated text "matches" but artifact unhelpful
  "q06/00-live-evidence-zoho-invoice": "wrong",
};
// Everything else = right by default

function extractVerdict(text, marker) {
  if (!text || !text.includes(marker)) return null;
  const m = text.match(/verdict=(match|mismatch|inconclusive|error)/);
  return m ? m[1] : null;
}

const rows = [];
for (const p of patterns) {
  const qs = await get("quests?title=ilike."+p+"%25&select=id,title,stage&order=title");
  for (const q of qs) {
    const num = (q.title.match(/^(\d+)/)||[])[1] || "?";
    const items = await get("items?quest_id=eq."+q.id+"&select=id,item_key,expectation,url&order=item_key");
    for (const it of items) {
      const ic = await get("item_comments?item_id=eq."+it.id+"&select=text,actor_name,created_at&order=created_at.asc");
      const layers = {
        v2_mini: null,
        v3_4o: null,
        v4_calibrated: null,
        cross_4turbo: null,
        cross_opus: null,
      };
      for (const c of ic) {
        if (c.text.includes("[Vision/text-judge 2026-04-26 v2]")) layers.v2_mini = extractVerdict(c.text, "v2");
        else if (c.text.includes("[Judge gpt-4o 2026-04-26 v3]")) layers.v3_4o = extractVerdict(c.text, "v3");
        else if (c.text.includes("[Judge gpt-4o calibrated 2026-04-26 v4]")) layers.v4_calibrated = extractVerdict(c.text, "v4");
        // gpt-4-turbo cross-check (uses different actor_name in script)
        if (c.actor_name && c.actor_name.includes("Cross-check (claude")) layers.cross_opus = extractVerdict(c.text, "");
      }
      const key = "q"+num.padStart(2,"0")+"/"+it.item_key;
      const truth = myGroundTruth[key] || "right";
      rows.push({ key, quest: q.title, item_key: it.item_key, truth, ...layers });
    }
  }
}

// Print per-item table
console.log("# | Item                                          | Truth | v2-mini       | v3-4o         | v4-calibrated | claude-opus");
console.log("-".repeat(140));
for (const r of rows) {
  console.log([
    r.key.padEnd(56),
    r.truth.padEnd(5),
    (r.v2_mini||"-").padEnd(13),
    (r.v3_4o||"-").padEnd(13),
    (r.v4_calibrated||"-").padEnd(13),
    (r.cross_opus||"-").padEnd(13),
  ].join(" | "));
}

// Aggregate effectiveness
console.log("\n=== AGGREGATE LAYER ATTRIBUTION ===");
const layers = ["v2_mini", "v3_4o", "v4_calibrated"];
for (const L of layers) {
  let TP = 0, TN = 0, FP = 0, FN = 0; // wrt wrong = positive
  let none = 0;
  for (const r of rows) {
    const v = r[L];
    if (!v || v === "skip" || v === "error") { none++; continue; }
    const flagged = v === "mismatch" || v === "inconclusive";
    const wrong = r.truth === "wrong";
    if (flagged && wrong) TP++;
    else if (flagged && !wrong) FP++;
    else if (!flagged && wrong) FN++;
    else TN++;
  }
  const total = rows.length;
  const judged = total - none;
  console.log(`\nLayer: ${L}`);
  console.log(`  judged ${judged}/${total} items`);
  console.log(`  caught (flagged wrong items): ${TP} of ${rows.filter(r=>r.truth==='wrong').length} known-wrong`);
  console.log(`  false alarms (flagged right items): ${FP}`);
  console.log(`  let through (passed wrong items): ${FN}`);
  console.log(`  correctly passed right items: ${TN}`);
}

// Specific look at the 2 known-wrong items
console.log("\n=== KNOWN-WRONG ITEMS — layer-by-layer ===");
const wrongRows = rows.filter(r => r.truth === "wrong");
for (const r of wrongRows) {
  console.log(`\n${r.key} (${r.item_key})`);
  console.log(`  v2 gpt-4o-mini:    ${r.v2_mini || "(no verdict)"}`);
  console.log(`  v3 gpt-4o:         ${r.v3_4o || "(no verdict)"}`);
  console.log(`  v4 calibrated:     ${r.v4_calibrated || "(no verdict)"}`);
}
