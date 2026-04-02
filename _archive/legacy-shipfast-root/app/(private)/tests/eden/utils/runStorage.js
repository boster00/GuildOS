/**
 * localStorage wrapper for Eden test run persistence (save, load, list, export).
 * Handles runType: "single" | "batch", batchPrompts.
 */

const STORAGE_KEY = "eden-test-runs";
const MAX_RUNS = 100;

export function saveRun(run) {
  if (typeof window === "undefined") return;
  const list = listRuns();
  const entry = {
    ...run,
    savedAt: new Date().toISOString(),
  };
  list.unshift(entry);
  const trimmed = list.slice(0, MAX_RUNS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
  }
}

export function listRuns() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function loadRun(index) {
  const list = listRuns();
  return list[index] != null ? list[index] : null;
}

export function exportRun(run) {
  return JSON.stringify(run, null, 2);
}
