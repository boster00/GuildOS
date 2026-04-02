import { Agent, Runner } from "@openai/agents";
import { OpenAIProvider } from "@openai/agents-openai";
import { tool } from "@openai/agents";
import { z } from "zod";
import { listAdventurers } from "./create.js";
import { loadAdventurer, loadAdventurerFromRow } from "./adventurer.js";
import { getGlobalAssigneeMeta } from "./globalAssignees.js";
import { getSkillBook } from "@/libs/skill_book";
import { runFetchRecentSalesOrders } from "@/libs/skill_book/zoho";
import {
  transitionQuestStage,
  updateQuest,
  assignQuest,
  createSubQuest,
  appendAgentExecutionAttempt,
  appendInventoryItem,
} from "@/libs/quest/runtime";

const TOOL_IMPLEMENTATIONS = {
  runFetchRecentSalesOrders: (context) =>
    tool({
      name: "runFetchRecentSalesOrders",
      description: "Fetch the most recent sales orders from Zoho Books.",
      parameters: z.object({
        limit: z.number().nullable().optional(),
      }),
      async execute({ limit }) {
        const lim = limit == null ? 10 : limit;
        const { data, error } = await runFetchRecentSalesOrders(context.userId, { limit: lim });
        if (error) return JSON.stringify({ result: false, msg: error.message });
        return JSON.stringify({ result: true, msg: `Fetched ${data.length} rows`, data });
      },
    }),

  transitionQuestStage: (context) =>
    tool({
      name: "transitionQuestStage",
      description:
        "Move a quest to the next stage in its lifecycle (idea → plan → assign → execute → review → closing → completed). Use completed only after archival in closing is done.",
      parameters: z.object({
        questId: z.string(),
        newStage: z.enum(["idea", "plan", "assign", "execute", "review", "closing", "completed"]),
      }),
      async execute({ questId, newStage }) {
        const { data, error } = await transitionQuestStage(questId, newStage, { client: context.client });
        if (error) return JSON.stringify({ result: false, msg: error.message });
        return JSON.stringify({ result: true, msg: `Quest moved to ${newStage}`, data });
      },
    }),

  updateQuest: (context) =>
    tool({
      name: "updateQuest",
      description: "Update a quest's title, description, deliverables, due date (ISO string), stage, or assignee id.",
      parameters: z.object({
        questId: z.string(),
        title: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        deliverables: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        stage: z.enum(["idea", "plan", "assign", "execute", "review", "closing", "completed"]).nullable().optional(),
        assigneeId: z.string().nullable().optional(),
      }),
      async execute({ questId, title, description, deliverables, dueDate, stage, assigneeId }) {
        const { data, error } = await updateQuest(
          questId,
          {
            title: title ?? undefined,
            description: description ?? undefined,
            deliverables: deliverables ?? undefined,
            dueDate: dueDate ?? undefined,
            stage: stage ?? undefined,
            assigneeId: assigneeId ?? undefined,
          },
          { client: context.client },
        );
        if (error) return JSON.stringify({ result: false, msg: error.message });
        return JSON.stringify({ result: true, msg: "Quest updated", data });
      },
    }),

  listAdventurers: (context) =>
    tool({
      name: "listAdventurers",
      description: "List all active adventurers in the roster with their name, class, and skill books.",
      parameters: z.object({}),
      async execute() {
        const { data, error } = await listAdventurers(context.userId, { client: context.client });
        if (error) return JSON.stringify({ result: false, msg: error.message });
        return JSON.stringify({ result: true, msg: `${data.length} adventurer(s)`, data });
      },
    }),

  assignQuest: (context) =>
    tool({
      name: "assignQuest",
      description: "Assign a quest to an adventurer by name.",
      parameters: z.object({
        questId: z.string(),
        adventurerName: z.string(),
      }),
      async execute({ questId, adventurerName }) {
        const { data, error } = await assignQuest(questId, adventurerName, { client: context.client });
        if (error) return JSON.stringify({ result: false, msg: error.message });
        return JSON.stringify({ result: true, msg: `Quest assigned to ${adventurerName}`, data });
      },
    }),

  appendQuestExecutionLog: (context) =>
    tool({
      name: "appendQuestExecutionLog",
      description:
        "Append a troubleshooting note to the quest agent_execution.attempts log (for retries and human-readable traces).",
      parameters: z.object({
        questId: z.string(),
        note: z.string(),
        detailJson: z.string().nullable().optional(),
      }),
      async execute({ questId, note, detailJson }) {
        let detail;
        if (detailJson != null && detailJson !== "") {
          try {
            detail = JSON.parse(detailJson);
          } catch {
            detail = detailJson;
          }
        }
        const out = await appendAgentExecutionAttempt(
          questId,
          {
            at: new Date().toISOString(),
            phase: "log",
            note,
            detail,
          },
          { client: context.client },
        );
        if (out.error) return JSON.stringify({ result: false, msg: out.error.message });
        return JSON.stringify({ result: true, msg: "Log appended", data: out.data });
      },
    }),

  submitQuestDeliverable: (context) =>
    tool({
      name: "submitQuestDeliverable",
      description:
        "Record an inventory item for the quest and move the quest to the review stage.",
      parameters: z.object({
        questId: z.string(),
        itemKey: z.string(),
        itemPayloadJson: z.string(),
      }),
      async execute({ questId, itemKey, itemPayloadJson }) {
        let itemPayload;
        try {
          itemPayload = JSON.parse(itemPayloadJson);
        } catch (e) {
          return JSON.stringify({ result: false, msg: `Invalid JSON: ${e?.message || e}` });
        }
        const { error: hErr } = await appendInventoryItem(
          questId,
          { item_key: itemKey, payload: itemPayload },
          { client: context.client },
        );
        if (hErr) return JSON.stringify({ result: false, msg: hErr.message });
        const { error: tErr } = await transitionQuestStage(questId, "review", { client: context.client });
        if (tErr) return JSON.stringify({ result: false, msg: tErr.message });
        return JSON.stringify({ result: true, msg: "Deliverable recorded; quest moved to review" });
      },
    }),

  createSubQuest: (context) =>
    tool({
      name: "createSubQuest",
      description: "Create a sub-quest linked to a parent quest.",
      parameters: z.object({
        parentQuestId: z.string(),
        title: z.string(),
        description: z.string(),
        deliverables: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        assigneeId: z.string().nullable().optional(),
        assignedTo: z.string().nullable().optional(),
      }),
      async execute({ parentQuestId, title, description, deliverables, dueDate, assigneeId, assignedTo }) {
        const { data, error } = await createSubQuest(
          {
            userId: context.userId,
            parentQuestId,
            title,
            description,
            deliverables: deliverables ?? undefined,
            dueDate: dueDate ?? undefined,
            assigneeId: assigneeId ?? undefined,
            assignedTo: assignedTo ?? undefined,
          },
          { client: context.client },
        );
        if (error) return JSON.stringify({ result: false, msg: error.message });
        return JSON.stringify({ result: true, msg: `Sub-quest created: ${title}`, data });
      },
    }),
};

