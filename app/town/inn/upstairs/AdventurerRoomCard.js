"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

const STATUS_BADGE = {
  idle: { label: "Idle", className: "badge-ghost" },
  busy: { label: "Working", className: "badge-info" },
  confused: { label: "Confused", className: "badge-warning" },
  ailing: { label: "Ailing", className: "badge-error" },
  inactive: { label: "Inactive", className: "badge-ghost opacity-50" },
};

const STATUS_POSE = {
  idle: "normal",
  inactive: "normal",
  busy: "working",
  confused: "attention",
  ailing: "attention",
};

const STAGE_LABELS = {
  execute: { label: "Executing", className: "badge-info" },
  escalated: { label: "Escalated", className: "badge-warning" },
  review: { label: "In Review", className: "badge-accent" },
  closing: { label: "Closing", className: "badge-ghost" },
};

function getAvatarSrc(avatarType, status) {
  const type = avatarType || "monkey";
  const pose = STATUS_POSE[status] || "normal";
  return `/images/guildos/sprites/${type}-${pose}.png`;
}

export default function AdventurerRoomCard({ adventurer: a, questCounts }) {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState(null);
  const [chatBusy, setChatBusy] = useState(false);

  const name = typeof a.name === "string" ? a.name : "—";
  const status = a.session_status || "inactive";
  const badge = STATUS_BADGE[status] || STATUS_BADGE.inactive;
  const avatarSrc = getAvatarSrc(a.avatar_url, status);
  const hasSession = !!a.session_id;
  const cursorUrl = hasSession ? `https://cursor.com/agents/${a.session_id}` : null;

  const decommission = async () => {
    if (!window.confirm(`Decommission ${name}? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/adventurer?action=decommission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adventurerId: a.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Failed"); return; }
      toast.success("Decommissioned.");
      router.refresh();
    } catch { toast.error("Request failed"); }
  };

  const loadConversation = async () => {
    if (!hasSession) return;
    try {
      const res = await fetch(`/api/adventurer?action=conversation&adventurerId=${a.id}`);
      const json = await res.json();
      if (json.ok) setChatMessages(json.data?.messages || []);
    } catch { /* ignore */ }
  };

  const openChat = async () => {
    setChatOpen(true);
    await loadConversation();
  };

  const sendMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || !hasSession) return;
    setChatBusy(true);
    try {
      await fetch("/api/adventurer?action=message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adventurerId: a.id, message: msg }),
      });
      setChatInput("");
      await loadConversation();
    } catch { toast.error("Send failed"); }
    setChatBusy(false);
  };

  const stageEntries = Object.entries(questCounts || {}).filter(([, count]) => count > 0);

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/60 p-4">
      <div className="flex items-start gap-4">
        {/* Avatar + status */}
        <div className="relative shrink-0">
          <img src={avatarSrc} alt={name} className="h-48 w-48 rounded-xl object-contain" />
          <span className={`badge badge-sm absolute -bottom-1 left-1/2 -translate-x-1/2 ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-lg font-semibold">{name}</span>
              {hasSession && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-success" title="Session linked" />
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {hasSession && (
                <button type="button" className="btn btn-primary btn-sm" onClick={openChat}>
                  Chat
                </button>
              )}
              <Link href={`/town/inn/upstairs/${a.id}`} className="btn btn-ghost btn-sm">
                Edit
              </Link>
              <button type="button" className="btn btn-outline btn-xs text-error hover:border-error" onClick={decommission}>
                Decommission
              </button>
            </div>
          </div>

          {/* Quest stage counts */}
          {stageEntries.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {stageEntries.map(([stage, count]) => {
                const sl = STAGE_LABELS[stage] || { label: stage, className: "badge-ghost" };
                return (
                  <span key={stage} className={`badge badge-sm ${sl.className}`}>
                    {count} {sl.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-base-content/40">No active quests</p>
          )}

          {/* Skill books */}
          {(a.skill_books || []).length > 0 && (
            <p className="mt-2 text-xs text-base-content/50">
              Skills: {a.skill_books.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Chat panel */}
      {chatOpen && (
        <div className="mt-4 rounded-xl border border-base-300 bg-base-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Chat with {name}</h3>
            <div className="flex items-center gap-2">
              {cursorUrl && (
                <a href={cursorUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs">
                  Open in Cursor ↗
                </a>
              )}
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setChatOpen(false)}>Close</button>
            </div>
          </div>

          {/* Messages */}
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-base-200/50 p-2">
            {chatMessages === null ? (
              <p className="text-xs text-base-content/40">Loading...</p>
            ) : chatMessages.length === 0 ? (
              <p className="text-xs text-base-content/40">No messages yet</p>
            ) : (
              chatMessages.slice(-20).map((m) => (
                <div key={m.id} className={`chat ${m.type === "user_message" ? "chat-end" : "chat-start"}`}>
                  <div className={`chat-bubble chat-bubble-sm ${m.type === "user_message" ? "chat-bubble-primary" : ""}`}>
                    {m.text?.substring(0, 500) || "..."}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1"
              placeholder="Send a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={chatBusy}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={sendMessage} disabled={chatBusy || !chatInput.trim()}>
              {chatBusy ? <span className="loading loading-spinner loading-xs" /> : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
