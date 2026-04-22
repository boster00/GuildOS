/**
 * BosterBio Lifecycle Weapon — reads genes and writes enrichment via bapi.php
 *
 * Endpoint: https://www.bosterbio.com/?_bapi=1&action=<action>&api_key=<key>
 * Auth: BOSTERBIO_BAPI_KEY env var (or profile env_vars)
 *
 * Actions:
 *   readGenes   — fetch top genes needing enrichment
 *   readGene    — fetch a single gene by gene_species
 *   writeEnrichment — write HTML enrichment back to the genes table
 */

import { database } from "@/libs/council/database";

const BAPI_BASE = process.env.BOSTERBIO_BAPI_URL || "https://www.bosterbio.com/";

// ---------------------------------------------------------------------------
// Auth resolution
// ---------------------------------------------------------------------------

async function resolveApiKey(userId) {
  const key = process.env.BOSTERBIO_BAPI_KEY;
  if (key) return key;
  if (userId) {
    const db = await database.init("service");
    const { data } = await db
      .from("profiles")
      .select("env_vars")
      .eq("id", userId)
      .single();
    return data?.env_vars?.BOSTERBIO_BAPI_KEY || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function bapiUrl(action, params = {}) {
  const url = new URL(BAPI_BASE);
  url.searchParams.set("_bapi", "cjgeo");
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function bapiGet(action, params, apiKey) {
  const url = bapiUrl(action, { ...params, api_key: apiKey });
  const res = await fetch(url, {
    headers: { "User-Agent": "GuildOS-Lifecycle/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`BAPI ${action} HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`BAPI ${action} error: ${json.error}`);
  return json;
}

async function bapiPost(action, body, apiKey) {
  const url = bapiUrl(action, { api_key: apiKey });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "GuildOS-Lifecycle/1.0",
      Accept: "application/json",
    },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`BAPI ${action} HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`BAPI ${action} error: ${json.error}`);
  return json;
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/**
 * Fetch genes that need enrichment (enrichment IS NULL or empty).
 * Ordered by priority DESC.
 *
 * @param {{ limit?: number, species?: string, userId?: string }} opts
 * @returns {Promise<{ ok: boolean, genes: object[] }>}
 */
export async function readGenes({ limit = 5, species = "Human", userId } = {}) {
  const apiKey = await resolveApiKey(userId);
  if (!apiKey) throw new Error("BOSTERBIO_BAPI_KEY not configured");
  const data = await bapiGet("get_genes", { limit, species }, apiKey);
  return { ok: true, genes: data.genes };
}

/**
 * Fetch a single gene record by gene_species key.
 *
 * @param {{ gene_species: string, userId?: string }} opts
 * @returns {Promise<{ ok: boolean, gene: object }>}
 */
export async function readGene({ gene_species, userId } = {}) {
  if (!gene_species) throw new Error("gene_species is required");
  const apiKey = await resolveApiKey(userId);
  if (!apiKey) throw new Error("BOSTERBIO_BAPI_KEY not configured");
  const data = await bapiGet("get_gene", { gene_species }, apiKey);
  return { ok: true, gene: data.gene };
}

/**
 * Write AI-generated HTML enrichment back to a gene record.
 *
 * @param {{ gene_species: string, enrichment_html: string, userId?: string }} opts
 * @returns {Promise<{ ok: boolean, gene_species: string, message: string }>}
 */
export async function writeEnrichment({ gene_species, enrichment_html, userId } = {}) {
  if (!gene_species) throw new Error("gene_species is required");
  if (!enrichment_html) throw new Error("enrichment_html is required");
  const apiKey = await resolveApiKey(userId);
  if (!apiKey) throw new Error("BOSTERBIO_BAPI_KEY not configured");
  const data = await bapiPost("write_enrichment", { gene_species, enrichment_html }, apiKey);
  return { ok: true, gene_species: data.gene_species, message: data.message };
}

/**
 * Health check — verify BAPI is reachable.
 * @param {{ userId?: string }} opts
 */
export async function ping({ userId } = {}) {
  const apiKey = await resolveApiKey(userId);
  if (!apiKey) throw new Error("BOSTERBIO_BAPI_KEY not configured");
  const url = bapiUrl("ping", { api_key: apiKey });
  const res = await fetch(url, {
    headers: { "User-Agent": "GuildOS-Lifecycle/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  const json = await res.json();
  return { ok: json.success === true, message: json.message };
}
