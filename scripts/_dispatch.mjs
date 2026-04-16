import { readFileSync } from "fs";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const key = env.CURSOR_API_KEY;
const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
const AGENT = process.argv[2];
const msgFile = process.argv[3];
const message = msgFile ? readFileSync(msgFile, "utf8") : process.argv.slice(3).join(" ");
const res = await fetch(`https://api.cursor.com/v0/agents/${AGENT}/followup`, {
  method: "POST",
  headers: { Authorization: auth, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: { text: message } }),
});
if (!res.ok) { console.error("Failed:", res.status, await res.text()); process.exit(1); }
console.log("Sent to", AGENT);
