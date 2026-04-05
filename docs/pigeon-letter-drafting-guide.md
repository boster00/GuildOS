# Pigeon Letter Drafting Guide

**Read this before composing any pigeon letter payload for Browserclaw.**

A pigeon letter tells Browserclaw to open a browser tab and execute a sequence of steps on that page. When all steps are done, the collected item values are posted back to GuildOS and stored in the quest.

---

## Payload structure

```json
{
  "steps": [
    { "action": "<action>", ...params }
  ]
}
```

`steps` is an array of step objects. Steps run in order inside a single background tab. The tab is closed when all steps complete or on first error.

---

## Actions

### `navigate`

Navigate the tab to a URL. No value is returned.

```json
{ "action": "navigate", "url": "https://example.com" }
```

> **Shorthand**: any step that has a `url` field will navigate first, then run its `action`. So `navigate` is only needed when navigation is the sole purpose of the step.

---

### `get`

Read data from a DOM element and store it as an item to return to GuildOS.

```json
{
  "action": "get",
  "selector": "h1",
  "item": "pageTitle"
}
```

**Parameters**

| Field | Type | Default | Description |
|---|---|---|---|
| `selector` | string | required | CSS selector |
| `item` | string | required | Key name to store the result under. This is what gets posted back to GuildOS. |
| `attribute` | string | `""` | What to read. Empty = `innerText`. Special values: `innerHTML`, `outerHTML`, `value`. Any other string → `el.getAttribute(attribute)`. |
| `getAll` | boolean | `false` | If `true`, runs `querySelectorAll` and returns an array of values. |

**Examples**

```json
{ "action": "get", "selector": "h1", "item": "heading" }
{ "action": "get", "selector": "input[name=email]", "item": "emailValue", "attribute": "value" }
{ "action": "get", "selector": "li.result", "item": "results", "getAll": true }
{ "action": "get", "selector": "meta[name=description]", "item": "metaDesc", "attribute": "content" }
```

---

### `click`

Perform a realistic click on an element. Dispatches the full pointer/mouse event chain: `pointerover`, `pointerenter`, `mouseover`, `mouseenter`, `pointermove`, `mousemove`, `pointerdown`, `mousedown`, `focus`, `pointerup`, `mouseup`, `click`.

```json
{
  "action": "click",
  "selector": "button[type=submit]"
}
```

**Parameters**

| Field | Type | Default | Description |
|---|---|---|---|
| `selector` | string | required | CSS selector of the element to click |
| `item` | string | optional | If provided, stores `{ "clicked": true }` under this key |

---

### `typeText`

Focus an input or contenteditable and type text into it.

```json
{
  "action": "typeText",
  "selector": "input[name=search]",
  "text": "quarterly report",
  "item": "typed"
}
```

**Parameters**

| Field | Type | Default | Description |
|---|---|---|---|
| `selector` | string | required | CSS selector |
| `text` | string | required | Text to type |
| `clearContent` | boolean | `true` | If `true`, clears the field first. If `false`, appends to existing value. |
| `item` | string | optional | If provided, stores `{ "typed": <char count> }` |

---

### `pressKey`

Dispatch `keydown` + `keypress` + `keyup` on an element (or the currently focused element if no selector).

```json
{
  "action": "pressKey",
  "selector": "input[name=search]",
  "key": "Enter"
}
```

**Parameters**

| Field | Type | Default | Description |
|---|---|---|---|
| `selector` | string | optional | CSS selector. Falls back to `document.activeElement`. |
| `key` | string | required | Key value (e.g. `"Enter"`, `"Tab"`, `"Escape"`, `"ArrowDown"`) |
| `item` | string | optional | If provided, stores `{ "key": "<key>" }` |

---

### `wait`

Wait a number of seconds, then optionally poll the DOM until a selector appears.

```json
{
  "action": "wait",
  "seconds": 2,
  "selector": ".results-loaded"
}
```

**Parameters**

| Field | Type | Default | Description |
|---|---|---|---|
| `seconds` | number | `0` | Time to wait before starting (max 120). |
| `selector` | string | `""` | If provided, polls DOM every 1 second for up to 30 seconds after the initial wait. Step fails if selector not found within 30s. |
| `item` | string | optional | If provided, stores `{ "waited": <seconds>, "found": "<selector>" }` |

---

### `getUrl`

Return the current tab URL.

```json
{
  "action": "getUrl",
  "item": "currentUrl"
}
```

**Parameters**

| Field | Type | Description |
|---|---|---|
| `item` | string | Required. Key to store the URL under. |

---

## How items are returned

Every step with an `item` field stores its result in a dictionary. When all steps complete, that dictionary is posted to GuildOS (`POST /api/pigeon-post?action=deliver`) with the `questId` and `letterId`. The quest's inventory is then updated by the weapon/pigeon handler.

**Only steps that have an `item` field contribute to the result.** Steps without `item` (e.g. a `click` or a `navigate`) run their action but contribute nothing to the delivered payload.

---

## Composing a multi-step letter

```json
{
  "steps": [
    { "action": "navigate", "url": "https://app.example.com/dashboard" },
    { "action": "wait", "seconds": 1, "selector": ".data-table" },
    { "action": "get", "selector": ".data-table tbody tr", "item": "rows", "getAll": true },
    { "action": "getUrl", "item": "source" }
  ]
}
```

**Tips**

- Always navigate before trying to read or interact.
- Use `wait` with a `selector` instead of a fixed sleep whenever possible — it resolves faster and handles variable load times.
- `click` + `wait` is the standard pattern after clicking a button that triggers a page update.
- Use `get` with `attribute: "value"` for form inputs; plain `get` (no attribute) for visible text.
- `getUrl` is useful to confirm which page the session ended up on.
- Keep letters focused: one logical task per letter, a handful of steps.
