"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

/**
 * Manual quest inventory append: PATCH /api/quest with action addItem.
 */
export default function QuestAddInventoryItemForm({ questId }) {
  const router = useRouter();
  const [itemKey, setItemKey] = useState("");
  const [valueRaw, setValueRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const key = itemKey.trim();
    if (!key) {
      toast.error("item_key is required");
      return;
    }
    let value;
    const trimmed = valueRaw.trim();
    if (!trimmed) {
      value = "";
    } else {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed;
      }
    }
    setBusy(true);
    try {
      const r = await fetch("/api/quest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: questId, action: "addItem", item_key: key, value }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Failed to add item");
        return;
      }
      toast.success("Item added");
      setItemKey("");
      setValueRaw("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-base-300 bg-base-200/20 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Add inventory item</h2>
      <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
        <label className="form-control w-full">
          <span className="label-text text-xs">item_key</span>
          <input
            className="input input-bordered input-sm w-full font-mono text-xs"
            value={itemKey}
            onChange={(e) => setItemKey(e.target.value)}
            placeholder="e.g. h1text"
          />
        </label>
        <label className="form-control w-full">
          <span className="label-text text-xs">Value (plain text or JSON)</span>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full font-mono text-xs"
            rows={4}
            value={valueRaw}
            onChange={(e) => setValueRaw(e.target.value)}
            placeholder='string or {"foo":1}'
          />
        </label>
        <button type="submit" className="btn btn-primary btn-sm w-fit" disabled={busy}>
          {busy ? "Adding…" : "Add to inventory"}
        </button>
      </form>
    </div>
  );
}
