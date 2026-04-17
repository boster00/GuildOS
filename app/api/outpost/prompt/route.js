// Claude Outpost — pending prompt relay
// POST { prompt } to queue a message for injection into the next Claude.ai session.
// GET to consume it (extension polls this; prompt is cleared after first read).

let pendingPrompt = null;

export async function GET() {
  const prompt = pendingPrompt;
  pendingPrompt = null;
  return Response.json({ prompt });
}

export async function POST(request) {
  const body = await request.json();
  pendingPrompt = body.prompt ?? null;
  return Response.json({ ok: true });
}
