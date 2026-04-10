import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Env var snapshot passed to each agent as its environment
// ---------------------------------------------------------------------------
function buildEnvSnapshot() {
  const KEYS = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRETE_KEY",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "SITE_URL",
    "GOOGLE_ID",
    "GOOGLE_SECRET",
    "ASANA_ACCESS_TOKEN",
    "EDEN_AI_API_KEY",
    "ELEVENLABS_API_KEY",
    "STRIPE_PUBLIC_KEY",
    "STRIPE_SECRET_KEY",
    "CRON_SECRET",
  ];
  const env = {};
  for (const k of KEYS) {
    if (process.env[k]) env[k] = process.env[k];
  }
  return env;
}

// ---------------------------------------------------------------------------
// Cursor Cloud Agent
// Docs: https://cursor.com/docs/cloud-agent/api/endpoints
// OpenAPI spec: https://cursor.com/docs-static/cloud-agents-openapi.yaml
// Auth: Basic auth — base64(apiKey + ":") in the Authorization header
// ---------------------------------------------------------------------------
const CURSOR_BASE = "https://api.cursor.com";

function cursorHeaders(apiKey) {
  const encoded = Buffer.from(`${apiKey}:`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

const CURSOR_SETUP_HINT =
  "Verify the Cursor GitHub App is installed on this repo/org. Call GET /api/cloud_agents?action=listRepos to see repos the app can access. Set CURSOR_BRANCH if your default branch is not main. Intermittent branch errors are often Cursor/GitHub token issues — retry later.";

async function cursorSetup({ cursorRepository, cursorRef } = {}) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "CURSOR_API_KEY not found in .env.local. Add it to enable Cursor Cloud Agent testing.",
    };
  }
  const repoFromBody = typeof cursorRepository === "string" && cursorRepository.trim() !== "";
  const repoUrl = process.env.CURSOR_REPO_URL;
  const repoSlug = process.env.CURSOR_REPO;

  let repo;
  let ref;
  if (repoFromBody) {
    repo = cursorRepository.trim();
    ref =
      typeof cursorRef === "string" && cursorRef.trim() !== ""
        ? cursorRef.trim()
        : "main";
  } else if (repoUrl || repoSlug) {
    repo = repoUrl ?? `https://github.com/${repoSlug}`;
    ref = process.env.CURSOR_BRANCH ?? "main";
  } else {
    return {
      ok: false,
      error:
        "Set CURSOR_REPO_URL (https://github.com/org/repo) or CURSOR_REPO (org/repo) in .env.local, or pass cursorRepository (and optional cursorRef) in the request body.",
    };
  }

  // POST /v0/agents — launches a new cloud agent run
  // source.repository: full GitHub HTTPS URL; ref avoids flaky default-branch detection on Cursor's side
  const res = await fetch(`${CURSOR_BASE}/v0/agents`, {
    method: "POST",
    headers: cursorHeaders(apiKey),
    body: JSON.stringify({
      prompt: { text: "Agent initialized. Acknowledge setup and confirm you are ready." },
      model: "default",
      source: { repository: repo, ref },
      target: { autoCreatePr: false },
    }),
  });
  const data = await res.json().catch(() => ({}));
  const sessionId = data.id ?? null;
  const viewUrl = data.target?.url ?? `https://cursor.com/agents?id=${sessionId}`;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      sessionId,
      viewUrl,
      data,
      hint: CURSOR_SETUP_HINT,
    };
  }
  return { ok: true, status: res.status, sessionId, viewUrl, data };
}

async function cursorMessage({ sessionId }) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) return { ok: false, error: "CURSOR_API_KEY not set." };
  if (!sessionId) return { ok: false, error: "No session. Run Setup first." };
  // POST /v0/agents/{id}/followup — add a follow-up instruction to an existing agent
  const res = await fetch(`${CURSOR_BASE}/v0/agents/${sessionId}/followup`, {
    method: "POST",
    headers: cursorHeaders(apiKey),
    body: JSON.stringify({ prompt: { text: "calculate 8*9" } }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Cursor returns chat on GET /v0/agents/{id}/conversation, not on GET /v0/agents/{id}. */
function cursorConversationMessages(convBody) {
  if (!convBody || typeof convBody !== "object") return [];
  const raw =
    convBody.messages ??
    convBody.data ??
    convBody.conversation?.messages ??
    (Array.isArray(convBody) ? convBody : null);
  return Array.isArray(raw) ? raw : [];
}

function cursorMessagePlainText(msg) {
  if (!msg || typeof msg !== "object") return "";
  if (typeof msg.text === "string") return msg.text;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object" && typeof b.text === "string") return b.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function cursorLatestAssistantText(messages) {
  const isAssistant = (m) => {
    const r = String(m.role ?? m.type ?? "").toLowerCase();
    return r === "assistant" || r === "model" || r === "agent";
  };
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isAssistant(messages[i])) {
      const t = cursorMessagePlainText(messages[i]);
      if (t) return t;
    }
  }
  if (messages.length > 0) {
    const t = cursorMessagePlainText(messages[messages.length - 1]);
    if (t) return t;
  }
  return null;
}

async function cursorFetch({ sessionId }) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) return { ok: false, error: "CURSOR_API_KEY not set." };
  if (!sessionId) return { ok: false, error: "No session. Run Setup first." };
  // GET /v0/agents/{id} — status + metadata (no chat body)
  // GET /v0/agents/{id}/conversation — user/assistant messages (see Cursor Cloud Agents API)
  const [agentRes, convRes] = await Promise.all([
    fetch(`${CURSOR_BASE}/v0/agents/${sessionId}`, { headers: cursorHeaders(apiKey) }),
    fetch(`${CURSOR_BASE}/v0/agents/${sessionId}/conversation`, { headers: cursorHeaders(apiKey) }),
  ]);
  const data = await agentRes.json().catch(() => ({}));
  const conversationBody = await convRes.json().catch(() => ({}));
  const messages = cursorConversationMessages(conversationBody);
  const latestAssistantText = cursorLatestAssistantText(messages);

  return {
    ok: agentRes.ok,
    status: agentRes.status,
    data,
    conversationFetch: {
      ok: convRes.ok,
      status: convRes.status,
    },
    conversation: conversationBody,
    messages,
    latestAssistantText,
    hint:
      !convRes.ok
        ? "Could not load GET /v0/agents/{id}/conversation; chat text may be unavailable for this agent or API version."
        : messages.length === 0
          ? "Conversation is empty yet — wait for the agent to finish, then fetch again."
          : undefined,
  };
}

