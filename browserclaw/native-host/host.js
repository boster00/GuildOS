#!/usr/bin/env node
/**
 * Browserclaw Native Messaging Host
 *
 * Launched by Chrome when the extension calls chrome.runtime.connectNative().
 * Communicates with the extension via stdin/stdout (Chrome native messaging protocol:
 * 4-byte little-endian length prefix + JSON payload).
 *
 * Also listens on TCP port 3004 for external commands (from GuildOS API routes).
 * Bridges TCP <-> native messaging so the API can send commands to the extension.
 */

const net = require("net");

const TCP_PORT = Number(process.env.BROWSERCLAW_NATIVE_PORT) || 3004;

// ── Chrome native messaging I/O ────────────────────────────────────

function writeNativeMessage(data) {
  const json = JSON.stringify(data);
  const buf = Buffer.from(json, "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

let inputBuf = Buffer.alloc(0);

function processInput() {
  while (inputBuf.length >= 4) {
    const len = inputBuf.readUInt32LE(0);
    if (inputBuf.length < 4 + len) break;
    const jsonBuf = inputBuf.subarray(4, 4 + len);
    inputBuf = inputBuf.subarray(4 + len);
    try {
      const msg = JSON.parse(jsonBuf.toString("utf-8"));
      handleExtensionMessage(msg);
    } catch (e) {
      logErr("Failed to parse native message:", e.message);
    }
  }
}

process.stdin.on("data", (chunk) => {
  inputBuf = Buffer.concat([inputBuf, chunk]);
  processInput();
});

process.stdin.on("end", () => {
  logErr("stdin closed (extension disconnected). Exiting.");
  process.exit(0);
});

// ── TCP server for API commands ────────────────────────────────────

/** @type {Map<string, net.Socket>} pending command ID -> TCP socket */
const pendingCommands = new Map();

/** @type {net.Socket | null} */
let activeSocket = null;

const tcpServer = net.createServer((socket) => {
  logErr("TCP client connected");
  activeSocket = socket;

  let tcpBuf = "";
  socket.on("data", (chunk) => {
    tcpBuf += chunk.toString("utf-8");
    // Messages are newline-delimited JSON
    const lines = tcpBuf.split("\n");
    tcpBuf = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "command" && msg.id) {
          pendingCommands.set(msg.id, socket);
          writeNativeMessage(msg);
          logErr(`Forwarded command ${msg.id} to extension`);
        }
      } catch (e) {
        logErr("Bad TCP JSON:", e.message);
      }
    }
  });

  socket.on("close", () => {
    logErr("TCP client disconnected");
    if (activeSocket === socket) activeSocket = null;
  });

  socket.on("error", (err) => {
    logErr("TCP socket error:", err.message);
  });
});

tcpServer.listen(TCP_PORT, "127.0.0.1", () => {
  logErr(`TCP bridge listening on 127.0.0.1:${TCP_PORT}`);
  // Tell the extension we're ready
  writeNativeMessage({ type: "host_ready", tcpPort: TCP_PORT });
});

tcpServer.on("error", (err) => {
  logErr("TCP server error:", err.message);
  // If port is busy, still work for native messaging only
});

// ── Message routing ────────────────────────────────────────────────

function handleExtensionMessage(msg) {
  logErr("From extension:", JSON.stringify(msg).slice(0, 200));

  // Route results back to the TCP socket that sent the command
  if (msg.type === "result" && msg.id) {
    const socket = pendingCommands.get(msg.id);
    if (socket && !socket.destroyed) {
      socket.write(JSON.stringify(msg) + "\n");
      pendingCommands.delete(msg.id);
      logErr(`Routed result ${msg.id} back to TCP client`);
    }
    return;
  }
}

function logErr(...args) {
  process.stderr.write("[NativeHost] " + args.join(" ") + "\n");
}

logErr("Browserclaw native messaging host started");
