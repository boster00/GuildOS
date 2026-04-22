/**
 * Cursor skill book — cloud agent dispatch, monitoring, and PPT generation.
 *
 * Wraps the cursor weapon for adventurer-level task dispatch, status checks,
 * and artifact retrieval. PPT generation is a first-class action dispatched
 * to cursor cloud agents.
 */
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";
import * as cursorWeapon from "@/libs/weapon/cursor/index.js";
import { getAdventurerExecutionContext } from "@/libs/adventurer/advance.js";

export const skillBook = {
  id: "cursor",
  title: "Cursor Cloud Agents",
  description:
    "Dispatch tasks to Cursor cloud agents, check status, read conversations, and generate PowerPoint presentations.",
  steps: [],
  toc: {
    dispatchTask: {
      description:
        "Send a task to a Cursor cloud agent via followup message. The agent receives the message and executes it autonomously. Always include explicit push instructions if code changes are expected.",
      input: {
        agentId: "string — Cursor agent ID (bc-XXXXXXXX-...)",
        instructions: "string — natural language task description. Describe WHAT to do and success criteria, not HOW.",
        model: "string — model to use (default: composer-2.0, the cheapest in-house model)",
      },
      output: {
        result: "object — Cursor API response",
        agentId: "string — the agent ID for followup",
      },
    },
    readStatus: {
      description:
        "Check the current status of a Cursor cloud agent. Returns whether the agent is active, idle, or finished.",
      input: {
        agentId: "string — Cursor agent ID",
      },
      output: {
        status: "string — agent status",
        agent: "object — full agent details",
      },
    },
    readConversation: {
      description:
        "Read the full conversation history of a Cursor cloud agent. Useful for reviewing what the agent did and extracting results.",
      input: {
        agentId: "string — Cursor agent ID",
      },
      output: {
        conversation: "array — conversation messages",
      },
    },
    dispatchPptGeneration: {
      description:
        "Dispatch a PowerPoint generation task to a Cursor cloud agent. The agent generates the PPT and uploads it to Supabase Storage. Describe the content in natural language — the agent decides tools and layout.",
      input: {
        agentId: "string — Cursor agent ID",
        topic: "string — PPT topic/title",
        slides: "string — description of desired slides (natural language)",
        questId: "string — quest ID for storage path (uploads to cursor_cloud/{questId}/)",
      },
      output: {
        result: "object — Cursor API response confirming dispatch",
        agentId: "string — agent ID for followup checks",
      },
    },
    cloudEnvironment: {
      description: "Reference: what a Cursor cloud agent session has available and cannot do.",
      howTo: `
**Runtime (from April 2026 agent interview):**
- Linux desktop with X11, DISPLAY=:1, 1920x1200 VNC — headed browsers WORK and are visible to the user via Cursor's desktop stream
- System Chrome at \`/usr/local/bin/google-chrome\` — prefer over bundled Playwright Chromium for headed browsing
- Node 22, Python 3.12, pnpm 10, ffmpeg, git, curl pre-installed
- No mouse/keyboard GUI API — use Playwright for all UI interaction
- Shared auth state: \`storageState\` from playwright/.auth/user.json enables Gmail, Zoho, Smartlead, Instantly, LinkedIn, Figma
- Filesystem persists within a session's lifetime but not guaranteed across sessions

**Blind spots:**
- Cannot see the user's screen — only sees images attached to the conversation or files in the repo
- Often completes code changes but forgets to \`git push\` — always include explicit push instructions

**Limitations:**
- OAuth — cannot complete interactive login; print the URL for the user to authorize
- Secrets — repo secret scanner may block commits containing API keys; use base64 or env vars
- Long-running commands can timeout; use background processes

**When in doubt about capabilities:** ask the agent directly via a followup message.
`,
    },
    apiSpecs: {
      description: "Reference: Cursor Cloud Agents API endpoints, auth, and model choice.",
      howTo: `
- **Agent ID format:** \`bc-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX\`
- **Endpoints:**
  - \`POST /v0/agents/{id}/followup\` — send work
  - \`GET /v0/agents/{id}\` — status
  - \`GET /v0/agents/{id}/conversation\` — chat history
- **Auth:** Basic auth with \`CURSOR_API_KEY\` (base64 of \`key:\`)
- **Model:** always use \`composer-2.0\` (cheapest in-house). Switch to a newer cheap in-house model if one releases. Never use claude/gpt for cloud agent tasks.
- **Capabilities (confirmed):** \`npm run dev\` in background, Playwright headless (viewport screenshots more reliable than full-page), PPT generation, UI testing, Supabase DB (service role bypasses RLS), Supabase Storage upload, HTTP to localhost:3002 when dev server runs.
`,
    },
    prepareEnvironment: {
      description: "Generate the env setup script for a fresh Cursor cloud agent session and send it as the first followup.",
      howTo: `
Use the cursor weapon:

\`\`\`javascript
import { readEnvSetupInstructions } from "@/libs/weapon/cursor";
const { setupScript } = await readEnvSetupInstructions({ userId });
// Send setupScript to the agent as the first followup message
\`\`\`
`,
    },
    writeMinimalSystemPrompt: {
      description: "Rules for authoring an adventurer's system_prompt.",
      howTo: `
System prompts must be minimal:
- Only include instructions that change behavior from the default. If Claude would do it anyway, don't say it.
- No descriptions of what the agent "is" or "can do" — just actionable rules and constraints.
- Point to a guideline file if rules are detailed. One sentence referencing the file is better than repeating its contents.
- Bad: "You are a general-purpose agent. You handle research, analysis, browser automation..." (fluff, changes nothing)
- Good: "Read /docs/adventurer-claude-non-development-guideline.md before starting. Do not modify GuildOS source code." (actionable, changes behavior)
`,
    },
  },
};

