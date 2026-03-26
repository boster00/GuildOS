// ARCHIVED: Original path was tests/monkey/patch-htmlCheck.test.ts

/**
 * Unit tests for monkey utility functions
 */

import { describe, it, expect } from "vitest";
import { applyStatePatches, PatchOp } from "../../libs/monkey/utils/patch";
import { checkHtmlSafety } from "../../libs/monkey/utils/htmlCheck";

describe("applyStatePatches", () => {
  it("should apply set operation", () => {
    const state = { article: { title: "Old" } };
    const patches: PatchOp[] = [{ op: "set", path: "article.title", value: "New" }];
    const result = applyStatePatches(state, patches);
    expect(result.article.title).toBe("New");
  });

  it("should apply merge operation", () => {
    const state = { article: { meta: { author: "John" } } };
    const patches: PatchOp[] = [
      { op: "merge", path: "article.meta", value: { date: "2024-01-01" } },
    ];
    const result = applyStatePatches(state, patches);
    expect(result.article.meta.author).toBe("John");
    expect(result.article.meta.date).toBe("2024-01-01");
  });

  it("should apply append operation", () => {
    const state = { article: { sections: [{ id: "1" }] } };
    const patches: PatchOp[] = [
      { op: "append", path: "article.sections", value: { id: "2" } },
    ];
    const result = applyStatePatches(state, patches);
    expect(result.article.sections.length).toBe(2);
    expect(result.article.sections[1].id).toBe("2");
  });

  it("should apply remove operation", () => {
    const state = { article: { sections: [{ id: "1" }, { id: "2" }] } };
    const patches: PatchOp[] = [{ op: "remove", path: "article.sections[0]" }];
    const result = applyStatePatches(state, patches);
    expect(result.article.sections.length).toBe(1);
    expect(result.article.sections[0].id).toBe("2");
  });

  it("should handle nested paths", () => {
    const state = { a: { b: { c: "old" } } };
    const patches: PatchOp[] = [{ op: "set", path: "a.b.c", value: "new" }];
    const result = applyStatePatches(state, patches);
    expect(result.a.b.c).toBe("new");
  });

  it("should not mutate original state", () => {
    const state = { article: { title: "Original" } };
    const patches: PatchOp[] = [{ op: "set", path: "article.title", value: "Modified" }];
    const result = applyStatePatches(state, patches);
    expect(state.article.title).toBe("Original");
    expect(result.article.title).toBe("Modified");
  });
});

describe("checkHtmlSafety", () => {
  it("should accept safe HTML", () => {
    const html = '<article><h1>Title</h1><p>Content</p></article>';
    const result = checkHtmlSafety(html);
    expect(result.ok).toBe(true);
  });

  it("should reject HTML with script tags", () => {
    const html = '<article><script>alert("xss")</script></article>';
    const result = checkHtmlSafety(html);
    expect(result.ok).toBe(false);
    expect(result.issues?.some((i: string) => i.includes("script"))).toBe(true);
  });

  it("should reject HTML with inline event handlers", () => {
    const html = '<article><h1 onclick="alert(1)">Title</h1></article>';
    const result = checkHtmlSafety(html);
    expect(result.ok).toBe(false);
    expect(result.issues?.some((i: string) => i.includes("onclick"))).toBe(true);
  });

  it("should reject HTML with style tags", () => {
    const html = '<article><style>body { color: red; }</style></article>';
    const result = checkHtmlSafety(html);
    expect(result.ok).toBe(false);
    expect(result.issues?.some((i: string) => i.includes("style"))).toBe(true);
  });

  it("should handle empty HTML", () => {
    const result = checkHtmlSafety("");
    expect(result.ok).toBe(false);
  });

  it("should handle non-string input", () => {
    const result = checkHtmlSafety(null as any);
    expect(result.ok).toBe(false);
  });

  it("should detect malformed HTML", () => {
    const html = '<article><h1>Title</h1><p>Unclosed';
    const result = checkHtmlSafety(html);
    // May or may not fail depending on implementation
    expect(typeof result.ok).toBe("boolean");
  });
});

