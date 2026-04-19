// ============================================================
// SOVEREIGN OS PLATFORM — AUDIT TRAIL SURFACE (P8+P14)
// P14: Filter by event type quick-select (abac.denied, webhook.failed, archive.ran)
//       ABAC deny log section, CSV export (GET /audit?format=csv)
//
// GET /audit              — Audit log v2 view + hash verification
// GET /audit?format=csv   — P14: Export audit log as CSV
// GET /audit/deny-log     — P14: ABAC deny log view
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
  'abac.access_denied':       '🔒',
  'webhook.delivery_failed':  '⚡',
  'event.archived':           '📦',
}

// P14: Quick-filter event type groups
const EVENT_TYPE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'ABAC Denied', value: 'abac.access_denied' },
  { label: 'Webhook Failed', value: 'webhook.delivery_failed' },
  { label: 'Archived', value: 'event.archived' },
  { label: 'Approvals', value: 'approval.approved' },
  { label: 'Intent', value: 'intent.created' },
  { label: 'Federation', value: 'federation.created' },
  { label: 'Anomaly', value: 'anomaly.detected' },
]

function eventIcon(event_type: string): string {
  return EVENT_ICON[event_type] || '◉'
}

export function createAuditRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ============================================================
  // GET /audit — Audit Log v2 View (+ P14: CSV export)
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
    const formatParam = c.req.query('format') || ''
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

    // P14: CSV Export
    if (formatParam === 'csv') {
      const headers = ['id','event_type','object_type','object_id','actor','tenant_id','payload_summary','surface','event_hash','created_at']
      const csvRows = events.map(ev => headers.map(h => {
        const val = (ev as any)[h] || ''
        return '"' + String(val).replace(/"/g, '""') + '"'
      }).join(','))
      const csvContent = [headers.join(','), ...csvRows].join('\n')

      // Log export job to D1 (non-blocking)
      if (db) {
        const jobId = 'aej-' + Date.now().toString(36)
        db.prepare(`INSERT INTO audit_export_jobs (id, format, filter_json, status, row_count, created_by, completed_at)
          VALUES (?, 'csv', ?, 'completed', ?, 'ui', CURRENT_TIMESTAMP)`)
          .bind(jobId, JSON.stringify({ event_type: eventFilter, tenant: tenantFilter }), events.length)
          .run().catch(() => {})
      }

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0,10)}.csv"`,
        }
      })
    }

    // Verify hashes for displayed events
    const verifiedEvents: (AuditLogV2 & { hash_ok: boolean })[] = await Promise.all(
      events.map(async (ev) => ({
        ...ev,
        hash_ok: await verifyAuditHash(ev),
      }))
    )

    const allOk = verifiedEvents.every(e => e.hash_ok)
    const failCount = verifiedEvents.filter(e => !e.hash_ok).length

    // P14: Load abac_deny_log sample for sidebar
    let abacDenyCount = 0
    let abacDenySample: any[] = []
    if (db) {
      try {
        const cnt = await db.prepare(`SELECT COUNT(*) as c FROM abac_deny_log`).first<{ c: number }>()
        abacDenyCount = cnt?.c || 0
        const sample = await db.prepare(
          `SELECT surface, resource_type, action, subject_role, denied_at FROM abac_deny_log ORDER BY denied_at DESC LIMIT 5`
        ).all<any>()
        abacDenySample = sample.results || []
      } catch { /* non-blocking */ }
    }

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

    // P14: Build query string for CSV export
    const csvParams = new URLSearchParams()
    csvParams.set('format', 'csv')
    if (tenantFilter) csvParams.set('tenant', tenantFilter)
    if (eventFilter) csvParams.set('event_type', eventFilter)
    if (actorFilter) csvParams.set('actor', actorFilter)

    // P14: Quick-filter buttons
    const quickFilters = EVENT_TYPE_FILTERS.map(f => {
      const isActive = (eventFilter || '') === f.value
      const params = new URLSearchParams()
      if (f.value) params.set('event_type', f.value)
      if (tenantFilter) params.set('tenant', tenantFilter)
      if (actorFilter) params.set('actor', actorFilter)
      return `<a href="/audit?${params.toString()}" style="display:inline-block;padding:4px 10px;border-radius:4px;font-size:11px;text-decoration:none;border:1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};background:${isActive ? 'rgba(79,142,247,0.15)' : 'transparent'};color:${isActive ? 'var(--accent)' : 'var(--text2)'}">${f.label}</a>`
    }).join('')

    const filterForm = `
      <div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:11px;color:var(--text3)">Quick filter:</span>
        ${quickFilters}
      </div>
      <form method="GET" action="/audit" class="filter-form">
        <input name="tenant" class="form-input-sm" placeholder="Tenant ID" value="${tenantFilter || ''}">
        <input name="event_type" class="form-input-sm" placeholder="Event type" value="${eventFilter || ''}">
        <input name="actor" class="form-input-sm" placeholder="Actor" value="${actorFilter || ''}">
        <button type="submit" class="btn btn-sm btn-primary">Filter</button>
        <a href="/audit" class="btn btn-sm btn-secondary">Clear</a>
        <a href="/audit?${csvParams.toString()}" style="background:#22c55e;color:#fff;border:none;border-radius:4px;padding:5px 10px;font-size:11px;text-decoration:none;font-weight:600">⬇ CSV Export</a>
      </form>
    `

    // P14: ABAC deny log sidebar
    const abacDenySection = abacDenyCount > 0 ? `
      <div class="card mt-4">
        <h3 class="section-title">🔒 ABAC Deny Log — P14</h3>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="color:var(--text3);font-size:12px">${abacDenyCount} total denials recorded</span>
          <a href="/audit/deny-log" style="font-size:11px;color:var(--accent)">View full log →</a>
        </div>
        <table class="data-table" style="font-size:0.78rem">
          <thead><tr>
            <th>Surface</th><th>Resource</th><th>Action</th><th>Role</th><th>Denied At</th>
          </tr></thead>
          <tbody>
            ${abacDenySample.map(d => `<tr>
              <td>${d.surface || '—'}</td>
              <td>${d.resource_type || '—'}</td>
              <td style="color:#f97316">${d.action || '—'}</td>
              <td style="color:#fbbf24">${d.subject_role || '—'}</td>
              <td style="color:var(--text3)">${(d.denied_at || '').slice(0,16)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : ''

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🔏 Immutable Audit Trail</h1>
          <p class="page-subtitle">P8+P14 — SHA-256 cryptographic event hashing. ABAC deny log, webhook failures, CSV export.</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P8+P14</span>
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
        <div class="stat-card"><div class="stat-num">${abacDenyCount}</div><div class="stat-label">ABAC Denials</div></div>
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
        <h3 class="section-title">🔍 Filter Events — P14</h3>
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

      ${abacDenySection}

      <div class="card mt-4">
        <h3 class="section-title">ℹ️ Hash Verification Protocol</h3>
        <div class="info-grid">
          <div class="info-item"><strong>Algorithm:</strong> SHA-256 (Web Crypto API)</div>
          <div class="info-item"><strong>Input:</strong> <code>event_type|object_id|actor|created_at</code></div>
          <div class="info-item"><strong>Stored:</strong> Hex string (64 chars)</div>
          <div class="info-item"><strong>Verification:</strong> Recomputed on every read</div>
          <div class="info-item"><strong>Immutability:</strong> No UPDATE on audit_log_v2 (enforced at app layer)</div>
          <div class="info-item"><strong>P14 Export:</strong> CSV export via GET /audit?format=csv</div>
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

    return c.html(layout('Audit Trail — P8+P14', content, 'audit'))
  })

  // ============================================================
  // GET /audit/deny-log — P14: Full ABAC Deny Log View
  // ============================================================
  route.get('/deny-log', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.redirect('/dashboard')

    const db = c.env.DB
    let denials: any[] = []
    let totalDenials = 0

    if (db) {
      try {
        const cnt = await db.prepare(`SELECT COUNT(*) as c FROM abac_deny_log`).first<{ c: number }>()
        totalDenials = cnt?.c || 0
        const rows = await db.prepare(
          `SELECT id, surface, resource_type, action, subject_role, tenant_id, denied_at FROM abac_deny_log ORDER BY denied_at DESC LIMIT 100`
        ).all<any>()
        denials = rows.results || []
      } catch { /* non-blocking */ }
    }

    const rows = denials.map(d => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${d.id}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--text2)">${d.surface || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--text2)">${d.resource_type || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;color:#f97316">${d.action || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;color:#fbbf24">${d.subject_role || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--text3)">${d.tenant_id || '—'}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${(d.denied_at || '').slice(0,19)}</td>
      </tr>`).join('')

    const content = `
      <div class="page-header">
        <div>
          <h1>🔒 ABAC Deny Log</h1>
          <p style="color:var(--text2)">P14 — All recorded ABAC access denials · ${totalDenials} total</p>
        </div>
        <a href="/audit" style="color:var(--text2);text-decoration:none">← Audit Trail</a>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#ef4444">${totalDenials}</div>
          <div style="color:var(--text3);font-size:11px">Total Denials</div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#f97316">${denials.length}</div>
          <div style="color:var(--text3);font-size:11px">Showing (last 100)</div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center">
          <a href="/health-dashboard#abac-drill-down" style="font-size:13px;font-weight:600;color:#f97316;text-decoration:none">Health Dashboard →</a>
          <div style="color:var(--text3);font-size:11px">View in context</div>
        </div>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg3)">
            ${['ID','Surface','Resource','Action','Role','Tenant','Denied At'].map(h =>
              `<th style="padding:8px 12px;text-align:left;color:var(--text3);font-size:10px;font-weight:500">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>
            ${denials.length === 0
              ? `<tr><td colspan="7" style="padding:30px;text-align:center;color:var(--text3)">No ABAC denials recorded. Platform is enforcing open-by-default.</td></tr>`
              : rows}
          </tbody>
        </table>
      </div>
    `
    return c.html(layout('ABAC Deny Log — P14', content, 'audit'))
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
