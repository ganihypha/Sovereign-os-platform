// ============================================================
// SOVEREIGN OS PLATFORM — PLUGGABLE RATE LIMITER (P5)
// Current implementation: in-memory counter (resets on deploy).
// Production target: KV-backed distributed rate limiting.
// Status: PARTIAL — in-memory fallback active.
//
// To upgrade to KV-backed:
//   1. Add KV binding to wrangler.jsonc
//   2. Pass KV namespace to createRateLimiter
//   3. Replace in-memory store with KV.get/put
// ============================================================

// In-memory rate store (per-key request counters)
// Resets on each Worker cold start. NOT distributed.
const memStore: Map<string, { count: number; resetAt: number }> = new Map()

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number          // Unix timestamp (seconds) when the window resets
  isMemoryFallback: boolean  // true = KV not available, using in-memory
}

// ---- checkRateLimit ----
// Check if keyId has exceeded limit within the window (default: 1 hour).
// Uses in-memory store (PARTIAL — see note above).
export function checkRateLimit(
  keyId: string,
  limit: number,
  windowSeconds: number = 3600
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000)
  const entry = memStore.get(keyId)

  if (!entry || now >= entry.resetAt) {
    // Start new window
    const resetAt = now + windowSeconds
    memStore.set(keyId, { count: 1, resetAt })
    return { allowed: true, limit, remaining: limit - 1, resetAt, isMemoryFallback: true }
  }

  if (entry.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: entry.resetAt, isMemoryFallback: true }
  }

  entry.count++
  memStore.set(keyId, entry)
  return { allowed: true, limit, remaining: limit - entry.count, resetAt: entry.resetAt, isMemoryFallback: true }
}

// ---- addRateLimitHeaders ----
// Adds X-RateLimit-* headers to the response context.
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
    'X-RateLimit-Policy': result.isMemoryFallback ? 'in-memory-partial' : 'kv-enforced',
  }
}