async function cursorListRepos() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) return { ok: false, error: "CURSOR_API_KEY not set." };
  // GET /v0/repositories — list repos the Cursor GitHub App can access
  const res = await fetch(`${CURSOR_BASE}/v0/repositories`, {
    headers: cursorHeaders(apiKey),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Anthropic Managed Agents — Sessions API (beta)
// Docs: https://platform.claude.com/docs/en/api/beta/sessions
// This route calls GET /v1/agents + POST /v1/sessions (developer API). That is NOT the same
// as clicking “New session” in the Claude Code consumer UI (claude.ai/code): those UIs do
// not populate GET /v1/agents. Managed agent definitions are created under Console → Agents.
// ---------------------------------------------------------------------------
const CLAUDE_BASE = "https://api.anthropic.com";
const CLAUDE_HEADERS = () => ({
  "X-Api-Key": process.env.ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "managed-agents-2026-04-01",
  "Content-Type": "application/json",
});

/** Managed Agents session metadata: max 16 keys, values ≤512 chars — no secrets. */
function buildClaudeSessionMetadata() {
  const keys = ["NEXT_PUBLIC_SITE_URL", "SITE_URL"];
  const meta = {};
  for (const k of keys) {
    const v = process.env[k];
    if (v && typeof v === "string") {
      meta[k] = v.length > 512 ? v.slice(0, 512) : v;
    }
  }
  return Object.keys(meta).length ? meta : undefined;
}

async function claudeResolveEnvironmentId() {
  const res = await fetch(`${CLAUDE_BASE}/v1/environments`, { headers: CLAUDE_HEADERS() });
  const data = await res.json().catch(() => ({}));
  const list = Array.isArray(data.data) ? data.data : [];
  if (!res.ok) {
    return {
      ok: false,
      error: "Failed to list environments from the Anthropic API.",
      status: res.status,
      data,
    };
  }
  if (list.length === 0) {
    return {
      ok: false,
      error:
        "No environments on this Anthropic organization. Create at least one in Claude Console so GET /v1/environments returns a row.",
      data,
    };
  }
  return { ok: true, environmentId: list[0].id, source: "first_from_list" };
}

async function claudeSetup() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not found in .env.local." };

  const agentRes = await fetch(`${CLAUDE_BASE}/v1/agents`, { headers: CLAUDE_HEADERS() });
  const agentData = await agentRes.json().catch(() => ({}));
  const agents = Array.isArray(agentData.data) ? agentData.data : [];

  if (!agentRes.ok) {
    return {
      ok: false,
      error:
        "Could not list managed agents. Check ANTHROPIC_API_KEY, managed-agents beta access, and that the key belongs to the same org as Claude Console.",
      agentListStatus: agentRes.status,
      agentListResponse: agentData,
    };
  }

  if (agents.length === 0) {
    return {
      ok: false,
      error:
        "GET /v1/agents returned zero managed agent configs for this API key. This proving-grounds step does not use the claude.ai/code “New session” UI.",
      agentCount: 0,
      agentListResponse: agentData,
      hint:
        "Managed agents are created in the developer console (https://platform.claude.com → Agents), not by starting a session in the Claude Code web app. Use an API key from the same Anthropic organization as that console. Then GET /v1/agents will list rows and Setup can create a session.",
    };
  }

  const envResolve = await claudeResolveEnvironmentId();
  if (!envResolve.ok) {
    return { ok: false, ...envResolve };
  }

  const agent = agents[0];
  const metadata = buildClaudeSessionMetadata();
  const sessionBody = {
    agent: agent.id,
    environment_id: envResolve.environmentId,
    ...(metadata ? { metadata } : {}),
  };

  const sessionRes = await fetch(`${CLAUDE_BASE}/v1/sessions`, {
    method: "POST",
    headers: CLAUDE_HEADERS(),
    body: JSON.stringify(sessionBody),
  });
  const sessionData = await sessionRes.json().catch(() => ({}));
  const sessionId = sessionData.id ?? null;

  return {
    ok: sessionRes.ok,
    status: sessionRes.status,
    sessionId,
    agentUsed: { id: agent.id, name: agent.name },
    environmentUsed: { id: envResolve.environmentId, source: envResolve.source },
    viewUrl: "https://claude.ai/code",
    data: sessionData,
  };
}

async function claudeMessage({ sessionId }) {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "ANTHROPIC_API_KEY not set." };
  if (!sessionId) return { ok: false, error: "No session. Run Setup first." };

  const res = await fetch(`${CLAUDE_BASE}/v1/sessions/${sessionId}/events`, {
    method: "POST",
    headers: CLAUDE_HEADERS(),
    body: JSON.stringify({
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: "calculate 8*9" }],
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function claudeNormalizeEvents(data) {
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.events)) return data.events;
  if (Array.isArray(data)) return data;
  return [];
}

async function claudeFetch({ sessionId }) {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "ANTHROPIC_API_KEY not set." };
  if (!sessionId) return { ok: false, error: "No session. Run Setup first." };

  const res = await fetch(`${CLAUDE_BASE}/v1/sessions/${sessionId}/events`, {
    headers: CLAUDE_HEADERS(),
  });
  const data = await res.json().catch(() => ({}));
  const events = claudeNormalizeEvents(data);
  const agentMessages = events.filter((e) => e.type === "agent.message");
  const latest = agentMessages[agentMessages.length - 1] ?? null;
  return { ok: res.ok, status: res.status, latestMessage: latest, eventCount: events.length, data };
}

