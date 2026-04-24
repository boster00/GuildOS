import { readFileSync } from "fs";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const key = env.CURSOR_API_KEY;
const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
const prompt = readFileSync(process.argv[2], "utf8");
const res = await fetch("https://api.cursor.com/v0/agents", {
  method: "POST",
  headers: { Authorization: auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: { text: prompt },
    model: "composer-2",
    source: { repository: "https://github.com/boster00/cjgeo", ref: "main" },
    target: { autoCreatePr: false },
  }),
});
const txt = await res.text();
console.log("status:", res.status);
console.log("body:", txt.slice(0, 1000));
