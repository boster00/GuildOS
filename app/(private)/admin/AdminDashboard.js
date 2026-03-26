"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

function fmt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
function fmtDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}
function timeAgo(iso) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
const PLAN_BADGE = { free: "badge-ghost", starter: "badge-info", pro: "badge-success" };

async function apiFetch(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function UserDetailModal({ user, onClose }) {
  const [tab, setTab] = useState("ledger");
  const [ledger, setLedger] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerOffset, setLedgerOffset] = useState(0);
  const [payments, setPayments] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const PAGE_SIZE = 100;
  const loadLedger = useCallback(async (offset = 0) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch(`/api/admin/users/${user.id}/ledger?offset=${offset}&limit=${PAGE_SIZE}`);
      setLedger(data.entries ?? []); setLedgerTotal(data.total ?? 0); setLedgerOffset(offset);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [user.id]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsOffset, setPaymentsOffset] = useState(0);
  const [keywordsTotal, setKeywordsTotal] = useState(0);
  const [keywordsOffset, setKeywordsOffset] = useState(0);
  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesOffset, setArticlesOffset] = useState(0);

  const loadPayments = useCallback(async (offset = 0) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch(`/api/admin/users/${user.id}/payments?offset=${offset}&limit=100`);
      setPayments(data.events ?? []); setPaymentsTotal(data.total ?? 0); setPaymentsOffset(offset);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [user.id]);
  const loadKeywords = useCallback(async (offset = 0) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch(`/api/admin/users/${user.id}/keywords?offset=${offset}&limit=100`);
      setKeywords(data.projects ?? []); setKeywordsTotal(data.total ?? 0); setKeywordsOffset(offset);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [user.id]);
  const loadArticles = useCallback(async (offset = 0) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch(`/api/admin/users/${user.id}/articles?offset=${offset}&limit=100`);
      setArticles(data.articles ?? []); setArticlesTotal(data.total ?? 0); setArticlesOffset(offset);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => {
    if (tab === "ledger") loadLedger(0);
    else if (tab === "payments") loadPayments(0);
    else if (tab === "keywords") loadKeywords(0);
    else if (tab === "articles") loadArticles(0);
  }, [tab, loadLedger, loadPayments, loadKeywords, loadArticles]);

  const totalPages = Math.ceil(ledgerTotal / PAGE_SIZE);
  const currentPage = Math.floor(ledgerOffset / PAGE_SIZE);

  const paymentsPages = Math.ceil(paymentsTotal / PAGE_SIZE);
  const paymentsPage = Math.floor(paymentsOffset / PAGE_SIZE);
  const keywordsPages = Math.ceil(keywordsTotal / PAGE_SIZE);
  const keywordsPage = Math.floor(keywordsOffset / PAGE_SIZE);
  const articlesPages = Math.ceil(articlesTotal / PAGE_SIZE);
  const articlesPage = Math.floor(articlesOffset / PAGE_SIZE);

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl w-full">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">{user.email}</h3>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span className={`badge ${PLAN_BADGE[user.plan] ?? "badge-ghost"}`}>{user.planName}</span>
              <span className="text-sm text-base-content/60">Monthly: {fmt(user.creditsRemaining)} cr</span>
              <span className="text-sm text-base-content/60">PAYG: {fmt(user.paygWallet)} cr</span>
              <span className="text-sm text-base-content/60">Joined: {fmtDateShort(user.joinedAt)}</span>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="tabs tabs-bordered mb-4">
          {["ledger", "payments", "keywords", "articles"].map((t) => (
            <button key={t} className={`tab tab-bordered capitalize ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        {error && <div className="alert alert-error mb-4 text-sm">{error}</div>}
        {loading && <div className="flex justify-center py-8"><span className="loading loading-spinner" /></div>}
        {!loading && tab === "ledger" && (
          <>
            <div className="overflow-x-auto">
              <table className="table table-xs table-zebra w-full">
                <thead><tr><th>Seq</th><th>Action</th><th>Cost</th><th>Monthly Δ</th><th>PAYG Δ</th><th>Monthly Bal</th><th>PAYG Bal</th><th>Date</th><th>Meta</th></tr></thead>
                <tbody>
                  {ledger.length === 0 ? <tr><td colSpan={9} className="text-center py-4 text-base-content/50">No ledger entries</td></tr> : ledger.map((row) => (
                    <tr key={row.seq}>
                      <td className="font-mono text-xs">{row.seq}</td>
                      <td><span className={`badge badge-xs ${row.cost < 0 ? "badge-success" : "badge-ghost"}`}>{row.action}</span></td>
                      <td className={`font-mono ${row.cost < 0 ? "text-success" : ""}`}>{fmt(row.cost)}</td>
                      <td className="font-mono">{fmt(row.monthly_cost)}</td><td className="font-mono">{fmt(row.payg_cost)}</td>
                      <td className="font-mono">{fmt(row.monthly_balance)}</td><td className="font-mono">{fmt(row.payg_balance)}</td>
                      <td className="text-xs whitespace-nowrap">{fmtDate(row.created_at)}</td>
                      <td className="max-w-xs truncate text-xs text-base-content/50">{row.meta ? JSON.stringify(row.meta) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-base-content/60">{ledgerOffset + 1}–{Math.min(ledgerOffset + PAGE_SIZE, ledgerTotal)} of {ledgerTotal}</span>
                <div className="join">
                  <button className="join-item btn btn-sm" disabled={currentPage === 0} onClick={() => loadLedger(ledgerOffset - PAGE_SIZE)}>«</button>
                  <button className="join-item btn btn-sm btn-disabled">{currentPage + 1} / {totalPages}</button>
                  <button className="join-item btn btn-sm" disabled={ledgerOffset + PAGE_SIZE >= ledgerTotal} onClick={() => loadLedger(ledgerOffset + PAGE_SIZE)}>»</button>
                </div>
              </div>
            )}
          </>
        )}
        {!loading && tab === "payments" && (
          <>
            <div className="overflow-x-auto">
              <table className="table table-xs table-zebra w-full">
                <thead><tr><th>Event Type</th><th>Date</th><th>Invoice ID</th><th>Mode</th><th>Detail</th></tr></thead>
                <tbody>
                  {payments.length === 0 ? <tr><td colSpan={5} className="text-center py-4 text-base-content/50">No payment events</td></tr> : payments.map((ev) => (
                    <tr key={ev.event_id}>
                      <td><span className="badge badge-xs badge-outline">{ev.event_type}</span></td>
                      <td className="text-xs whitespace-nowrap">{fmtDate(ev.stripe_created_at)}</td>
                      <td className="font-mono text-xs">{ev.stripe_invoice_id ?? "—"}</td>
                      <td><span className={`badge badge-xs ${ev.livemode ? "badge-warning" : "badge-ghost"}`}>{ev.livemode ? "live" : "test"}</span></td>
                      <td className="max-w-xs truncate text-xs text-base-content/50">{ev.event_data ? JSON.stringify(ev.event_data).slice(0, 120) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paymentsTotal > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-base-content/60">{paymentsOffset + 1}–{Math.min(paymentsOffset + PAGE_SIZE, paymentsTotal)} of {paymentsTotal}</span>
                <div className="join">
                  <button type="button" className="join-item btn btn-sm" disabled={paymentsPage === 0} onClick={() => loadPayments(paymentsOffset - PAGE_SIZE)}>«</button>
                  <button type="button" className="join-item btn btn-sm btn-disabled">{paymentsPage + 1} / {paymentsPages}</button>
                  <button type="button" className="join-item btn btn-sm" disabled={paymentsOffset + PAGE_SIZE >= paymentsTotal} onClick={() => loadPayments(paymentsOffset + PAGE_SIZE)}>»</button>
                </div>
              </div>
            )}
          </>
        )}
        {!loading && tab === "keywords" && (
          <>
            <div className="space-y-4">
              {keywords.length === 0 ? <p className="text-center py-4 text-base-content/50">No visibility tracking projects</p> : keywords.map((project) => (
                <div key={project.id} className="border border-base-300 rounded-lg p-3">
                  <div className="font-semibold text-sm mb-2">{project.domain} <span className="badge badge-xs badge-ghost ml-1">{project.cadence}</span></div>
                  {project.keywords?.length === 0 ? <p className="text-xs text-base-content/50">No keywords</p> : (
                    <table className="table table-xs w-full">
                      <thead><tr><th>Keyword</th><th>Latest Position</th><th>Checked</th></tr></thead>
                      <tbody>
                        {project.keywords.map((kw) => (
                          <tr key={kw.id}>
                            <td>{kw.keyword}</td>
                            <td>{kw.latestPosition != null ? <span className={`font-mono font-bold ${kw.latestPosition <= 3 ? "text-success" : kw.latestPosition <= 10 ? "text-warning" : ""}`}>{kw.latestPosition}</span> : <span className="text-base-content/40">—</span>}</td>
                            <td className="text-xs text-base-content/60">{timeAgo(kw.latestCheckedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
            {keywordsTotal > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-base-content/60">{keywordsOffset + 1}–{Math.min(keywordsOffset + PAGE_SIZE, keywordsTotal)} of {keywordsTotal} projects</span>
                <div className="join">
                  <button type="button" className="join-item btn btn-sm" disabled={keywordsPage === 0} onClick={() => loadKeywords(keywordsOffset - PAGE_SIZE)}>«</button>
                  <button type="button" className="join-item btn btn-sm btn-disabled">{keywordsPage + 1} / {keywordsPages}</button>
                  <button type="button" className="join-item btn btn-sm" disabled={keywordsOffset + PAGE_SIZE >= keywordsTotal} onClick={() => loadKeywords(keywordsOffset + PAGE_SIZE)}>»</button>
                </div>
              </div>
            )}
          </>
        )}
        {!loading && tab === "articles" && (
          <>
            <div className="overflow-x-auto">
              <table className="table table-xs table-zebra w-full">
                <thead><tr><th>Title</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  {articles.length === 0 ? <tr><td colSpan={3} className="text-center py-4 text-base-content/50">No articles</td></tr> : articles.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium max-w-md truncate" title={a.title}>{a.title}</td>
                      <td><span className="badge badge-xs badge-ghost">{a.status ?? "—"}</span></td>
                      <td className="text-xs whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {articlesTotal > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-base-content/60">{articlesOffset + 1}–{Math.min(articlesOffset + PAGE_SIZE, articlesTotal)} of {articlesTotal}</span>
                <div className="join">
                  <button type="button" className="join-item btn btn-sm" disabled={articlesPage === 0} onClick={() => loadArticles(articlesOffset - PAGE_SIZE)}>«</button>
                  <button type="button" className="join-item btn btn-sm btn-disabled">{articlesPage + 1} / {articlesPages}</button>
                  <button type="button" className="join-item btn btn-sm" disabled={articlesOffset + PAGE_SIZE >= articlesTotal} onClick={() => loadArticles(articlesOffset + PAGE_SIZE)}>»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

function GrantCreditsModal({ email, onClose, onSuccess }) {
  const [credits, setCredits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const nonceRef = useRef(crypto.randomUUID());
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const data = await apiFetch("/api/admin/grant-payg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, credits: parseInt(credits, 10), clientNonce: nonceRef.current }) });
      onSuccess(data); onClose();
    } catch (e) { setError(e.message); setSubmitting(false); }
  };
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">Grant PAYG Credits</h3><button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button></div>
        <p className="text-sm text-base-content/60 mb-4 font-mono truncate">{email}</p>
        {error && <div className="alert alert-error mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control"><label className="label"><span className="label-text font-medium">Credits *</span></label>
            <input type="number" className="input input-bordered w-full" placeholder="e.g. 50" min="1" step="1" value={credits} onChange={(e) => setCredits(e.target.value)} autoFocus required />
          </div>
          <div className="flex gap-2"><button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary flex-1" disabled={submitting}>{submitting ? <span className="loading loading-spinner loading-sm" /> : "Grant"}</button></div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

function GrantCreditsTab() {
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const nonceRef = useRef(crypto.randomUUID());
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setResult(null); setError(null);
    try {
      const data = await apiFetch("/api/admin/grant-payg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), credits: parseInt(credits, 10), clientNonce: nonceRef.current }) });
      setResult(data); setEmail(""); setCredits(""); nonceRef.current = crypto.randomUUID();
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };
  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-lg font-bold mb-1">Grant PAYG Credits</h2>
      <p className="text-sm text-base-content/60 mb-6">Credits are added to the recipient&apos;s non-expiring PAYG wallet with a full ledger entry.</p>
      {result && <div className="alert alert-success mb-4"><span>{result.alreadyGranted ? `Already granted (idempotent) — no duplicate entry created.` : `Granted ${result.credits} PAYG credits to ${result.targetEmail}. PAYG balance: ${fmt(result.remainingPayg)}`}</span></div>}
      {error && <div className="alert alert-error mb-4"><span>{error}</span></div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control"><label className="label"><span className="label-text font-medium">Recipient Email *</span></label><input type="email" className="input input-bordered w-full" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="form-control"><label className="label"><span className="label-text font-medium">Credits *</span></label><input type="number" className="input input-bordered w-full" placeholder="e.g. 50" min="1" step="1" value={credits} onChange={(e) => setCredits(e.target.value)} required /></div>
        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>{submitting ? <span className="loading loading-spinner loading-sm" /> : "Grant PAYG Credits"}</button>
      </form>
    </div>
  );
}

const USERS_PAGE_SIZE = 100;

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersOffset, setUsersOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [grantTarget, setGrantTarget] = useState(null);
  const [grantToast, setGrantToast] = useState(null);

  const loadUsers = useCallback(async (offset = 0) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: String(USERS_PAGE_SIZE), offset: String(offset) });
      if (search) params.set("search", search);
      if (planFilter) params.set("plan", planFilter);
      const data = await apiFetch(`/api/admin/users?${params}`);
      setUsers(data.users ?? []); setUsersTotal(data.total ?? 0); setUsersOffset(offset);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [search, planFilter]);

  useEffect(() => { loadUsers(0); }, [loadUsers]);
  const handleSearch = () => {
    setSearch(searchInput);
    loadUsers(0);
  };

  const totalPages = Math.ceil(usersTotal / USERS_PAGE_SIZE);
  const currentPage = Math.floor(usersOffset / USERS_PAGE_SIZE);

  if (error) return <div className="alert alert-error">{error}</div>;
  const handleGrantSuccess = (result) => {
    setGrantTarget(null);
    setGrantToast(result?.targetEmail ? `Granted to ${result.targetEmail}` : "Credits granted");
  };

  return (
    <>
      {grantToast && <div className="alert alert-success mb-4 text-sm">{grantToast}</div>}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input type="text" className="input input-bordered input-sm w-64" placeholder="Search by email…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
        <button type="button" className="btn btn-sm btn-ghost" onClick={handleSearch}>Search</button>
        <select className="select select-bordered select-sm w-32" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} title="Filter by plan">
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
        </select>
        <span className="text-sm text-base-content/50">{users.length > 0 ? `${usersOffset + 1}–${Math.min(usersOffset + USERS_PAGE_SIZE, usersTotal)} of ${usersTotal}` : usersTotal > 0 ? `0 of ${usersTotal}` : "0"} users</span>
      </div>
      {loading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" /></div> : (
        <>
          <div className="overflow-x-auto">
            <table className="table table-sm table-zebra w-full">
              <thead><tr><th>Email</th><th>Plan</th><th>Monthly Cr</th><th>PAYG Cr</th><th>Last Active</th><th>Articles</th><th>Renews</th><th></th></tr></thead>
              <tbody>
                {users.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-base-content/40">No users found</td></tr> : users.map((u) => (
                  <tr key={u.id} className="hover cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <td className="font-medium">{u.email}</td><td><span className={`badge badge-sm ${PLAN_BADGE[u.plan] ?? "badge-ghost"}`}>{u.planName}</span></td>
                    <td className="font-mono text-sm">{fmt(u.creditsRemaining)}</td><td className="font-mono text-sm">{fmt(u.paygWallet)}</td>
                    <td className="text-sm whitespace-nowrap"><span title={fmtDate(u.lastActive)}>{timeAgo(u.lastActive)}</span></td>
                    <td className="text-sm">{u.articleCount}</td><td className="text-sm text-base-content/60">{fmtDateShort(u.renewalAt)}</td>
                    <td><div className="flex gap-1"><button className="btn btn-xs btn-ghost" onClick={(e) => { e.stopPropagation(); setSelectedUser(u); }}>Detail →</button><button className="btn btn-xs btn-outline btn-success" onClick={(e) => { e.stopPropagation(); setGrantTarget(u.email); }}>Grant</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {usersTotal > USERS_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-base-content/60">{usersOffset + 1}–{Math.min(usersOffset + USERS_PAGE_SIZE, usersTotal)} of {usersTotal}</span>
              <div className="join">
                <button type="button" className="join-item btn btn-sm" disabled={currentPage === 0} onClick={() => loadUsers(usersOffset - USERS_PAGE_SIZE)}>«</button>
                <button type="button" className="join-item btn btn-sm btn-disabled">{currentPage + 1} / {totalPages}</button>
                <button type="button" className="join-item btn btn-sm" disabled={usersOffset + USERS_PAGE_SIZE >= usersTotal} onClick={() => loadUsers(usersOffset + USERS_PAGE_SIZE)}>»</button>
              </div>
            </div>
          )}
        </>
      )}
      {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
      {grantTarget && <GrantCreditsModal email={grantTarget} onClose={() => setGrantTarget(null)} onSuccess={handleGrantSuccess} />}
    </>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");
  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6"><h1 className="text-2xl font-bold">Admin Dashboard</h1><p className="text-base-content/60 text-sm mt-1">User behaviour, credit ledger, keyword rankings, and payment status.</p></div>
        <div className="tabs tabs-boxed bg-base-100 mb-6 inline-flex">
          <button className={`tab ${tab === "users" ? "tab-active" : ""}`} onClick={() => setTab("users")}>Users</button>
          <button className={`tab ${tab === "grant" ? "tab-active" : ""}`} onClick={() => setTab("grant")}>Grant Credits</button>
        </div>
        <div className="card bg-base-100 shadow-sm p-6">{tab === "users" && <UsersTab />}{tab === "grant" && <GrantCreditsTab />}</div>
      </div>
    </div>
  );
}
