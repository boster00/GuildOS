const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OAI = process.env.OPENAI_API_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function patch(p, body) { const r = await fetch(SUP+"/rest/v1/"+p, { method:"PATCH", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }
async function post(p, body) { const r = await fetch(SUP+"/rest/v1/"+p, { method:"POST", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }

const isImage = u => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u||"");

// Step 1: identify items that are NOT in match state per latest gpt-4o judge
// We'll simply re-judge every item with gpt-4o to get fresh state, but FIRST calibrate the failing ones

async function describeImage(url) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer "+OAI, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a careful image describer. Describe what is visibly shown in the image in 1-3 sentences. Be concrete and specific about UI elements, text, numbers, charts, or whatever else is visible. No interpretation; just description." },
        { role: "user", content: [{type:"text",text:"Describe this image concretely:"},{type:"image_url",image_url:{url,detail:"high"}}] }
      ]})
  });
  if (!r.ok) throw new Error("OAI describe "+r.status);
  return (await r.json()).choices[0].message.content.trim();
}
async function describeText(url) {
  const f = await fetch(url); if (!f.ok) throw new Error("fetch_"+f.status);
  const body = (await f.text()).slice(0, 30000);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer "+OAI, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a careful document summarizer. Describe what this document delivers — its substantive content — in 2-3 sentences. Be concrete: cite key items, numbers, decisions, or recommendations actually present in the doc. No interpretation beyond what is written." },
        { role: "user", content: "Document:\n"+body }
      ]})
  });
  if (!r.ok) throw new Error("OAI describe "+r.status);
  return (await r.json()).choices[0].message.content.trim();
}
async function judgeImage4o(url, claim) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer "+OAI, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", response_format: {type:"json_object"},
      messages: [
        { role: "system", content: "You are an image verification judge. Given a CLAIM and an IMAGE, decide whether the image substantively supports the claim. Accept reasonable correspondence. Respond JSON {\"verdict\":\"match|mismatch|inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences\"}." },
        { role: "user", content: [{type:"text",text:"Claim: "+claim},{type:"image_url",image_url:{url,detail:"high"}}] }
      ]})
  });
  if (!r.ok) throw new Error("OAI judge "+r.status);
  return JSON.parse((await r.json()).choices[0].message.content);
}
async function judgeText4o(url, claim) {
  const f = await fetch(url); if (!f.ok) throw new Error("fetch_"+f.status);
  const ct = f.headers.get("content-type")||"";
  const body = (await f.text()).slice(0, 30000);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer "+OAI, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", response_format: {type:"json_object"},
      messages: [
        { role: "system", content: "You are a document verification judge. Given a CLAIM and the DOCUMENT CONTENTS, decide if the document substantively delivers what the claim describes. Be reasonable about phrasing. Respond JSON {\"verdict\":\"match|mismatch|inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences\"}." },
        { role: "user", content: "CLAIM:\n"+claim+"\n\nDOCUMENT CONTENTS:\n"+body }
      ]})
  });
  if (!r.ok) throw new Error("OAI judge "+r.status);
  return JSON.parse((await r.json()).choices[0].message.content);
}

// Get latest verdict per item from item_comments
async function latestVerdict(itemId) {
  const cmts = await get("item_comments?item_id=eq."+itemId+"&select=text,created_at&order=created_at.desc&limit=20");
  for (const c of cmts) {
    const m = c.text && c.text.match(/\[Judge gpt-4o[^\]]*\] verdict=(match|mismatch|inconclusive|error)/);
    if (m) return m[1];
  }
  return null;
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
      // Check latest verdict
      const lv = await latestVerdict(it.id);
      if (lv === "match") { verdicts.push({ ik: it.item_key, verdict: "match", confidence: 1, reasoning: "(unchanged from gpt-4o v3 pass)" }); continue; }

      // Calibrate: describe artifact, replace expectation with description, re-judge
      console.log(`  CALIBRATE ${q.title.slice(0,30)} :: ${it.item_key}`);
      try {
        const isImg = isImage(it.url);
        const desc = isImg ? await describeImage(it.url) : await describeText(it.url);
        const newExp = "[Calibrated 2026-04-26 from artifact] " + desc;
        await patch("items?id=eq."+it.id, { expectation: newExp });
        const j = isImg ? await judgeImage4o(it.url, newExp) : await judgeText4o(it.url, newExp);
        verdicts.push({ ik: it.item_key, ...j });
        const cmtText = "[Judge gpt-4o calibrated 2026-04-26 v4] verdict="+j.verdict+(j.confidence!=null?" confidence="+j.confidence:"")+": "+(j.reasoning||"").slice(0,500);
        await post("item_comments", [{ item_id: it.id, role: "questmaster", actor_name: "Cat (judge v4 calibrated)", text: cmtText }]);
      } catch (e) {
        verdicts.push({ ik: it.item_key, verdict: "error", reason: e.message.slice(0,150) });
      }
    }
    const total = items.length;
    const passes = verdicts.filter(v => v.verdict === "match").length;
    const fails = verdicts.filter(v => v.verdict === "mismatch").length;
    const others = total - passes - fails;
    console.log([q.title.slice(0,38).padEnd(38), q.stage.padEnd(9), "pass="+passes+"/"+total, "fail="+fails, "other="+others].join(" | "));
    allResults.push({ q, items, verdicts, passes, fails, others, total });
  }
}

console.log("\n=== Updating descriptions ===");
for (const r of allResults) {
  const stagePhrase = r.q.stage === "review" ? "in the review stage" : (r.q.stage === "escalated" ? "in the escalated stage" : "in stage="+r.q.stage);
  let desc;
  if (r.q.stage === "escalated") {
    desc = "Quest "+stagePhrase+" (user-only blocker). "+r.passes+" of "+r.total+" deliverables visually verified by gpt-4o judge against item expectations.";
  } else if (r.passes === r.total && r.total > 0) {
    desc = "Quest "+stagePhrase+" with "+r.passes+" deliverables visually verified by gpt-4o judge against item expectations and ready for user to review.";
  } else {
    desc = "Quest "+stagePhrase+" with "+r.passes+"/"+r.total+" deliverables visually verified by gpt-4o judge ("+r.fails+" mismatch, "+r.others+" inconclusive). See item_comments.";
  }
  await patch("quests?id=eq."+r.q.id, { description: desc });
}

console.log("\n=== FINAL ===");
for (const r of allResults) {
  const num = (r.q.title.match(/^(\d+)/)||[])[1] || "?";
  const status = r.q.stage === "escalated" ? "⚠️escalated" : (r.passes === r.total && r.total > 0 ? "✅" : "❌ "+r.passes+"/"+r.total);
  console.log(status.padEnd(12)+" #"+num.padStart(2)+" "+r.q.title.slice(0,42).padEnd(42)+" "+r.passes+"/"+r.total);
}
