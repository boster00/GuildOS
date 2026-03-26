/**
 * Static capability list for Eden Test capability explorer.
 * type: "native" | "composed"
 * recipe: optional array of steps for composed capabilities.
 */

export const CAPABILITIES = [
  {
    id: "chat-single",
    name: "Single-model chat",
    category: "LLM",
    type: "native",
    useCase: "One prompt, one model response.",
    inputs: ["prompt", "modelId"],
    output: "text",
    difficulty: "easy",
  },
  {
    id: "chat-batch",
    name: "Multi-model batch chat",
    category: "LLM",
    type: "native",
    useCase: "Same prompt across multiple models for comparison.",
    inputs: ["prompt", "modelIds[]"],
    output: "text[]",
    difficulty: "easy",
  },
  {
    id: "image-text",
    name: "Text-to-image",
    category: "Image",
    type: "native",
    useCase: "Generate image from text prompt.",
    inputs: ["prompt", "size?"],
    output: "image URL",
    difficulty: "easy",
  },
  {
    id: "image-edit",
    name: "Image-to-image edit",
    category: "Image",
    type: "native",
    useCase: "Edit image with text instruction.",
    inputs: ["image", "prompt"],
    output: "image URL",
    difficulty: "medium",
  },
  {
    id: "video-async",
    name: "Video generation (async)",
    category: "Video",
    type: "native",
    useCase: "Create video job, poll for completion.",
    inputs: ["prompt", "options?"],
    output: "video URL (when ready)",
    difficulty: "medium",
  },
  {
    id: "tts",
    name: "Text-to-speech",
    category: "Audio",
    type: "native",
    useCase: "Synthesize speech from text.",
    inputs: ["text", "voice?"],
    output: "audio URL / base64",
    difficulty: "easy",
  },
  {
    id: "blog-seo",
    name: "Blog + SEO (composed)",
    category: "Content",
    type: "composed",
    recipe: [
      { step: 1, action: "Research prompts", api: "chat" },
      { step: 2, action: "Create outline", api: "chat" },
      { step: 3, action: "Draft sections", api: "chat" },
      { step: 4, action: "Optimize for keywords", api: "chat" },
    ],
    useCase: "End-to-end blog with outline and keyword optimization.",
    inputs: ["topic", "keywords[]"],
    output: "outline + draft",
    difficulty: "hard",
  },
  {
    id: "image-plus-caption",
    name: "Image + caption (composed)",
    category: "Content",
    type: "composed",
    recipe: [
      { step: 1, action: "Generate image", api: "image" },
      { step: 2, action: "Describe image (vision)", api: "chat" },
    ],
    useCase: "Generate image then get a caption via vision model.",
    inputs: ["imagePrompt"],
    output: "image URL + caption",
    difficulty: "medium",
  },
];

export const CATEGORIES = [...new Set(CAPABILITIES.map((c) => c.category))];
