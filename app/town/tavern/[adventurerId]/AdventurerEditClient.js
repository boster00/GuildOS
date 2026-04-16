"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { isRecruitReady, mergeDraftPatch } from "@/libs/proving_grounds/ui.js";

/**
 * @param {{ adventurerId: string, initialDraft: Record<string, unknown> }} props
 */
export default function AdventurerEditClient({ adventurerId, initialDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft);
  const [saving, setSaving] = useState(false);
  const [rosterSkillIds, setRosterSkillIds] = useState(() => []);

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

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/adventurer?action=update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adventurerId, draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Could not save");
        return;
      }
      toast.success("Saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (id) => {
    const cur = new Set(draft.skill_books || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    updateDraft({ skill_books: [...cur] });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <label className="form-control w-full">
        <span className="label-text text-xs font-mono">name</span>
        <input
          type="text"
          className="input input-bordered input-sm mt-1 w-full"
          value={String(draft.name ?? "")}
          onChange={(e) => updateDraft({ name: e.target.value })}
        />
      </label>

      <label className="form-control w-full">
        <span className="label-text text-xs font-mono">system_prompt</span>
        <textarea
          className="textarea textarea-bordered mt-1 min-h-[140px] w-full text-sm"
          value={String(draft.system_prompt ?? "")}
          onChange={(e) => updateDraft({ system_prompt: e.target.value })}
        />
      </label>

      <div className="form-control w-full">
        <span className="label-text text-xs font-mono">skill_books</span>
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
        <span className="label-text text-xs font-mono">backstory</span>
        <textarea
          className="textarea textarea-bordered mt-1 min-h-[88px] w-full text-sm"
          value={String(draft.backstory ?? "")}
          onChange={(e) => updateDraft({ backstory: e.target.value })}
        />
      </label>

      <label className="form-control w-full">
        <span className="label-text text-xs font-mono">capabilities</span>
        <textarea
          className="textarea textarea-bordered mt-1 min-h-[120px] w-full text-sm"
          value={String(draft.capabilities ?? "")}
          onChange={(e) => updateDraft({ capabilities: e.target.value })}
        />
        <span className="label-text-alt text-[10px] text-base-content/45">
          Plain text: what this agent can do (Cat agent selection).
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="button" className="btn btn-primary" disabled={!ready || saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <Link href="/town/tavern" className="btn btn-ghost btn-sm">
          Back to upstairs
        </Link>
      </div>
    </div>
  );
}
