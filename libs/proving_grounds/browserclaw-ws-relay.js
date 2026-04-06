/**
 * Browserclaw WebSocket Relay Server
 *
 * Standalone relay on port 3003 bridging two client roles:
 *   - "extension"  — the Browserclaw Chrome extension
 *   - "controller" — the GuildOS API route (or any test harness)
 *
 * Protocol:
 *   Identify:  { type: "identify", role: "extension" | "controller" }
 *   Command:   { type: "command", id: "<uuid>", command: { steps: [...] } }
 *   Result:    { type: "result",  id: "<uuid>", result: { ... } }
 *
 * Usage: node libs/proving_grounds/browserclaw-ws-relay.js
 */

const { WebSocketServer } = require("ws");

const PORT = Number(process.env.BROWSERCLAW_WS_PORT) || 3003;

const wss = new WebSocketServer({ port: PORT });

/** @type {Set<import("ws").WebSocket>} */
const extensions = new Set();
/** @type {Set<import("ws").WebSocket>} */
const controllers = new Set();

wss.on("connection", (ws) => {
  let role = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      ws.send(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    // Identify
    if (msg.type === "identify") {
      role = msg.role;
      if (role === "extension") {
        extensions.add(ws);
        console.log(`[WS Relay] Extension connected (total: ${extensions.size})`);
        ws.send(JSON.stringify({ type: "identified", role: "extension" }));
      } else if (role === "controller") {
        controllers.add(ws);
        console.log(`[WS Relay] Controller connected (total: ${controllers.size})`);
        ws.send(JSON.stringify({ type: "identified", role: "controller" }));
      }
      return;
    }

    // Controller sends command -> relay to first extension
    if (msg.type === "command" && role === "controller") {
      const ext = [...extensions][0];
      if (!ext || ext.readyState !== 1) {
        ws.send(JSON.stringify({ type: "result", id: msg.id, result: { ok: false, error: "No extension connected" } }));
        return;
      }
      ext.send(JSON.stringify(msg));
      return;
    }

    // Extension sends result -> relay to all controllers
    if (msg.type === "result" && role === "extension") {
      for (const ctrl of controllers) {
        if (ctrl.readyState === 1) ctrl.send(JSON.stringify(msg));
      }
      return;
    }

    // Status check
    if (msg.type === "status") {
      ws.send(JSON.stringify({
        type: "status",
        extensions: extensions.size,
        controllers: controllers.size,
      }));
    }
  });

  ws.on("close", () => {
    if (role === "extension") {
      extensions.delete(ws);
      console.log(`[WS Relay] Extension disconnected (total: ${extensions.size})`);
    } else if (role === "controller") {
      controllers.delete(ws);
      console.log(`[WS Relay] Controller disconnected (total: ${controllers.size})`);
    }
  });

  ws.on("error", (err) => {
    console.error("[WS Relay] Socket error:", err.message);
  });
});

console.log(`[WS Relay] Browserclaw WebSocket relay listening on ws://localhost:${PORT}`);
