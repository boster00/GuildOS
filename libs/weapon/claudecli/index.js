/**
 * claudeCLI weapon — invokes `claude --print --dangerously-skip-permissions` as a child
 * process and returns stdout as an HTML report. Used exclusively by the Blacksmith.
 *
 * Requires `claude` CLI to be installed. Resolves the full path via `where` (Windows)
 * or `which` (Unix) so that execFile works without shell interpolation issues.
 */
import { execFile, execSync } from "child_process";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Resolve full path to `claude` binary once (cached). */
let _claudePath = null;
function getClaudePath() {
  if (_claudePath) return _claudePath;
  const cmd = process.platform === "win32" ? "where claude" : "which claude";
  const raw = execSync(cmd, { encoding: "utf8" }).trim();
  _claudePath = raw.split(/\r?\n/)[0]; // first match
  return _claudePath;
}

/**
 * Invoke the Claude CLI with a task prompt. Expects Claude to output a complete HTML document.
 *
 * @param {string} taskPrompt
 * @returns {Promise<{ ok: boolean, html: string, rawOutput: string, error?: string }>}
 */
export async function invoke(taskPrompt) {
  if (!taskPrompt || typeof taskPrompt !== "string" || !taskPrompt.trim()) {
    return { ok: false, html: "", rawOutput: "", error: "taskPrompt is required" };
  }

  let claudeBin;
  try {
    claudeBin = getClaudePath();
  } catch (e) {
    const msg = `Could not find claude CLI on PATH: ${e.message || e}`;
    return { ok: false, html: buildErrorHtml(msg, ""), rawOutput: "", error: msg };
  }

  return new Promise((resolve) => {
    execFile(
      claudeBin,
      ["--print", "--dangerously-skip-permissions", taskPrompt.trim()],
      { cwd: process.cwd(), timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (process.env.NODE_ENV === "development" && stderr) {
          process.stderr.write(`[claudecli:stderr] ${stderr}`);
        }

        const rawOutput = stdout || "";

        if (err) {
          const isTimeout = err.killed || err.code === "ETIMEDOUT";
          const msg = isTimeout ? "Claude CLI timed out after 5 minutes." : `Claude CLI error: ${err.message}`;
          resolve({
            ok: false,
            html: buildErrorHtml(msg, rawOutput),
            rawOutput,
            error: isTimeout ? "timeout" : err.message,
          });
          return;
        }

        resolve({ ok: true, html: rawOutput.trim(), rawOutput });
      },
    );
  });
}

/** @param {string} msg @param {string} log */
function buildErrorHtml(msg, log) {
  const escaped = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>claudeCLI Error</title>
<style>body{font-family:monospace;padding:2rem;background:#1a1a1a;color:#f87171}
pre{white-space:pre-wrap;word-break:break-all;color:#d1d5db;background:#111;padding:1rem;border-radius:6px}</style>
</head><body><h2>claudeCLI Error</h2><p>${escaped(msg)}</p>${log ? `<pre>${escaped(log)}</pre>` : ""}</body></html>`;
}
