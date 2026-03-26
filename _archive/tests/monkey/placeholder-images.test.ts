// ARCHIVED: Original path was tests/monkey/placeholder-images.test.ts

/**
 * Tests for placeholder image replacement
 */

import { processPlaceholderImages, processPlaceholderImagesSync } from "../../libs/monkey/tools/renderers/processPlaceholderImages";

describe("processPlaceholderImages", () => {
  it("should replace missing src with placeholder based on logo alt text", () => {
    const html = '<img alt="Company Logo" />';
    const result = processPlaceholderImagesSync(html, "professional");
    expect(result).toContain('src="/images/placeholders/professional/logo.svg"');
  });

  it("should replace empty src with placeholder based on avatar alt text", () => {
    const html = '<img src="" alt="User Avatar" />';
    const result = processPlaceholderImagesSync(html, "casual");
    expect(result).toContain('src="/images/placeholders/casual/avatar.svg"');
  });

  it("should replace placeholder text in src with placeholder based on product alt text", () => {
    const html = '<img src="placeholder" alt="Product Image" />';
    const result = processPlaceholderImagesSync(html, "minimalist");
    expect(result).toContain('src="/images/placeholders/minimalist/product.svg"');
  });

  it("should replace broken image pattern with placeholder based on banner alt text", () => {
    const html = '<img src="broken-image.jpg" alt="Hero Banner" />';
    const result = processPlaceholderImagesSync(html, "colorful");
    expect(result).toContain('src="/images/placeholders/colorful/banner.svg"');
  });

  it("should use default placeholder when no matching keywords found", () => {
    const html = '<img alt="Some Random Image" />';
    const result = processPlaceholderImagesSync(html, "corporate");
    expect(result).toContain('src="/images/placeholders/corporate/default.svg"');
  });

  it("should preserve valid image src", () => {
    const html = '<img src="/actual-image.jpg" alt="Company Logo" />';
    const result = processPlaceholderImagesSync(html, "professional");
    expect(result).toContain('src="/actual-image.jpg"');
  });

  it("should handle multiple images in HTML", () => {
    const html = `
      <img alt="Company Logo" />
      <img src="/valid.jpg" alt="Valid Image" />
      <img src="" alt="User Profile" />
    `;
    const result = processPlaceholderImagesSync(html, "creative");
    expect(result).toContain('/images/placeholders/creative/logo.svg');
    expect(result).toContain('src="/valid.jpg"');
    expect(result).toContain('/images/placeholders/creative/avatar.svg');
  });

  it("should handle logo keyword priority correctly", () => {
    // Logo should take priority over other keywords
    const html = '<img alt="Company Logo and Brand" />';
    const result = processPlaceholderImagesSync(html, "professional");
    expect(result).toContain('/images/placeholders/professional/logo.svg');
  });

  it("should handle self-closing img tags", () => {
    const html = '<img src="" alt="Icon Symbol" />';
    const result = processPlaceholderImagesSync(html, "minimalist");
    expect(result).toContain('/images/placeholders/minimalist/icon.svg');
  });

  it("should default to professional theme when invalid theme provided", () => {
    const html = '<img alt="Company Logo" />';
    const result = processPlaceholderImagesSync(html, "invalid" as any);
    expect(result).toContain('/images/placeholders/professional/logo.svg');
  });

  it("should handle case-insensitive keyword matching", () => {
    const html = '<img alt="COMPANY LOGO" />';
    const result = processPlaceholderImagesSync(html, "professional");
    expect(result).toContain('/images/placeholders/professional/logo.svg');
  });

  it("should handle images without alt text", () => {
    const html = '<img src="" />';
    const result = processPlaceholderImagesSync(html, "professional");
    expect(result).toContain('/images/placeholders/professional/default.svg');
  });
});
