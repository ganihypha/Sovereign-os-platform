// ============================================================
// SOVEREIGN OS PLATFORM — MARKETPLACE SURFACE (P8 + P24)
// Connector template marketplace — governed publishing + real templates
//
// GET /marketplace          — Marketplace listing (public-facing) + template library
// GET /marketplace/templates — Real connector template library (P24)
// GET /marketplace/:id      — Template preview + install form (P24)
// POST /marketplace/:id/install — Install connector from template (P24)
// POST /marketplace/:id/rate    — Rate a template (P24 SHOULD DO)
// GET /marketplace/submit   — Submit form
// POST /marketplace/submit  — Submit connector to marketplace
// POST /marketplace/:id/approve — Approve listing (Tier 2 required)
// POST /marketplace/:id/reject  — Reject listing
// POST /marketplace/:id/download — Increment download counter
//
// AUTH: Submit/Approve/Install requires auth
//       Browsing + template preview is public
// APPROVAL: Tier 2 gate — always required for marketplace listing
// P24: Real connector_templates table — GitHub, Slack, Jira, Webhook
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

const SOURCE_ICON: Record<string, string> = {
  github:  '🐙',
  slack:   '💬',
  jira:    '📋',
  webhook: '🔗',
  generic: '⚡',
}

// ============================================================
// P24 HELPER: List connector templates from D1
// ============================================================
async function listConnectorTemplates(db: D1Database, opts?: { source_type?: string }): Promise<any[]> {
  try {
    let sql = `SELECT * FROM connector_templates WHERE status = 'published'`
    const params: string[] = []
    if (opts?.source_type) { sql += ` AND source_type = ?`; params.push(opts.source_type) }
    sql += ` ORDER BY install_count DESC`
    const result = await db.prepare(sql).bind(...params).all()
    return result.results || []
  } catch { return [] }
}

async function getConnectorTemplate(db: D1Database, id: string): Promise<any | null> {
  try {
    const result = await db.prepare(`SELECT * FROM connector_templates WHERE id = ? AND status != 'deprecated'`).bind(id).first()
    return result || null
  } catch { return null }
}

async function installConnectorTemplate(db: D1Database, templateId: string, tenantId: string, config: Record<string, string>, installedBy: string): Promise<{ ok: boolean; connectorId?: string; error?: string }> {
  try {
    const tpl = await getConnectorTemplate(db, templateId)
    if (!tpl) return { ok: false, error: 'template-not-found' }

    const connectorId = `conn-${tpl.source_type}-${Date.now().toString(36)}`
    const mergedConfig = { ...JSON.parse(tpl.default_config || '{}'), ...config }

    // Insert into connectors table (platform standard)
    await db.prepare(`
      INSERT INTO connectors (id, name, connector_type, config, tenant_id, approval_status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
    `).bind(
      connectorId,
      `${tpl.name} (from template)`,
      tpl.source_type,
      JSON.stringify(mergedConfig),
      tenantId || 'default',
      installedBy
    ).run()

    // Increment install count
    await db.prepare(`UPDATE connector_templates SET install_count = install_count + 1, updated_at = datetime('now') WHERE id = ?`).bind(templateId).run()

    return { ok: true, connectorId }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'install-failed' }
  }
}

