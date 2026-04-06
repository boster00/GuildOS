# How to develop new skill books

Skill books live under `libs/skill_book/<bookId>/` (typically a single `index.js`). The hub [`libs/skill_book/index.js`](index.js) is the **catalog**: `SKILL_BOOKS`, `ADVENTURER_REGISTRY`, `getSkillBook`, and roster helpers.

## 1. Module shape (`libs/skill_book/<bookId>/index.js`)

Export:

- **`skillBook`** — Object with `id` (string, equals folder name), `title`, `description`, `steps` (often `[]`), and **`toc`**.
- **One async function per action** — Same names as keys under `skillBook.toc`.

### TOC format

The TOC is an **object** (not an array). Each key is an action name, each value has `description`, `input`, `output`, and optionally `waitFor`.

```js
export const skillBook = {
  id: "mybook",
  title: "My Book",
  description: "What this book covers.",
  steps: [],
  toc: {
    search: {
      description: "Search records from any supported module.",
      input: {
        module: "string, one of: orders, invoices, contacts",
        limit: "int, e.g. 10",
      },
      output: {
        records: "array of objects",
      },
    },
  },
};
```

### TOC field rules

- **`description`** — Caller language: describe what the caller gets, not what the function does internally. Used by `boast` at assign time.
- **`input`** — Flat key-value map. Each value is a string declaring the type and constraints or example. This doubles as format enforcement for AI-generated execution plans.
  - Free-form: `"string, e.g. shirts"`
  - Constrained: `"string, one of: salesorders, invoices, bills"`
  - Numeric: `"int, e.g. 5"`
  - Complex: `"object with name, description, codeGoal"`
- **`output`** — Same flat key-value format as `input`.
- **`waitFor`** (optional) — Array of inventory keys that must exist before this action runs.

### Naming rules

Action names must use the six standard verbs: `read`, `write`, `delete`, `search`, `transform`, `normalize`. Do not use synonyms (`get`, `fetch`, `load`, `list`, `find`, `create`, `update`).

Prefer **multipurpose actions** with a parameter over one action per entity. Example: one `search` with a `module` param, not `searchContacts` + `searchQuotes` + `getRecentOrders`.

### Implementation pattern

Actions usually call **weapons** under `libs/weapon/<name>/`, not external APIs directly.

Follow `normalizePayload(a, b)` for handling both `(userId, input)` and `(enrichedPayload)` call shapes. Return **`skillActionOk` / `skillActionErr`** from [`actionResult.js`](actionResult.js).

## 2. Registering the book

In [`libs/skill_book/index.js`](index.js):

1. **Import** `skillBook` and each action function from `./<bookId>/index.js`.
2. Add **`SKILL_BOOKS.<bookId>`** to the `SKILL_BOOKS` object.
3. Create **`<bookId>AdventurerActions`** — map action name → `(_userId, input) => fn(input || {})`.
4. Add **`ADVENTURER_REGISTRY.<bookId>`** with `definition` and `adventurerActions`.

Do not duplicate ids elsewhere. `listSkillBookIdsForRosterUI` is derived from `SKILL_BOOKS` keys (excluding `default`). Validation uses `getAcceptedSkillBookIds()` plus optional `LEGACY_SKILL_BOOK_IDS`.

## 3. Adventurers, boast, and planning

An adventurer row's **`skill_books`** array (strings) controls which books they wield.

At **assign** time, the Questmaster calls `boast` on each adventurer. `boast` loads the TOC of every skill book and returns action names + descriptions. This is the binding contract for what the adventurer can do — the Questmaster only assigns if the boast covers the quest.

At **plan** time, the adventurer's AI sees the full TOC (including `input` and `output`) and generates an `execution_plan` with the correct action names and parameters.

## 4. Cross-stack features (e.g. pigeon + Browserclaw)

When a skill action persists **rich step objects** consumed by the Browserclaw extension:

1. Skill action builds **`partials`** with all needed fields.
2. **`buildPigeonLetterFromPartials`** (or equivalent) must **shallow-merge** those fields into each stored step.
3. Extension **normalization** (e.g. `normalizeOneStep`) must preserve extra keys.
4. **`chrome.tabs.sendMessage`** for execute must forward the **full step**, not only `action`/`selector`.

## 5. Verify

- `getSkillBook("<bookId>")` returns a non-null view with `toc` and wrapped action methods.
- `buildBoast({ skill_books: ["<bookId>"] })` returns the action names and descriptions from the TOC.
- Lint and smoke any API or proving-grounds path that exercises the new actions.
