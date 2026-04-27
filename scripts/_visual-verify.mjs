const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OAI = process.env.OPENAI_API_KEY;
if (!OAI) { console.error('OPENAI_API_KEY missing'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function get(p) { const r = await fetch(SUP+'/rest/v1/'+p, { headers: H }); return r.json(); }
async function patch(p, body) { const r = await fetch(SUP+'/rest/v1/'+p, { method:'PATCH', headers:{...H, Prefer:'return=representation'}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }
async function post(p, body) { const r = await fetch(SUP+'/rest/v1/'+p, { method:'POST', headers:{...H, Prefer:'return=representation'}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }

async function judge(imageUrl, claim) {
  const body = {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a strict image verification judge. You will be given ONE image and ONE claim about what it shows. Your only job is to decide whether the image actually matches the claim. Be conservative: if you cannot confirm the claim from the image alone, return verdict="mismatch" or "inconclusive". Common failure modes: stock/generic image, blank/loading state, error/login page, placeholder text. Respond ONLY with JSON: { "verdict": "match" | "mismatch" | "inconclusive", "confidence": 0.0-1.0, "reasoning": "1-2 sentences" }' },
      { role: 'user', content: [
        { type: 'text', text: 'Claim about this image: ' + claim },
        { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
      ]}
    ]
  };
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer '+OAI, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('OpenAI '+r.status+': '+(await r.text()).slice(0,200));
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content);
}

const patterns = ['1.%20', '2.%20', '3.%20', '4.%20', '5.%20', '6.%20', '7.%20', '8.%20', '9.%20', '10.%20', '11.%20', '12.%20', '13.%20'];
const results = [];
for (const p of patterns) {
  const qs = await get('quests?title=ilike.'+p+'%25&select=id,title,stage&order=title');
  for (const q of qs) {
    const items = await get('items?quest_id=eq.'+q.id+'&select=id,item_key,expectation,url&order=item_key');
    const verdicts = [];
    for (const it of items) {
      if (!it.url) { verdicts.push({ item_key: it.item_key, verdict: 'skip', reason: 'no_url' }); continue; }
      if (!it.expectation) { verdicts.push({ item_key: it.item_key, verdict: 'skip', reason: 'no_expectation' }); continue; }
      try {
        const host = new URL(it.url).hostname;
        if (!host.includes('supabase')) {
          // Try anyway — gpt may handle public images. Fall through.
        }
        const j = await judge(it.url, it.expectation);
        verdicts.push({ item_key: it.item_key, verdict: j.verdict, confidence: j.confidence, reasoning: j.reasoning });
      } catch (e) {
        verdicts.push({ item_key: it.item_key, verdict: 'error', reason: e.message.slice(0,150) });
      }
    }
    const passes = verdicts.filter(v => v.verdict === 'match').length;
    const fails = verdicts.filter(v => v.verdict === 'mismatch').length;
    const incon = verdicts.filter(v => v.verdict === 'inconclusive' || v.verdict === 'error' || v.verdict === 'skip').length;
    const total = items.length;
    console.log([q.title.slice(0,38).padEnd(38), q.stage.padEnd(9), `pass=${passes}/${total}`, `fail=${fails}`, `other=${incon}`].join(' | '));
    verdicts.forEach(v => console.log('   ['+v.verdict.padEnd(13)+'] '+(v.confidence||'').toString().padStart(4)+' '+v.item_key.padEnd(30)+' :: '+(v.reasoning||v.reason||'').slice(0,90)));
    results.push({ quest: q, items, verdicts, passes, fails, incon, total });
  }
}

console.log('\n--- updating descriptions ---');
for (const r of results) {
  const stagePhrase = r.quest.stage === 'review' ? 'in the review stage' : (r.quest.stage === 'escalated' ? 'in the escalated stage' : 'in stage='+r.quest.stage);
  let desc;
  if (r.quest.stage === 'escalated') {
    desc = `Quest ${stagePhrase} (user-only blocker). ${r.passes} of ${r.total} screenshots visually verified by vision-judge against item expectations; deliverables present, blocker requires user action before final review.`;
  } else if (r.passes === r.total && r.total > 0) {
    desc = `Quest ${stagePhrase} with ${r.passes} screenshots visually verified by vision-judge against item expectations and ready for user to review.`;
  } else {
    desc = `Quest ${stagePhrase} with ${r.passes}/${r.total} screenshots visually verified by vision-judge; ${r.fails} mismatch, ${r.incon} skipped/inconclusive — see item_comments for per-item verdicts.`;
  }
  await patch('quests?id=eq.'+r.quest.id, { description: desc });
  for (let i = 0; i < r.items.length; i++) {
    const v = r.verdicts[i]; const it = r.items[i];
    if (v.verdict === 'skip') continue;
    const text = `[Vision-judge 2026-04-26] verdict=${v.verdict}${v.confidence!=null?` confidence=${v.confidence}`:''}: ${(v.reasoning||v.reason||'').slice(0,500)}`;
    await post('item_comments', [{ item_id: it.id, role: 'questmaster', actor_name: 'Cat (vision-judge)', text }]);
  }
}

console.log('\n--- summary ---');
for (const r of results) {
  const num = (r.quest.title.match(/^(\d+)/)||[])[1] || '?';
  const truly_done = r.quest.stage === 'escalated' ? '⚠️escalated' : (r.passes === r.total ? '✅' : '❌');
  console.log(`${truly_done} #${num.padStart(2)} ${r.quest.title.slice(0,40).padEnd(40)} ${r.passes}/${r.total} pass`);
}
