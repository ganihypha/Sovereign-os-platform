// ============================================================
// SOVEREIGN OS PLATFORM — PUBLIC API GATEWAY v1 (P8 UPGRADE)
// External API gateway with KV-backed distributed rate limiting.
// Auth: Bearer token (public API key — separate from internal role keys)
// Security: Never expose governance internals, secrets, or role details
// Rate limiting: KV-backed distributed (P6 upgrade from in-memory PARTIAL)
// P7: /api/v1/metrics-history — time-series from metrics_snapshots
//     /api/v1/metrics-snapshot — trigger manual snapshot write
// P8: /api/v1/anomaly-detect — ML/AI anomaly detection on metrics
//     /api/v1/audit-events — audit log v2 (sanitized, read-only)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { checkRateLimit, rateLimitHeaders } from '../lib/rateLimiter'
import { takeMetricsSnapshot, getMetricsHistory } from '../lib/metricsService'
import { runAnomalyDetection } from '../lib/anomalyService'
import { getAuditLogV2 } from '../lib/auditService'

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

  // GET /api/v1 — Root path handler (P18 fix: was 500)
  app.get('/', (c) => {
    return c.json({
      status: 'ok',
      platform: 'Sovereign OS Platform',
      api: 'Public API Gateway v1',
      version: '1.9.0-P19',
      endpoints: [
        { path: '/api/v1/health', auth: 'none', description: 'API health check' },
        { path: '/api/v1/docs', auth: 'none', description: 'API documentation' },
        { path: '/api/v1/metrics', auth: 'bearer', description: 'Platform metrics (sanitized)' },
        { path: '/api/v1/tenants', auth: 'bearer', description: 'Tenant list (sanitized)' },
        { path: '/api/v1/sessions', auth: 'bearer', description: 'Active sessions (sanitized)' },
        { path: '/api/v1/status', auth: 'bearer', description: 'Platform status' },
        { path: '/api/v1/metrics-history', auth: 'bearer', description: 'Time-series metrics snapshots' },
        { path: '/api/v1/audit-events', auth: 'bearer', description: 'Audit log (sanitized, read-only)' },
      ],
      docs: '/api/v1/docs',
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/v1/health — Public API health check (P19: version locked to current platform)
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      platform: 'Sovereign OS Platform',
      version: '1.9.0-P19',
      phase: 'P19 — Platform Hardening, Email Delivery, Session Tracking, Changelog',
      api_version: 'v1',
      email_delivery: !!(c.env.RESEND_API_KEY) ? 'configured' : 'not-configured',
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/v1/docs — Public API documentation
  app.get('/docs', (c) => {
    return c.json({
      api: 'Sovereign OS Platform Public API v1',
      version: '0.7.0-P7',
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
        status: 'ACTIVE — KV-backed distributed rate limiting (falls back to in-memory if KV unavailable)',
        headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Policy'],
        default_limit: 100,
        window: '1 hour',
        policy: 'kv-enforced (when KV binding available) | in-memory-partial (fallback)',
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

  // Rate limiting check (P6: KV-backed if available, else in-memory fallback)
    const rateResult = await checkRateLimit(apiKey.id, apiKey.rate_limit, 3600, c.env.RATE_LIMITER_KV)
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
      version: '0.7.0-P7',
      phase: 'P7 — Enterprise Governance Expansion',
      persistence: repo.isPersistent ? 'd1-persistent' : 'in-memory',
      metrics,
      timestamp: new Date().toISOString(),
    }, 200, rateLimitHeaders(rateResult))
  })

  // GET /api/v1/metrics-history — Time-series metrics from snapshots (P7)
  app.get('/metrics-history', requirePublicKey, async (c) => {
    const repo = createRepo(c.env.DB)
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>

    const snapshotType = (c.req.query('type') ?? 'daily') as 'hourly' | 'daily' | 'weekly'
    const tenantId = c.req.query('tenant_id') ?? 'tenant-default'
    const limit = Math.min(parseInt(c.req.query('limit') ?? '30'), 90)

    const history = await getMetricsHistory(repo, tenantId, snapshotType, limit)

    return c.json({
      history,
      count: history.length,
      snapshot_type: snapshotType,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
    }, 200, rateLimitHeaders(rateResult))
  })

  // POST /api/v1/metrics-snapshot — Trigger manual snapshot write (P7)
  app.post('/metrics-snapshot', requirePublicKey, async (c) => {
    const repo = createRepo(c.env.DB)
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>
    const apiKey = (c as unknown as Record<string, unknown>)['publicApiKey'] as { role_scope: string }

    // Only readwrite keys can trigger snapshot writes
    if (apiKey.role_scope !== 'readwrite') {
      return c.json({ error: 'readwrite scope required for snapshot writes' }, 403, rateLimitHeaders(rateResult))
    }

    const body = await c.req.json().catch(() => ({})) as { tenant_id?: string; snapshot_type?: string }
    const tenantId = body.tenant_id ?? 'tenant-default'
    const snapshotType = (body.snapshot_type ?? 'daily') as 'hourly' | 'daily' | 'weekly'

    const result = await takeMetricsSnapshot(repo, { tenantId, snapshotType })

    return c.json({
      ok: result.ok,
      period_label: result.period_label,
      snapshot_id: result.id,
      timestamp: new Date().toISOString(),
    }, result.ok ? 200 : 500, rateLimitHeaders(rateResult))
  })

  // POST /api/v1/anomaly-detect — ML/AI anomaly detection on metrics (P8)
  app.post('/anomaly-detect', requirePublicKey, async (c) => {
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>
    const apiKey = (c as unknown as Record<string, unknown>)['publicApiKey'] as { role_scope: string }

    if (apiKey.role_scope !== 'readwrite') {
      return c.json({ error: 'readwrite scope required for anomaly detection' }, 403, rateLimitHeaders(rateResult))
    }

    const body = await c.req.json().catch(() => ({})) as {
      tenant_id?: string
      threshold?: number
      write_alerts?: boolean
    }

    const results = await runAnomalyDetection(c.env.DB, {
      tenant_id: body.tenant_id ?? 'default',
      threshold: body.threshold,
      openai_api_key: c.env.OPENAI_API_KEY,
      write_alerts: body.write_alerts ?? true,
    })

    const anomalies = results.filter(r => r.is_anomaly)

    return c.json({
      ok: true,
      tenant_id: body.tenant_id ?? 'default',
      total_metrics_checked: results.length,
      anomalies_detected: anomalies.length,
      results,
      ai_note: results.some(r => r.confidence === 'ai-assisted')
        ? 'ai-generated — requires human confirmation before action'
        : 'statistical-only',
      timestamp: new Date().toISOString(),
    }, 200, rateLimitHeaders(rateResult))
  })

  // GET /api/v1/audit-events — Sanitized audit log v2 (P8)
  app.get('/audit-events', requirePublicKey, async (c) => {
    const rateResult = (c as unknown as Record<string, unknown>)['rateLimitResult'] as ReturnType<typeof checkRateLimit>
    const apiKey = (c as unknown as Record<string, unknown>)['publicApiKey'] as { role_scope: string }

    if (apiKey.role_scope !== 'readwrite') {
      return c.json({ error: 'readwrite scope required for audit access' }, 403, rateLimitHeaders(rateResult))
    }

    const tenantId = c.req.query('tenant_id') || 'default'
    const eventType = c.req.query('event_type') || undefined
    const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 50)

    const events = await getAuditLogV2(c.env.DB, { tenant_id: tenantId, event_type: eventType, limit })

    // Sanitize: return public-safe fields only
    const sanitized = events.map(e => ({
      id: e.id,
      event_type: e.event_type,
      object_type: e.object_type,
      object_id: e.object_id,
      actor: e.actor,
      tenant_id: e.tenant_id,
      event_hash: e.event_hash,
      surface: e.surface,
      created_at: e.created_at,
    }))

    return c.json({
      events: sanitized,
      count: sanitized.length,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
    }, 200, rateLimitHeaders(rateResult))
  })

  return app
}
