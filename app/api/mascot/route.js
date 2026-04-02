/**
 * Mascot images from public/images/guildos — triage via ?action=
 */
import path from "path";
import { readFile } from "fs/promises";

const MASCOT_FILES = {
  cat: "cat.png",
  monkey: "monkey.png",
  pig: "pig.png",
  rabbit: "rabbit.png",
  cover: "cover.png",
};

const MASCOT_DIR = path.join(process.cwd(), "public", "images", "guildos");

function getMascotImagePath(name) {
  const file = MASCOT_FILES[name];
  return file ? path.join(MASCOT_DIR, file) : null;
}

export async function GET(request) {
  const action = request.nextUrl.searchParams.get("action");
  if (action !== "image") {
    return Response.json(
      {
        error: "Missing or invalid action",
        validActions: ["image"],
        example: "/api/mascot?action=image&name=cat",
      },
      { status: 400 }
    );
  }

  const name = request.nextUrl.searchParams.get("name");
  if (!name) {
    return Response.json({ error: "name query parameter is required" }, { status: 400 });
  }

  const path = getMascotImagePath(name);
  if (!path) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await readFile(path);
    return new Response(file, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 404 });
  }
}
