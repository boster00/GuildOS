/**
 * SSH weapon — execute commands on remote machines.
 *
 * Uses system SSH (no npm deps). Requires passwordless SSH keys to be set up.
 * Known hosts are configured in profiles.env_vars as SSH_HOSTS JSON.
 */

export const toc = {
  executeCommand: "Execute a shell command on a remote host via SSH.",
  searchHosts: "Search configured SSH hosts.",
  readRemoteFile: "Read a file from a remote host over SSH.",
};
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { database } from "@/libs/council/database";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Host registry
// ---------------------------------------------------------------------------

/**
 * Known host presets. Additional hosts can be added via SSH_HOSTS env var.
 */
const KNOWN_HOSTS = {
  carbon: { host: "carbon", user: null, description: "Carbon SSH server (local network)" },
  boster_production: { host: "c100h.bosterbio.com", user: null, description: "Boster production server — Magento 2, MariaDB" },
};

/**
 * Resolve a host alias or raw host string to connection details.
 * @param {string} hostOrAlias
 * @param {string} [userId]
 */
async function resolveHost(hostOrAlias, userId) {
  // Check presets
  const preset = KNOWN_HOSTS[hostOrAlias];
  if (preset) return preset;

  // Check user-defined hosts from env_vars
  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const hostsJson = data?.env_vars?.SSH_HOSTS;
      if (hostsJson) {
        const hosts = JSON.parse(hostsJson);
        if (hosts[hostOrAlias]) return hosts[hostOrAlias];
      }
    } catch { /* no custom hosts */ }
  }

  // Raw host string
  return { host: hostOrAlias, user: null, description: null };
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

/**
 * Execute a command on a remote host via SSH.
 * @param {{ host: string, command: string, user?: string, timeout?: number }} input
 * @param {string} [userId]
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, exitCode: number|null }>}
 */
export async function executeCommand({ host, command, user, timeout } = {}, userId) {
  if (!host) throw new Error("host is required");
  if (!command) throw new Error("command is required");

  const resolved = await resolveHost(host, userId);
  const sshUser = user || resolved.user;
  const target = sshUser ? `${sshUser}@${resolved.host}` : resolved.host;
  const timeoutMs = timeout || DEFAULT_TIMEOUT;

  const args = [
    "-o", "ConnectTimeout=10",
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "BatchMode=yes",
    target,
    command,
  ];

  try {
    const { stdout, stderr } = await execFileAsync("ssh", args, {
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
    });
    return { ok: true, stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 2000), exitCode: 0 };
  } catch (e) {
    return {
      ok: false,
      stdout: (e.stdout || "").slice(0, 10000),
      stderr: (e.stderr || e.message || "").slice(0, 2000),
      exitCode: e.code ?? null,
    };
  }
}

/**
 * Search available SSH hosts (presets + user-defined).
 * @param {object} [input]
 * @param {string} [userId]
 */
export async function searchHosts(input = {}, userId) {
  const hosts = { ...KNOWN_HOSTS };

  if (userId) {
    try {
      const db = await database.init("service");
      const { data } = await db.from("profiles").select("env_vars").eq("id", userId).single();
      const hostsJson = data?.env_vars?.SSH_HOSTS;
      if (hostsJson) {
        const custom = JSON.parse(hostsJson);
        Object.assign(hosts, custom);
      }
    } catch { /* no custom hosts */ }
  }

  return {
    hosts: Object.entries(hosts).map(([alias, info]) => ({
      alias,
      host: info.host,
      user: info.user,
      description: info.description,
    })),
  };
}

/**
 * Read a file from a remote host.
 * @param {{ host: string, path: string, user?: string, tail?: number }} input
 * @param {string} [userId]
 */
export async function readRemoteFile({ host, path, user, tail } = {}, userId) {
  if (!path) throw new Error("path is required");
  const cmd = tail ? `tail -n ${tail} ${path}` : `cat ${path}`;
  return executeCommand({ host, command: cmd, user }, userId);
}

// ---------------------------------------------------------------------------
// Credential check
// ---------------------------------------------------------------------------

export async function checkCredentials(userId) {
  try {
    // Check if ssh is available
    const { stdout } = await execFileAsync("ssh", ["-V"], { timeout: 5000 }).catch((e) => ({
      stdout: "",
      stderr: e.stderr || e.message,
    }));
    const hosts = await searchHosts({}, userId);
    return {
      ok: true,
      msg: `SSH available. ${hosts.hosts.length} known hosts configured.`,
    };
  } catch (e) {
    return { ok: false, msg: `SSH not available: ${e.message}` };
  }
}
