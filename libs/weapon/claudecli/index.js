/**
 * claudeCLI weapon — invokes `claude --print --dangerously-skip-permissions` and returns
 * stdout. Uses exec() with a temp file for the prompt to avoid shell escaping issues
 * and environment quirks in the Next.js dev server.
 */
import { exec } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @param {string} taskPrompt
 * @returns {Promise<{ ok: boolean, html: string, rawOutput: string, error?: string }>}
 */
export async function invoke(taskPrompt) {
  if (!taskPrompt || typeof taskPrompt !== "string" || !taskPrompt.trim()) {
    return { ok: false, html: "", rawOutput: "", error: "taskPrompt is required" };
  }

  // Write prompt to a temp file so we don't have to shell-escape it
  const tmpFile = join(tmpdir(), `claudecli-${randomUUID()}.txt`);
  try {
    writeFileSync(tmpFile, taskPrompt.trim(), "utf8");
  } catch (e) {
    return { ok: false, html: buildErrorHtml(`Failed to write temp file: ${e.message}`, ""), rawOutput: "", error: e.message };
  }

  // Use `type` (Windows) or `cat` (Unix) to pipe the prompt file into claude --print
  const cat = process.platform === "win32" ? "type" : "cat";
  const cmd = `${cat} "${tmpFile}" | claude --print --dangerously-skip-permissions`;

  return new Promise((resolve) => {
    exec(cmd, { cwd: process.cwd(), timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      // Clean up temp file
      try { unlinkSync(tmpFile); } catch { /* ignore */ }

      if (process.env.NODE_ENV === "development" && stderr) {
        process.stderr.write(`[claudecli:stderr] ${stderr}`);
      }

      const rawOutput = stdout || "";

      if (err) {
        const isTimeout = err.killed || err.code === "ETIMEDOUT";
        const msg = isTimeout ? "Claude CLI timed out after 5 minutes." : `Claude CLI error: ${err.message}`;
        resolve({ ok: false, html: buildErrorHtml(msg, rawOutput), rawOutput, error: isTimeout ? "timeout" : err.message });
        return;
      }

      resolve({ ok: true, html: rawOutput.trim(), rawOutput });
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
