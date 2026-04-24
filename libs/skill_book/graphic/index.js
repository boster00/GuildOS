/**
 * Graphic skill book — standards and prompts for AI-generated game art assets,
 * plus Figma design file access via the figma weapon.
 *
 * Image generation: openai_images weapon (gpt-image-2)
 * Design reading:   figma weapon (REST API)
 */

import {
  readFile as wReadFile,
  readNodes as wReadNodes,
  readExport as wReadExport,
} from "@/libs/weapon/figma";
import { skillActionOk, skillActionErr } from "@/libs/skill_book/actionResult.js";

/**
 * Primary design file — Boster Design Master File.
 * URL: https://www.figma.com/design/NMfOvoGgMVFPYM4nLtN8zD/Boster-Design-Master-File
 */
const PRIMARY_FILE_KEY = "NMfOvoGgMVFPYM4nLtN8zD";

export const skillBook = {
  id: "graphic",
  title: "Graphic",
  description:
    "Generate game art assets (gpt-image-2 via openai_images weapon) and read Figma design files " +
    "(figma weapon, REST API). Primary Figma file: Boster-Design-Master-File (NMfOvoGgMVFPYM4nLtN8zD). " +
    "Requires FIGMA_ACCESS_TOKEN for Figma actions.",

  toc: {
    generateSpriteSheet: {
      description: "Generate a chibi character sprite sheet (1280×720, 8×4 grid, 4 animations) using the locked standard prompt via gpt-image-2.",
    },
    readPages: {
      description:
        "List all pages in the primary Figma file (or a given fileKey). " +
        "Returns each page's id, name, and top-level child count.",
      input: { fileKey: "string, optional — defaults to Boster Design Master File" },
      output: { pages: "array of { id, name, childCount }" },
    },
    readPage: {
      description:
        "Get the full node tree for a single named page. Useful for understanding " +
        "layout structure before exporting specific frames.",
      input: {
        pageName: "string — page name, e.g. 'Home' or 'Components'",
        fileKey: "string, optional — defaults to primary file",
        depth: "int, optional — tree depth limit (default 3)",
      },
      output: { page: "Figma node object with children", fileKey: "string" },
    },
    exportFrames: {
      description:
        "Export one or more frames/components as image URLs (PNG by default). " +
        "Pass nodeIds as an array of Figma node IDs (e.g. '1234:5678').",
      input: {
        nodeIds: "array of string — Figma node IDs to export",
        fileKey: "string, optional — defaults to primary file",
        format: "string, optional — 'png' | 'jpg' | 'svg' | 'pdf' (default 'png')",
        scale: "number, optional — render scale (default 2)",
      },
      output: { images: "object — map of nodeId → image URL" },
    },
    readComponents: {
      description:
        "List all top-level frames and components across all pages of a file. " +
        "Useful for discovering what's available before a targeted readPage or exportFrames.",
      input: { fileKey: "string, optional — defaults to primary file" },
      output: { components: "array of { id, name, page, type }" },
    },
  },

  generateSpriteSheet: `
Generate a sprite sheet using the \`openai_images\` weapon (\`@/libs/weapon/openai_images\`).

**Model:** gpt-image-2
**Size:** 1536x1024 (landscape — closest supported size to the 1280×720 canvas)
**Quality:** high
**DO NOT** pass \`response_format\` — unsupported, always returns b64_json.

**Invocation:**
\`\`\`js
import { generate } from "@/libs/weapon/openai_images";
const [b64] = await generate(
  { prompt: SPRITE_SHEET_PROMPT, size: "1536x1024", quality: "high" },
  userId
);
// b64 is a base64 PNG string
const buffer = Buffer.from(b64, "base64");
\`\`\`

**Locked standard prompt (use verbatim — do not paraphrase or shorten):**

\`\`\`
Create a transparent-background sprite sheet template for a featureless round chibi character body, no accessories, no animal features, no clothing, simple placeholder body only.

Canvas size 1280x720 pixels. Arrange frames in a clean 8-column by 4-row grid. Each cell is 160x180 pixels. Inside each cell, place a 128x128 character pose area with consistent scale and centered alignment. Leave label text below each pose.

Use soft chibi-style fantasy game art, clean 2D illustration, pastel colors, simple body, no complex details, low visual noise.

Rows:
Row 1: idle standing animation, 4 frames, subtle breathing/bobbing.
Row 2: working animation, 8 frames, waving a simple placeholder sword/tool.
Row 3: need attention animation, 6 frames, jumping with one hand raised and O-shaped mouth.
Row 4: walking animation, 8 frames, simple walk cycle.

Under each visible frame, add small readable labels exactly in this format:
[pose, frame n, x, y, w, h]

Use the following labels:
idle, frame 1, 16, 8, 128, 128
idle, frame 2, 176, 8, 128, 128
idle, frame 3, 336, 8, 128, 128
idle, frame 4, 496, 8, 128, 128

working, frame 1, 16, 188, 128, 128
working, frame 2, 176, 188, 128, 128
working, frame 3, 336, 188, 128, 128
working, frame 4, 496, 188, 128, 128
working, frame 5, 656, 188, 128, 128
working, frame 6, 816, 188, 128, 128
working, frame 7, 976, 188, 128, 128
working, frame 8, 1136, 188, 128, 128

attention, frame 1, 16, 368, 128, 128
attention, frame 2, 176, 368, 128, 128
attention, frame 3, 336, 368, 128, 128
attention, frame 4, 496, 368, 128, 128
attention, frame 5, 656, 368, 128, 128
attention, frame 6, 816, 368, 128, 128

walk, frame 1, 16, 548, 128, 128
walk, frame 2, 176, 548, 128, 128
walk, frame 3, 336, 548, 128, 128
walk, frame 4, 496, 548, 128, 128
walk, frame 5, 656, 548, 128, 128
walk, frame 6, 816, 548, 128, 128
walk, frame 7, 976, 548, 128, 128
walk, frame 8, 1136, 548, 128, 128
\`\`\`

**After generating:**
1. Save the buffer to Supabase Storage (bucket: \`assets\`, path: \`sprite-sheets/<name>-<timestamp>.png\`).
2. Return the public URL and store it in quest inventory under key \`sprite_sheet_url\`.
`.trim(),
};