function getUserId() {
  const ctx = getAdventurerExecutionContext();
  return ctx?.userId || null;
}

export async function dispatchTask(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const agentId = String(inObj.agentId || "").trim();
  const instructions = String(inObj.instructions || "").trim();
  const model = String(inObj.model || "").trim() || undefined;

  if (!agentId) return skillActionErr("agentId is required");
  if (!instructions) return skillActionErr("instructions are required");

  const userId = _userId || getUserId();
  try {
    const result = await cursorWeapon.writeFollowup({ agentId, message: instructions, model }, userId);
    return skillActionOk({
      items: {
        result: JSON.stringify(result),
        agentId,
      },
      msg: `Task dispatched to agent ${agentId}`,
    });
  } catch (e) {
    return skillActionErr(`Dispatch failed: ${e.message}`);
  }
}

export async function readStatus(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const agentId = String(inObj.agentId || "").trim();
  if (!agentId) return skillActionErr("agentId is required");

  const userId = _userId || getUserId();
  try {
    const agent = await cursorWeapon.readAgent({ agentId }, userId);
    return skillActionOk({
      items: {
        status: JSON.stringify(agent.status || "unknown"),
        agent: JSON.stringify(agent),
      },
      msg: `Agent ${agentId} status: ${agent.status || "unknown"}`,
    });
  } catch (e) {
    return skillActionErr(`Status check failed: ${e.message}`);
  }
}

export async function readConversation(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const agentId = String(inObj.agentId || "").trim();
  if (!agentId) return skillActionErr("agentId is required");

  const userId = _userId || getUserId();
  try {
    const conv = await cursorWeapon.readConversation({ agentId }, userId);
    return skillActionOk({
      items: { conversation: JSON.stringify(conv) },
      msg: `Retrieved conversation for agent ${agentId}`,
    });
  } catch (e) {
    return skillActionErr(`Conversation read failed: ${e.message}`);
  }
}

export async function dispatchPptGeneration(_userId, input) {
  const inObj = typeof input === "object" && input ? input : {};
  const agentId = String(inObj.agentId || "").trim();
  const topic = String(inObj.topic || "").trim();
  const slides = String(inObj.slides || "").trim();
  const questId = String(inObj.questId || "").trim();

  if (!agentId) return skillActionErr("agentId is required");
  if (!topic) return skillActionErr("topic is required");

  const userId = _userId || getUserId();
  const instructions = [
    `Generate a PowerPoint presentation about: ${topic}`,
    slides ? `\nSlide content:\n${slides}` : "",
    "",
    "Requirements:",
    "- Use pptxgenjs or python-pptx to create the PPT file",
    "- Upload the final .pptx to Supabase Storage at:",
    questId
      ? `  cursor_cloud/${questId}/${topic.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pptx`
      : `  cursor_cloud/general/${topic.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pptx`,
    "- Post the public URL as a quest comment",
    "- Take a screenshot of at least one slide as visual proof",
    "",
    "After generating, git push your changes.",
  ].join("\n");

  try {
    const result = await cursorWeapon.writeFollowup({ agentId, message: instructions }, userId);
    return skillActionOk({
      items: {
        result: JSON.stringify(result),
        agentId,
      },
      msg: `PPT generation dispatched to agent ${agentId}: "${topic}"`,
    });
  } catch (e) {
    return skillActionErr(`PPT dispatch failed: ${e.message}`);
  }
}
