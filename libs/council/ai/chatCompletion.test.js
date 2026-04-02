import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = {
        completions: {
          create: createMock,
        },
      };
    }
  },
}));

import { runGenericChat } from "./chatCompletion.js";

describe("runGenericChat", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    createMock.mockResolvedValue({
      choices: [{ message: { content: "Why did the cat sit on the laptop? To keep an eye on the mouse." } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  });

  it("returns assistant text from chat.completions", async () => {
    const out = await runGenericChat({
      messages: [{ role: "user", content: "Tell a short cat joke." }],
    });
    expect(out.text).toContain("cat");
    expect(out.model).toBeTruthy();
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Tell a short cat joke." }],
      }),
    );
  });

  it("throws when messages is empty", async () => {
    await expect(runGenericChat({ messages: [] })).rejects.toThrow(/non-empty/);
  });
});
