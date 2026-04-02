"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const KEY_ID = "ZOHO_BOOKS_CLIENT_ID";
const KEY_SECRET = "ZOHO_BOOKS_CLIENT_SECRET";
const LOOM_EMBED = "https://www.loom.com/embed/c72a321e31864e96854c8975f05d36fd";

const ZOHO_REGIONS = [
  { value: "com", label: "Worldwide (zoho.com)" },
  { value: "eu", label: "Europe (zoho.eu)" },
  { value: "in", label: "India (zoho.in)" },
  { value: "com_au", label: "Australia (zoho.com.au)" },
  { value: "jp", label: "Japan (zoho.jp)" },
];

/**
 * Compact forge UI for Zoho: credentials + video blurb, or forged success + scrap.
 */
export function ZohoForgeWeaponPanel({ weaponSummary, isForged, zohoStatus }) {
  const router = useRouter();
  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scrapping, setScrapping] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    setError(null);
    try {
      const res = await fetch("/api/council/profile/env-vars", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    if (!isForged) void loadKeys();
  }, [isForged, loadKeys]);

  const hasBothKeys = keys.includes(KEY_ID) && keys.includes(KEY_SECRET);

  async function onSaveFormulas(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const id = clientId.trim();
    const secret = clientSecret.trim();
    if (!id || !secret) {
      setError("Enter both Client ID and Client Secret.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/council/profile/env-vars", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set: { [KEY_ID]: id, [KEY_SECRET]: secret } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setClientId("");
      setClientSecret("");
      setMessage("Saved to Formulary.");
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onScrap() {
    if (
      !window.confirm(
        "Scrap this weapon? Zoho tokens in the Apothecary will be removed. You can forge again afterward. OAuth app formulas in the Formulary stay until you remove them there."
      )
    ) {
      return;
    }
    setScrapping(true);
    setError(null);
    try {
      const res = await fetch("/api/weapon/zoho?action=scrap", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setScrapping(false);
    }
  }

  if (isForged) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border-2 border-success bg-success/10 p-6 text-success shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-content text-lg font-bold">
              ✓
            </span>
            <h2 className="text-xl font-bold text-success">Forged — weapon ready</h2>
          </div>
          <p className="mt-3 text-base font-medium text-success/95">
            Zoho Books is connected. Skill books can use this weapon; OAuth tokens live in the{" "}
            <Link href="/town/town-square/apothecary" className="link font-semibold text-success underline">
              Apothecary
            </Link>
            .
          </p>
          <ul className="mt-4 space-y-1 rounded-xl bg-success/10 px-4 py-3 text-sm text-success/90">
            <li>
              <span className="font-medium text-success">Region:</span> {zohoStatus?.region ?? "—"}
            </li>
            <li>
              <span className="font-medium text-success">Organization:</span>{" "}
              {zohoStatus?.hasOrganizationId ? "linked" : "not set"}
            </li>
            <li>
              <span className="font-medium text-success">Refresh token:</span>{" "}
              {zohoStatus?.hasRefreshToken ? "stored" : "—"}
            </li>
          </ul>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-warning border-warning text-warning"
          disabled={scrapping}
          onClick={onScrap}
        >
          {scrapping ? "Scrapping…" : "Scrap weapon & forge again"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-base-content/85">{weaponSummary}</p>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">Formulas</h2>

          {loadingKeys ? (
            <p className="text-sm text-base-content/60">Loading…</p>
          ) : hasBothKeys ? (
            <div className="rounded-xl border border-info bg-info/10 p-4 text-sm text-info-content">
              <p className="font-medium text-info">These keys already exist on your profile</p>
              <p className="mt-1 text-info/90">
                <code className="text-xs">{KEY_ID}</code> and <code className="text-xs">{KEY_SECRET}</code> are set. To
                remove or change them, you must edit them in{" "}
                <Link href="/town/council-hall/formulary" className="link font-semibold underline">
                  Council Hall → Formulary
                </Link>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={onSaveFormulas} className="space-y-3">
              <label className="form-control w-full">
                <span className="label-text text-xs font-medium">
                  <code>{KEY_ID}</code>
                </span>
                <input
                  type="text"
                  autoComplete="off"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="input input-bordered input-sm w-full font-mono"
                  placeholder="From Zoho API Console"
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text text-xs font-medium">
                  <code>{KEY_SECRET}</code>
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="input input-bordered input-sm w-full font-mono"
                  placeholder="From Zoho API Console"
                />
              </label>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "Saving…" : "Save to Formulary"}
              </button>
            </form>
          )}

          {message ? (
            <div className="alert alert-success py-2 text-sm">
              <span>{message}</span>
            </div>
          ) : null}
          {error ? (
            <div className="alert alert-error py-2 text-sm">
              <span>{error}</span>
            </div>
          ) : null}

          <div className="border-t border-base-300 pt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">Finish forging</h2>
            <p className="mt-1 text-xs text-base-content/65">Choose your Zoho data center, then authorize in Zoho.</p>
            <form
              action="/api/weapon/zoho"
              method="GET"
              className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <input type="hidden" name="action" value="connect" />
              <label className="form-control w-full max-w-xs">
                <span className="label-text text-xs">Region</span>
                <select name="region" className="select select-bordered select-sm w-full" defaultValue="com">
                  {ZOHO_REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-success btn-sm">
                Open Zoho — finish forging
              </button>
            </form>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="flex flex-1 flex-col justify-center rounded-xl border border-base-300 bg-base-200/40 p-4 text-sm leading-relaxed text-base-content/85">
            <p>
              Get <strong>Client ID</strong> and <strong>Client Secret</strong> from the{" "}
              <a
                href="https://api-console.zoho.com/"
                className="link link-primary font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                Zoho API Console
              </a>{" "}
              (server-based / web client). Register the redirect URI this app expects, then paste both values in the
              fields on the left and save—unless they already exist; then manage them in the Formulary.
            </p>
          </div>
          <div className="relative aspect-video w-full min-h-[12rem] flex-1 overflow-hidden rounded-xl border border-base-300 bg-base-300/20 lg:max-w-md">
            <iframe
              src={LOOM_EMBED}
              title="Zoho forging walkthrough"
              className="absolute inset-0 h-full w-full"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  );
}
