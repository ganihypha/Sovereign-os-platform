// ============================================================
// SOVEREIGN OS PLATFORM — PUBLIC API GATEWAY v1 (P5)
// External API gateway with rate limiting.
// Auth: Bearer token (public API key — separate from internal role keys)
// Security: Never expose governance internals, secrets, or role details
// Rate limiting: in-memory (PARTIAL — KV-backed is production target)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { checkRateLimit, rateLimitHeaders } from '../lib/rateLimiter'

// ---- Hash helper (Web Crypto) ----
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---- Extract bearer token ----
function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function createApiV1Route() {
  const app = new Hono<{ Bindings: Env }>()

  // ============================================================
  // PUBLIC ROUTES — no auth required
  // ============================================================

  // GET /api/v1/health — Public API health check
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      platform: 'Sovereign OS Platform',
      version: '0.5.0-P5',
      phase: 'P5 — Multi-Tenant & AI-Augmented Operations',
      api_version: 'v1',
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/v1/docs — Public API documentation
  app.get('/docs', (c) => {
    return c.json({
      api: 'Sovereign OS Platform Public API v1',
      version: '0.5.0-P5',
      authentication: 'Bearer token (issue via /api-keys surface)',
      base_url: '/api/v1',
      endpoints: {
        'GET /api/v1/health': 'Platform health — no auth required',
        'GET /api/v1/docs': 'This documentation — no auth required',
        'GET /api/v1/metrics': 'Platform metrics — requires valid API key',
        'GET /api/v1/tenants': 'Tenant list — requires valid API key (readonly)',
        'GET /api/v1/sessions': 'Active sessions — requires valid API key (readonly)',
        'GET /api/v1/status': 'Detailed platform status — requires valid API key (readonly)',
      },
      rate_limiting: {
        status: 'PARTIAL — in-memory enforcement (KV-backed is production target)',
        headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Policy'],
        default_limit: 100,
        window: '1 hour',
      },
      notes: [
        'Public API returns sanitized data only — no governance internals exposed',
        'Secrets, key hashes, and role details are never returned',
        'Rate limit headers are included in every authenticated response',
      ],
    })
  })

  // ============================================================
  // AUTHENTICATED ROUTES — require valid public API key
  // ============================================================

  // Auth middleware for /api/v1/* authenticated routes
  const requirePublicKey = async (
    c: Parameters<Parameters<typeof app.use>[0]>[0],
    next: () => Promise<void>
  ) => {
    const repo = createRepo(c.env.DB)
    const bearerToken = extractBearer(c.req.header('Authorization'))

    if (!bearerToken) {
      return c.json({
        error: 'Authentication required',
        hint: 'Provide Authorization: Bearer <public_api_key>',
        docs: '/api/v1/docs',
      }, 401)
    }

    const keyHash = await sha256(bearerToken)
    const apiKey = await repo.getPublicApiKeyByHash(keyHash)

    if (!apiKey) {
      return c.json({ error: 'Invalid or revoked API key' }, 401)
    }

    // Rate limiting check
    const rateResult = checkRateLimit(apiKey.id, apiKey.rate_limit)
    if (!rateResult.allowed) {
      return c.json(
        { error: 'Rate limit exceeded', retry_after: rateResult.resetAt },
        429,
        rateLimitHeaders(rateResult)
      )
    }

    // Track usage (async — don't block response)
    repo.incrementPublicApiKeyUsage(keyHash).catch(() => {})

    // Attach to context
    ;(c as unknown as Record<string, unknown>)['publicApiKey'] = apiKey
    ;(c as unknown as Record<string, unknown>)['rateLimitResult'] = rateResult

    return next()
  }

  // GET /api/v1/metrics — Platform metrics (sanitized)
  app.get('/metrics', requirePublicKey, async (c) => {
    const repo = createRepo(c.env.DB)
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>

    const metrics = await repo.getReportMetrics()

    return c.json({
      metrics,
      tenant: 'default',
      timestamp: new Date().toISOString(),
    }, 200, rateLimitHeaders(rateResult))
  })

  // GET /api/v1/tenants — Tenant list (sanitized — no sensitive fields)
  app.get('/tenants', requirePublicKey, async (c) => {
    const repo = createRepo(c.env.DB)
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>

    const tenants = await repo.getTenants()
    // Sanitize: remove owner_email from public output
    const sanitized = tenants.map(t => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      plan: t.plan,
      isolation_mode: t.isolation_mode,
      created_at: t.created_at,
    }))

    return c.json({ tenants: sanitized, count: sanitized.length }, 200, rateLimitHeaders(rateResult))
  })

  // GET /api/v1/sessions — Active sessions (sanitized)
  app.get('/sessions', requirePublicKey, async (c) => {
    const repo = createRepo(c.env.DB)
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>

    const sessions = await repo.getSessions()
    const activeSessions = sessions.filter(s => s.status === 'active').map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      created_at: s.created_at,
    }))

    return c.json({ sessions: activeSessions, count: activeSessions.length }, 200, rateLimitHeaders(rateResult))
  })

  // GET /api/v1/status — Platform status (sanitized)
  app.get('/status', requirePublicKey, async (c) => {
    const repo = createRepo(c.env.DB)
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>

    const metrics = await repo.getReportMetrics()

    return c.json({
      status: 'operational',
      version: '0.5.0-P5',
      phase: 'P5 — Multi-Tenant & AI-Augmented Operations',
      persistence: repo.isPersistent ? 'd1-persistent' : 'in-memory',
      metrics,
      timestamp: new Date().toISOString(),
    }, 200, rateLimitHeaders(rateResult))
  })

  return app
}
