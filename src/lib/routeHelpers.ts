// ============================================================
// SOVEREIGN OS PLATFORM — ROUTE HELPERS (P21)
// Centralized DB error handling utilities for route handlers.
// Wrap D1 calls to return user-friendly errors instead of raw DB errors.
// ============================================================

import { layout } from '../layout'

/**
 * Wrap an async route handler to catch D1/DB errors and return
 * a user-friendly HTML error page instead of a raw error dump.
 * Usage: routeHandler(c, async () => { ... D1 calls ... })
 */
export async function withDbErrorHandling<T>(
  c: { html: (body: string, status?: number) => Response; req: { path: string } },
  handler: () => Promise<T>,
  surfaceName = 'Surface'
): Promise<T | Response> {
  try {
    return await handler()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Detect D1/SQLite errors — return user-friendly page, not raw error
    const isDbError = /D1|sqlite|SQLITE|prepare|bind|execute|no such table/i.test(msg)
    const userMsg = isDbError
      ? 'Database temporarily unavailable. Please try again shortly.'
      : 'An unexpected error occurred. Please try again.'

    // Return typed as Response — caller should return this value
    return (c as Parameters<typeof c.html>[0] extends never ? never : typeof c).html(
      layout(surfaceName, `
        <div style="max-width:520px;margin:80px auto;text-align:center">
          <div style="font-size:48px;margin-bottom:16px">⚠️</div>
          <h2 style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">${surfaceName} Unavailable</h2>
          <p style="font-size:13px;color:var(--text2);margin-bottom:20px">${userMsg}</p>
          <a href="/dashboard" style="font-size:13px;color:var(--accent)">← Back to Dashboard</a>
        </div>
      `, '/dashboard'),
      503
    ) as unknown as Response
  }
}

/**
 * Wrap a D1 database call with silent error handling.
 * Returns null on any DB error — use for non-critical data enrichment.
 */
export async function safeDb<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

/**
 * Add Cache-Control: no-store to any sensitive response context.
 */
export function noCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  }
}
