/**
 * 1. Remove all console.log/warn/error/debug/info from source files.
 * 2. Add at the start of each function:  
 * Scope: app/, libs/, components/, config/. Excludes: node_modules, .next, _archive.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDE_DIRS = new Set(["node_modules", ".next", "_archive", ".git"]);
const EXT = [".js", ".ts", ".jsx", ".tsx"];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.has(e.name)) walk(full, out);
      continue;
    }
    if (EXT.includes(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

function removeConsoleStatements(content) {
  let s = content;
  // Remove single-line console.(log|warn|error|debug|info)(...); (no newlines inside parens)
  s = s.replace(/^\s*console\.(log|warn|error|debug|info)\s*\([^()]*\);?\s*$/gm, "");
  // Multi-line: find console.xxx( and remove until matching );
  while (true) {
    const idx = s.search(/console\.(log|warn|error|debug|info)\s*\(/);
    if (idx === -1) break;
    let depth = 0;
    let i = s.indexOf("(", idx);
    for (; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") { depth--; if (depth === 0) break; }
      else if (s[i] === '"' || s[i] === "'" || s[i] === "`") {
        const q = s[i];
        i++;
        while (i < s.length && (s[i] !== q || s[i - 1] === "\\")) i++;
      }
    }
    const end = s.indexOf(";", i);
    const endPos = end !== -1 ? end + 1 : i + 1;
    s = s.slice(0, idx) + s.slice(endPos);
  }
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

function addPerFunctionLogs(content, filePath) {
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
  let s = content;
  // Order: export default function first, then plain function (so we don't double-match)
  // export default function name( ... ) {
  s = s.replace(
    /(export\s+default\s+function\s+(\w+)\s*\([^)]*\)\s*\{)/g,
    (m, open, name) => open + "\n  console.log(\"[" + relPath + "] " + name + "\");"
  );
  // function name( ... ) {  (but not "export default function name", already handled)
  s = s.replace(
    /(\b(?<!export\s+default\s+)function\s+(\w+)\s*\([^)]*\)\s*\{)/g,
    (m, open, name) => open + "\n  console.log(\"[" + relPath + "] " + name + "\");"
  );
  // name = function( ... ) {
  s = s.replace(
    /(\b(\w+)\s*=\s*function\s*\([^)]*\)\s*\{)/g,
    (m, open, name) => open + "\n  console.log(\"[" + relPath + "] " + name + "\");"
  );
  // name = ( ... ) => {
  s = s.replace(
    /(\b(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{)/g,
    (m, open, name) => open + "\n  console.log(\"[" + relPath + "] " + name + "\");"
  );
  return s;
}

const dirs = ["app", "libs", "components", "config"];
let allFiles = [];
for (const d of dirs) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    allFiles = allFiles.concat(walk(full));
  }
}
// Root-level app files
["middleware.js", "middleware.ts"].forEach((f) => {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) allFiles.push(full);
});

let removed = 0;
let instrumented = 0;
for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, "utf8");
  const before = content;
  content = removeConsoleStatements(content);
  if (content !== before) removed++;
  content = addPerFunctionLogs(content, filePath);
  instrumented++;
  fs.writeFileSync(filePath, content, "utf8");
}
