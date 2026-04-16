import { readFileSync } from "fs";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const key = env.CURSOR_API_KEY;
const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
const AGENT = process.argv[2];
const N = parseInt(process.argv[3] || "3");
const res = await fetch(`https://api.cursor.com/v0/agents/${AGENT}/conversation`, { headers: { Authorization: auth } });
const data = await res.json();
const msgs = data.messages || [];
for (const m of msgs.slice(-N)) {
  console.log(`\n--- ${m.type} ---`);
  console.log(m.text?.substring(0, 3000) || "(empty)");
}
console.log(`\nTotal messages: ${msgs.length}`);
