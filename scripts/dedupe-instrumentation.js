const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const EXCLUDE = new Set(["node_modules", ".next", "_archive", ".git"]);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!EXCLUDE.has(e.name)) walk(full, out);
      continue;
    }
    if ([".js", ".ts", ".jsx", ".tsx"].includes(path.extname(e.name))) out.push(full);
  }
  return out;
}

const dirs = ["app", "libs", "components", "config"].map((d) => path.join(ROOT, d));
let files = [];
for (const d of dirs) {
  if (fs.existsSync(d)) files = files.concat(walk(d));
}

const pat = /^\s*console\.log\("\[[^\]]+\][^"]*"\);\s*$/;
let dup = 0;
for (const fp of files) {
  const c = fs.readFileSync(fp, "utf8");
  const lines = c.split("\n");
  const out = [];
  let prev = "";
  for (const line of lines) {
    const t = line.trim();
    if (pat.test(t) && t === prev) {
      dup++;
      continue;
    }
    if (pat.test(t)) prev = t;
    else prev = "";
    out.push(line);
  }
  const newC = out.join("\n");
  if (newC !== c) fs.writeFileSync(fp, newC, "utf8");
}
