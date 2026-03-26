/**
 * In-Memory Run State Store
 * Supports interactive mode where frontend triggers next steps
 */

export interface RunState {
  runId: string;
  payload: any;
  stepIndex: number;
  artifacts: Record<string, any>;
  createdAt: number;
  lastUpdated: number;
}

// In-memory store (in production, use Redis or database)
const runStore = new Map<string, RunState>();

/**
 * Create a new run
 */
export function createRun(payload: any): string {
  const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();
  
  runStore.set(runId, {
    runId,
    payload,
    stepIndex: 0,
    artifacts: {},
    createdAt: now,
    lastUpdated: now,
  });
  
  return runId;
}

/**
 * Get run state
 */
export function getRun(runId: string): RunState | undefined {
  return runStore.get(runId);
}

/**
 * Update run state
 */
export function updateRun(runId: string, patch: Partial<RunState>): void {
  const run = runStore.get(runId);
  if (!run) {
    // If run doesn't exist, create it (can happen in non-interactive mode)
    const now = Date.now();
    runStore.set(runId, {
      runId,
      payload: patch.payload || {},
      stepIndex: patch.stepIndex || 0,
      artifacts: patch.artifacts || {},
      createdAt: now,
      lastUpdated: now,
    });
    return;
  }
  
  runStore.set(runId, {
    ...run,
    ...patch,
    lastUpdated: Date.now(),
  });
}

/**
 * Delete run
 */
export function deleteRun(runId: string): void {
  runStore.delete(runId);
}

/**
 * Clean up old runs (older than 1 hour)
 */
export function cleanupOldRuns(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [runId, run] of runStore.entries()) {
    if (run.lastUpdated < oneHourAgo) {
      runStore.delete(runId);
    }
  }
}

// Cleanup every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldRuns, 30 * 60 * 1000);
}
