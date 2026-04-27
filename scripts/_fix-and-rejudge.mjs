const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OAI = process.env.OPENAI_API_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function patch(p, body) { const r = await fetch(SUP+"/rest/v1/"+p, { method:"PATCH", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }
async function post(p, body) { const r = await fetch(SUP+"/rest/v1/"+p, { method:"POST", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }
async function del(p) { const r = await fetch(SUP+"/rest/v1/"+p, { method:"DELETE", headers: H }); return r.status; }

const isImage = u => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u||"");

console.log("=== STEP 1: deleting junk items ===");
const stray = await get("items?item_key=eq.questId&select=id,caption,quest_id");
for (const s of stray) {
  if (s.caption === s.quest_id) {
    await del("item_comments?item_id=eq."+s.id);
    const st = await del("items?id=eq."+s.id);
    console.log("  DEL questId stray "+s.id.slice(0,8)+" status="+st);
  }
}
for (const legacyKey of ["delist_draft", "boster_guarantee_edit"]) {
  const legacy = await get("items?item_key=eq."+legacyKey+"&select=id,quest_id");
  for (const l of legacy) {
    const canonical = legacyKey === "delist_draft" ? "01-delist-draft" : "02-guarantee-edit";
    const peer = await get("items?quest_id=eq."+l.quest_id+"&item_key=eq."+canonical+"&select=id");
    if (peer.length) {
      await del("item_comments?item_id=eq."+l.id);
      const st = await del("items?id=eq."+l.id);
      console.log("  DEL legacy duplicate "+legacyKey+" on quest "+l.quest_id.slice(0,8)+" status="+st);
    } else {
      console.log("  KEEP "+legacyKey+" (no canonical peer)");
    }
  }
}

console.log("\n=== STEP 2: re-judging with gpt-4o ===");

async function judgeImage4o(url, claim) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer "+OAI, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", response_format: {type:"json_object"},
      messages: [
        { role: "system", content: "You are an image verification judge. Given a CLAIM and an IMAGE, decide whether the image substantively supports the claim. The image is a real-world deliverable from an engineering quest — accept reasonable correspondence between visible content and claim. Respond JSON {\"verdict\":\"match|mismatch|inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences\"}." },
        { role: "user", content: [{type:"text",text:"Claim: "+claim},{type:"image_url",image_url:{url,detail:"high"}}] }
      ]})
  });
  if (!r.ok) throw new Error("OAI "+r.status);
  return JSON.parse((await r.json()).choices[0].message.content);
}
async function judgeText4o(url, claim) {
  const f = await fetch(url);
  if (!f.ok) throw new Error("fetch_"+f.status);
  const ct = f.headers.get("content-type")||"";
  const body = (await f.text()).slice(0, 30000);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer "+OAI, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", response_format: {type:"json_object"},
      messages: [
        { role: "system", content: "You are a document verification judge. Given a CLAIM and the DOCUMENT CONTENTS, decide if the document substantively delivers what the claim describes. Be reasonable about phrasing — exact-string match not required. Respond JSON {\"verdict\":\"match|mismatch|inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences citing specific phrases from the doc\"}." },
        { role: "user", content: "CLAIM:\n"+claim+"\n\nDOCUMENT CONTENTS (content-type: "+ct+", truncated to 30K chars):\n"+body }
      ]})
  });
  if (!r.ok) throw new Error("OAI "+r.status);
  return JSON.parse((await r.json()).choices[0].message.content);
}

const patterns = ["1.%20", "2.%20", "3.%20", "4.%20", "5.%20", "6.%20", "7.%20", "8.%20", "9.%20", "10.%20", "11.%20", "12.%20", "13.%20"];
const results = [];

for (const p of patterns) {
  const qs = await get("quests?title=ilike."+p+"%25&select=id,title,stage&order=title");
  for (const q of qs) {
    const items = await get("items?quest_id=eq."+q.id+"&select=id,item_key,expectation,url&order=item_key");
    const verdicts = [];
    for (const it of items) {
      if (!it.url || !it.expectation) { verdicts.push({ ik: it.item_key, verdict: "skip", reason: !it.url?"no_url":"no_expectation" }); continue; }
      const fn = isImage(it.url) ? judgeImage4o : judgeText4o;
      try {
        const j = await fn(it.url, it.expectation);
        verdicts.push({ ik: it.item_key, ...j });
      } catch (e) { verdicts.push({ ik: it.item_key, verdict: "error", reason: e.message.slice(0,150) }); }
    }
    const total = items.length;
    const passes = verdicts.filter(v => v.verdict === "match").length;
    const fails = verdicts.filter(v => v.verdict === "mismatch").length;
    const others = total - passes - fails;
    console.log([q.title.slice(0,38).padEnd(38), q.stage.padEnd(9), "pass="+passes+"/"+total, "fail="+fails, "other="+others].join(" | "));
    verdicts.forEach(v => console.log("   ["+v.verdict.padEnd(13)+"] "+(v.confidence||"").toString().padStart(4)+" "+v.ik.padEnd(30)+" :: "+(v.reasoning||v.reason||"").slice(0,90)));
    results.push({ q, items, verdicts, passes, fails, others, total });
    for (let i = 0; i < items.length; i++) {
      const v = verdicts[i]; const it = items[i];
      if (v.verdict === "skip") continue;
      const text = "[Judge gpt-4o 2026-04-26 v3] verdict="+v.verdict+(v.confidence!=null?" confidence="+v.confidence:"")+": "+(v.reasoning||v.reason||"").slice(0,500);
      await post("item_comments", [{ item_id: it.id, role: "questmaster", actor_name: "Cat (judge v3 gpt-4o)", text }]);
    }
  }
}

console.log("\n=== STEP 3: updating descriptions ===");
for (const r of results) {
  const stagePhrase = r.q.stage === "review" ? "in the review stage" : (r.q.stage === "escalated" ? "in the escalated stage" : "in stage="+r.q.stage);
  let desc;
  if (r.q.stage === "escalated") {
    desc = "Quest "+stagePhrase+" (user-only blocker). "+r.passes+" of "+r.total+" deliverables visually verified by gpt-4o judge.";
  } else if (r.passes === r.total && r.total > 0) {
    desc = "Quest "+stagePhrase+" with "+r.passes+" deliverables visually verified by gpt-4o judge against item expectations and ready for user to review.";
  } else {
    desc = "Quest "+stagePhrase+" with "+r.passes+"/"+r.total+" deliverables visually verified by gpt-4o judge ("+r.fails+" mismatch, "+r.others+" inconclusive); "+(r.total - r.passes)+" item(s) not yet ready. See item_comments for per-item judge verdicts.";
  }
  await patch("quests?id=eq."+r.q.id, { description: desc });
}

console.log("\n=== FINAL TRUTH ===");
for (const r of results) {
  const num = (r.q.title.match(/^(\d+)/)||[])[1] || "?";
  const status = r.q.stage === "escalated" ? "⚠️escalated" : (r.passes === r.total && r.total > 0 ? "✅ all-pass" : "❌ "+r.passes+"/"+r.total);
  console.log(status.padEnd(15)+" #"+num.padStart(2)+" "+r.q.title.slice(0,42).padEnd(42)+" "+r.passes+"/"+r.total);
}
