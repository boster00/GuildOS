/** Built-in portrait options (served from `public/`). */
export const PORTRAIT_PRESETS = [
  {
    id: "monkey",
    label: "Monkey",
    src: "/images/guildos/portraits/preset-monkey.png",
    hint: "Four-state chibi sheet style",
  },
  {
    id: "rabbit",
    label: "Rabbit",
    src: "/images/guildos/portraits/preset-rabbit.png",
    hint: "Four-state chibi sheet style",
  },
];

/**
 * Server-side `fetch()` cannot load relative URLs; use an absolute URL for same-origin assets.
 * Call from the browser when posting to `/api/adventurer/avatar`.
 */
export function absoluteUrlForReferenceFetch(url) {
  if (typeof window === "undefined") return String(url || "").trim();
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return `${window.location.origin}${u}`;
  return u;
}
