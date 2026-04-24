/**
 * Graphic skill book — standards and prompts for AI-generated game art assets.
 * All image generation routes through the `openai_images` weapon using gpt-image-2.
 */

export const skillBook = {
  id: "graphic",
  title: "Graphic",
  description: "Generate and manage game art assets using gpt-image-2 via the openai_images weapon.",

  toc: {
    generateSpriteSheet: "Generate a chibi character sprite sheet (1280×720, 8×4 grid, 4 animations) using the locked standard prompt via gpt-image-2.",
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
