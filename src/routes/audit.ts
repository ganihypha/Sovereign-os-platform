// ============================================================
// SOVEREIGN OS PLATFORM — AUDIT TRAIL SURFACE (P8)
// Immutable audit trail with SHA-256 event hash verification
//
// GET /audit              — Audit log v2 view + hash verification
// GET /audit/verify/:id   — Verify single event hash
// POST /audit/verify-all  — Re-verify all recent events (returns report)
//
// AUTH: GET requires auth (audit data is sensitive governance data)
// IMMUTABLE: No write endpoints on this surface — append-only
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { isAuthenticated } from '../lib/auth'
import { layout } from '../layout'
import { getAuditLogV2, verifyAuditHash } from '../lib/auditService'
import type { AuditLogV2 } from '../types'

const EVENT_ICON: Record<string, string> = {
  'intent.created':           '◈',
  'approval.approved':        '✓',
  'approval.rejected':        '✗',
  'federation.created':       '🔗',
  'federation.approved':      '✓',
  'federation.revoked':       '⊘',
  'federated_intent.shared':  '📤',
  'federated_intent.approved':'✓',
  'marketplace.submitted':    '⊕',
  'marketplace.listed':       '✅',
  'marketplace.rejected':     '✗',
  'anomaly.detected':         '⚠',
  'connector.created':        '⊞',
  'connector.activated':      '▶',
}

function eventIcon(event_type: string): string {
  return EVENT_ICON[event_type] || '◉'
}

