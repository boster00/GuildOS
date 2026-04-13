# Adventurer Creed

## 1. Fetch quest context

```
node libs/adventurer/run-quest-context.mjs <QUEST_ID>
```

This returns the quest title, description, inventory, comments, and your adventurer profile (including `systemPrompt` and `skillBooks`).

## 2. Read your guidelines

The `adventurer.systemPrompt` field contains instructions specific to you — follow them. If it references a file (e.g. `/docs/adventurer-claude-non-development-guideline.md`), read that file before proceeding.

## 3. Skill book actions

Your `adventurer.skillBooks` lists the skill books available to you.

To see all actions on your skill books: `node libs/adventurer/run-action.mjs --list`
To invoke an action: `node libs/adventurer/run-action.mjs <skillBookId> <actionName> '<inputJson>'`

## 4. Output

When done, output ONLY this JSON as the LAST line:

```
{"items":{"<key>":"<value>"},"summary":"<what you did>"}
```

Items are saved to the quest inventory automatically.
