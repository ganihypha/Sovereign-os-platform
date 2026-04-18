// ============================================================
// SOVEREIGN OS PLATFORM — MARKETPLACE SURFACE (P8)
// Connector template marketplace — governed publishing
//
// GET /marketplace          — Marketplace listing (public-facing)
// GET /marketplace/submit   — Submit form
// POST /marketplace/submit  — Submit connector to marketplace
// POST /marketplace/:id/approve — Approve listing (Tier 2 required)
// POST /marketplace/:id/reject  — Reject listing
// POST /marketplace/:id/download — Increment download counter
//
// AUTH: Submit/Approve requires auth
//       Browsing is public
// APPROVAL: Tier 2 gate — always required for marketplace listing
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import { layout } from '../layout'
import {
  listMarketplaceConnectors,
  getMarketplaceConnector,
  submitConnectorToMarketplace,
  approveMarketplaceListing,
  rejectMarketplaceListing,
  incrementDownloads,
} from '../lib/marketplaceService'

const STATUS_BADGE: Record<string, string> = {
  submitted:    'badge-yellow',
  under_review: 'badge-blue',
  listed:       'badge-green',
  rejected:     'badge-red',
  withdrawn:    'badge-grey',
}

export function createMarketplaceRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ============================================================
  // GET /marketplace — Public Listing
  // ============================================================
  route.get('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    const db = c.env.DB

    const [listed, allSubmissions] = await Promise.all([
      listMarketplaceConnectors(db, { listing_status: 'listed' }),
      isAuth ? listMarketplaceConnectors(db) : [],
    ])

    const pending = allSubmissions.filter(m => m.listing_status === 'submitted' || m.listing_status === 'under_review')
    const totalDownloads = listed.reduce((sum, m) => sum + (m.downloads || 0), 0)

    const listedCards = listed.map(m => {
      let tags: string[] = []
      try { tags = JSON.parse(m.listing_tags || '[]') } catch { tags = [] }
      return `
        <div class="connector-card">
          <div class="connector-header">
            <span class="connector-icon">⚡</span>
            <div>
              <div class="connector-title">${m.listing_title || m.connector_id}</div>
              <div class="connector-meta">v${m.version_tag} · ${m.downloads} downloads</div>
            </div>
            <span class="badge badge-green">Listed</span>
          </div>
          <p class="connector-desc">${m.listing_description || 'No description.'}</p>
          <div class="connector-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
          <div class="connector-footer">
            <span class="small muted">By: ${m.submitted_by} · ${m.created_at?.slice(0, 10)}</span>
            <form method="POST" action="/marketplace/${m.id}/download" style="display:inline">
              <button class="btn btn-sm btn-blue">↓ Use Template</button>
            </form>
          </div>
        </div>
      `
    }).join('')

    const pendingRows = pending.map(m => `
      <tr>
        <td class="mono small">${m.id}</td>
        <td>${m.listing_title || m.connector_id}</td>
        <td class="mono small">${m.connector_id}</td>
        <td>${m.submitted_by}</td>
        <td><span class="badge ${STATUS_BADGE[m.listing_status] || 'badge-grey'}">${m.listing_status}</span></td>
        <td class="small">${m.created_at?.slice(0, 10) || '—'}</td>
        <td>
          ${isAuth && (m.listing_status === 'submitted' || m.listing_status === 'under_review') ? `
            <form method="POST" action="/marketplace/${m.id}/approve" style="display:inline">
              <button class="btn btn-sm btn-green" onclick="return confirm('Approve and list?')">List</button>
            </form>
            <form method="POST" action="/marketplace/${m.id}/reject" style="display:inline">
              <input name="reason" placeholder="Reason" class="form-input-inline" required>
              <button class="btn btn-sm btn-red">Reject</button>
            </form>
          ` : m.approved_by || '—'}
        </td>
      </tr>
    `).join('')

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🛒 Connector Marketplace</h1>
          <p class="page-subtitle">P8 — Governed connector template publishing. Tier 2 approval required for all listings.</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P8</span>
          <span class="badge badge-green">${listed.length} listed</span>
          ${isAuth ? `<a href="/marketplace/submit" class="btn btn-primary">+ Submit Connector</a>` : ''}
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${listed.length}</div><div class="stat-label">Listed Connectors</div></div>
        <div class="stat-card"><div class="stat-num">${pending.length}</div><div class="stat-label">Pending Review</div></div>
        <div class="stat-card"><div class="stat-num">${totalDownloads}</div><div class="stat-label">Total Downloads</div></div>
        <div class="stat-card"><div class="stat-num">${allSubmissions.length}</div><div class="stat-label">Total Submissions</div></div>
      </div>

      <div class="card mb-4">
        <h3 class="section-title">✅ Listed Connectors</h3>
        ${listed.length ? `<div class="connector-grid">${listedCards}</div>` :
          '<p class="empty-state">No connectors listed yet. Submit a connector to get started.</p>'}
      </div>

      ${isAuth && pending.length ? `
      <div class="card mb-4">
        <h3 class="section-title">⏳ Pending Review (Tier 2 Approval Queue)</h3>
        <div class="table-container">
          <table class="data-table">
            <thead><tr>
              <th>ID</th><th>Title</th><th>Connector ID</th><th>Submitted By</th>
              <th>Status</th><th>Submitted</th><th>Actions</th>
            </tr></thead>
            <tbody>${pendingRows}</tbody>
          </table>
        </div>
      </div>` : ''}

      <style>
        .connector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
        .connector-card { background: var(--bg-card, #1a1d27); border: 1px solid var(--border, #2d3748); border-radius: 8px; padding: 16px; }
        .connector-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
        .connector-icon { font-size: 1.5rem; }
        .connector-title { font-weight: 600; color: var(--text-primary, #e2e8f0); }
        .connector-meta { font-size: 0.75rem; color: var(--text-muted, #718096); }
        .connector-desc { font-size: 0.875rem; color: var(--text-secondary, #a0aec0); margin: 8px 0; }
        .connector-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
        .tag { background: #2d3748; color: #a0aec0; font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; }
        .connector-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border, #2d3748); padding-top: 8px; }
        .form-input-inline { background: #2d3748; border: 1px solid #4a5568; color: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; width: 120px; }
      </style>
    `

    return c.html(layout('Connector Marketplace — P8', content, 'marketplace'))
  })

  // ============================================================
  // GET /marketplace/submit — Submit form
  // ============================================================
  route.get('/submit', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.redirect('/marketplace?error=auth-required')
    const repo = createRepo(c.env.DB)
    const connectors = await repo.getConnectors()
    const eligible = connectors.filter(cn => cn.approval_status === 'approved')

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📤 Submit to Marketplace</h1>
          <p class="page-subtitle">Submit an approved connector as a marketplace template. Tier 2 approval required.</p>
        </div>
      </div>

      <div class="card">
        <form method="POST" action="/marketplace/submit" class="form-grid">
          <div class="form-row">
            <label>Connector (must be approved + marketplace-eligible)</label>
            <select name="connector_id" class="form-input" required>
              <option value="">— Select connector —</option>
              ${eligible.map(cn => `<option value="${cn.id}">${cn.name} (${cn.connector_type})</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label>Listing Title</label>
            <input name="listing_title" class="form-input" placeholder="e.g. Webhook Alert Dispatcher" required>
          </div>
          <div class="form-row">
            <label>Description</label>
            <textarea name="listing_description" class="form-input" rows="3" placeholder="What does this connector do?"></textarea>
          </div>
          <div class="form-row">
            <label>Tags (comma-separated)</label>
            <input name="listing_tags" class="form-input" placeholder="webhook, alerts, automation">
          </div>
          <div class="form-row">
            <label>Tenant ID</label>
            <input name="submitted_tenant_id" class="form-input" placeholder="tenant-default">
          </div>
          <div class="form-row">
            <label>Version Tag</label>
            <input name="version_tag" class="form-input" value="1.0.0">
          </div>
          <div class="form-row">
            <label>Notes for Reviewer</label>
            <textarea name="listing_notes" class="form-input" rows="2" placeholder="Any notes for the Tier 2 reviewer"></textarea>
          </div>
          <div class="form-row">
            <button type="submit" class="btn btn-primary">Submit for Review</button>
            <a href="/marketplace" class="btn btn-secondary ml-2">Cancel</a>
          </div>
        </form>
      </div>
    `
    return c.html(layout('Submit to Marketplace — P8', content, 'marketplace'))
  })

  // ============================================================
  // POST /marketplace/submit
  // ============================================================
  route.post('/submit', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)

    const body = await c.req.parseBody()
    const tagsStr = String(body.listing_tags || '').trim()
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean)

    const result = await submitConnectorToMarketplace(c.env.DB, {
      connector_id: String(body.connector_id || '').trim(),
      submitted_by: 'Platform Architect',
      submitted_tenant_id: String(body.submitted_tenant_id || 'default').trim(),
      listing_title: String(body.listing_title || '').trim(),
      listing_description: String(body.listing_description || '').trim(),
      listing_tags: tags,
      listing_notes: String(body.listing_notes || '').trim(),
      version_tag: String(body.version_tag || '1.0.0').trim(),
    })

    if (!result.ok) return c.redirect(`/marketplace?error=${result.error}`)
    return c.redirect('/marketplace?ok=submitted')
  })

  // ============================================================
  // POST /marketplace/:id/approve
  // ============================================================
  route.post('/:id/approve', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)
    const id = c.req.param('id')
    await approveMarketplaceListing(c.env.DB, id, 'Platform Architect')
    return c.redirect('/marketplace?ok=listed')
  })

  // ============================================================
  // POST /marketplace/:id/reject
  // ============================================================
  route.post('/:id/reject', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const reason = String(body.reason || 'No reason provided').trim()
    await rejectMarketplaceListing(c.env.DB, id, 'Platform Architect', reason)
    return c.redirect('/marketplace?ok=rejected')
  })

  // ============================================================
  // POST /marketplace/:id/download — increment download count
  // ============================================================
  route.post('/:id/download', async (c) => {
    const id = c.req.param('id')
    await incrementDownloads(c.env.DB, id)
    return c.redirect('/marketplace?ok=downloaded')
  })

  return route
}
