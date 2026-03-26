/**
 * In-memory rate limit for Eden test API routes.
 * Per-route budgets; 429 with code RATE_LIMIT_EXCEEDED when exceeded.
 * Optional per-user when auth is available (identify by header or session).
 */

const budgets = new Map();
const DEFAULT_BUDGETS = {
  "/api/eden/chat": 60,
  "/api/eden/image": 20,
  "/api/eden/video": 5,
  "/api/eden/tts": 30,
};

function getKey(route, userId) {
  return userId ? `${route}:${userId}` : route;
}

function getRemaining(route, userId) {
  const key = getKey(route, userId);
  const entry = budgets.get(key);
  const limit = DEFAULT_BUDGETS[route] ?? 30;
  if (!entry) return { remaining: limit, resetAt: Date.now() + 60 * 1000 };
  if (Date.now() > entry.resetAt) {
    budgets.set(key, { count: 0, resetAt: Date.now() + 60 * 1000 });
    return { remaining: limit, resetAt: Date.now() + 60 * 1000 };
  }
  return { remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

function consume(route, userId) {
  const key = getKey(route, userId);
  const limit = DEFAULT_BUDGETS[route] ?? 30;
  let entry = budgets.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    entry = { count: 0, resetAt: Date.now() + 60 * 1000 };
    budgets.set(key, entry);
  }
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  return { remaining, limit, resetAt: entry.resetAt };
}

function check(route, userId) {
  const { remaining } = getRemaining(route, userId);
  if (remaining <= 0) {
    return { allowed: false, code: "RATE_LIMIT_EXCEEDED" };
  }
  return { allowed: true };
}

module.exports = {
  check,
  consume,
  getRemaining,
  DEFAULT_BUDGETS,
};
