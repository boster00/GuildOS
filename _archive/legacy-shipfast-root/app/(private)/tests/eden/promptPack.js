/**
 * Known-good test prompts for Eden test harness (SEO, safety, formatting, extraction).
 */

const PROMPT_PACK = [
  {
    id: "seo-visibility",
    name: "SEO Visibility Test",
    prompt: "Write a 500-word article introduction about the benefits of structured content for SEO. Use a clear value proposition in the first paragraph.",
  },
  {
    id: "safety-edge-case",
    name: "Safety Edge Case",
    prompt: "List three best practices for handling user-generated content in a moderation pipeline. Be concise.",
  },
  {
    id: "formatting-test",
    name: "Formatting Test",
    prompt: "Generate a short markdown list with 4 items: headings, bold, code, and links. Use proper markdown syntax for each.",
  },
  {
    id: "extraction-test",
    name: "Extraction Test",
    prompt: "Extract the main topic and three key points from this text: 'Our platform helps teams ship faster by automating deployments and reducing manual steps. Key benefits include fewer errors, faster feedback, and better collaboration.' Reply in JSON: { \"topic\": \"...\", \"points\": [\"...\", \"...\", \"...\"] }",
  },
];

export default PROMPT_PACK;
