// ============================================================
// SOVEREIGN OS PLATFORM — API V2 (P10)
// Structured REST layer with cursor-based pagination,
// filtering, sorting, rate limiting, OpenAPI-style docs.
// Resources: intents, approvals, workflows, notifications,
//            health-snapshots, audit-events
// Rate limiting: via existing RATE_LIMITER_KV
// ============================================================

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { checkRateLimit as kvCheckRateLimit } from '../lib/rateLimiter'

const API_V2_VERSION = '2.0.0'
const API_V2_PHASE = 'P10'
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

// ============================================================
// UTILITY: cursor-based pagination
// ============================================================
function paginate<T extends Record<string, unknown>>(
  rows: T[],
  cursor?: string,
  limit = DEFAULT_PAGE_SIZE,
  sortField = 'created_at',
  sortDir: 'asc' | 'desc' = 'desc'
): { data: T[]; next_cursor: string | null; total: number; has_more: boolean } {
  limit = Math.min(limit, MAX_PAGE_SIZE)
  const total = rows.length

  // Sort
  const sorted = [...rows].sort((a, b) => {
    const av = String(a[sortField] || '')
    const bv = String(b[sortField] || '')
    return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
  })

  // Cursor: base64 of { index }
  let startIdx = 0
  if (cursor) {
    try {
      const decoded = JSON.parse(atob(cursor))
      startIdx = decoded.index || 0
    } catch { startIdx = 0 }
  }

  const slice = sorted.slice(startIdx, startIdx + limit)
  const endIdx = startIdx + slice.length
  const has_more = endIdx < total
  const next_cursor = has_more ? btoa(JSON.stringify({ index: endIdx })) : null

  return { data: slice, next_cursor, total, has_more }
}

// ============================================================
// UTILITY: apply filter/search from query params
// ============================================================
function filterRows<T extends Record<string, unknown>>(
  rows: T[],
  filters: Record<string, string>
): T[] {
  return rows.filter(row => {
    for (const [key, val] of Object.entries(filters)) {
      if (!val) continue
      if (key === 'q') {
        // full-text search across all string values
        const haystack = Object.values(row).map(v => String(v || '')).join(' ').toLowerCase()
        if (!haystack.includes(val.toLowerCase())) return false
        continue
      }
      if (key === 'date_from') {
        const d = String(row['created_at'] || row['started_at'] || '')
        if (d && d < val) return false
        continue
      }
      if (key === 'date_to') {
        const d = String(row['created_at'] || row['started_at'] || '')
        if (d && d > val + 'T23:59:59Z') return false
        continue
      }
      if (row[key] !== undefined && String(row[key]) !== val) return false
    }
    return true
  })
}

// ============================================================
// UTILITY: standard API v2 response envelope
// ============================================================
function apiResponse(data: unknown, meta?: Record<string, unknown>) {
  return {
    api_version: API_V2_VERSION,
    phase: API_V2_PHASE,
    timestamp: new Date().toISOString(),
    ...meta,
    data,
  }
}

function apiError(message: string, code = 400) {
  return {
    api_version: API_V2_VERSION,
    error: { message, code },
    timestamp: new Date().toISOString(),
  }
}

// ============================================================
// RATE LIMIT HELPER
// ============================================================
async function checkRateLimit(env: Env, key: string): Promise<boolean> {
  if (!env.RATE_LIMITER_KV) return true // no KV → allow
  try {
    const result = await kvCheckRateLimit(env.RATE_LIMITER_KV, `apiv2:${key}`, 60, 60)
    return result.allowed
  } catch {
    return true
  }
}

