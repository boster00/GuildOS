import OpenAI from "openai";
import { resolveDungeonMasterRuntime } from "@/libs/council/councilSettings";
import { getDefaultDraft, mergeDraftPatch, isRecruitReady, checklistState } from "@/libs/proving_grounds/ui.js";
import { CAT_BASE_IDENTITY, CAT_COMMISSION_WORKFLOW } from "./prompts.js";

const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;

function buildCommissionSystemPrompt(baseDraft) {
  return `${CAT_BASE_IDENTITY}

${CAT_COMMISSION_WORKFLOW}

Current draft JSON (merge updates via draftPatch):
${JSON.stringify(baseDraft)}`;
}

/**
 * @param {{
 *   ownerId: string,
 *   messages: { role: string, content: string }[],
 *   draft: Record<string, unknown> | null | undefined,
 *   client: import("@/libs/council/database/types.js").DatabaseClient,
 * }} opts
 */
export async function runCommissionChat({ ownerId, messages, draft, client }) {
  const rt = await resolveDungeonMasterRuntime(ownerId, { client });
  if (rt.error) return { error: rt.error };
  if (!rt.apiKey) {
    return {
      error: new Error(
        "No OpenAI API key: add one in Council Hall → Dungeon master's room, or set OPENAI_API_KEY in the environment.",
      ),
    };
  }

  const trimmed = (messages || [])
    .filter((m) => m && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
    }));

  const baseDraft = draft && typeof draft === "object" ? draft : getDefaultDraft();

  const openai = new OpenAI({
    apiKey: rt.apiKey,
    ...(rt.baseUrl ? { baseURL: rt.baseUrl } : {}),
  });

  const model = rt.defaultModel || "gpt-4o-mini";

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildCommissionSystemPrompt(baseDraft),
        },
        ...trimmed,
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        data: {
          assistantMessage: "I got a garbled response—try asking again in one sentence.",
          draft: baseDraft,
          checklist: checklistState(baseDraft),
          done: isRecruitReady(baseDraft),
        },
      };
    }

    const assistantMessage =
      typeof parsed.assistantMessage === "string" ? parsed.assistantMessage : "Right. What should they be called?";
    const patch = parsed.draftPatch && typeof parsed.draftPatch === "object" ? parsed.draftPatch : {};
    const nextDraft = mergeDraftPatch(baseDraft, patch);
    const done = isRecruitReady(nextDraft);

    return {
      data: {
        assistantMessage,
        draft: nextDraft,
        checklist: checklistState(nextDraft),
        done,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
