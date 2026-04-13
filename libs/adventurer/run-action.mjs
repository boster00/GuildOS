#!/usr/bin/env node
/**
 * run-action.mjs — CLI tool for adventurers to invoke skill book actions.
 *
 * Usage:
 *   node libs/adventurer/run-action.mjs <skillBookId> <actionName> '<inputJson>'
 *
 * Examples:
 *   node libs/adventurer/run-action.mjs zoho search '{"module":"Contacts","limit":5}'
 *   node libs/adventurer/run-action.mjs testskillbook testaction '{"num1":3,"num2":7}'
 *   node libs/adventurer/run-action.mjs browsercontrol dispatchBrowserActionsThroughPigeonPost '{"questId":"...","browserActions":[...]}'
 *
 * Output: JSON to stdout with { ok, msg, items, error }
 *
 * Notes:
 * - Weapon actions are accessed THROUGH skill book actions, not directly.
 * - Uses the service role database client (no user session needed).
 * - Reads PIGEON_POST_OWNER_ID from .env.local as the userId for actions that need it.
 */

import "dotenv/config";

const [,, skillBookId, actionName, inputJsonStr] = process.argv;

if (!skillBookId || !actionName) {
  console.error(JSON.stringify({
    ok: false,
    error: "Usage: node libs/adventurer/run-action.mjs <skillBookId> <actionName> '[inputJson]'",
    availableBooks: "Run with --list to see available skill books and actions.",
  }));
  process.exit(1);
}

// --list: enumerate all skill books and their actions
if (skillBookId === "--list") {
  const { listSkillBooksForLibrary } = await import("../skill_book/index.js");
  const books = listSkillBooksForLibrary();
  console.log(JSON.stringify(books, null, 2));
  process.exit(0);
}

let input = {};
if (inputJsonStr) {
  try {
    input = JSON.parse(inputJsonStr);
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: `Invalid JSON input: ${e.message}` }));
    process.exit(1);
  }
}

try {
  const { getSkillBook } = await import("../skill_book/index.js");
  const book = getSkillBook(skillBookId);

  if (!book) {
    // List available books on error
    const { SKILL_BOOKS } = await import("../skill_book/index.js");
    const available = Object.keys(SKILL_BOOKS);
    console.error(JSON.stringify({
      ok: false,
      error: `Unknown skill book: "${skillBookId}"`,
      availableBooks: available,
    }));
    process.exit(1);
  }

  const fn = book[actionName];
  if (typeof fn !== "function") {
    // List available actions on this book
    const toc = book.toc && typeof book.toc === "object" ? book.toc : {};
    const actions = Object.entries(toc).map(([name, entry]) => ({
      name,
      description: entry?.description || "",
      input: entry?.input || {},
      output: entry?.output || {},
    }));
    console.error(JSON.stringify({
      ok: false,
      error: `No action "${actionName}" on skill book "${skillBookId}"`,
      availableActions: actions,
    }));
    process.exit(1);
  }

  const userId = process.env.PIGEON_POST_OWNER_ID || "system";
  const result = await fn(userId, input);

  // Normalize output
  const output = {
    ok: result?.ok ?? true,
    msg: result?.msg || "",
    items: result?.items || {},
  };
  if (result?.error) output.error = result.error;
  if (result?.data) output.data = result.data;

  console.log(JSON.stringify(output, null, 2));
  process.exit(output.ok ? 0 : 1);
} catch (err) {
  console.error(JSON.stringify({
    ok: false,
    error: err.message || String(err),
  }));
  process.exit(1);
}
