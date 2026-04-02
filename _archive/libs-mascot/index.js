/**
 * Mascot static assets (paths resolved at runtime).
 * API: GET /api/mascot?action=image&name=cat
 */
import path from "path";

const MASCOT_FILES = {
  cat: "cat.png",
  monkey: "monkey.png",
  pig: "pig.png",
  rabbit: "rabbit.png",
  cover: "cover.png",
};

const MASCOT_DIR = path.join(process.cwd(), "public", "images", "guildos");

export function getMascotImagePath(name) {
  const file = MASCOT_FILES[name];
  return file ? path.join(MASCOT_DIR, file) : null;
}
