/**
 * claudeCLI weapon — spawns `claude --print --dangerously-skip-permissions` as a child
 * process and returns stdout as an HTML report. Used exclusively by the Blacksmith.
 *
 * Requires `claude` CLI to be installed and on PATH where the Next.js dev server runs.
 */
import { spawn } from "child_process";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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

  return new Promise((resolve) => {
    let rawOutput = "";
    let timedOut = false;

    const proc = spawn("claude", ["--print", "--dangerously-skip-permissions", taskPrompt.trim()], {
      cwd: process.cwd(),
      shell: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, TIMEOUT_MS);

    proc.stdout.on("data", (chunk) => {
      rawOutput += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      // Log stderr but don't treat as failure — claude CLI may write status lines there
      if (process.env.NODE_ENV === "development") {
        process.stderr.write(`[claudecli:stderr] ${chunk.toString()}`);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          ok: false,
          html: buildErrorHtml("Claude CLI timed out after 5 minutes.", rawOutput),
          rawOutput,
          error: "timeout",
        });
        return;
      }
      if (code !== 0) {
        resolve({
          ok: false,
          html: buildErrorHtml(`Claude CLI exited with code ${code}.`, rawOutput),
          rawOutput,
          error: `exit_code_${code}`,
        });
        return;
      }
      resolve({ ok: true, html: rawOutput.trim(), rawOutput });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      const msg = err.message || String(err);
      resolve({
        ok: false,
        html: buildErrorHtml(`Failed to spawn claude CLI: ${msg}`, ""),
        rawOutput: "",
        error: msg,
      });
    });
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