// ============================================================
// ROUTE FACTORY
// ============================================================
export function createApiV2Route() {
  const route = new Hono<{ Bindings: Env }>()

  route.use('/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }))

  // ============================================================
  // GET /api/v2 — root info + rate limit status
  // ============================================================
  route.get('/', (c) => {
    return c.json(apiResponse({
      name: 'Sovereign OS Platform API v2',
      version: API_V2_VERSION,
      phase: API_V2_PHASE,
      docs: '/api/v2/docs',
      resources: [
        '/api/v2/intents',
        '/api/v2/approvals',
        '/api/v2/workflows',
        '/api/v2/notifications',
        '/api/v2/health-snapshots',
        '/api/v2/audit-events',
      ],
      rate_limit: '60 requests/min per API key (KV-enforced)',
    }))
  })

  // ============================================================
  // GET /api/v2/docs — OpenAPI-style docs (HTML)
  // ============================================================
  route.get('/docs', (c) => {
    const endpoints = [
      { method: 'GET', path: '/api/v2',                    desc: 'API root info & available resources' },
      { method: 'GET', path: '/api/v2/docs',               desc: 'This documentation page' },
      { method: 'GET', path: '/api/v2/intents',            desc: 'List intent sessions. Params: status, q, cursor, limit, sort, dir, date_from, date_to' },
      { method: 'GET', path: '/api/v2/intents/:id',        desc: 'Get single intent by ID' },
      { method: 'GET', path: '/api/v2/approvals',          desc: 'List approval requests. Params: status, tier, q, cursor, limit, sort, dir' },
      { method: 'GET', path: '/api/v2/approvals/:id',      desc: 'Get single approval by ID' },
      { method: 'GET', path: '/api/v2/workflows',          desc: 'List workflows. Params: status, tenant_id, q, cursor, limit' },
      { method: 'GET', path: '/api/v2/workflows/:id',      desc: 'Get single workflow by ID' },
      { method: 'GET', path: '/api/v2/workflows/:id/runs', desc: 'List execution runs for a workflow' },
      { method: 'GET', path: '/api/v2/notifications',      desc: 'List notifications. Params: event_type, read, tenant_id, cursor, limit' },
      { method: 'GET', path: '/api/v2/health-snapshots',   desc: 'List health check snapshots. Params: surface, is_healthy, cursor, limit' },
      { method: 'GET', path: '/api/v2/audit-events',       desc: 'List audit events. Params: actor, action, resource_type, cursor, limit' },
      { method: 'GET', path: '/api/v2/metrics',            desc: 'Current platform metrics snapshot (real-time from D1)' },
    ]

    const rows = endpoints.map(e => `
      <tr style="border-bottom:1px solid #2a2d35">
        <td style="padding:10px 14px">
          <span style="padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;
            background:${e.method === 'GET' ? 'rgba(34,197,94,0.1)' : 'rgba(79,142,247,0.1)'};
            color:${e.method === 'GET' ? '#22c55e' : '#4f8ef7'};
            border:1px solid ${e.method === 'GET' ? 'rgba(34,197,94,0.3)' : 'rgba(79,142,247,0.3)'}">
            ${e.method}
          </span>
        </td>
        <td style="padding:10px 14px;font-family:monospace;font-size:12px;color:#22d3ee">
          <a href="${e.path}" style="color:#22d3ee;text-decoration:none" target="_blank">${e.path}</a>
        </td>
        <td style="padding:10px 14px;font-size:12px;color:#9aa3b2">${e.desc}</td>
      </tr>
    `).join('')

    return c.html(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sovereign OS API v2 Docs</title>
<style>
* { box-sizing: border-box; margin:0; padding:0; }
body { background:#0f1117; color:#e2e8f0; font-family:'Inter',monospace; padding:32px; }
h1 { font-size:22px; font-weight:700; margin-bottom:8px; color:#fff; }
.subtitle { font-size:13px; color:#9aa3b2; margin-bottom:32px; }
.badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600;
         background:rgba(249,115,22,0.1); color:#f97316; border:1px solid rgba(249,115,22,0.3); margin-left:8px; }
table { width:100%; border-collapse:collapse; background:#1a1d27; border-radius:8px; overflow:hidden; border:1px solid #2a2d35; }
th { padding:12px 14px; text-align:left; font-size:11px; color:#6b7280; font-weight:600; background:#14161f; border-bottom:1px solid #2a2d35; text-transform:uppercase; letter-spacing:0.05em; }
h2 { font-size:15px; font-weight:600; color:#e2e8f0; margin:32px 0 12px; }
.note { font-size:12px; color:#9aa3b2; margin-top:20px; padding:12px 16px; background:#1a1d27; border-radius:6px; border:1px solid #2a2d35; }
</style>
</head>
<body>
<h1>Sovereign OS Platform — API v2 Docs <span class="badge">P10 LIVE</span></h1>
<div class="subtitle">Version ${API_V2_VERSION} · Base URL: /api/v2 · Rate limit: 60 req/min · All responses include envelope: api_version, timestamp, data</div>
<h2>Endpoints</h2>
<table>
  <thead><tr>
    <th style="width:80px">Method</th>
    <th style="width:320px">Path</th>
    <th>Description</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="note">
  <strong>Pagination:</strong> All list endpoints support cursor-based pagination via <code>cursor</code> and <code>limit</code> query params.
  Response includes <code>next_cursor</code>, <code>total</code>, <code>has_more</code> fields.<br><br>
  <strong>Filtering:</strong> Use <code>q</code> for full-text search. Field-specific filters (e.g. <code>status=active</code>) are also supported.<br><br>
  <strong>Sorting:</strong> Use <code>sort=field_name&amp;dir=asc|desc</code>.<br><br>
  <strong>Authentication:</strong> Pass <code>X-API-Key</code> header with a valid platform API key for authenticated resources.
</div>
</body></html>`)
  })

  // ============================================================
  // GET /api/v2/intents — list intent sessions
  // ============================================================
  route.get('/intents', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    if (!await checkRateLimit(c.env, c.req.header('x-api-key') || c.req.header('cf-connecting-ip') || 'anon')) {
      return c.json(apiError('Rate limit exceeded', 429), 429)
    }
    const repo = createRepo(c.env.DB)
    const sessions = await repo.getSessions()
    const q = Object.fromEntries(new URL(c.req.url).searchParams)
    const filters: Record<string, string> = {}
    if (q['status']) filters['status'] = q['status']
    if (q['q']) filters['q'] = q['q']
    if (q['date_from']) filters['date_from'] = q['date_from']
    if (q['date_to']) filters['date_to'] = q['date_to']
    const filtered = filterRows(sessions as Record<string, unknown>[], filters)
    const paged = paginate(filtered, q['cursor'], parseInt(q['limit'] || '20'), q['sort'] || 'created_at', (q['dir'] as 'asc' | 'desc') || 'desc')
    return c.json(apiResponse(paged.data, { pagination: { cursor: q['cursor'] || null, next_cursor: paged.next_cursor, total: paged.total, has_more: paged.has_more, limit: parseInt(q['limit'] || '20') } }))
  })

  route.get('/intents/:id', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    const repo = createRepo(c.env.DB)
    const sessions = await repo.getSessions()
    const item = sessions.find((s: Record<string, unknown>) => s['id'] === c.req.param('id'))
    if (!item) return c.json(apiError('Not found', 404), 404)
    return c.json(apiResponse(item))
  })

  // ============================================================
  // GET /api/v2/approvals — list approval requests
  // ============================================================
  route.get('/approvals', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    if (!await checkRateLimit(c.env, c.req.header('x-api-key') || c.req.header('cf-connecting-ip') || 'anon')) {
      return c.json(apiError('Rate limit exceeded', 429), 429)
    }
    const repo = createRepo(c.env.DB)
    const approvals = await repo.getApprovalRequests()
    const q = Object.fromEntries(new URL(c.req.url).searchParams)
    const filters: Record<string, string> = {}
    if (q['status']) filters['status'] = q['status']
    if (q['tier']) filters['tier'] = q['tier']
    if (q['q']) filters['q'] = q['q']
    const filtered = filterRows(approvals as Record<string, unknown>[], filters)
    const paged = paginate(filtered, q['cursor'], parseInt(q['limit'] || '20'), q['sort'] || 'created_at', (q['dir'] as 'asc'|'desc') || 'desc')
    return c.json(apiResponse(paged.data, { pagination: { next_cursor: paged.next_cursor, total: paged.total, has_more: paged.has_more } }))
  })

  route.get('/approvals/:id', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    const repo = createRepo(c.env.DB)
    const approvals = await repo.getApprovalRequests()
    const item = approvals.find((a: Record<string, unknown>) => a['id'] === c.req.param('id'))
    if (!item) return c.json(apiError('Not found', 404), 404)
    return c.json(apiResponse(item))
  })

  // ============================================================
  // GET /api/v2/workflows — list workflows
  // ============================================================
  route.get('/workflows', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    if (!await checkRateLimit(c.env, c.req.header('x-api-key') || c.req.header('cf-connecting-ip') || 'anon')) {
      return c.json(apiError('Rate limit exceeded', 429), 429)
    }
    try {
      const q = Object.fromEntries(new URL(c.req.url).searchParams)
      const filters: Record<string, string> = {}
      if (q['status']) filters['status'] = q['status']
      if (q['tenant_id']) filters['tenant_id'] = q['tenant_id']
      if (q['q']) filters['q'] = q['q']

      const result = await c.env.DB.prepare(`SELECT * FROM workflows ORDER BY created_at DESC LIMIT 500`).all()
      const workflows = (result.results || []) as Record<string, unknown>[]
      const filtered = filterRows(workflows, filters)
      const paged = paginate(filtered, q['cursor'], parseInt(q['limit'] || '20'))
      return c.json(apiResponse(paged.data, { pagination: { next_cursor: paged.next_cursor, total: paged.total, has_more: paged.has_more } }))
    } catch {
      return c.json(apiResponse([], { pagination: { next_cursor: null, total: 0, has_more: false } }))
    }
  })

  route.get('/workflows/:id', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    try {
      const wf = await c.env.DB.prepare(`SELECT * FROM workflows WHERE id = ?`).bind(c.req.param('id')).first()
      if (!wf) return c.json(apiError('Not found', 404), 404)
      return c.json(apiResponse(wf))
    } catch {
      return c.json(apiError('Not found', 404), 404)
    }
  })

  route.get('/workflows/:id/runs', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    try {
      const q = Object.fromEntries(new URL(c.req.url).searchParams)
      const result = await c.env.DB.prepare(`SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?`).bind(c.req.param('id'), parseInt(q['limit'] || '50')).all()
      const runs = result.results || []
      return c.json(apiResponse(runs, { total: runs.length }))
    } catch {
      return c.json(apiResponse([]))
    }
  })

  // ============================================================
  // GET /api/v2/notifications — list notifications
  // ============================================================
  route.get('/notifications', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    if (!await checkRateLimit(c.env, c.req.header('x-api-key') || c.req.header('cf-connecting-ip') || 'anon')) {
      return c.json(apiError('Rate limit exceeded', 429), 429)
    }
    try {
      const q = Object.fromEntries(new URL(c.req.url).searchParams)
      const result = await c.env.DB.prepare(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500`).all()
      const rows = (result.results || []) as Record<string, unknown>[]
      const filters: Record<string, string> = {}
      if (q['event_type']) filters['event_type'] = q['event_type']
      if (q['tenant_id']) filters['tenant_id'] = q['tenant_id']
      if (q['read'] !== undefined) filters['read'] = q['read']
      const filtered = filterRows(rows, filters)
      const paged = paginate(filtered, q['cursor'], parseInt(q['limit'] || '20'))
      return c.json(apiResponse(paged.data, { pagination: { next_cursor: paged.next_cursor, total: paged.total, has_more: paged.has_more } }))
    } catch {
      return c.json(apiResponse([]))
    }
  })

  // ============================================================
  // GET /api/v2/health-snapshots — list health check snapshots
  // ============================================================
  route.get('/health-snapshots', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    if (!await checkRateLimit(c.env, c.req.header('x-api-key') || c.req.header('cf-connecting-ip') || 'anon')) {
      return c.json(apiError('Rate limit exceeded', 429), 429)
    }
    try {
      const q = Object.fromEntries(new URL(c.req.url).searchParams)
      const result = await c.env.DB.prepare(`SELECT * FROM health_snapshots ORDER BY checked_at DESC LIMIT 500`).all()
      const rows = (result.results || []) as Record<string, unknown>[]
      const filters: Record<string, string> = {}
      if (q['surface']) filters['surface'] = q['surface']
      if (q['is_healthy'] !== undefined) filters['is_healthy'] = q['is_healthy']
      const filtered = filterRows(rows, filters)
      const paged = paginate(filtered, q['cursor'], parseInt(q['limit'] || '20'), 'checked_at', 'desc')
      return c.json(apiResponse(paged.data, { pagination: { next_cursor: paged.next_cursor, total: paged.total, has_more: paged.has_more } }))
    } catch {
      return c.json(apiResponse([]))
    }
  })

  // ============================================================
  // GET /api/v2/audit-events — list audit trail events
  // ============================================================
  route.get('/audit-events', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    if (!await checkRateLimit(c.env, c.req.header('x-api-key') || c.req.header('cf-connecting-ip') || 'anon')) {
      return c.json(apiError('Rate limit exceeded', 429), 429)
    }
    try {
      const q = Object.fromEntries(new URL(c.req.url).searchParams)
      const result = await c.env.DB.prepare(`SELECT * FROM audit_log_v2 ORDER BY created_at DESC LIMIT 500`).all()
      const rows = (result.results || []) as Record<string, unknown>[]
      const filters: Record<string, string> = {}
      if (q['actor']) filters['actor'] = q['actor']
      if (q['action']) filters['action'] = q['action']
      if (q['resource_type']) filters['resource_type'] = q['resource_type']
      if (q['tenant_id']) filters['tenant_id'] = q['tenant_id']
      const filtered = filterRows(rows, filters)
      const paged = paginate(filtered, q['cursor'], parseInt(q['limit'] || '20'))
      return c.json(apiResponse(paged.data, { pagination: { next_cursor: paged.next_cursor, total: paged.total, has_more: paged.has_more } }))
    } catch {
      return c.json(apiResponse([]))
    }
  })

  // ============================================================
  // GET /api/v2/metrics — real-time platform metrics snapshot
  // ============================================================
  route.get('/metrics', async (c) => {
    if (!c.env.DB) return c.json(apiError('DB not configured', 503), 503)
    if (!await checkRateLimit(c.env, c.req.header('x-api-key') || c.req.header('cf-connecting-ip') || 'anon')) {
      return c.json(apiError('Rate limit exceeded', 429), 429)
    }
    const repo = createRepo(c.env.DB)
    const [sessions, approvals, execEntries, connectors, proofs, alerts] = await Promise.all([
      repo.getSessions(),
      repo.getApprovalRequests(),
      repo.getExecutionEntries(),
      repo.getConnectors(),
      repo.getProofArtifacts(),
      repo.getAlerts(),
    ])

    let workflowStats = { total: 0, active: 0, draft: 0, pending_approval: 0 }
    try {
      const r = await c.env.DB.prepare(`SELECT status, COUNT(*) as cnt FROM workflows GROUP BY status`).all()
      for (const row of (r.results || []) as { status: string; cnt: number }[]) {
        workflowStats.total += row.cnt
        if (row.status === 'active') workflowStats.active = row.cnt
        if (row.status === 'draft') workflowStats.draft = row.cnt
        if (row.status === 'pending_approval') workflowStats.pending_approval = row.cnt
      }
    } catch { /* graceful */ }

    return c.json(apiResponse({
      collected_at: new Date().toISOString(),
      sessions: { total: sessions.length, active: sessions.filter((s: Record<string, unknown>) => s['status'] === 'active').length, closed: sessions.filter((s: Record<string, unknown>) => s['status'] === 'closed').length },
      approvals: { total: approvals.length, pending: approvals.filter((a: Record<string, unknown>) => a['status'] === 'pending').length, approved: approvals.filter((a: Record<string, unknown>) => a['status'] === 'approved').length, rejected: approvals.filter((a: Record<string, unknown>) => a['status'] === 'rejected').length },
      executions: { total: execEntries.length, running: execEntries.filter((e: Record<string, unknown>) => e['status'] === 'running').length, done: execEntries.filter((e: Record<string, unknown>) => e['status'] === 'done').length, blocked: execEntries.filter((e: Record<string, unknown>) => e['status'] === 'blocked').length },
      connectors: { total: connectors.length, active: connectors.filter((c: Record<string, unknown>) => c['status'] === 'active').length, pending: connectors.filter((c: Record<string, unknown>) => c['status'] === 'pending').length },
      proofs: { total: proofs.length, pass_rate: proofs.length > 0 ? Math.round(proofs.filter((p: Record<string, unknown>) => p['outcome_classification'] === 'PASS').length / proofs.length * 100) : 0 },
      alerts: { total: alerts.length, unread: alerts.filter((a: Record<string, unknown>) => !a['acknowledged']).length },
      workflows: workflowStats,
    }))
  })

  return route
}