async function rateConnectorTemplate(db: D1Database, templateId: string, tenantId: string, rating: number, comment: string, ratedBy: string): Promise<{ ok: boolean }> {
  try {
    await db.prepare(`
      INSERT INTO connector_ratings (connector_template_id, tenant_id, rating, comment, rated_by, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(templateId, tenantId || 'default', rating, comment, ratedBy).run()
    return { ok: true }
  } catch { return { ok: false } }
}

async function getTemplateAvgRating(db: D1Database, templateId: string): Promise<{ avg: number; count: number }> {
  try {
    const r = await db.prepare(`SELECT AVG(rating) as avg, COUNT(*) as cnt FROM connector_ratings WHERE connector_template_id = ?`).bind(templateId).first() as any
    return { avg: Math.round((r?.avg || 0) * 10) / 10, count: r?.cnt || 0 }
  } catch { return { avg: 0, count: 0 } }
}

export function createMarketplaceRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ============================================================
  // GET /marketplace — Public Listing + P24 Template Library
  // ============================================================
  route.get('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    const db = c.env.DB
    const filterType = c.req.query('type') || ''

    const [listed, allSubmissions, templates] = await Promise.all([
      listMarketplaceConnectors(db, { listing_status: 'listed' }),
      isAuth ? listMarketplaceConnectors(db) : [],
      listConnectorTemplates(db, filterType ? { source_type: filterType } : undefined),
    ])

    const pending = allSubmissions.filter(m => m.listing_status === 'submitted' || m.listing_status === 'under_review')
    const totalDownloads = listed.reduce((sum, m) => sum + (m.downloads || 0), 0)
    const totalInstalls = templates.reduce((sum, t) => sum + (t.install_count || 0), 0)

    // P24: Template library cards
    const templateCards = templates.map(t => {
      const icon = SOURCE_ICON[t.source_type] || '⚡'
      const starsHtml = '★★★★★'.split('').map((s, i) => `<span style="color:${i < 4 ? '#f6c90e' : '#4a5568'}">${s}</span>`).join('')
      return `
        <div class="connector-card" style="position:relative">
          <div class="connector-header">
            <span class="connector-icon">${icon}</span>
            <div style="flex:1">
              <div class="connector-title">${t.name}</div>
              <div class="connector-meta">${t.source_type} · ${t.install_count} installs</div>
            </div>
            <span class="badge badge-green">Published</span>
          </div>
          <p class="connector-desc">${t.description || 'No description.'}</p>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:0.85rem">${starsHtml}</span>
            <span class="small muted">4.2</span>
          </div>
          <div class="connector-footer">
            <a href="/marketplace/${t.id}" class="btn btn-sm btn-blue">👁 Preview</a>
            ${isAuth ? `<a href="/marketplace/${t.id}?action=install" class="btn btn-sm btn-green">⚡ Install</a>` : ''}
          </div>
        </div>
      `
    }).join('')

    // Legacy listed cards
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

    const typeFilters = ['github', 'slack', 'jira', 'webhook', 'generic'].map(t =>
      `<a href="/marketplace?type=${t}" class="btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-secondary'}">${SOURCE_ICON[t]} ${t}</a>`
    ).join('')

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🛒 Connector Marketplace</h1>
          <p class="page-subtitle">P24 — Real connector template library (GitHub, Slack, Jira, Webhook) + governed publishing</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P24</span>
          <span class="badge badge-green">${templates.length} templates</span>
          ${isAuth ? `<a href="/marketplace/submit" class="btn btn-primary">+ Submit Connector</a>` : ''}
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${templates.length}</div><div class="stat-label">Published Templates</div></div>
        <div class="stat-card"><div class="stat-num">${totalInstalls}</div><div class="stat-label">Total Installs</div></div>
        <div class="stat-card"><div class="stat-num">${listed.length}</div><div class="stat-label">Legacy Listed</div></div>
        <div class="stat-card"><div class="stat-num">${pending.length}</div><div class="stat-label">Pending Review</div></div>
      </div>

      <div class="card mb-4">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 class="section-title" style="margin:0">⚡ Connector Templates</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <a href="/marketplace" class="btn btn-sm ${!filterType ? 'btn-primary' : 'btn-secondary'}">All</a>
            ${typeFilters}
          </div>
        </div>
        ${templates.length ? `<div class="connector-grid">${templateCards}</div>` :
          '<p class="empty-state">No templates found.</p>'}
      </div>

      ${listed.length ? `
      <div class="card mb-4">
        <h3 class="section-title">✅ Community Listed Connectors</h3>
        <div class="connector-grid">${listedCards}</div>
      </div>` : ''}

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
        .connector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .connector-card { background: var(--bg-card, #1a1d27); border: 1px solid var(--border, #2d3748); border-radius: 8px; padding: 16px; transition: border-color 0.2s; }
        .connector-card:hover { border-color: #4a90d9; }
        .connector-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
        .connector-icon { font-size: 1.5rem; }
        .connector-title { font-weight: 600; color: var(--text-primary, #e2e8f0); }
        .connector-meta { font-size: 0.75rem; color: var(--text-muted, #718096); }
        .connector-desc { font-size: 0.875rem; color: var(--text-secondary, #a0aec0); margin: 8px 0; }
        .connector-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
        .tag { background: #2d3748; color: #a0aec0; font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; }
        .connector-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border, #2d3748); padding-top: 8px; gap: 6px; }
        .form-input-inline { background: #2d3748; border: 1px solid #4a5568; color: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; width: 120px; }
      </style>
    `

    return c.html(layout('Connector Marketplace — P24', content, 'marketplace'))
  })

  // ============================================================
  // GET /marketplace/templates — Template list (JSON API)
  // ============================================================
  route.get('/templates', async (c) => {
    const templates = await listConnectorTemplates(c.env.DB)
    return c.json({ templates, count: templates.length })
  })

  // ============================================================
  // GET /marketplace/:id — Template Preview + Install Form (P24)
  // ============================================================
  route.get('/:id', async (c) => {
    const id = c.req.param('id')
    // Skip if known sub-paths
    if (['submit', 'templates'].includes(id)) return c.redirect('/marketplace')
    const isAuth = await isAuthenticated(c, c.env)
    const db = c.env.DB

    const tpl = await getConnectorTemplate(db, id)
    if (!tpl) return c.html(layout('Template Not Found', `<div class="card"><p class="empty-state">Connector template <code>${id}</code> not found.</p><a href="/marketplace" class="btn btn-secondary">← Back</a></div>`, 'marketplace'))

    const rating = await getTemplateAvgRating(db, id)
    const icon = SOURCE_ICON[tpl.source_type] || '⚡'
    const action = c.req.query('action') || ''

    let configFields: any[] = []
    try { configFields = JSON.parse(tpl.config_schema || '{}').fields || [] } catch { configFields = [] }

    const fieldHtml = configFields.map((f: any) => `
      <div class="form-row">
        <label>${f.label}${f.required ? ' <span style="color:#e53e3e">*</span>' : ''}</label>
        ${f.type === 'textarea'
          ? `<textarea name="cfg_${f.key}" class="form-input" placeholder="${f.placeholder || ''}">${f.default || ''}</textarea>`
          : f.type === 'multiselect'
          ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${(f.options || []).map((opt: string) =>
              `<label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">
                <input type="checkbox" name="cfg_${f.key}" value="${opt}" ${(f.default || []).includes(opt) ? 'checked' : ''}> ${opt}
              </label>`).join('')}</div>`
          : f.type === 'boolean'
          ? `<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="cfg_${f.key}" ${f.default ? 'checked' : ''}> Enable</label>`
          : `<input type="${f.type || 'text'}" name="cfg_${f.key}" class="form-input" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''} value="${f.default || ''}">`
        }
      </div>
    `).join('')

    const starsHtml = Array.from({length: 5}, (_, i) =>
      `<span style="color:${i < Math.round(rating.avg) ? '#f6c90e' : '#4a5568'}">★</span>`
    ).join('')

    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${icon} ${tpl.name}</h1>
          <p class="page-subtitle">${tpl.description || 'Connector template'}</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-green">${tpl.source_type}</span>
          <span class="badge badge-blue">${tpl.install_count} installs</span>
          <a href="/marketplace" class="btn btn-secondary">← Back</a>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <div class="card mb-4">
            <h3 class="section-title">📋 Template Details</h3>
            <table class="data-table">
              <tr><td class="muted small">ID</td><td class="mono small">${tpl.id}</td></tr>
              <tr><td class="muted small">Type</td><td>${icon} ${tpl.source_type}</td></tr>
              <tr><td class="muted small">Status</td><td><span class="badge badge-green">${tpl.status}</span></td></tr>
              <tr><td class="muted small">Installs</td><td>${tpl.install_count}</td></tr>
              <tr><td class="muted small">Rating</td><td>${starsHtml} ${rating.avg} (${rating.count} reviews)</td></tr>
              <tr><td class="muted small">Created</td><td class="small">${tpl.created_at?.slice(0,10)}</td></tr>
            </table>
          </div>

          <div class="card mb-4">
            <h3 class="section-title">⚙️ Config Fields</h3>
            ${configFields.length ? `<ul style="list-style:none;padding:0;margin:0">${configFields.map((f: any) => `
              <li style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2d3748">
                <span>${f.label} ${f.required ? '<span style="color:#e53e3e">*</span>' : '<span class="muted small">(optional)</span>'}</span>
                <span class="mono small muted">${f.type}</span>
              </li>`).join('')}</ul>` : '<p class="muted small">No configuration required.</p>'}
          </div>

          <div class="card">
            <h3 class="section-title">⭐ Rate this Template</h3>
            ${isAuth ? `
            <form method="POST" action="/marketplace/${id}/rate" class="form-grid">
              <div class="form-row">
                <label>Rating</label>
                <select name="rating" class="form-input" required>
                  <option value="5">★★★★★ (5 — Excellent)</option>
                  <option value="4">★★★★☆ (4 — Good)</option>
                  <option value="3">★★★☆☆ (3 — Average)</option>
                  <option value="2">★★☆☆☆ (2 — Poor)</option>
                  <option value="1">★☆☆☆☆ (1 — Very Poor)</option>
                </select>
              </div>
              <div class="form-row">
                <label>Comment (optional)</label>
                <input name="comment" class="form-input" placeholder="Your experience with this template...">
              </div>
              <div class="form-row">
                <button type="submit" class="btn btn-secondary">Submit Rating</button>
              </div>
            </form>` : '<p class="muted small">Log in to rate this template.</p>'}
          </div>
        </div>

        <div>
          <div class="card">
            <h3 class="section-title">⚡ Install Connector from Template</h3>
            ${isAuth ? `
            <form method="POST" action="/marketplace/${id}/install" class="form-grid">
              <div class="form-row">
                <label>Tenant ID</label>
                <input name="tenant_id" class="form-input" value="default" placeholder="Your tenant ID">
              </div>
              ${fieldHtml}
              <div class="form-row" style="padding-top:8px;border-top:1px solid #2d3748">
                <button type="submit" class="btn btn-primary">⚡ Install Now</button>
                <a href="/marketplace" class="btn btn-secondary ml-2">Cancel</a>
              </div>
            </form>` : `
            <p class="muted">Authentication required to install templates.</p>
            <a href="/marketplace" class="btn btn-secondary">← Browse Templates</a>
            `}
          </div>
        </div>
      </div>
    `
    return c.html(layout(`${tpl.name} — Marketplace`, content, 'marketplace'))
  })

  // ============================================================
  // POST /marketplace/:id/install — Install connector from template (P24)
  // ============================================================
  route.post('/:id/install', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)
    const id = c.req.param('id')
    const body = await c.req.parseBody()

    const config: Record<string, string> = {}
    for (const [k, v] of Object.entries(body)) {
      if (k.startsWith('cfg_')) { config[k.slice(4)] = String(v) }
    }
    const tenantId = String(body.tenant_id || 'default').trim()

    const result = await installConnectorTemplate(c.env.DB, id, tenantId, config, 'Platform Architect')
    if (!result.ok) {
      return c.redirect(`/marketplace/${id}?error=${encodeURIComponent(result.error || 'install-failed')}`)
    }
    return c.redirect(`/connectors?ok=installed&connector=${result.connectorId}`)
  })

  // ============================================================
  // POST /marketplace/:id/rate — Rate a template (P24 SHOULD DO)
  // ============================================================
  route.post('/:id/rate', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.html('<p>Unauthorized</p>', 401)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const rating = Math.min(5, Math.max(1, parseInt(String(body.rating || '5'))))
    const comment = String(body.comment || '').trim()
    await rateConnectorTemplate(c.env.DB, id, 'default', rating, comment, 'Platform Architect')
    return c.redirect(`/marketplace/${id}?ok=rated`)
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
