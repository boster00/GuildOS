/**
 * Obsolete File Report Generator
 * Scans the codebase for suspected obsolete files and writes _obsolete-report.md.
 * Run: node scripts/generate-obsolete-report.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".self-diagnose", ".cursor"]);
const SOURCE_EXT = [".js", ".ts", ".jsx", ".tsx"];
const DOC_EXT = [".md"];
const KNOWN_DEAD_DIRS = ["base44_generated_code", "libs/agent-kit"];
const ROOT_NOTE_PATTERNS = [/_COMPLETE\.md$/, /_SUMMARY\.md$/, /_IMPROVEMENTS\.md$/, /_FIX\.md$/];
const DEPRECATED_PATTERNS = [
  /\bDEPRECATED\b/i,
  /@deprecated/i,
  /TODO:\s*remove/i,
  /\bobsolete\b/i,
];
const OLD_COMMIT_DAYS = 90;

// --- File walker ---

function walkFiles(dir, extensions, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (!EXCLUDE_DIRS.has(e.name)) walkFiles(full, extensions, fileList);
      continue;
    }
    const ext = path.extname(e.name).toLowerCase();
    if (extensions.includes(ext)) fileList.push(rel);
  }
  return fileList;
}

function getAllSourceFiles() {
  const fromRoot = walkFiles(ROOT, SOURCE_EXT);
  const rootMd = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name);
  return [...fromRoot, ...rootMd];
}

// --- Next.js convention (excluded from zero-import check) ---

function isNextjsConvention(relPath) {
  const base = path.basename(relPath).toLowerCase();
  if (base === "middleware.js" || base === "middleware.ts") return true;
  if (base === "opengraph-image.js" || base === "opengraph-image.ts") return true;
  const names = ["page.js", "page.jsx", "page.ts", "page.tsx", "layout.js", "layout.jsx", "layout.ts", "layout.tsx", "route.js", "route.ts", "loading.js", "loading.ts", "error.js", "error.ts"];
  if (names.includes(base)) return true;
  return false;
}

// --- Import index: for each file, list of files that import it ---

function buildImportIndex(files) {
  const fileSet = new Set(files);
  const index = new Map();
  for (const f of files) index.set(f, []);

  const importRegex = /(?:require\s*\(\s*["']([^"']+)["']\s*\)|from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\))/g;

  for (const file of files) {
    const fullPath = path.join(ROOT, file);
    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      const spec = (m[1] || m[2] || m[3] || "").trim();
      if (!spec) continue;
      const resolved = resolveImportSpecToFile(spec, file, fileSet);
      if (resolved && resolved !== file) {
        const list = index.get(resolved);
        if (list && !list.includes(file)) list.push(file);
      }
    }
  }
  return index;
}

function resolveImportSpecToFile(spec, fromFile, fileSet) {
  const fromDir = path.dirname(fromFile).replace(/\\/g, "/");
  let candidates = [];
  if (spec.startsWith("@/")) {
    const p = spec.slice(2).replace(/\\/g, "/");
    const base = p.replace(/\.(js|ts|jsx|tsx)$/, "");
    candidates = [
      p,
      base + ".js",
      base + ".ts",
      base + ".jsx",
      base + ".tsx",
      base + "/index.js",
      base + "/index.ts",
      base + "/index.jsx",
      base + "/index.tsx",
    ];
  } else {
    const joined = path.join(fromDir, spec).replace(/\\/g, "/");
    const base = joined.replace(/\.(js|ts|jsx|tsx)$/, "");
    candidates = [
      joined,
      base + ".js",
      base + ".ts",
      base + ".jsx",
      base + ".tsx",
      base + "/index.js",
      base + "/index.ts",
    ];
  }
  for (const c of candidates) {
    const normalized = path.normalize(c).replace(/\\/g, "/");
    if (fileSet.has(normalized)) return normalized;
    if (fileSet.has(c)) return c;
  }
  return null;
}

// --- Git last-modified (bulk: one git log, newest commits first so first-seen = last modified) ---

function getGitDatesBulk(files) {
  const fileSet = new Set(files);
  const dates = new Map();
  try {
    const out = execSync('git log -1000 --name-only --format="%ai"', {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    const lines = out.split(/\r?\n/);
    let currentDate = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        currentDate = trimmed;
        continue;
      }
      if (!trimmed || !currentDate) continue;
      const rel = path.relative(ROOT, path.resolve(ROOT, trimmed)).replace(/\\/g, "/");
      if (fileSet.has(rel) && !dates.has(rel)) dates.set(rel, currentDate);
    }
  } catch (_) {
    // ignore
  }
  return dates;
}

function getGitDateSingle(file) {
  try {
    const out = execSync(`git log -1 --format="%ai" -- "${path.join(ROOT, file)}"`, { cwd: ROOT, encoding: "utf8" });
    return out.trim();
  } catch {
    return "";
  }
}

// --- Signals ---

function detectSignals(relPath, content, importers, gitDate, allFiles) {
  const signals = [];
  const normalized = relPath.replace(/\\/g, "/");

  const isNext = isNextjsConvention(relPath);
  if (!isNext && importers.length === 0) signals.push("ZERO_IMPORTS");

  for (const re of DEPRECATED_PATTERNS) {
    if (re.test(content)) {
      signals.push("DEPRECATED_MARKER");
      break;
    }
  }

  for (const d of KNOWN_DEAD_DIRS) {
    if (normalized.startsWith(d + "/") || normalized === d) {
      signals.push("KNOWN_DEAD_DIR");
      break;
    }
  }

  const rootBase = path.basename(relPath);
  if (!relPath.includes("/") && relPath.endsWith(".md")) {
    if (ROOT_NOTE_PATTERNS.some((re) => re.test(relPath))) signals.push("ROOT_NOTE");
  }

  if (relPath.includes("page.js") || relPath.includes("page.jsx") || relPath.includes("page.ts") || relPath.includes("page.tsx")) {
    if (/useRouter\s*\(\s*\)|useRouter\s*\(\)/m.test(content) && /redirect\s*\(|\.push\s*\(/m.test(content) && content.length < 800) {
      signals.push("STUB_REDIRECT");
    }
  }

  if (gitDate) {
    const d = new Date(gitDate);
    const now = new Date();
    const days = (now - d) / (24 * 60 * 60 * 1000);
    if (days > OLD_COMMIT_DAYS) signals.push("OLD_COMMIT");
  }

  return [...new Set(signals)];
}

function getConfidence(signals, relPath, importers) {
  const isNext = isNextjsConvention(relPath);
  const hasZero = signals.includes("ZERO_IMPORTS");
  const hasDep = signals.includes("DEPRECATED_MARKER");
  const hasKnown = signals.includes("KNOWN_DEAD_DIR");
  const hasRoot = signals.includes("ROOT_NOTE");
  const hasStub = signals.includes("STUB_REDIRECT");
  const hasOld = signals.includes("OLD_COMMIT");

  if ((hasZero && hasDep) || (hasZero && hasKnown) || (hasStub && hasDep) || signals.length >= 2) return "High";
  if (hasZero && !isNext) return "Medium";
  if (hasDep || hasKnown || hasStub) return "Medium";
  if (hasRoot || hasOld) return "Low";
  return null;
}

// --- Type ---

function classifyType(relPath) {
  const n = relPath.replace(/\\/g, "/");
  if (n.startsWith("app/(private)/tests/")) return "test-page";
  if (n.startsWith("app/api/")) return "api-route";
  if (n.startsWith("app/") && (n.includes("/page.") || n.endsWith("page.js") || n.endsWith("page.jsx") || n.endsWith("page.ts") || n.endsWith("page.tsx"))) return "page";
  if (n.startsWith("components/")) return "component";
  if (n.startsWith("libs/")) return "lib";
  if (n.startsWith("config/")) return "config";
  if (n.startsWith("docs/") || (path.extname(relPath) === ".md" && !relPath.includes("/"))) return "docs";
  return "lib";
}

// --- Notes (first comment or export) ---

function getNotes(relPath, content) {
  const lines = content.split(/\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("//") && t.length > 2) return t.slice(2).trim().slice(0, 80);
    if (t.startsWith("*") && t.includes("DEPRECATED")) return t.trim().slice(0, 80);
    if (t.startsWith("/*") && t.includes("DEPRECATED")) return t.trim().slice(0, 80);
  }
  const exportMatch = content.match(/export\s+(?:const|function|class)\s+(\w+)/);
  if (exportMatch) return `Exports ${exportMatch[1]}`;
  return "";
}

// --- Main ---

function main() {
  const files = getAllSourceFiles();
  const importIndex = buildImportIndex(files);

  const gitDates = getGitDatesBulk(files);
  for (const f of files) {
    if (!gitDates.has(f)) gitDates.set(f, getGitDateSingle(f));
  }

  const rows = [];
  for (const file of files) {
    if (file === "scripts/generate-obsolete-report.js") continue;
    const fullPath = path.join(ROOT, file);
    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    const importers = importIndex.get(file) || [];
    const gitDate = gitDates.get(file) || "";
    const signals = detectSignals(file, content, importers, gitDate, files);
    const confidence = getConfidence(signals, file, importers);
    if (!confidence) continue;

    const type = classifyType(file);
    const notes = getNotes(file, content);
    rows.push({ file, type, gitDate, signals, notes, confidence });
  }

  const byConfidence = { High: [], Medium: [], Low: [] };
  for (const r of rows) {
    byConfidence[r.confidence].push(r);
  }

  const outPath = path.join(ROOT, "_obsolete-report.md");
  let md = `# Obsolete File Report\n\nGenerated: ${new Date().toISOString()}\n\n`;

  for (const level of ["High", "Medium", "Low"]) {
    const list = byConfidence[level];
    if (list.length === 0) continue;
    md += `## ${level} confidence\n\n`;
    md += `| File | Type | Last Modified | Signals | Notes |\n`;
    md += `|------|------|---------------|---------|-------|\n`;
    for (const r of list) {
      const fileCell = "`" + r.file + "`";
      const sigs = r.signals.join(", ");
      const notes = (r.notes || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const date = r.gitDate ? r.gitDate.slice(0, 10) : "";
      md += `| ${fileCell} | ${r.type} | ${date} | ${sigs} | ${notes} |\n`;
    }
    md += "\n";
  }

  fs.writeFileSync(outPath, md, "utf8");
}

main();
