# How to develop new skill books

Skill books live under `libs/skill_book/<bookId>/` (typically a single `index.js`). The hub [`libs/skill_book/index.js`](index.js) is the **catalog**: `SKILL_BOOKS`, `ADVENTURER_REGISTRY`, `getSkillBook`, `tocForAdventurer`, and roster helpers.

## 1. Module shape (`libs/skill_book/<bookId>/index.js`)

Export:

- **`skillBook`** — Object with `id` (string, equals folder name), `title`, `description`, `steps` (often `[]`), and **`toc`**.
- **One async function per action** — Same names as keys under `skillBook.toc`.

### TOC entries

Each action id maps to metadata used for planning and UI:

- **`description`** — Human (and model) readable summary; can be long for planner-facing books.
- **`inputExample`** — Example payload shape (object). Becomes `toc[action].input` in `getSkillBook` when no separate `input` object is set.
- **`outputExample`** — Example outputs; same merging rules as `inputExample`.
- **`waitFor`** (optional) — String keys for dependency ordering where supported.

Follow [`testskillbook/index.js`](testskillbook/index.js) for `normalizePayload(a, b)` and returning **`skillActionOk` / `skillActionErr`** from [`actionResult.js`](actionResult.js).

Actions usually call **weapons** under `libs/weapon/<name>/`, not external APIs directly.

## 2. Registering the book

In [`libs/skill_book/index.js`](index.js):

1. **Import** `skillBook` and each action function from `./<bookId>/index.js`.
2. Add **`SKILL_BOOKS.<bookId>`** to the `SKILL_BOOKS` object.
3. Create **`<bookId>AdventurerActions`** — map action name → `(userId, input) => fn(userId, input)`.
4. Add **`ADVENTURER_REGISTRY.<bookId>`** with `definition` and `adventurerActions`.

Do not duplicate ids elsewhere. `listSkillBookIdsForRosterUI` is derived from `SKILL_BOOKS` keys (excluding `default`). Validation uses `getAcceptedSkillBookIds()` plus optional `LEGACY_SKILL_BOOK_IDS`.

## 3. Adventurers and planning

An adventurer row’s **`skill_books`** array (strings) controls which TOC entries appear in [`tocForAdventurer`](index.js). Assign books in Guildmaster / Inn edit UIs or via manage APIs. Models commissioning adventurers should only use ids from `SKILL_BOOKS` (see [`libs/cat/prompts.js`](../cat/prompts.js)).

## 4. Cross-stack features (e.g. pigeon + Browserclaw)

When a skill action persists **rich step objects** consumed by the Browserclaw extension:

1. Skill action builds **`partials`** with all needed fields.
2. **`buildPigeonLetterFromPartials`** (or equivalent) must **shallow-merge** those fields into each stored step.
3. Extension **normalization** (e.g. `normalizeOneStep`) must preserve extra keys.
4. **`chrome.tabs.sendMessage`** for execute must forward the **full step**, not only `action`/`selector`.

Otherwise planner-facing docs will not match runtime behavior.

## 5. Verify

- `getSkillBook("<bookId>")` returns a non-null view with `toc` and wrapped action methods.
- Lint and smoke any API or proving-grounds path that exercises the new actions.

---

For repo layout norms, see `.cursor/rules/guildos-libs-layout.mdc` under `libs/**`.
