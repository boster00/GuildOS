// ARCHIVED: Original path was tests/content-magic/resolveRelativeUrlsInHtml.test.js

import { describe, it, expect } from "vitest";
import {
  resolveRelativeUrlsInHtml,
} from "@/libs/content-magic/utils/resolveRelativeUrlsInHtml";
import { normalizeMediaDomain } from "@/libs/content-magic/utils/normalizeMediaDomain";

describe("normalizeMediaDomain", () => {
  it("returns origin for valid domain", () => {
    expect(normalizeMediaDomain("example.com")).toBe("https://example.com");
    expect(normalizeMediaDomain("https://example.com/")).toBe("https://example.com");
    expect(normalizeMediaDomain("https://example.com/assets")).toBe("https://example.com");
  });

  it("returns null for empty input", () => {
    expect(normalizeMediaDomain("")).toBe(null);
    expect(normalizeMediaDomain("   ")).toBe(null);
  });

  it("returns error object for invalid URL", () => {
    const result = normalizeMediaDomain("not a url !!!");
    expect(result).toHaveProperty("error");
    expect(typeof result.error).toBe("string");
  });
});

describe("resolveRelativeUrlsInHtml", () => {
  const base = "https://x.com";

  it("resolves img src", () => {
    const html = '<img src="/a.png">';
    const out = resolveRelativeUrlsInHtml(html, base);
    expect(out).toContain('src="https://x.com/a.png"');
  });

  it("resolves url() in style blocks", () => {
    const html = "<style>.x{background:url(/b.png)}</style>";
    const out = resolveRelativeUrlsInHtml(html, base);
    expect(out).toContain("https://x.com/b.png");
  });

  it("keeps a[href] unchanged when resolveLinks is false", () => {
    const html = '<a href="/page">Link</a>';
    const out = resolveRelativeUrlsInHtml(html, base, { resolveLinks: false });
    expect(out).toContain('href="/page"');
  });

  it("rewrites a[href] when resolveLinks is true", () => {
    const html = '<a href="/page">Link</a>';
    const out = resolveRelativeUrlsInHtml(html, base, { resolveLinks: true });
    expect(out).toContain('href="https://x.com/page"');
  });

  it("never rewrites javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">X</a>';
    const out = resolveRelativeUrlsInHtml(html, base, { resolveLinks: true });
    expect(out).toContain('href="javascript:alert(1)"');
  });

  it("skips already absolute URLs", () => {
    const html = '<img src="https://other.com/img.png">';
    const out = resolveRelativeUrlsInHtml(html, base);
    expect(out).toContain('src="https://other.com/img.png"');
  });

  it("skips data: URIs", () => {
    const html = '<img src="data:image/png;base64,abc">';
    const out = resolveRelativeUrlsInHtml(html, base);
    expect(out).toContain('src="data:image/png;base64,abc"');
  });
});
