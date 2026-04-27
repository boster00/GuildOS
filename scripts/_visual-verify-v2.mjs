const KEY = process.env.SUPABASE_SECRETE_KEY;
const SUP = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OAI = process.env.OPENAI_API_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function get(p) { const r = await fetch(SUP+'/rest/v1/'+p, { headers: H }); return r.json(); }
async function patch(p, body) { const r = await fetch(SUP+'/rest/v1/'+p, { method:'PATCH', headers:{...H, Prefer:'return=representation'}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }
async function post(p, body) { const r = await fetch(SUP+'/rest/v1/'+p, { method:'POST', headers:{...H, Prefer:'return=representation'}, body: JSON.stringify(body) }); return [r.status, await r.json()]; }

const isImage = u => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u||'');
const isDoc = u => /\.(md|json|txt|csv|html?|log)(\?|$)/i.test(u||'');

async function judgeImage(url, claim) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer '+OAI, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', response_format: {type:'json_object'},
      messages: [
        { role: 'system', content: 'Strict image judge. Respond JSON {"verdict":"match|mismatch|inconclusive","confidence":0-1,"reasoning":"1-2 sentences"}.' },
        { role: 'user', content: [{type:'text',text:'Claim: '+claim},{type:'image_url',image_url:{url,detail:'low'}}] }
      ]})
  });
  if (!r.ok) throw new Error('OAI '+r.status);
  return JSON.parse((await r.json()).choices[0].message.content);
}
async function judgeText(url, claim) {
  const f = await fetch(url);
  if (!f.ok) throw new Error('fetch_'+f.status);
  const ct = f.headers.get('content-type')||'';
  const body = (await f.text()).slice(0, 12000); // cap
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer '+OAI, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', response_format: {type:'json_object'},
      messages: [
        { role: 'system', content: 'You are a strict document verification judge. Given a CLAIM and the DOCUMENT CONTENTS, decide if the document substantively delivers what the claim describes. Respond JSON {"verdict":"match|mismatch|inconclusive","confidence":0-1,"reasoning":"1-2 sentences citing specific phrases from the doc"}.' },
        { role: 'user', content: 'CLAIM:\n'+claim+'\n\nDOCUMENT CONTENTS (content-type: '+ct+', truncated to 12K chars):\n'+body }
      ]})
  });
  if (!r.ok) throw new Error('OAI '+r.status);
  return JSON.parse((await r.json()).choices[0].message.content);
}

const patterns = ['1.%20', '2.%20', '3.%20', '4.%20', '5.%20', '6.%20', '7.%20', '8.%20', '9.%20', '10.%20', '11.%20', '12.%20', '13.%20'];
const results = [];

for (const p of patterns) {
  const qs = await get('quests?title=ilike.'+p+'%25&select=id,title,stage&order=title');
  for (const q of qs) {
    const items = await get('items?quest_id=eq.'+q.id+'&select=id,item_key,expectation,url&order=item_key');
    const verdicts = [];
    for (const it of items) {
      if (!it.url || !it.expectation) { verdicts.push({ ik: it.item_key, kind: 'skip', verdict: 'skip', reason: !it.url?'no_url':'no_expectation' }); continue; }
      const url = it.url;
      let kind, judgeFn;
      if (isImage(url)) { kind = 'image'; judgeFn = judgeImage; }
      else if (isDoc(url)) { kind = 'doc'; judgeFn = judgeText; }
      else { kind = 'unknown'; judgeFn = judgeText; }
      try {
        const j = await judgeFn(url, it.expectation);
        verdicts.push({ ik: it.item_key, kind, ...j });
      } catch (e) { verdicts.push({ ik: it.item_key, kind, verdict: 'error', reason: e.message.slice(0,150) }); }
    }
    const total = items.length;
    const passes = verdicts.filter(v => v.verdict === 'match').length;
    const fails = verdicts.filter(v => v.verdict === 'mismatch').length;
    const others = total - passes - fails;
    const imgs = verdicts.filter(v=>v.kind==='image').length;
    const docs = verdicts.filter(v=>v.kind==='doc'||v.kind==='unknown').length;
    console.log([q.title.slice(0,38).padEnd(38), q.stage.padEnd(9), `pass=${passes}/${total}`, `fail=${fails}`, `imgs=${imgs}`, `docs=${docs}`].join(' | '));
    verdicts.forEach(v => console.log(`   [${v.kind.padEnd(7)}|${v.verdict.padEnd(13)}] ${(v.confidence||'').toString().padStart(4)} ${v.ik.padEnd(30)} :: ${(v.reasoning||v.reason||'').slice(0,90)}`));
    results.push({ q, items, verdicts, passes, fails, others, total, imgs, docs });
  }
}

console.log('\n--- updating descriptions (truthful, image+doc breakdown) ---');
for (const r of results) {
  const stagePhrase = r.q.stage === 'review' ? 'in the review stage' : (r.q.stage === 'escalated' ? 'in the escalated stage' : 'in stage='+r.q.stage);
  let desc;
  if (r.passes === r.total && r.total > 0) {
    const breakdown = r.docs > 0 ? `${r.imgs} screenshots + ${r.docs} docs` : `${r.passes} screenshots`;
    desc = `Quest ${stagePhrase} with ${r.passes} deliverables (${breakdown}) verified by gpt-4o-mini judge against item expectations and ready for user to review.`;
  } else {
    desc = `Quest ${stagePhrase} with ${r.passes}/${r.total} deliverables verified by gpt-4o-mini judge (${r.fails} mismatch, ${r.others - (r.total - r.passes - r.fails)} other gaps); not ready until ${r.total - r.passes} item(s) addressed. See item_comments for per-item verdicts.`;
  }
  if (r.q.stage === 'escalated') {
    desc = `Quest ${stagePhrase} (user-only blocker). ${r.passes} of ${r.total} deliverables verified by gpt-4o-mini judge against item expectations.`;
  }
  await patch('quests?id=eq.'+r.q.id, { description: desc });
  for (let i = 0; i < r.items.length; i++) {
    const v = r.verdicts[i]; const it = r.items[i];
    if (v.verdict === 'skip') continue;
    const text = `[Vision/text-judge 2026-04-26 v2] kind=${v.kind} verdict=${v.verdict}${v.confidence!=null?` confidence=${v.confidence}`:''}: ${(v.reasoning||v.reason||'').slice(0,500)}`;
    await post('item_comments', [{ item_id: it.id, role: 'questmaster', actor_name: 'Cat (judge v2)', text }]);
  }
}

console.log('\n--- final summary ---');
for (const r of results) {
  const num = (r.q.title.match(/^(\d+)/)||[])[1] || '?';
  const status = r.q.stage === 'escalated' ? '⚠️ escalated' : (r.passes === r.total ? '✅ all-pass' : '❌ '+r.passes+'/'+r.total);
  console.log(`${status.padEnd(15)} #${num.padStart(2)} ${r.q.title.slice(0,40).padEnd(40)} pass=${r.passes}/${r.total}`);
}
