import { requireUser } from "@/libs/council/auth/server";
import { database } from "@/libs/council/database";
import { updateAdventurer } from "@/libs/proving_grounds/server.js";
import { isRecruitReady } from "@/libs/proving_grounds/ui.js";
import {
  listSkillBooksForProvingGrounds,
  getAdventurerDraftForOwner,
  getQuestContextForOwner,
  runProvingGroundsAction,
} from "@/libs/proving_grounds";
import { getQuestForOwner, advance as advanceQuest, createQuest } from "@/libs/quest";
import { runQuestToCompletion } from "@/libs/proving_grounds/server.js";
import { publicTables } from "@/libs/council/publicTables";

export const maxDuration = 300;

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  const action = request.nextUrl.searchParams.get("action") || "";

  if (action === "listSkillBooks") {
    const books = listSkillBooksForProvingGrounds();
    return Response.json({ ok: true, books });
  }

  if (action === "getAdventurer") {
    const adventurerId = request.nextUrl.searchParams.get("adventurerId")?.trim();
    if (!adventurerId) {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    const db = await database.init("server");
    const { data, error } = await getAdventurerDraftForOwner({
      adventurerId,
      ownerId: user.id,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ ok: true, ...data });
  }

  if (action === "getQuest") {
    const questId = request.nextUrl.searchParams.get("questId")?.trim();
    if (!questId) {
      return Response.json({ error: "questId is required" }, { status: 400 });
    }
    const db = await database.init("server");
    const { data, error } = await getQuestContextForOwner({
      questId,
      ownerId: user.id,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json({ ok: true, preview: data.preview, quest: data.quest });
  }

  if (action === "getSkillBookToc") {
    const skillBookId = request.nextUrl.searchParams.get("skillBookId")?.trim();
    if (!skillBookId) {
      return Response.json({ error: "skillBookId is required" }, { status: 400 });
    }
    const { getSkillBook } = await import("@/libs/skill_book");
    const book = getSkillBook(skillBookId);
    if (!book) {
      return Response.json({ error: `Unknown skill book: ${skillBookId}` }, { status: 404 });
    }
    return Response.json({ ok: true, toc: book.toc || {} });
  }

  if (action === "getSetupSteps") {
    const db = await database.init("server");
    const { data } = await db
      .from(publicTables.profiles)
      .select("council_settings")
      .eq("id", user.id)
      .single();
    const steps = data?.council_settings?.proving_grounds_setup;
    return Response.json({ ok: true, steps: Array.isArray(steps) ? steps : [] });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e?.message === "UNAUTHORIZED") return unauthorized();
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body?.action === "string" ? body.action : "";
  const db = await database.init("server");

  if (action === "updateAdventurer") {
    const adventurerId = body?.adventurerId != null ? String(body.adventurerId).trim() : "";
    const draft = body?.draft;
    if (!adventurerId) {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    if (!draft || typeof draft !== "object") {
      return Response.json({ error: "draft object is required" }, { status: 400 });
    }
    if (!isRecruitReady(draft)) {
      return Response.json({ error: "Draft is incomplete (name and system_prompt required)." }, { status: 400 });
    }
    const { data, error } = await updateAdventurer({
      adventurerId,
      ownerId: user.id,
      draft,
      client: db,
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ ok: true, data });
  }

  if (action === "advanceQuest") {
    const questId = body?.questId != null ? String(body.questId).trim() : "";
    if (!questId) {
      return Response.json({ error: "questId is required" }, { status: 400 });
    }
    const { data: questRow, error: qErr } = await getQuestForOwner(questId, user.id, { client: db });
    if (qErr || !questRow) {
      return Response.json({ error: qErr?.message || "Quest not found." }, { status: 404 });
    }
    const result = await advanceQuest(questRow, { client: db });
    return Response.json({ ok: result.ok !== false, ...result });
  }

  if (action === "runAction") {
    const adventurerId = body?.adventurerId != null ? String(body.adventurerId).trim() : "";
    const skillBookId = body?.skillBookId != null ? String(body.skillBookId).trim() : "";
    const actionName = body?.actionName != null ? String(body.actionName).trim() : "";
    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
    const draft =
      body?.draft && typeof body.draft === "object" && !Array.isArray(body.draft) ? body.draft : undefined;
    const questIdRaw = body?.questId != null ? String(body.questId).trim() : "";

    if (!adventurerId) {
      return Response.json({ error: "adventurerId is required" }, { status: 400 });
    }
    if (!skillBookId) {
      return Response.json({ error: "skillBookId is required" }, { status: 400 });
    }
    if (!actionName) {
      return Response.json({ error: "actionName is required" }, { status: 400 });
    }

    const { data: advRow, error: loadErr } = await getAdventurerDraftForOwner({
      adventurerId,
      ownerId: user.id,
      client: db,
    });
    if (loadErr || !advRow?.row) {
      return Response.json({ error: loadErr?.message || "Adventurer not found." }, { status: 404 });
    }

    let questRow = null;
    if (questIdRaw) {
      const { data: q, error: qErr } = await getQuestForOwner(questIdRaw, user.id, { client: db });
      if (qErr || !q) {
        return Response.json({ error: qErr?.message || "Quest not found." }, { status: 404 });
      }
      questRow = q;
    }

    const result = await runProvingGroundsAction({
      userId: user.id,
      client: db,
      skillBookId,
      actionName,
      payload,
      adventurerRow: advRow.row,
      draft,
      questRow,
    });

    return Response.json({
      ok: result.ok,
      msg: result.msg ?? "",
      items: result.items ?? {},
    });
  }

  if (action === "seedGuildAdventurers") {
    const serviceDb = await database.init("service");
    const guildAdventurers = [
      {
        id: "a1000000-0000-0000-0000-000000000001", owner_id: user.id, name: "Cat",
        skill_books: ["questmaster"],
        capabilities: "Triages incoming quests. Matches quests to adventurers by capability. Spawns recruiting quests when no match exists.",
        backstory: "The Cat is the Questmaster of the guild — sharp-eyed, decisive, and always scanning the roster for the right fit.",
        system_prompt: `You are Cat, the Questmaster of the guild. You triage quests at the idea stage.\n\nExamine the quest title and description alongside the provided roster of adventurers and their capabilities.\n\nIf an adventurer on the roster is a good match for the quest, respond with ONLY this JSON:\n{"action":"assign","adventurer_id":"<exact uuid from roster>","msg":"<brief rationale>"}\n\nIf NO adventurer is a good match, respond with ONLY this JSON:\n{"action":"recruit","child_title":"Recruit adventurer for: <original quest title>","next_steps":["<original quest description>"],"msg":"<brief rationale why no one fits>"}\n\nRules:\n- Respond with ONLY one JSON object. No prose, no markdown.\n- "msg" must be a non-empty string.`,
      },
      {
        id: "a2000000-0000-0000-0000-000000000002", owner_id: user.id, name: "Pig",
        skill_books: ["guildmaster"],
        capabilities: "Plans quests. Checks skill book availability. Spawns skill book creation quests when capability gaps exist.",
        backstory: "Pig is the Guildmaster — methodical, well-connected, and knows every skill book in the library by heart.",
        system_prompt: `You are Pig, the Guildmaster. You plan quests at the plan stage.\n\nYou will be given a quest title and description, plus a list of available skill books.\n\nCase 1 — An existing skill book already has the action needed:\n{"action":"plan","execution_plan":[{"skillbook":"<id>","action":"<actionName>"}],"msg":"<rationale>"}\n\nCase 2 — An existing skill book is the right place but needs a NEW action added to it:\n{"action":"create_skillbook","child_title":"Add action to <skillBookId>","weapon_spec":{"name":"<ActionName>","description":"<one sentence>","codeGoal":"Add a new exported async function called <actionName> to the existing skill book at libs/skill_book/<skillBookId>/index.js. <describe what the function does, its inputs, outputs>. Also add a toc entry with inputExample and outputExample.","targetSkillBook":"<skillBookId>","actions":["<actionName>"]},"setup_steps":[],"next_steps":["<current quest description>"],"msg":"<rationale>"}\n\nCase 3 — NO skill book covers the domain at all (need a new weapon/connector):\n{"action":"create_skillbook","child_title":"Design skill book for: <domain>","weapon_spec":{"name":"<WeaponName>","description":"<one sentence>","codeGoal":"<what the weapon code should do>","actions":["<actionName>"]},"setup_steps":["Step 1: <instruction>","Step 2: <next step>"],"next_steps":["<current quest description>"],"msg":"<rationale>"}\n\nRules:\n- Respond with ONLY one JSON object. No prose, no markdown.\n- weapon_spec.name should be PascalCase.\n- For Case 2, weapon_spec.targetSkillBook must be the existing skill book id.\n- For Case 2, codeGoal must be specific: function name, inputs, outputs, what it returns.`,
      },
      {
        id: "a3000000-0000-0000-0000-000000000003", owner_id: user.id, name: "Runesmith",
        skill_books: ["guildmaster", "blacksmith"],
        capabilities: "Designs skill book structures. Assesses weapon needs. Delegates code generation to Blacksmith.",
        backstory: "The Runesmith inscribes the blueprints — turning vague capability gaps into precise weapon specifications.",
        system_prompt: `You are the Runesmith. You design skill books and delegate weapon forging to the Blacksmith.\n\nRespond with ONLY this JSON:\n{"action":"plan","execution_plan":[{"skillbook":"blacksmith","action":"forgeWeapon"},{"skillbook":"blacksmith","action":"updateProvingGrounds"}],"weapon_spec":{"name":"<WeaponName>","description":"<one sentence>","codeGoal":"<precise description of what the weapon code should do>","actions":["<action1>"]},"setup_steps":["Step 1: <human setup instruction>"],"msg":"<rationale>"}\n\nRules:\n- Respond with ONLY one JSON object. No prose, no markdown.\n- execution_plan is always exactly the two blacksmith steps shown above.`,
      },
      {
        id: "a4000000-0000-0000-0000-000000000004", owner_id: user.id, name: "Blacksmith",
        skill_books: ["blacksmith"],
        capabilities: "Forges weapons by invoking Claude CLI to write weapon code files and register them.",
        backstory: "The Blacksmith strikes true — given a spec, the weapon is forged and the proving grounds updated.",
        system_prompt: `You are the Blacksmith. You forge weapons by running the claudeCLI tool.\n\nYour execution_plan is ALWAYS exactly these two steps:\n1. blacksmith.forgeWeapon\n2. blacksmith.updateProvingGrounds\n\nRespond with ONLY this JSON:\n{"action":"plan","execution_plan":[{"skillbook":"blacksmith","action":"forgeWeapon"},{"skillbook":"blacksmith","action":"updateProvingGrounds"}],"msg":"Ready to forge."}`,
      },
    ];
    const results = [];
    for (const adv of guildAdventurers) {
      const { data, error } = await serviceDb.from(publicTables.adventurers).upsert(adv, { onConflict: "id" }).select("id, name");
      if (error) {
        results.push({ name: adv.name, error: error.message });
      } else {
        results.push({ name: adv.name, id: data?.[0]?.id });
      }
    }
    return Response.json({ ok: true, count: results.length, adventurers: results });
  }

  if (action === "cliSmoke") {
    const { invoke } = await import("@/libs/weapon/claudecli/index.js");
    const prompt = `In the file app/town/proving-grounds/ProvingGroundsClient.js, find the button with id="green-test-btn". It currently has className that includes "btn-error". Change "btn-error" to "btn-success" in the DEFAULT state (the useState initializer for greenBtnColor). Do not change anything else. Your entire output must be a single valid HTML document reporting what you changed. Begin with <!DOCTYPE html> immediately.`;
    const result = await invoke(prompt);
    const logs = [
      { step: 0, action: "cliSmoke:invoke", ok: result.ok, detail: { error: result.error || null, outputLength: result.rawOutput?.length ?? 0 } },
    ];
    return Response.json({ ok: result.ok, finalStage: result.ok ? "completed" : "failed", logs, html: result.html });
  }

  if (action === "runTestQuest") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!title && !description) {
      return Response.json({ error: "title or description is required" }, { status: 400 });
    }

    const questTitle = title || description.slice(0, 80);
    const questDescription = description || title;

    const { data: newQuest, error: createErr } = await createQuest({
      userId: user.id,
      title: questTitle,
      description: questDescription,
      stage: "idea",
      client: db,
    });

    if (createErr || !newQuest) {
      return Response.json({ error: createErr?.message || "Failed to create quest" }, { status: 500 });
    }

    // Use service client for the long-running advancement loop (bypasses RLS, consistent)
    const serviceDb = await database.init("service");
    const { ok, finalStage, logs, html } = await runQuestToCompletion(newQuest.id, { client: serviceDb });

    return Response.json({ ok, questId: newQuest.id, finalStage, logs, html });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