export default skillBook;

// ─── Figma callable actions (via figma weapon) ───────────────────────────────

export async function readPages(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  try {
    const data = await wReadFile({ fileKey, depth: 1 }, userId);
    const pages = (data?.document?.children || []).map((p) => ({
      id: p.id,
      name: p.name,
      childCount: p.children?.length ?? 0,
    }));
    return skillActionOk({ pages, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}

export async function readPage(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  if (!input?.pageName) return skillActionErr("pageName required");
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  const depth = input?.depth ?? 3;
  try {
    const meta = await wReadFile({ fileKey, depth: 1 }, userId);
    const pages = meta?.document?.children || [];
    const page = pages.find(
      (p) => p.name.toLowerCase() === input.pageName.toLowerCase()
    );
    if (!page) {
      const names = pages.map((p) => p.name).join(", ");
      return skillActionErr(`Page "${input.pageName}" not found. Available: ${names}`);
    }
    const nodes = await wReadNodes({ fileKey, nodeIds: [page.id] }, userId);
    const pageNode = nodes?.nodes?.[page.id]?.document ?? page;
    return skillActionOk({ page: pageNode, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}

export async function exportFrames(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  if (!Array.isArray(input?.nodeIds) || input.nodeIds.length === 0)
    return skillActionErr("nodeIds (array) required");
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  try {
    const data = await wReadExport(
      { fileKey, nodeIds: input.nodeIds, format: input.format ?? "png", scale: input.scale ?? 2 },
      userId
    );
    return skillActionOk({ images: data?.images ?? {}, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}

export async function readComponents(a, b) {
  const [userId, input] = typeof a === "string" ? [a, b ?? {}] : [undefined, a ?? {}];
  const fileKey = input?.fileKey || PRIMARY_FILE_KEY;
  try {
    const data = await wReadFile({ fileKey, depth: 2 }, userId);
    const components = [];
    for (const page of data?.document?.children || []) {
      for (const node of page.children || []) {
        components.push({
          id: node.id,
          name: node.name,
          page: page.name,
          type: node.type,
        });
      }
    }
    return skillActionOk({ components, fileKey });
  } catch (e) {
    return skillActionErr(e.message);
  }
}