export function createAuditRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ============================================================
  // GET /audit — Audit Log v2 View
  // ============================================================
  route.get('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) {
      return c.html(layout('Audit Trail — P8', `
        <div class="auth-gate">
          <h2>🔒 Authentication Required</h2>
          <p>Audit trail access requires platform authentication.</p>
          <a href="/dashboard" class="btn btn-primary">← Dashboard</a>
        </div>
      `, 'audit'))
    }

    const db = c.env.DB
    const tenantFilter = c.req.query('tenant') || undefined
    const eventFilter = c.req.query('event_type') || undefined
    const actorFilter = c.req.query('actor') || undefined
    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const limit = 50
    const offset = (page - 1) * limit

    const events = await getAuditLogV2(db, {
      tenant_id: tenantFilter,
      event_type: eventFilter,
      actor: actorFilter,
      limit,
      offset,
    })

    // Verify hashes for displayed events
    const verifiedEvents: (AuditLogV2 & { hash_ok: boolean })[] = await Promise.all(
      events.map(async (ev) => ({
        ...ev,
        hash_ok: await verifyAuditHash(ev),
      }))
    )

    const allOk = verifiedEvents.every(e => e.hash_ok)
    const failCount = verifiedEvents.filter(e => !e.hash_ok).length

    const rows = verifiedEvents.map(ev => `
      <tr class="${!ev.hash_ok ? 'row-error' : ''}">
        <td class="mono small">${ev.id}</td>
        <td><span class="event-icon">${eventIcon(ev.event_type)}</span> <span class="event-type">${ev.event_type}</span></td>
        <td class="small">${ev.object_type}</td>
        <td class="mono small">${ev.object_id}</td>
        <td class="small">${ev.actor}</td>
        <td class="small">${ev.tenant_id}</td>
        <td class="small">${ev.payload_summary || '—'}</td>
        <td class="small">${ev.surface || '—'}</td>
        <td class="mono small hash-col" title="${ev.event_hash}">${ev.event_hash.slice(0, 8)}…</td>
        <td>
          <span class="badge ${ev.hash_ok ? 'badge-green' : 'badge-red'}">
            ${ev.hash_ok ? '✓ valid' : '✗ TAMPERED'}
          </span>
        </td>
        <td class="small">${ev.created_at?.slice(0, 19) || '—'}</td>
      </tr>
    `).join('')

    const filterForm = `
      <form method="GET" action="/audit" class="filter-form">
        <input name="tenant" class="form-input-sm" placeholder="Tenant ID" value="${tenantFilter || ''}">
        <input name="event_type" class="form-input-sm" placeholder="Event type" value="${eventFilter || ''}">
        <input name="actor" class="form-input-sm" placeholder="Actor" value="${actorFilter || ''}">
        <button type="submit" class="btn btn-sm btn-primary">Filter</button>
        <a href="/audit" class="btn btn-sm btn-secondary">Clear</a>
      </form>
    `

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🔏 Immutable Audit Trail</h1>
          <p class="page-subtitle">P8 — SHA-256 cryptographic event hashing. Every state mutation is hashed and verifiable.</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P8</span>
          ${allOk
            ? `<span class="badge badge-green">✓ All ${verifiedEvents.length} hashes valid</span>`
            : `<span class="badge badge-red">⚠ ${failCount} hash failures</span>`
          }
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${verifiedEvents.length}</div><div class="stat-label">Events (this page)</div></div>
        <div class="stat-card"><div class="stat-num">${verifiedEvents.filter(e => e.hash_ok).length}</div><div class="stat-label">Hash Valid</div></div>
        <div class="stat-card"><div class="stat-num">${failCount}</div><div class="stat-label">Hash Failures</div></div>
        <div class="stat-card"><div class="stat-num">SHA-256</div><div class="stat-label">Algorithm</div></div>
      </div>

      ${failCount > 0 ? `
        <div class="alert alert-critical mb-4">
          ⚠️ <strong>INTEGRITY WARNING:</strong> ${failCount} event(s) failed hash verification.
          This may indicate data tampering. Review immediately.
        </div>
      ` : `
        <div class="alert alert-ok mb-3">
          ✓ All displayed event hashes verified intact.
        </div>
      `}

      <div class="card mb-4">
        <h3 class="section-title">🔍 Filter Events</h3>
        ${filterForm}
      </div>

      <div class="card">
        <h3 class="section-title">📋 Audit Events — Append-Only Log</h3>
        <p class="small muted mb-2">
          Hash input: <code>SHA-256(event_type | object_id | actor | created_at)</code>
          — verified on every page load. No UPDATE allowed on this table.
        </p>
        <div class="table-container">
          <table class="data-table audit-table">
            <thead><tr>
              <th>ID</th><th>Event Type</th><th>Object Type</th><th>Object ID</th>
              <th>Actor</th><th>Tenant</th><th>Summary</th><th>Surface</th>
              <th>Hash (preview)</th><th>Verified</th><th>Timestamp</th>
            </tr></thead>
            <tbody>
              ${rows || `<tr><td colspan="11" class="empty">No audit events yet. Events are written on state mutations.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="pagination mt-3">
          ${page > 1 ? `<a href="/audit?page=${page - 1}${tenantFilter ? `&tenant=${tenantFilter}` : ''}${eventFilter ? `&event_type=${eventFilter}` : ''}" class="btn btn-sm btn-secondary">← Prev</a>` : ''}
          <span class="page-info">Page ${page}</span>
          ${events.length === limit ? `<a href="/audit?page=${page + 1}${tenantFilter ? `&tenant=${tenantFilter}` : ''}${eventFilter ? `&event_type=${eventFilter}` : ''}" class="btn btn-sm btn-secondary">Next →</a>` : ''}
        </div>
      </div>

      <div class="card mt-4">
        <h3 class="section-title">ℹ️ Hash Verification Protocol</h3>
        <div class="info-grid">
          <div class="info-item"><strong>Algorithm:</strong> SHA-256 (Web Crypto API)</div>
          <div class="info-item"><strong>Input:</strong> <code>event_type|object_id|actor|created_at</code></div>
          <div class="info-item"><strong>Stored:</strong> Hex string (64 chars)</div>
          <div class="info-item"><strong>Verification:</strong> Recomputed on every read</div>
          <div class="info-item"><strong>Immutability:</strong> No UPDATE on audit_log_v2 (enforced at app layer)</div>
          <div class="info-item"><strong>Secrets:</strong> Never included in hash input or stored</div>
        </div>
      </div>

      <style>
        .hash-col { font-size: 0.7rem; font-family: monospace; }
        .event-type { font-size: 0.8rem; }
        .event-icon { font-size: 0.9rem; }
        .audit-table { font-size: 0.8rem; }
        .row-error { background: rgba(239, 68, 68, 0.08) !important; }
        .alert-ok { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #86efac; padding: 8px 12px; border-radius: 6px; }
        .alert-critical { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 8px 12px; border-radius: 6px; }
        .filter-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .form-input-sm { background: #2d3748; border: 1px solid #4a5568; color: #e2e8f0; padding: 5px 10px; border-radius: 4px; font-size: 0.8rem; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
        .info-item { font-size: 0.85rem; color: #a0aec0; }
        .pagination { display: flex; gap: 8px; align-items: center; }
        .page-info { color: #718096; font-size: 0.85rem; }
      </style>
    `

    return c.html(layout('Audit Trail — P8', content, 'audit'))
  })

  // ============================================================
  // GET /audit/verify/:id — Verify single event hash
  // ============================================================
  route.get('/verify/:id', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'unauthorized' }, 401)

    const id = c.req.param('id')
    const db = c.env.DB
    if (!db) return c.json({ error: 'no-db' }, 503)

    try {
      const row = await db.prepare('SELECT * FROM audit_log_v2 WHERE id = ?').bind(id).first()
      if (!row) return c.json({ error: 'not-found' }, 404)

      const event = row as unknown as AuditLogV2
      const hash_ok = await verifyAuditHash(event)

      return c.json({
        id: event.id,
        event_type: event.event_type,
        object_id: event.object_id,
        actor: event.actor,
        created_at: event.created_at,
        event_hash: event.event_hash,
        hash_ok,
        verified_at: new Date().toISOString(),
        algorithm: 'sha256',
      })
    } catch (e) {
      return c.json({ error: String(e) }, 500)
    }
  })

  return route
}
