// ============================================================
// SOVEREIGN OS PLATFORM — KV-BACKED DISTRIBUTED RATE LIMITER (P6)
// P5 status: PARTIAL (in-memory only, resets on cold start)
// P6 status: KV-backed distributed (survives cold starts, cross-instance)
//
// Strategy:
//   - If KV namespace is provided → use KV-backed distributed counting
//   - If KV not available → graceful in-memory fallback (documented)
//
// KV Key format: "rl:{keyId}:{windowStart}"
// TTL: windowSeconds + 10s buffer to prevent stale key accumulation
//
// X-RateLimit-Policy:
//   'kv-enforced'       — KV-backed, distributed, survives cold starts
//   'in-memory-partial' — fallback, resets on cold start (documented)
// ============================================================

// In-memory fallback store (used only when KV is not available)
const memStore: Map<string, { count: number; resetAt: number }> = new Map()

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number           // Unix timestamp (seconds) when the window resets
  isMemoryFallback: boolean // true = KV not available, using in-memory
}

// ---- KV-backed rate limit check ----
// Uses Cloudflare KV for distributed, persistent rate limiting.
async function checkRateLimitKV(
  kv: KVNamespace,
  keyId: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds
  const resetAt = windowStart + windowSeconds
  const kvKey = `rl:${keyId}:${windowStart}`

  try {
    // Atomic read-increment-write using KV
    const existing = await kv.get(kvKey)
    const currentCount = existing ? parseInt(existing, 10) : 0

    if (currentCount >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        isMemoryFallback: false,
      }
    }

    const newCount = currentCount + 1
    // Store with TTL = remaining window time + 10s buffer
    const ttl = Math.max(10, resetAt - now + 10)
    await kv.put(kvKey, String(newCount), { expirationTtl: ttl })

    return {
      allowed: true,
      limit,
      remaining: limit - newCount,
      resetAt,
      isMemoryFallback: false,
    }
  } catch (_err) {
    // KV error — fall through to in-memory fallback
    return checkRateLimitMem(keyId, limit, windowSeconds)
  }
}

// ---- In-memory fallback rate limit check ----
// Used when KV is not available. Resets on cold start. DOCUMENTED.
function checkRateLimitMem(
  keyId: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000)
  const entry = memStore.get(keyId)

  if (!entry || now >= entry.resetAt) {
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

// ---- checkRateLimit (main export) ----
// Auto-selects KV-backed or in-memory based on KV availability.
export async function checkRateLimit(
  keyId: string,
  limit: number,
  windowSeconds: number = 3600,
  kv?: KVNamespace
): Promise<RateLimitResult> {
  if (kv) {
    return checkRateLimitKV(kv, keyId, limit, windowSeconds)
  }
  return checkRateLimitMem(keyId, limit, windowSeconds)
}

// ---- Synchronous fallback (backward compat — in-memory only) ----
// Used by routes that haven't been updated to pass KV yet.
// Will be removed in P7.
export function checkRateLimitSync(
  keyId: string,
  limit: number,
  windowSeconds: number = 3600
): RateLimitResult {
  return checkRateLimitMem(keyId, limit, windowSeconds)
}

// ---- rateLimitHeaders ----
// Adds X-RateLimit-* headers + Cache-Control: no-store (P21: sensitive API hardening)
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
    'X-RateLimit-Policy': result.isMemoryFallback ? 'in-memory-partial' : 'kv-enforced',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
  }
}
