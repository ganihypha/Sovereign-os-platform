// ============================================================
// SOVEREIGN OS PLATFORM — WEBHOOKS INBOUND SURFACE (P24)
// Inbound webhook receiver for external systems
//
// POST /webhooks/inbound/:source  — Receive external webhooks
//   - Validates HMAC-SHA256 signature if WEBHOOK_SECRET configured
//   - Stores to webhook_inbound_log D1 table
//   - Routes to relevant workflow by source type
//
// GET /webhooks/inbound/log       — View inbound webhook history (auth required)
//
// SOURCES: github / slack / jira / unknown
// SIGNATURE: HMAC-SHA256 of raw body, compared against X-Hub-Signature-256 / X-Slack-Signature
// SECURITY: payload_hash stored — never exposes full payload in UI
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { isAuthenticated } from '../lib/auth'
import { layout } from '../layout'

// ============================================================
// HELPERS
// ============================================================

function generateId(): string {
  return `wh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

async function computeHmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPayload(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(payload))
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Detect event type from headers + body for each source
function detectEventType(source: string, headers: Headers, body: any): string {
  try {
    if (source === 'github') {
      return headers.get('X-GitHub-Event') || body?.action || 'unknown'
    }
    if (source === 'slack') {
      return body?.type || body?.event?.type || 'unknown'
    }
    if (source === 'jira') {
      return body?.webhookEvent || body?.issue_event_type_name || 'unknown'
    }
    return body?.event_type || body?.type || 'webhook'
  } catch { return 'unknown' }
}

// Route to workflow based on source + event
function routeToWorkflow(source: string, eventType: string): string | null {
  const routing: Record<string, Record<string, string>> = {
    github: {
      push: 'governance.code-change',
      pull_request: 'governance.review-request',
      issues: 'governance.issue-created',
      release: 'governance.release-published',
    },
    slack: {
      message: 'notifications.slack-message',
      'app_mention': 'notifications.slack-mention',
    },
    jira: {
      'jira:issue_created': 'governance.jira-issue',
      'jira:issue_updated': 'governance.jira-update',
    },
  }
  return routing[source]?.[eventType] || null
}

// Validate signature per source
async function validateSignature(
  source: string,
  headers: Headers,
  rawBody: string,
  secret: string | null
): Promise<boolean> {
  if (!secret) return false
  try {
    if (source === 'github') {
      const sig = headers.get('X-Hub-Signature-256')
      if (!sig) return false
      const expected = `sha256=${await computeHmacSha256(secret, rawBody)}`
      return sig === expected
    }
    if (source === 'slack') {
      const ts = headers.get('X-Slack-Request-Timestamp')
      const sig = headers.get('X-Slack-Signature')
      if (!ts || !sig) return false
      const baseString = `v0:${ts}:${rawBody}`
      const expected = `v0=${await computeHmacSha256(secret, baseString)}`
      return sig === expected
    }
    // Generic: compare X-Webhook-Signature
    const sig = headers.get('X-Webhook-Signature') || headers.get('X-Signature')
    if (!sig) return false
    const expected = await computeHmacSha256(secret, rawBody)
    return sig === expected || sig === `sha256=${expected}`
  } catch { return false }
}

async function logWebhookInbound(
  db: D1Database,
  data: {
    id: string
    source: string
    tenant_id: string
    payload_hash: string
    signature_valid: boolean
    event_type: string
    status: string
    workflow_triggered: string | null
    error_message: string | null
  }
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO webhook_inbound_log
        (id, source, tenant_id, payload_hash, signature_valid, event_type, status, workflow_triggered, error_message, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      data.id, data.source, data.tenant_id, data.payload_hash,
      data.signature_valid ? 1 : 0,
      data.event_type, data.status, data.workflow_triggered, data.error_message
    ).run()
  } catch { /* best-effort */ }
}

// ============================================================
// ROUTE FACTORY
// ============================================================
export function createWebhooksRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ============================================================
  // POST /webhooks/inbound/:source — Receive external webhooks
  // ============================================================
  route.post('/inbound/:source', async (c) => {
    const source = c.req.param('source').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'unknown'
    const id = generateId()

    let rawBody = ''
    let parsedBody: any = {}
    let status = 'received'
    let errorMessage: string | null = null
    let signatureValid = false

    try {
      rawBody = await c.req.text()
      try { parsedBody = JSON.parse(rawBody) } catch { parsedBody = {} }
    } catch (e: any) {
      errorMessage = 'failed-to-read-body'
      status = 'failed'
    }

    const payloadHash = rawBody ? await hashPayload(rawBody) : ''
    const eventType = detectEventType(source, c.req.raw.headers, parsedBody)

    // Validate signature if secret available
    // WEBHOOK_SECRET env var: source-specific or global
    const secret: string | null = (c.env as any).WEBHOOK_SECRET || null
    if (secret && rawBody) {
      signatureValid = await validateSignature(source, c.req.raw.headers, rawBody, secret)
    }

    // Route to workflow
    const workflowTriggered = routeToWorkflow(source, eventType)
    if (workflowTriggered) { status = 'processed' }

    // Store to D1
    await logWebhookInbound(c.env.DB, {
      id, source,
      tenant_id: c.req.header('X-Tenant-ID') || 'default',
      payload_hash: payloadHash,
      signature_valid: signatureValid,
      event_type: eventType,
      status,
      workflow_triggered: workflowTriggered,
      error_message: errorMessage,
    })

    return c.json({
      ok: true,
      id,
      source,
      event_type: eventType,
      status,
      signature_valid: signatureValid,
      workflow_triggered: workflowTriggered,
      received_at: new Date().toISOString(),
    })
  })

  // ============================================================
  // GET /webhooks/inbound/log — View inbound webhook history (auth required)
  // ============================================================
  route.get('/inbound/log', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.redirect('/webhooks/inbound/log?error=auth-required')

    const db = c.env.DB
    const limit = parseInt(c.req.query('limit') || '50')
    const sourceFilter = c.req.query('source') || ''
    const accept = c.req.header('accept') || ''

    let logs: any[] = []
    try {
      let sql = `SELECT * FROM webhook_inbound_log`
      const params: string[] = []
      if (sourceFilter) { sql += ` WHERE source = ?`; params.push(sourceFilter) }
      sql += ` ORDER BY received_at DESC LIMIT ?`
      params.push(String(limit))
      const result = await db.prepare(sql).bind(...params).all()
      logs = result.results || []
    } catch { logs = [] }

    if (accept.includes('application/json')) {
      return c.json({ logs, count: logs.length })
    }

    const sourceIcons: Record<string, string> = { github: '🐙', slack: '💬', jira: '📋', webhook: '🔗', unknown: '❓' }
    const statusBadge: Record<string, string> = { received: 'badge-yellow', processed: 'badge-green', failed: 'badge-red' }

    const logRows = logs.map(l => `
      <tr>
        <td class="mono small">${l.id}</td>
        <td>${sourceIcons[l.source] || '❓'} ${l.source}</td>
        <td class="small">${l.event_type || '—'}</td>
        <td><span class="badge ${statusBadge[l.status] || 'badge-grey'}">${l.status}</span></td>
        <td>${l.signature_valid ? '<span class="badge badge-green">✓ valid</span>' : '<span class="badge badge-grey">unverified</span>'}</td>
        <td class="mono small" style="max-width:120px;overflow:hidden;text-overflow:ellipsis">${(l.payload_hash || '—').slice(0, 16)}…</td>
        <td class="small">${l.workflow_triggered || '—'}</td>
        <td class="small">${l.tenant_id}</td>
        <td class="small">${l.received_at?.slice(0, 16).replace('T', ' ') || '—'}</td>
      </tr>
    `).join('')

    const sourceFilters = ['github', 'slack', 'jira', 'webhook', 'unknown'].map(s =>
      `<a href="/webhooks/inbound/log?source=${s}" class="btn btn-sm ${sourceFilter === s ? 'btn-primary' : 'btn-secondary'}">${sourceIcons[s]} ${s}</a>`
    ).join('')

    const stats = {
      total: logs.length,
      processed: logs.filter(l => l.status === 'processed').length,
      failed: logs.filter(l => l.status === 'failed').length,
      sigValid: logs.filter(l => l.signature_valid).length,
    }

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🔗 Inbound Webhook Log</h1>
          <p class="page-subtitle">P24 — Inbound webhooks from GitHub, Slack, Jira, and custom sources</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P24</span>
          <span class="badge badge-green">${stats.total} received</span>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${stats.total}</div><div class="stat-label">Total Received</div></div>
        <div class="stat-card"><div class="stat-num">${stats.processed}</div><div class="stat-label">Processed</div></div>
        <div class="stat-card"><div class="stat-num">${stats.failed}</div><div class="stat-label">Failed</div></div>
        <div class="stat-card"><div class="stat-num">${stats.sigValid}</div><div class="stat-label">Sig Verified</div></div>
      </div>

      <div class="card mb-4">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 class="section-title" style="margin:0">📋 Webhook Events</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <a href="/webhooks/inbound/log" class="btn btn-sm ${!sourceFilter ? 'btn-primary' : 'btn-secondary'}">All</a>
            ${sourceFilters}
          </div>
        </div>

        <div class="card mb-3" style="background:#1a2040;border:1px solid #2d3748">
          <h4 style="margin:0 0 8px;font-size:0.875rem;color:#a0aec0">🧪 Test Webhook Endpoint</h4>
          <p class="small muted">Send a test webhook:</p>
          <pre style="background:#0d1117;color:#58a6ff;padding:10px;border-radius:4px;font-size:0.75rem;overflow-x:auto">curl -X POST https://sovereign-os-platform.pages.dev/webhooks/inbound/github \\
  -H "Content-Type: application/json" \\
  -H "X-GitHub-Event: push" \\
  -d '{"action":"push","repository":{"name":"sovereign-os-platform"}}'</pre>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead><tr>
              <th>ID</th><th>Source</th><th>Event Type</th><th>Status</th>
              <th>Signature</th><th>Payload Hash</th><th>Workflow</th><th>Tenant</th><th>Received</th>
            </tr></thead>
            <tbody>${logRows || '<tr><td colspan="9" class="empty">No webhooks received yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `
    return c.html(layout('Inbound Webhook Log — P24', content, 'webhooks'))
  })

  return route
}