function buildToolsForClass(classDef, context) {
  return (classDef.tool_ids || [])
    .filter((id) => TOOL_IMPLEMENTATIONS[id])
    .map((id) => TOOL_IMPLEMENTATIONS[id](context));
}

async function runAdventurerCore(loaded, { questId, input, client }) {
  const { row: adventurer, classDef, mind } = loaded;
  if (!classDef) {
    return { error: new Error(`Missing or invalid class preset for adventurer: ${adventurer.name}`) };
  }

  if (mind.error) {
    return { error: mind.error };
  }
  if (!mind.apiKey) {
    return {
      error: new Error(
        "No OpenAI API key: set OPENAI_API_KEY (or OPENAI_API_KEY_1) in the environment, or add a key in Council Hall → Dungeon master's room.",
      ),
    };
  }

  const provider = new OpenAIProvider({
    apiKey: mind.apiKey,
    ...(mind.effectiveBaseUrl ? { baseURL: mind.effectiveBaseUrl } : {}),
  });
  const runner = new Runner({ modelProvider: provider });

  const context = { userId: adventurer.owner_id, questId, client };
  const tools = buildToolsForClass(classDef, context);

  const skillBookContext = (adventurer.skill_books || [])
    .map((bookName) => {
      const sb = getSkillBook(bookName);
      return sb ? `Skill Book "${sb.title}": ${JSON.stringify(sb.steps)}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const basePrompt = classDef.system_prompt;
  const promptOverride = adventurer.system_prompt;
  const instructions = [
    promptOverride || basePrompt,
    skillBookContext ? `\nAvailable skill books:\n${skillBookContext}` : "",
    questId ? `\nQuest ID: ${questId}` : "",
  ].join("");

  const model = mind.effectiveModel;

  const cfg =
    adventurer.config && typeof adventurer.config === "object" && !Array.isArray(adventurer.config)
      ? adventurer.config
      : {};
  const modelSettings = {};
  if (typeof cfg.temperature === "number" && !Number.isNaN(cfg.temperature)) {
    modelSettings.temperature = cfg.temperature;
  }
  if (typeof cfg.max_output_tokens === "number") {
    modelSettings.maxTokens = cfg.max_output_tokens;
  } else if (typeof cfg.maxTokens === "number") {
    modelSettings.maxTokens = cfg.maxTokens;
  }

  const agent = new Agent({
    name: adventurer.name,
    instructions,
    tools,
    model,
    ...(Object.keys(modelSettings).length ? { modelSettings } : {}),
  });

  try {
    const result = await runner.run(agent, input, { maxTurns: mind.maxTurns });
    return { data: { output: result.finalOutput, adventurerId: adventurer.id } };
  } catch (err) {
    return { error: err };
  }
}

export async function runAdventurer(adventurerId, { questId, input, client }) {
  const { data: loaded, error: loadErr } = await loadAdventurer(adventurerId, { client });
  if (loadErr) return { error: loadErr };
  return runAdventurerCore(loaded, { questId, input, client });
}

/**
 * Run automation for built-in assignees (e.g. `cat` = questmaster) with no `adventurers` row.
 * Uses `ownerUserId` (quest owner) for Dungeon Master keys and tool context.
 */
export async function runGlobalQuestAssignee(assigneeName, { ownerUserId, questId, input, client }) {
  const meta = getGlobalAssigneeMeta(assigneeName);
  if (!meta) {
    return { error: new Error(`Not a global quest assignee: ${assigneeName}`) };
  }
  if (!ownerUserId) {
    return { error: new Error("ownerUserId is required for global assignee runs") };
  }

  const row = {
    id: `global:${meta.name}`,
    owner_id: ownerUserId,
    name: meta.name,
    presetKey: meta.presetKey,
    system_prompt: null,
    skill_books: meta.skill_books || [],
    mind_override: {},
    model_id: null,
    max_agent_turns: null,
    config: {},
    metadata: {},
  };

  const { data: loaded, error: loadErr } = await loadAdventurerFromRow(row, { client });
  if (loadErr) return { error: loadErr };
  return runAdventurerCore(loaded, { questId, input, client });
}
