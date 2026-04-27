// Download every item's artifact for direct visual inspection.
import { writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
async function get(p) { const r = await fetch(SUP+"/rest/v1/"+p, { headers: H }); return r.json(); }

await mkdir("tmp_inspect", { recursive: true });

const patterns = ["1.%20", "2.%20", "3.%20", "4.%20", "5.%20", "6.%20", "7.%20", "8.%20", "9.%20", "10.%20", "11.%20", "12.%20", "13.%20"];
const manifest = [];
let counter = 0;

for (const p of patterns) {
  const qs = await get("quests?title=ilike."+p+"%25&select=id,title&order=title");
  for (const q of qs) {
    const num = (q.title.match(/^(\d+)/)||[])[1] || "?";
    const subtitle = q.title.replace(/^\d+\.\s*/, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 30);
    const items = await get("items?quest_id=eq."+q.id+"&select=id,item_key,expectation,url&order=item_key");
    for (const it of items) {
      counter++;
      if (!it.url) {
        manifest.push({ counter, quest_num: num, quest_title: q.title, item_key: it.item_key, expectation: it.expectation, url: null, file: null, status: "no_url" });
        continue;
      }
      const ext = (it.url.match(/\.(png|jpg|jpeg|gif|webp|md|json|html?|txt)/i) || ["", "bin"])[1].toLowerCase();
      const safe_key = it.item_key.replace(/[^a-zA-Z0-9-]+/g, "_");
      const file = `tmp_inspect/q${num.padStart(2,"0")}_${subtitle}__${safe_key}.${ext}`;
      try {
        const f = await fetch(it.url);
        if (!f.ok) { manifest.push({ counter, quest_num: num, quest_title: q.title, item_key: it.item_key, expectation: it.expectation, url: it.url, file, status: "fetch_"+f.status, bytes: 0 }); continue; }
        const buf = Buffer.from(await f.arrayBuffer());
        await writeFile(file, buf);
        manifest.push({ counter, quest_num: num, quest_title: q.title, item_key: it.item_key, expectation: it.expectation, url: it.url, file, status: "ok", bytes: buf.length, ext });
        console.log(`✓ #${counter} q${num} ${it.item_key} → ${file} (${buf.length}B)`);
      } catch (e) {
        manifest.push({ counter, quest_num: num, quest_title: q.title, item_key: it.item_key, expectation: it.expectation, url: it.url, file, status: "error: "+e.message.slice(0,80), bytes: 0 });
        console.log(`✗ #${counter} q${num} ${it.item_key} → ${e.message.slice(0,80)}`);
      }
    }
  }
}

await writeFile("tmp_inspect/_manifest.json", JSON.stringify(manifest, null, 2));
console.log(`\nDone. ${manifest.length} items processed; manifest at tmp_inspect/_manifest.json`);
console.log(`OK: ${manifest.filter(m => m.status === "ok").length}, errors: ${manifest.filter(m => m.status !== "ok").length}`);
