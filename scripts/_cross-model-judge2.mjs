const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OAI = process.env.OPENAI_API_KEY;
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }
async function post(p, body) { const r = await fetch(SUP+"/rest/v1/"+p, { method:"POST", headers:{...H, Prefer:"return=representation"}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }
const isImage = u => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u||"");

async function judge4turbo(url, claim, isImg) {
  let messages;
  if (isImg) {
    messages = [
      { role: "system", content: "You are a strict deliverable verification judge. Be reasonable about phrasing. Respond ONLY in JSON: {\"verdict\":\"match|mismatch|inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences\"}" },
      { role: "user", content: [{type:"text",text:"CLAIM: "+claim},{type:"image_url",image_url:{url,detail:"high"}}] }
    ];
  } else {
    const f = await fetch(url); if (!f.ok) throw new Error("fetch_"+f.status);
    const body = (await f.text()).slice(0, 30000);
    messages = [
      { role: "system", content: "You are a strict deliverable verification judge for documents. Respond ONLY in JSON: {\"verdict\":\"match|mismatch|inconclusive\",\"confidence\":0-1,\"reasoning\":\"1-2 sentences\"}" },
      { role: "user", content: "CLAIM:\n"+claim+"\n\nDOC:\n"+body }
    ];
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer "+OAI, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4-turbo", response_format: {type:"json_object"}, messages })
  });
  if (!r.ok) throw new Error("oai_"+r.status+": "+(await r.text()).slice(0,150));
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
      if (!it.url || !it.expectation) { verdicts.push({ ik: it.item_key, verdict: "skip" }); continue; }
      try {
        const j = await judge4turbo(it.url, it.expectation, isImage(it.url));
        verdicts.push({ ik: it.item_key, ...j });
      } catch (e) { verdicts.push({ ik: it.item_key, verdict: "error", reason: e.message.slice(0,150) }); }
    }
    const total = items.length;
    const passes = verdicts.filter(v => v.verdict === "match").length;
    const fails = verdicts.filter(v => v.verdict === "mismatch").length;
    const others = total - passes - fails;
    console.log([q.title.slice(0,38).padEnd(38), q.stage.padEnd(9), "pass="+passes+"/"+total, "fail="+fails, "other="+others].join(" | "));
    verdicts.forEach(v => { if (v.verdict !== "match" && v.verdict !== "skip") console.log("   ["+v.verdict.padEnd(13)+"] "+(v.confidence||"").toString().padStart(4)+" "+v.ik.padEnd(30)+" :: "+(v.reasoning||v.reason||"").slice(0,120)); });
    results.push({ q, items, verdicts, passes, fails, others, total });
  }
}

console.log("\n=== AGREEMENT WITH gpt-4o ===");
let total = 0, agreed = 0, disagree = 0;
const disagreements = [];
for (const r of results) {
  for (let i = 0; i < r.items.length; i++) {
    const v = r.verdicts[i];
    if (v.verdict === "skip" || v.verdict === "error") continue;
    total++;
    if (v.verdict === "match") agreed++;
    else { disagree++; disagreements.push({ q: r.q.title, ik: r.items[i].item_key, v }); }
  }
}
console.log("Total comparable: " + total);
console.log("Agreement (gpt-4-turbo also says match): " + agreed + " (" + Math.round(agreed/total*100) + "%)");
console.log("Disagreements (gpt-4-turbo says NOT match): " + disagree);
disagreements.forEach(d => console.log("  "+d.q+" | "+d.ik+" → "+d.v.verdict+" (conf "+d.v.confidence+"): "+(d.v.reasoning||"").slice(0,150)));
