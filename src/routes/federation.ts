// ============================================================
// SOVEREIGN OS PLATFORM — FEDERATION SURFACE (P8)
// Cross-tenant intent sharing + federated approval chains
//
// GET /federation       — Federation registry view
// POST /federation      — Create new federation request
// POST /federation/:id/approve — Approve federation (Tier 2 required)
// POST /federation/:id/revoke  — Revoke active federation
//
// GET /federation/intents        — Federated intent log
// POST /federation/intents       — Share an intent cross-tenant
// POST /federation/intents/:id/approve — Approve shared intent
//
// AUTH: All mutations require platform auth
// AUDIT: All mutations written to audit_log_v2
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import { layout } from '../layout'
import {
  listFederations,
  getFederation,
  createFederation,
  approveFederation,
  revokeFederation,
  listFederatedIntents,
  shareFederatedIntent,
  approveFederatedIntent,
} from '../lib/federationService'
import { writeAuditEvent } from '../lib/auditService'
import { emitEvent } from '../lib/eventBusService'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
  revoked: 'badge-grey',
}

export function createFederationRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ============================================================
  // GET /federation — Federation Registry
  // ============================================================
  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)
    const db = c.env.DB

    const [federations, fedIntents] = await Promise.all([
      listFederations(db),
      listFederatedIntents(db),
    ])

    const tenantsRaw = await repo.getTenants()
    const tenantMap: Record<string, string> = {}
    for (const t of tenantsRaw) { tenantMap[t.id] = t.name }

    const pendingFed = federations.filter(f => f.status === 'pending').length
    const activeFed = federations.filter(f => f.status === 'approved').length
    const pendingIntents = fedIntents.filter(f => f.approval_status === 'pending').length

    const fedRows = federations.map(f => `
      <tr>
        <td class="mono small">${f.id}</td>
        <td>${tenantMap[f.source_tenant_id] || f.source_tenant_id}</td>
        <td>→</td>
        <td>${tenantMap[f.target_tenant_id] || f.target_tenant_id}</td>
        <td class="small">${(() => { try { return (JSON.parse(f.scope) as string[]).join(', ') } catch { return f.scope } })()}</td>
        <td><span class="badge ${STATUS_BADGE[f.status] || 'badge-grey'}">${f.status}</span></td>
        <td class="small">${f.approved_by || '—'}</td>
        <td class="small">${f.created_at?.slice(0, 10) || '—'}</td>
        <td>
          ${isAuth && f.status === 'pending' ? `
            <form method="POST" action="/federation/${f.id}/approve" style="display:inline">
              <button class="btn btn-sm btn-green" onclick="return confirm('Approve federation?')">Approve</button>
            </form>
            <form method="POST" action="/federation/${f.id}/revoke" style="display:inline">
              <button class="btn btn-sm btn-red" onclick="return confirm('Revoke?')">Revoke</button>
            </form>
          ` : f.status === 'approved' && isAuth ? `
            <form method="POST" action="/federation/${f.id}/revoke" style="display:inline">
              <button class="btn btn-sm btn-red" onclick="return confirm('Revoke federation?')">Revoke</button>
            </form>
          ` : '—'}
        </td>
      </tr>
    `).join('')

    const fedIntentRows = fedIntents.slice(0, 20).map(fi => `
      <tr>
        <td class="mono small">${fi.id}</td>
        <td class="mono small">${fi.intent_id}</td>
        <td>${tenantMap[fi.source_tenant_id] || fi.source_tenant_id}</td>
        <td>→</td>
        <td>${tenantMap[fi.target_tenant_id] || fi.target_tenant_id}</td>
        <td class="small">${fi.shared_scope}</td>
        <td><span class="badge ${STATUS_BADGE[fi.approval_status] || 'badge-grey'}">${fi.approval_status}</span></td>
        <td class="small">${fi.shared_by}</td>
        <td>
          ${isAuth && fi.approval_status === 'pending' ? `
            <form method="POST" action="/federation/intents/${fi.id}/approve" style="display:inline">
              <button class="btn btn-sm btn-green" onclick="return confirm('Approve?')">Approve</button>
            </form>
          ` : fi.approved_by || '—'}
        </td>
      </tr>
    `).join('')

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🔗 Federation Registry</h1>
          <p class="page-subtitle">P8 — Cross-tenant governed intent sharing and federated approval chains</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P8</span>
          <span class="badge badge-yellow">${pendingFed} pending</span>
          <span class="badge badge-green">${activeFed} active</span>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${federations.length}</div><div class="stat-label">Total Federations</div></div>
        <div class="stat-card"><div class="stat-num">${activeFed}</div><div class="stat-label">Active</div></div>
        <div class="stat-card"><div class="stat-num">${pendingFed}</div><div class="stat-label">Pending Approval</div></div>
        <div class="stat-card"><div class="stat-num">${pendingIntents}</div><div class="stat-label">Pending Intent Shares</div></div>
      </div>

      ${isAuth ? `
      <div class="card mb-4">
        <h3 class="section-title">📋 Create Federation Request</h3>
        <form method="POST" action="/federation" class="form-grid">
          <div class="form-row">
            <label>Source Tenant ID</label>
            <input name="source_tenant_id" class="form-input" placeholder="tenant-default" required>
          </div>
          <div class="form-row">
            <label>Target Tenant ID</label>
            <input name="target_tenant_id" class="form-input" placeholder="tenant-barberkas" required>
          </div>
          <div class="form-row">
            <label>Scope (comma-separated)</label>
            <input name="scope" class="form-input" value="intents" placeholder="intents,approvals">
          </div>
          <div class="form-row">
            <label>Federation Notes</label>
            <input name="federation_notes" class="form-input" placeholder="Purpose of this federation">
          </div>
          <div class="form-row">
            <button type="submit" class="btn btn-primary">Request Federation</button>
          </div>
        </form>
      </div>` : ''}

      <div class="card mb-4">
        <h3 class="section-title">🔗 Federation Registry (${federations.length})</h3>
        <div class="table-container">
          <table class="data-table">
            <thead><tr>
              <th>ID</th><th>Source</th><th></th><th>Target</th><th>Scope</th>
              <th>Status</th><th>Approved By</th><th>Created</th><th>Actions</th>
            </tr></thead>
            <tbody>${fedRows || '<tr><td colspan="9" class="empty">No federations yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="card mb-4">
        <h3 class="section-title">📤 Federated Intent Sharing Log (${fedIntents.length})</h3>
        ${isAuth ? `
        <form method="POST" action="/federation/intents" class="form-grid mb-3">
          <div class="form-row">
            <label>Intent ID</label>
            <input name="intent_id" class="form-input" placeholder="intent-abc123" required>
          </div>
          <div class="form-row">
            <label>Federation ID</label>
            <input name="federation_id" class="form-input" placeholder="fed-001" required>
          </div>
          <div class="form-row">
            <label>Source Tenant ID</label>
            <input name="source_tenant_id" class="form-input" placeholder="tenant-default" required>
          </div>
          <div class="form-row">
            <label>Target Tenant ID</label>
            <input name="target_tenant_id" class="form-input" placeholder="tenant-barberkas" required>
          </div>
          <div class="form-row">
            <label>Shared Scope</label>
            <input name="shared_scope" class="form-input" value="intent_brief">
          </div>
          <div class="form-row">
            <label>Notes</label>
            <input name="share_notes" class="form-input" placeholder="Why sharing this intent">
          </div>
          <div class="form-row">
            <button type="submit" class="btn btn-primary">Share Intent</button>
          </div>
        </form>` : ''}
        <div class="table-container">
          <table class="data-table">
            <thead><tr>
              <th>ID</th><th>Intent</th><th>Source</th><th></th><th>Target</th>
              <th>Scope</th><th>Status</th><th>By</th><th>Action</th>
            </tr></thead>
            <tbody>${fedIntentRows || '<tr><td colspan="9" class="empty">No federated intents yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `

    return c.html(layout('Federation Registry — P8', content, 'federation'))
  })

  // ============================================================
  // POST /federation — Create federation request
  // ============================================================
  route.post('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)

    const body = await c.req.parseBody()
    const source_tenant_id = String(body.source_tenant_id || '').trim()
    const target_tenant_id = String(body.target_tenant_id || '').trim()
    const scopeStr = String(body.scope || 'intents').trim()
    const federation_notes = String(body.federation_notes || '').trim()

    if (!source_tenant_id || !target_tenant_id) {
      return c.redirect('/federation?error=missing-fields')
    }
    if (source_tenant_id === target_tenant_id) {
      return c.redirect('/federation?error=same-tenant')
    }

    const scope = scopeStr.split(',').map(s => s.trim()).filter(Boolean)
    await createFederation(c.env.DB, {
      source_tenant_id,
      target_tenant_id,
      scope,
      federation_notes,
      created_by: 'Platform Architect',
    })

    // P12: Emit federation.requested event
    if (c.env.DB) {
      emitEvent(c.env.DB, {
        event_type: 'federation.requested',
        source_surface: 'federation',
        actor: 'Platform Architect',
        resource_type: 'federation',
        payload: { source_tenant_id, target_tenant_id, scope },
        severity: 'info'
      }).catch(() => {})
    }

    return c.redirect('/federation?ok=created')
  })

  // ============================================================
  // POST /federation/:id/approve
  // ============================================================
  route.post('/:id/approve', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)
    const id = c.req.param('id')
    await approveFederation(c.env.DB, id, 'Platform Architect')
    return c.redirect('/federation?ok=approved')
  })

  // ============================================================
  // POST /federation/:id/revoke
  // ============================================================
  route.post('/:id/revoke', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)
    const id = c.req.param('id')
    await revokeFederation(c.env.DB, id, 'Platform Architect')
    return c.redirect('/federation?ok=revoked')
  })

  // ============================================================
  // POST /federation/intents — Share intent cross-tenant
  // ============================================================
  route.post('/intents', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)

    const body = await c.req.parseBody()
    const result = await shareFederatedIntent(c.env.DB, {
      intent_id: String(body.intent_id || '').trim(),
      source_tenant_id: String(body.source_tenant_id || '').trim(),
      target_tenant_id: String(body.target_tenant_id || '').trim(),
      federation_id: String(body.federation_id || '').trim(),
      shared_scope: String(body.shared_scope || 'intent_brief').trim(),
      share_notes: String(body.share_notes || '').trim(),
      shared_by: 'Platform Architect',
    })

    if (!result.ok) return c.redirect(`/federation?error=${result.error}`)
    return c.redirect('/federation?ok=intent-shared')
  })

  // ============================================================
  // POST /federation/intents/:id/approve
  // ============================================================
  route.post('/intents/:id/approve', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)
    const id = c.req.param('id')
    await approveFederatedIntent(c.env.DB, id, 'Platform Architect')
    return c.redirect('/federation?ok=intent-approved')
  })

  return route
}
