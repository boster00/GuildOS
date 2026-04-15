"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { classDisplayLabel } from "@/libs/proving_grounds/ui.js";

const STATUS_BADGE = {
  idle: { label: "Idle", className: "badge-ghost" },
  raised_hand: { label: "Ready", className: "badge-success" },
  busy: { label: "Working", className: "badge-info" },
  confused: { label: "Needs Attention", className: "badge-warning" },
  error: { label: "Error", className: "badge-error" },
  inactive: { label: "Inactive", className: "badge-ghost opacity-50" },
};

const STATUS_POSE = {
  idle: "normal",
  inactive: "normal",
  raised_hand: "happy",
  busy: "working",
  confused: "attention",
  error: "attention",
};

function getAvatarSrc(avatarType, status) {
  const type = avatarType || "monkey";
  const pose = STATUS_POSE[status] || "normal";
  return `/images/guildos/sprites/${type}-${pose}.png`;
}

function formatTs(iso) {
  if (iso == null || iso === "") return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

/**
 * @param {{
 *   adventurer: {
 *     id: string,
 *     name?: string | null,
 *     system_prompt?: string | null,
 *     backstory?: string | null,
 *     skill_books?: string[] | null,
 *     capabilities?: string | null,
 *     created_at?: string | null,
 *     updated_at?: string | null,
 *   },
 * }} props
 */
export default function AdventurerRoomCard({ adventurer: a }) {
  const router = useRouter();
  const prompt = typeof a.system_prompt === "string" ? a.system_prompt : "";
  const backstory = typeof a.backstory === "string" ? a.backstory : "";
  const caps = typeof a.capabilities === "string" ? a.capabilities : "";
  const name = typeof a.name === "string" ? a.name : "—";
  const editHref = `/town/inn/upstairs/${a.id}`;

  const decommission = async () => {
    const label = name.trim() || "this adventurer";
    if (!window.confirm(`Decommission ${label}? They will be removed from your roster.`)) {
      return;
    }
    if (
      !window.confirm(`Final confirmation: permanently remove ${label}? This cannot be undone.`)
    ) {
      return;
    }
    try {
      const res = await fetch("/api/adventurer?action=decommission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adventurerId: a.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Could not decommission");
        return;
      }
      toast.success("Adventurer decommissioned.");
      router.refresh();
    } catch {
      toast.error("Request failed");
    }
  };

  const status = a.session_status || "inactive";
  const badge = STATUS_BADGE[status] || STATUS_BADGE.inactive;
  const avatarSrc = getAvatarSrc(a.avatar_url, status);

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/60 p-4">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <img
            src={avatarSrc}
            alt={name}
            className="h-24 w-24 rounded-xl object-contain"
          />
          <span className={`badge badge-sm absolute -bottom-1 left-1/2 -translate-x-1/2 ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-semibold">{name}</span>
                <span className="badge badge-outline badge-sm">{classDisplayLabel(name)}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-base-content/50">id: {a.id}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href={editHref} className="btn btn-ghost btn-sm">
                Edit
              </Link>
              <button type="button" className="btn btn-outline btn-sm text-error hover:border-error" onClick={decommission}>
                Decommission
              </button>
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-base-content/45">System prompt</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-base-content/80">
            {prompt.trim() ? prompt : <span className="text-base-content/45">—</span>}
          </dd>
        </div>
        {backstory.trim() ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-base-content/45">Backstory</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-base-content/75">{backstory}</dd>
          </div>
        ) : null}
        {caps.trim() ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-base-content/45">Capabilities</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-base-content/75">{caps}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-base-content/45">Skill books</dt>
          <dd className="mt-0.5 text-base-content/75">
            {(a.skill_books || []).length > 0 ? (a.skill_books || []).join(", ") : "—"}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/55">
          <span>Created {formatTs(a.created_at)}</span>
          <span>Updated {formatTs(a.updated_at)}</span>
        </div>
      </dl>

      <p className="mt-3">
        <Link href={editHref} className="text-xs font-medium text-primary hover:underline">
          Open room →
        </Link>
      </p>
    </div>
  );
}
