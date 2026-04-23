/**
 * Bioinvsync weapon — SSH/SFTP access to the bioinvsync.com legacy server.
 *
 * Host:  69.27.32.79  Port: 2223  User: bioinvsync
 * Key:   C:\Users\xsj70\bioinvsync.ppk  (PuTTY format)
 *
 * Uses plink.exe (PuTTY) which reads .ppk natively.
 * Requires Pageant to be running with the key loaded for non-interactive use.
 * Start Pageant: C:\Program Files\PuTTY\pageant.exe C:\Users\xsj70\bioinvsync.ppk
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HOST = "69.27.32.79";
const PORT = "2223";
const USER = "bioinvsync";
const KEY_FILE = "C:\\Users\\xsj70\\bioinvsync.ppk";
const PLINK = "C:\\Program Files\\PuTTY\\plink.exe";
const DEFAULT_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isPageantRunning() {
  try {
    const { stdout } = await execFileAsync("tasklist", [], { timeout: 5000 });
    return stdout.toLowerCase().includes("pageant");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Execute a command on the bioinvsync server via SSH.
 * @param {{ command: string, timeout?: number }} input
 */
export async function executeCommand({ command, timeout } = {}) {
  if (!command) throw new Error('"command" is required');

  const pageant = await isPageantRunning();
  if (!pageant) {
    throw new Error(
      "Pageant is not running. Start it with the bioinvsync.ppk key loaded:\n" +
      `"C:\\Program Files\\PuTTY\\pageant.exe" "C:\\Users\\xsj70\\bioinvsync.ppk"`
    );
  }

  const args = [
    "-ssh",
    "-P", PORT,
    "-i", KEY_FILE,
    "-batch",
    `${USER}@${HOST}`,
    command,
  ];

  try {
    const { stdout, stderr } = await execFileAsync(PLINK, args, {
      timeout: timeout ?? DEFAULT_TIMEOUT,
      maxBuffer: 5 * 1024 * 1024,
    });
    return { ok: true, stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 2000) };
  } catch (e) {
    return {
      ok: false,
      stdout: (e.stdout || "").slice(0, 10000),
      stderr: (e.stderr || e.message || "").slice(0, 2000),
    };
  }
}

/**
 * Read a file from the bioinvsync server.
 * @param {{ path: string, tail?: number }} input
 */
export async function readRemoteFile({ path, tail } = {}) {
  if (!path) throw new Error('"path" is required');
  const cmd = tail ? `tail -n ${tail} '${path}'` : `cat '${path}'`;
  return executeCommand({ command: cmd });
}

/**
 * List directory contents on the bioinvsync server.
 * @param {{ path?: string }} input
 */
export async function searchFiles({ path = "/home/bioinvsync/public_html" } = {}) {
  return executeCommand({ command: `find '${path}' -maxdepth 2 -type f | sort` });
}

/**
 * Check connectivity and Pageant status.
 */
export async function checkCredentials() {
  const pageant = await isPageantRunning();
  if (!pageant) {
    return {
      ok: false,
      msg: "Pageant not running. Start it with the bioinvsync.ppk key to enable SSH access.",
    };
  }
  const result = await executeCommand({ command: "echo connected && hostname", timeout: 10000 });
  return {
    ok: result.ok,
    msg: result.ok ? `Connected: ${result.stdout.trim()}` : result.stderr,
  };
}
