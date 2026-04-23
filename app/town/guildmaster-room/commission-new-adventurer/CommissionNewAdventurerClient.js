"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  checklistState,
  getDefaultDraft,
  isRecruitReady,
  mergeDraftPatch,
} from "@/libs/adventurer_runtime/ui.js";

function FieldCheckLabel({ fieldId, column, required, checks }) {
  const ok = Boolean(checks[fieldId]);
  return (
    <span className="label-text flex items-start gap-2 text-xs">
      <span
        className={
          required ? (ok ? "text-success" : "text-base-content/40") : ok ? "text-success/80" : "text-base-content/30"
        }
        aria-hidden
      >
        {required ? (ok ? "☑" : "☐") : ok ? "☑" : "○"}
      </span>
      <span>
        <span className="font-mono">{column}</span>
        {required ? " *" : " (optional)"}
      </span>
    </span>
  );
}

export default function CommissionNewAdventurerClient() {
  const router = useRouter();
  const [draft, setDraft] = useState(() => getDefaultDraft());
  const [recruitLoading, setRecruitLoading] = useState(false);
  const [rosterSkillIds, setRosterSkillIds] = useState(() => []);

  const checks = useMemo(() => checklistState(draft), [draft]);
  const ready = useMemo(() => isRecruitReady(draft), [draft]);

  const updateDraft = useCallback((patch) => {
    setDraft((d) => mergeDraftPatch(d, patch));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/skill_book?action=listRosterIds");
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(json.ids)) {
          setRosterSkillIds(json.ids);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recruit = async () => {
    if (!ready || recruitLoading) return;
    setRecruitLoading(true);
    try {
      const res = await fetch("/api/adventurer?action=recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Could not recruit");
        return;
      }
      toast.success("Adventurer recruited.");
      router.push("/town/tavern");
      router.refresh();
    } finally {
      setRecruitLoading(false);
    }
  };

  const toggleSkill = (id) => {
    const cur = new Set(draft.skill_books || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    updateDraft({ skill_books: [...cur] });
  };

  return (
    <div className="flex min-h-[70vh] flex-col gap-6">
      <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-base-300 bg-base-100/90 p-4">
        <h2 className="text-sm font-semibold text-base-content/80">Commission canvas</h2>
        <p className="text-[11px] text-base-content/55">
          Fields match <span className="font-mono">public.adventurers</span> columns (except id, owner_id, timestamps).
        </p>

        <label className="form-control w-full">
          <FieldCheckLabel fieldId="name" column="name" required checks={checks} />
          <input
            type="text"
            className="input input-bordered input-sm mt-1 w-full"
            value={String(draft.name ?? "")}
            onChange={(e) => updateDraft({ name: e.target.value })}
          />
        </label>

        <label className="form-control w-full">
          <FieldCheckLabel fieldId="system_prompt" column="system_prompt" required checks={checks} />
          <textarea
            className="textarea textarea-bordered mt-1 min-h-[120px] w-full text-sm"
            value={String(draft.system_prompt ?? "")}
            onChange={(e) => updateDraft({ system_prompt: e.target.value })}
          />
        </label>

        <div className="form-control w-full">
          <FieldCheckLabel fieldId="skill_books" column="skill_books" required={false} checks={checks} />
          <div className="mt-1 flex flex-wrap gap-2">
            {rosterSkillIds.map((id) => (
              <label key={id} className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={(draft.skill_books || []).includes(id)}
                  onChange={() => toggleSkill(id)}
                />
                <span className="label-text font-mono text-xs">{id}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="form-control w-full">
          <FieldCheckLabel fieldId="backstory" column="backstory" required={false} checks={checks} />
          <textarea
            className="textarea textarea-bordered mt-1 min-h-[88px] w-full text-sm"
            value={String(draft.backstory ?? "")}
            onChange={(e) => updateDraft({ backstory: e.target.value })}
          />
        </label>

        <label className="form-control w-full">
          <FieldCheckLabel fieldId="capabilities" column="capabilities" required={false} checks={checks} />
          <textarea
            className="textarea textarea-bordered mt-1 min-h-[120px] w-full text-sm"
            spellCheck={true}
            value={String(draft.capabilities ?? "")}
            onChange={(e) => updateDraft({ capabilities: e.target.value })}
          />
          <span className="label-text-alt text-[10px] text-base-content/45">
            Plain text: what this agent can do. Used when selecting an adventurer for a quest.
          </span>
        </label>

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <button type="button" className="btn btn-primary" disabled={!ready || recruitLoading} onClick={recruit}>
            {recruitLoading ? "Recruiting…" : "Confirm recruit"}
          </button>
          <Link href="/town/guildmaster-room" className="btn btn-ghost btn-sm">
            Back to chamber
          </Link>
        </div>
      </div>
    </div>
  );
}
