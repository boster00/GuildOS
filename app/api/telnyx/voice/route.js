/**
 * Telnyx TeXML voice webhook — single endpoint that handles both the initial
 * call greeting (Gather) and the digit-collected branch (Dial). Telnyx POSTs
 * standard TeXML form-encoded fields; on the first invocation `Digits` is
 * empty, on the gather callback it carries the pressed digit.
 *
 * Configured as the voice_url of a TeXML Application; that app is then assigned
 * to the bought DID. Forwarding target is hardcoded for the MVP — promote to
 * env or per-tenant config when generalizing.
 */

const FORWARD_TO = "+15105022247";

function texml(xml) {
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

async function handle(request) {
  const url = new URL(request.url);
  const action = `${url.origin}${url.pathname}`;

  let digits = "";
  let callerId = "";
  if (request.method === "POST") {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await request.formData();
      digits = String(form.get("Digits") || "");
      callerId = String(form.get("To") || "");
    } else if (ct.includes("application/json")) {
      const j = await request.json().catch(() => ({}));
      digits = String(j.Digits || j.digits || "");
      callerId = String(j.To || j.to || "");
    }
  }

  if (digits === "1") {
    return texml(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to the operator now.</Say>
  <Dial${callerId ? ` callerId="${callerId}"` : ""} timeout="25">${FORWARD_TO}</Dial>
</Response>`
    );
  }

  if (digits) {
    return texml(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">That option is not available. Goodbye.</Say>
  <Hangup/>
</Response>`
    );
  }

  return texml(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${action}" method="POST" timeout="6">
    <Say voice="Polly.Joanna">This is Boster Bio. To speak with the operator, press 1.</Say>
  </Gather>
  <Say voice="Polly.Joanna">We didn't receive any input. Goodbye.</Say>
  <Hangup/>
</Response>`
  );
}

export const GET = handle;
export const POST = handle;
