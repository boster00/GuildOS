"use client";

import { useCallback, useEffect, useState } from "react";
import { MerchantGuildExplain } from "@/components/MerchantGuildExplain";

const VALUE_MASK = "************";

export default function PotionFormularsSettings() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  /** Which stored var is being updated (null = none) */
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/council/profile/env-vars", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setNewName("");
      setNewValue("");
      setEditingKey(null);
      setEditValue("");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchBody(body) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/council/profile/env-vars", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return false;
      }
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setMessage("So recorded in your folio.");
      return true;
    } catch (err) {
      setError(err?.message || String(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    const value = newValue.trim();
    if (!name || !value) {
      setError("A true name and an essence are both required to brew a new seal.");
      return;
    }
    const ok = await patchBody({ set: { [name]: value } });
    if (ok) {
      setNewName("");
      setNewValue("");
    }
  }

  async function onRemove(key) {
    if (
      !window.confirm(
        `Scatter the seal named "${key}" from your formulary?\n\nOuter bridges may fall quiet until you brew it anew.`
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        `Second oath: strike "${key}" from the ledger forever?\n\nThere is no undoing from this hall.`
      )
    ) {
      return;
    }
    if (editingKey === key) {
      setEditingKey(null);
      setEditValue("");
    }
    await patchBody({ remove: [key] });
  }

  function onStartEdit(key) {
    setError(null);
    setEditingKey(key);
    setEditValue("");
  }

  function onCancelEdit() {
    setEditingKey(null);
    setEditValue("");
  }

  async function onSaveEdit(key) {
    const value = editValue.trim();
    if (!value) {
      setError("Whisper a new essence, or pour the vial out with Remove instead.");
      return;
    }
    const ok = await patchBody({ set: { [key]: value } });
    if (ok) {
      setEditingKey(null);
      setEditValue("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" />
        Unrolling the formulary…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MerchantGuildExplain
        fantasy={
          <p>
            <strong>Seals on the shelf</strong> are bindings already sworn—<strong>Stir again</strong> to pour in a new
            essence, <strong>Pour out</strong> to break the seal. <strong>Brew a new seal</strong> inscribes a fresh vial.
            Names you set here can override matching winds from the server&apos;s own scrolls when both speak the same
            true name.
          </p>
        }
        merchant={
          <p>
            The first section lists stored variables (names only). Use <strong>Stir again</strong> to update a value,{" "}
            <strong>Pour out</strong> to delete. <strong>Brew a new seal</strong> adds a new key and value. Profile
            values override the same keys in <code className="text-xs">process.env</code> when both are set.
          </p>
        }
      />

      {error && (
        <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{error}</div>
      )}
      {message && (
        <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">{message}</div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">Seals on the shelf</h2>
        {keys.length === 0 ? (
          <p className="mt-2 text-sm text-base-content/60">The shelf stands empty—no vials yet inscribed.</p>
        ) : (
          <ul className="mt-3 max-w-5xl divide-y divide-base-300 border-y border-base-300">
            {keys.map((key) => {
              const isEditing = editingKey === key;
              return (
                <li key={key} className="py-3 first:pt-2 last:pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
                    <div className="min-w-0 sm:w-[14rem] sm:shrink-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-base-content/50">True name</p>
                      <p className="mt-0.5 font-mono text-sm text-base-content" title={key}>
                        {key}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-base-content/50">Sealed brew</p>
                      <p
                        className="mt-0.5 font-mono text-sm tracking-[0.2em] text-base-content/80 select-none"
                        aria-label="The essence is sealed; it cannot be read back"
                      >
                        {VALUE_MASK}
                      </p>
                      {isEditing && (
                        <label className="mt-2 block">
                          <span className="sr-only">New essence</span>
                          <input
                            type="password"
                            className="input input-bordered input-sm mt-1 w-full max-w-md font-mono"
                            value={editValue}
                            onChange={(ev) => setEditValue(ev.target.value)}
                            autoComplete="new-password"
                            placeholder="Whisper the new essence"
                            autoFocus
                          />
                        </label>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:pt-5">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={saving}
                            onClick={() => void onSaveEdit(key)}
                          >
                            Seal it
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={onCancelEdit}>
                            Stay
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={saving || (editingKey !== null && editingKey !== key)}
                          onClick={() => onStartEdit(key)}
                        >
                          Stir again
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm btn-error"
                        disabled={saving}
                        onClick={() => void onRemove(key)}
                      >
                        Pour out
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border-t border-base-300 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">Brew a new seal</h2>
        <form onSubmit={onAdd} className="mt-3 flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
          <label className="form-control min-w-0 flex-1 sm:max-w-[14rem]">
            <span className="label-text text-xs">True name</span>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              autoComplete="off"
              placeholder="e.g. API_CLIENT_ID"
            />
          </label>
          <label className="form-control min-w-0 flex-1">
            <span className="label-text text-xs">Essence</span>
            <input
              type="password"
              className="input input-bordered input-sm w-full font-mono"
              value={newValue}
              onChange={(ev) => setNewValue(ev.target.value)}
              autoComplete="new-password"
              placeholder="Secret word or outward mark"
            />
          </label>
          <div className="flex shrink-0 sm:pb-0.5">
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              Commit to shelf
            </button>
          </div>
        </form>
      </section>

      <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void load()}>
        Reread the ledger
      </button>
    </div>
  );
}
