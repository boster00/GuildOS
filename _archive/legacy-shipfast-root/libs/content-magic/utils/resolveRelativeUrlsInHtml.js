/**
 * Resolve relative URLs in HTML to absolute URLs using a base origin.
 * Pure string/regex manipulation — no DOM parsing, no network fetches.
 * Handles: img src, source srcset, video/audio src, poster, data-* attributes,
 * CSS url() and image-set() in style="" and <style> blocks.
 *
 * @param {string} html - HTML string
 * @param {string} baseUrl - Normalized origin (e.g. https://example.com)
 * @param {{ resolveLinks?: boolean }} opts - resolveLinks: true to also rewrite a[href], form[action], cite (default false)
 * @returns {string} HTML with relative media URLs resolved to absolute
 */
export function resolveRelativeUrlsInHtml(html, baseUrl, opts = {}) {
  const { resolveLinks = false } = opts;

  if (!baseUrl || !html || typeof html !== "string") return html;

  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  const shouldConvert = (path) => {
    if (!path || typeof path !== "string") return false;

    const trimmed = path.trim();

    // Skip if already absolute URL
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) return false;

    // Protocol block: never rewrite into dangerous protocols
    if (/^(javascript:|vbscript:|file:|blob:)/i.test(trimmed)) return false;

    // Skip data URI and other special protocols
    if (/^(data:|mailto:|tel:)/i.test(trimmed)) return false;

    if (trimmed.startsWith("#") || trimmed.startsWith("?")) return false;

    const hasDot = trimmed.includes(".");
    const looksLikeFile =
      hasDot &&
      (trimmed.includes("/") ||
        /\.(css|js|jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot|pdf|mp4|mp3|webm|ogg)$/i.test(
          trimmed
        ));

    if (trimmed.startsWith("/")) return hasDot || trimmed.length > 1;
    return looksLikeFile || (hasDot && trimmed.length > 3);
  };

  const convertPath = (path) => {
    const trimmed = (path || "").trim();
    // Never prepend domain if already absolute (http/https or protocol-relative)
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) return trimmed;
    const cleanPath = trimmed.startsWith("/") ? trimmed : "/" + trimmed;
    return base + cleanPath;
  };

  // Attributes to process. When resolveLinks is false, exclude href, action, formaction, cite
  const mediaAttributes = [
    "src",
    "data",
    "poster",
    "icon",
    "data-src",
    "data-href",
    "data-bg",
    "data-background",
    "data-image",
    "data-lazy-src",
    "data-original",
    "data-lazy",
    "data-srcset",
    "data-background-image",
    "data-poster",
    "data-video-src",
    "data-audio-src",
    "content",
    "codebase",
    "classid",
    "xlink:href",
  ];

  const linkAttributes = ["href", "action", "formaction", "cite"];
  const urlAttributes = resolveLinks ? [...mediaAttributes, ...linkAttributes] : mediaAttributes;

  const attrPattern = new RegExp(
    `(${urlAttributes.join("|")})\\s*=\\s*["']([^"']+)["']`,
    "gi"
  );

  let processed = html;

  // 1. Replace URL-bearing attributes
  processed = processed.replace(attrPattern, (match, attr, path) => {
    if (attr.toLowerCase() === "content" && !path.startsWith("/")) return match;
    if (!shouldConvert(path)) return match;
    return `${attr}="${convertPath(path)}"`;
  });

  // 2. Handle srcset (multiple URLs with descriptors)
  processed = processed.replace(/srcset\s*=\s*["']([^"']+)["']/gi, (match, srcsetValue) => {
    const converted = srcsetValue
      .split(",")
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        const path = parts[0];
        const descriptor = parts.slice(1).join(" ");
        if (shouldConvert(path)) {
          return descriptor ? `${convertPath(path)} ${descriptor}` : convertPath(path);
        }
        return entry.trim();
      })
      .join(", ");
    return `srcset="${converted}"`;
  });

  // 3. Replace url() in CSS (style attributes, <style> blocks)
  processed = processed.replace(
    /url\s*\(\s*(['"]?)([^'")]+?)\1\s*\)/gi,
    (match, quote, path, offset, fullString) => {
      const trimmedPath = path.trim();
      if (!shouldConvert(trimmedPath)) return match;

      const beforeMatch = fullString.substring(Math.max(0, offset - 200), offset);
      const lastDoubleQuote = beforeMatch.lastIndexOf('"');
      const lastSingleQuote = beforeMatch.lastIndexOf("'");
      const lastEquals = beforeMatch.lastIndexOf("=");
      const insideDoubleQuotedAttr = lastDoubleQuote > lastEquals && lastEquals > -1;
      const insideSingleQuotedAttr = lastSingleQuote > lastEquals && lastEquals > -1;

      if (insideDoubleQuotedAttr || insideSingleQuotedAttr) {
        return `url(${convertPath(trimmedPath)})`;
      }
      return `url("${convertPath(trimmedPath)}")`;
    }
  );

  // 4. Handle image-set() CSS function
  processed = processed.replace(
    /image-set\s*\(\s*([^)]+?)\s*\)/gi,
    (match, imageSetValue, offset, fullString) => {
      const beforeMatch = fullString.substring(Math.max(0, offset - 200), offset);
      const lastDoubleQuote = beforeMatch.lastIndexOf('"');
      const lastSingleQuote = beforeMatch.lastIndexOf("'");
      const lastEquals = beforeMatch.lastIndexOf("=");
      const insideQuotedAttr =
        (lastDoubleQuote > lastEquals || lastSingleQuote > lastEquals) && lastEquals > -1;

      const converted = imageSetValue.replace(
        /url\s*\(\s*(['"]?)([^'")]+?)\1\s*\)/gi,
        (urlMatch, quote, path) => {
          const trimmedPath = path.trim();
          if (shouldConvert(trimmedPath)) {
            if (insideQuotedAttr) return `url(${convertPath(trimmedPath)})`;
            return `url("${convertPath(trimmedPath)}")`;
          }
          return urlMatch;
        }
      );
      return `image-set(${converted})`;
    }
  );

  // 5. Universal catch-all for quoted file paths
  processed = processed.replace(
    /(["'])((?:\/|[^"'\s/]+[\/])[^"']+?\.[^"']+?)\1/g,
    (match, quote, path, offset, fullString) => {
      const beforeMatch = fullString.substring(Math.max(0, offset - 100), offset);
      if (beforeMatch.match(/url\s*\(\s*$/i)) return match;
      if (match.includes(base)) return match;

      const attrMatch = beforeMatch.match(
        /\b(src|href|data-\w+|xlink:href|poster|action|content|cite)\s*=\s*$/i
      );
      if (attrMatch) return match;

      if (!shouldConvert(path)) return match;
      return `${quote}${convertPath(path)}${quote}`;
    }
  );

  return processed;
}