// ---------------------------------------------------------------------------
// OpenAI Codex — cloud delegation via Responses API
// Docs: https://developers.openai.com/codex/ide/features#cloud-delegation
// ---------------------------------------------------------------------------
async function codexSetup() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY not found in .env.local." };

  const env = buildEnvSnapshot();
  const envLine = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "o4-mini",
      input: [
        {
          role: "system",
          content: `You are a cloud coding agent. The following environment variables are available:\n\n${envLine}\n\nReady to receive coding tasks.`,
        },
        {
          role: "user",
          content: "Agent initialized. Acknowledge setup and confirm you are ready.",
        },
      ],
      store: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  const sessionId = data.id ?? null;
  const viewUrl = sessionId
    ? `https://platform.openai.com/responses/${sessionId}`
    : "https://platform.openai.com/responses";
  return { ok: res.ok, status: res.status, sessionId, viewUrl, data };
}

async function codexMessage({ sessionId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY not set." };
  if (!sessionId) return { ok: false, error: "No session. Run Setup first." };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "o4-mini",
      previous_response_id: sessionId,
      input: [{ role: "user", content: "calculate 8*9" }],
      store: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  const runId = data.id ?? null;
  return { ok: res.ok, status: res.status, runId, data };
}

async function codexFetch({ sessionId, runId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY not set." };
  const targetId = runId || sessionId;
  if (!targetId) return { ok: false, error: "No run ID. Run Setup and Calculate first." };

  const res = await fetch(`https://api.openai.com/v1/responses/${targetId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json().catch(() => ({}));
  const outputText =
    data.output?.find?.((o) => o.type === "message")?.content
      ?.find?.((c) => c.type === "output_text")?.text ?? null;
  return { ok: res.ok, status: res.status, outputText, data };
}

// ---------------------------------------------------------------------------
// Env check
// ---------------------------------------------------------------------------
function checkEnv() {
  return {
    env: {
      CURSOR_API_KEY: !!process.env.CURSOR_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    },
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  if (action === "checkEnv") return NextResponse.json(checkEnv());
  if (action === "listRepos") return NextResponse.json(await cursorListRepos());
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, sessionId, runId, cursorRepository, cursorRef } = body;

  try {
    let result;
    switch (action) {
      case "cursor_setup":
        result = await cursorSetup({ cursorRepository, cursorRef });
        break;
      case "cursor_message": result = await cursorMessage({ sessionId }); break;
      case "cursor_fetch":   result = await cursorFetch({ sessionId }); break;
      case "claude_setup":   result = await claudeSetup(); break;
      case "claude_message": result = await claudeMessage({ sessionId }); break;
      case "claude_fetch":   result = await claudeFetch({ sessionId }); break;
      case "codex_setup":    result = await codexSetup(); break;
      case "codex_message":  result = await codexMessage({ sessionId }); break;
      case "codex_fetch":    result = await codexFetch({ sessionId, runId }); break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[cloud_agents] [${action}] error:`, err);
    return NextResponse.json({ ok: false, error: err.message || "Unexpected error" }, { status: 500 });
  }
}
