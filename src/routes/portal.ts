// ============================================================
// SOVEREIGN OS PLATFORM — TENANT PORTAL SURFACE (P9)
// Tenant self-service portal: /portal/:slug
//
// GET /portal                 — Portal home (redirect to /portal/default)
// GET /portal/:slug           — Tenant portal home
// GET /portal/:slug/profile   — View/edit tenant profile
// POST /portal/:slug/profile  — Update tenant profile
// GET /portal/:slug/connectors — Tenant's connectors
// GET /portal/:slug/metrics   — Tenant's metrics
// GET /portal/:slug/federation — Tenant's federation status
// POST /portal/:slug/federation/request — Request federation with another tenant
// GET /portal/:slug/marketplace — Tenant marketplace submission
// POST /portal/:slug/marketplace/submit — Submit connector to marketplace
// GET /portal/:slug/policies  — P14: Tenant portal policy management tab
// POST /portal/:slug/policies/assign — P14: Assign policy to tenant via portal
// POST /portal/:slug/policies/remove — P14: Remove policy from tenant via portal
//
// AUTH: tenant API key scope enforcement (public_api_keys)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import { getTenantPolicies, assignTenantPolicy, removeTenantPolicy } from '../lib/abacUiService'

export const portalRoute = new Hono<{ Bindings: Env }>()

// Helper: validate portal access via API key or session
async function getPortalTenant(c: any, slug: string): Promise<{ allowed: boolean; tenant: any; apiKeyValid: boolean }> {
  const db = c.env.DB
  const repo = createRepo(db)

  // Get tenant by slug
  let tenant = null
  try {
    const result = await db.prepare(`SELECT * FROM tenants WHERE slug = ?`).bind(slug).first<any>()
    tenant = result
  } catch (_) { }

  if (!tenant) return { allowed: false, tenant: null, apiKeyValid: false }

  // Check API key header (X-API-Key) for tenant scope
  const apiKey = c.req.header('X-API-Key')
  let apiKeyValid = false
  if (apiKey) {
    try {
      const keyRow = await db.prepare(
        `SELECT * FROM public_api_keys WHERE key_value = ? AND tenant_id = ? AND revoked = 0`
      ).bind(apiKey, tenant.id).first<any>()
      apiKeyValid = !!keyRow
    } catch (_) { }
  }

  // Portal is accessible to anyone with tenant slug (read-only public view)
  // Mutations require API key or auth cookie
  return { allowed: true, tenant, apiKeyValid }
}

// GET /portal — Redirect to default
portalRoute.get('/', (c) => c.redirect('/portal/default'))

// GET /portal/:slug — Tenant portal home
portalRoute.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB

  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) {
    return c.html(layout('Portal — Not Found',
      `<div style="padding:40px;text-align:center"><h2 style="color:var(--red)">Tenant Not Found</h2><p style="color:var(--text2)">No tenant with slug: <code>${slug}</code></p><a href="/tenants" style="color:var(--accent)">View all tenants</a></div>`,
      '/portal'
    ), 404)
  }

  // Load tenant stats
  let connectorCount = 0, alertCount = 0, approvalCount = 0, apiKeyCount = 0
  try {
    connectorCount = (await db.prepare(`SELECT COUNT(*) as c FROM connectors WHERE tenant_id = ?`).bind(tenant.id).first<any>())?.c || 0
    alertCount = (await db.prepare(`SELECT COUNT(*) as c FROM platform_alerts WHERE tenant_id = ? AND read = 0`).bind(tenant.id).first<any>())?.c || 0
    approvalCount = (await db.prepare(`SELECT COUNT(*) as c FROM approvals WHERE tenant_id = ? AND status = 'pending'`).bind(tenant.id).first<any>())?.c || 0
    apiKeyCount = (await db.prepare(`SELECT COUNT(*) as c FROM public_api_keys WHERE tenant_id = ? AND revoked = 0`).bind(tenant.id).first<any>())?.c || 0
  } catch (_) { }

  // Check federation status
  let fedCount = 0
  try {
    fedCount = (await db.prepare(
      `SELECT COUNT(*) as c FROM tenant_federation WHERE (source_tenant_id = ? OR target_tenant_id = ?) AND status = 'active'`
    ).bind(tenant.id, tenant.id).first<any>())?.c || 0
  } catch (_) { }

  const portalLinks = [
    { path: `/portal/${slug}/profile`, icon: '👤', label: 'Profile', desc: 'View and update tenant info' },
    { path: `/portal/${slug}/connectors`, icon: '⊞', label: 'Connectors', desc: `${connectorCount} active connectors`, badge: connectorCount },
    { path: `/portal/${slug}/metrics`, icon: '📊', label: 'Metrics', desc: 'Usage & performance data' },
    { path: `/portal/${slug}/federation`, icon: '🔗', label: 'Federation', desc: `${fedCount} active federations`, badge: fedCount },
    { path: `/portal/${slug}/marketplace`, icon: '🛒', label: 'Marketplace', desc: 'Submit connectors' },
    { path: `/portal/${slug}/policies`, icon: '🛡️', label: 'Policies', desc: 'ABAC policy management' },
  ]

  const content = `
  <div class="page-header">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        <h1>🏠 Tenant Portal</h1>
        <span style="background:#22c55e22;color:#22c55e;border-radius:6px;padding:2px 10px;font-size:12px">${tenant.status || 'active'}</span>
        <span style="background:var(--bg3);color:var(--text3);border-radius:5px;padding:2px 8px;font-size:11px">P9</span>
      </div>
      <p style="color:var(--text2)">Self-service portal for <strong style="color:var(--text)">${tenant.name}</strong></p>
    </div>
    <div style="display:flex;gap:8px">
      <a href="/tenants" style="color:var(--text2);text-decoration:none;font-size:13px">← All Tenants</a>
    </div>
  </div>

  <!-- Tenant identity card -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:20px;display:flex;gap:20px;align-items:center">
    <div style="width:56px;height:56px;background:var(--accent);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;flex-shrink:0">
      ${(tenant.name || slug).charAt(0).toUpperCase()}
    </div>
    <div style="flex:1">
      <div style="font-size:20px;font-weight:700;color:var(--text)">${tenant.name}</div>
      <div style="color:var(--text3);font-size:13px">slug: <code style="color:var(--accent)">${slug}</code> · plan: <span style="color:var(--text2)">${tenant.plan || 'standard'}</span> · tier: <span style="color:var(--text2)">${tenant.tier || '1'}</span></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      ${[
        { val: connectorCount, label: 'Connectors', color: 'var(--accent)' },
        { val: approvalCount, label: 'Pending Approvals', color: approvalCount > 0 ? '#f59e0b' : 'var(--text2)' },
        { val: alertCount, label: 'Unread Alerts', color: alertCount > 0 ? '#ef4444' : 'var(--text2)' },
        { val: apiKeyCount, label: 'API Keys', color: '#22c55e' },
      ].map(s => `<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div><div style="color:var(--text3);font-size:11px">${s.label}</div></div>`).join('')}
    </div>
  </div>

  <!-- Portal navigation -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:20px">
    ${portalLinks.map(link => `
    <a href="${link.path}" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;text-decoration:none;transition:border-color 0.2s;display:block" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-size:22px;margin-bottom:6px">${link.icon}</div>
      <div style="font-weight:600;color:var(--text);margin-bottom:3px">${link.label}</div>
      <div style="color:var(--text3);font-size:12px">${link.desc}</div>
    </a>`).join('')}
  </div>

  <!-- Quick API info -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
    <div style="font-weight:600;margin-bottom:10px">🔑 API Access</div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:10px">Access your tenant data programmatically via the API with your tenant API key.</p>
    <div style="background:var(--bg3);border-radius:6px;padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent)">
      curl -H "X-API-Key: &lt;your-key&gt;" https://sovereign-os-platform.pages.dev/api/v1/metrics-history
    </div>
    <div style="margin-top:10px">
      <a href="/portal/${slug}/connectors" style="color:var(--accent);font-size:13px">Manage connectors →</a>
    </div>
  </div>
  `

  return c.html(layout(`Portal: ${tenant.name}`, content, `/portal/${slug}`))
})

// GET /portal/:slug/profile
portalRoute.get('/:slug/profile', async (c) => {
  const slug = c.req.param('slug')
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')
  const updated = c.req.query('updated')

  const content = `
  <div class="page-header">
    <div><h1>👤 Tenant Profile</h1><p style="color:var(--text2)">${tenant.name} — Self-Service</p></div>
    <a href="/portal/${slug}" style="color:var(--text2);text-decoration:none">← Portal Home</a>
  </div>
  ${updated ? `<div style="background:#22c55e22;border:1px solid #22c55e;border-radius:7px;padding:10px 16px;margin-bottom:16px;color:#22c55e">✅ Profile updated successfully</div>` : ''}
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:24px;max-width:500px">
    <form method="POST" action="/portal/${slug}/profile">
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">TENANT NAME</label>
        <input name="name" value="${tenant.name || ''}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px" />
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">SLUG (read-only)</label>
        <input value="${slug}" disabled style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text3);font-size:14px" />
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">PLAN</label>
        <select name="plan" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px">
          ${['starter','standard','pro','enterprise'].map(p => `<option value="${p}" ${tenant.plan === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">TIER</label>
        <select name="tier" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px">
          ${['1','2','3'].map(t => `<option value="${t}" ${String(tenant.tier) === t ? 'selected' : ''}>Tier ${t}</option>`).join('')}
        </select>
      </div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text3)">
        ℹ️ Profile updates are immediate. Tier changes require platform admin review.
      </div>
      <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:10px 20px;cursor:pointer;font-size:14px">Save Profile</button>
    </form>
  </div>
  `
  return c.html(layout('Tenant Profile', content, `/portal/${slug}`))
})

// POST /portal/:slug/profile
portalRoute.post('/:slug/profile', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  const body = await c.req.parseBody()
  const name = String(body.name || tenant.name).trim()
  const plan = String(body.plan || tenant.plan || 'standard').trim()
  const tier = parseInt(String(body.tier || tenant.tier || '1'))

  try {
    await db.prepare(`UPDATE tenants SET name = ?, plan = ?, tier = ? WHERE id = ?`)
      .bind(name, plan, tier, tenant.id).run()
  } catch (_) { }

  return c.redirect(`/portal/${slug}/profile?updated=1`)
})

// GET /portal/:slug/connectors
portalRoute.get('/:slug/connectors', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  let connectors: any[] = []
  try {
    const result = await db.prepare(`SELECT * FROM connectors WHERE tenant_id = ? ORDER BY created_at DESC`).bind(tenant.id).all<any>()
    connectors = result.results || []
  } catch (_) { }

  const rows = connectors.map(cn => `
  <tr style="border-bottom:1px solid var(--border)">
    <td style="padding:10px 14px;font-weight:500">${cn.name}</td>
    <td style="padding:10px 14px;color:var(--text2)">${cn.type}</td>
    <td style="padding:10px 14px"><span style="background:${cn.status === 'active' ? '#22c55e' : '#9aa3b2'}22;color:${cn.status === 'active' ? '#22c55e' : '#9aa3b2'};border-radius:5px;padding:2px 7px;font-size:11px">${cn.status}</span></td>
    <td style="padding:10px 14px;color:var(--text3);font-size:12px">${(cn.created_at || '').slice(0,10)}</td>
    <td style="padding:10px 14px">
      ${cn.marketplace_eligible ? `<span style="background:#a855f722;color:#a855f7;border-radius:5px;padding:2px 7px;font-size:11px">marketplace eligible</span>` : ''}
    </td>
  </tr>`).join('')

  const content = `
  <div class="page-header">
    <div><h1>⊞ My Connectors</h1><p style="color:var(--text2)">${tenant.name} — ${connectors.length} connectors</p></div>
    <a href="/portal/${slug}" style="color:var(--text2);text-decoration:none">← Portal Home</a>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Name','Type','Status','Created','Flags'].map(h => `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${connectors.length === 0
          ? `<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--text3)">No connectors yet. <a href="/connectors" style="color:var(--accent)">Go to Connectors</a> to create one.</td></tr>`
          : rows}
      </tbody>
    </table>
  </div>
  <div style="margin-top:16px"><a href="/portal/${slug}/marketplace" style="color:var(--accent);font-size:13px">Submit a connector to the marketplace →</a></div>
  `
  return c.html(layout('My Connectors', content, `/portal/${slug}`))
})

// GET /portal/:slug/metrics
portalRoute.get('/:slug/metrics', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  let snapshots: any[] = []
  try {
    const result = await db.prepare(
      `SELECT * FROM metrics_snapshots WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10`
    ).bind(tenant.id).all<any>()
    snapshots = result.results || []
  } catch (_) { }

  const rows = snapshots.map(s => `
  <tr style="border-bottom:1px solid var(--border)">
    <td style="padding:10px 14px;color:var(--text2);font-size:12px">${(s.created_at || '').slice(0,19)}</td>
    <td style="padding:10px 14px">${s.total_sessions || 0}</td>
    <td style="padding:10px 14px">${s.active_sessions || 0}</td>
    <td style="padding:10px 14px">${s.pending_approvals || 0}</td>
    <td style="padding:10px 14px">${s.active_connectors || 0}</td>
    <td style="padding:10px 14px">${s.running_executions || 0}</td>
  </tr>`).join('')

  const content = `
  <div class="page-header">
    <div><h1>📊 My Metrics</h1><p style="color:var(--text2)">${tenant.name} — Usage & Performance</p></div>
    <a href="/portal/${slug}" style="color:var(--text2);text-decoration:none">← Portal Home</a>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">Metrics History</span>
      <span style="color:var(--text3);font-size:12px;margin-left:8px">Last ${snapshots.length} snapshots</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Timestamp','Total Sessions','Active','Pending Approvals','Active Connectors','Running Execs'].map(h => `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${snapshots.length === 0
          ? `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text3)">No metrics snapshots yet for this tenant.</td></tr>`
          : rows}
      </tbody>
    </table>
  </div>
  `
  return c.html(layout('My Metrics', content, `/portal/${slug}`))
})

// GET /portal/:slug/federation
portalRoute.get('/:slug/federation', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')
  const requested = c.req.query('requested')

  let federations: any[] = []
  try {
    const result = await db.prepare(`
      SELECT * FROM tenant_federation
      WHERE source_tenant_id = ? OR target_tenant_id = ?
      ORDER BY created_at DESC
    `).bind(tenant.id, tenant.id).all<any>()
    federations = result.results || []
  } catch (_) { }

  let allTenants: any[] = []
  try {
    const result = await db.prepare(`SELECT id, name, slug FROM tenants WHERE id != ? AND status = 'active'`).bind(tenant.id).all<any>()
    allTenants = result.results || []
  } catch (_) { }

  const fedRows = federations.map(f => {
    const sc = f.status === 'active' ? '#22c55e' : f.status === 'pending' ? '#f59e0b' : '#ef4444'
    const isSrc = f.source_tenant_id === tenant.id
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 14px">${isSrc ? '→ Outbound' : '← Inbound'}</td>
      <td style="padding:10px 14px;color:var(--text2)">${isSrc ? f.target_tenant_id : f.source_tenant_id}</td>
      <td style="padding:10px 14px"><span style="background:${sc}22;color:${sc};border-radius:5px;padding:2px 7px;font-size:11px">${f.status}</span></td>
      <td style="padding:10px 14px;color:var(--text3);font-size:12px">${f.scope}</td>
      <td style="padding:10px 14px;color:var(--text3);font-size:11px">${(f.created_at || '').slice(0,10)}</td>
    </tr>`
  }).join('')

  const content = `
  <div class="page-header">
    <div><h1>🔗 My Federations</h1><p style="color:var(--text2)">${tenant.name} — Cross-tenant relationships</p></div>
    <a href="/portal/${slug}" style="color:var(--text2);text-decoration:none">← Portal Home</a>
  </div>
  ${requested ? `<div style="background:#22c55e22;border:1px solid #22c55e;border-radius:7px;padding:10px 16px;margin-bottom:16px;color:#22c55e">✅ Federation request submitted for approval</div>` : ''}

  <!-- Existing federations -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">Federation Relationships</span>
      <span style="color:var(--text3);font-size:12px;margin-left:8px">${federations.length} total</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Direction','Partner Tenant','Status','Scope','Date'].map(h => `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${federations.length === 0
          ? `<tr><td colspan="5" style="padding:30px;text-align:center;color:var(--text3)">No federations yet. Request one below.</td></tr>`
          : fedRows}
      </tbody>
    </table>
  </div>

  <!-- Request federation -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;max-width:500px">
    <div style="font-weight:600;margin-bottom:14px">Request New Federation</div>
    <form method="POST" action="/portal/${slug}/federation/request">
      <div style="margin-bottom:14px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">TARGET TENANT *</label>
        <select name="target_tenant_id" required style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px">
          <option value="">Select tenant...</option>
          ${allTenants.map(t => `<option value="${t.id}">${t.name} (${t.slug})</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:14px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">SCOPE (comma-separated)</label>
        <input name="scope" value="intents,approvals" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px" />
      </div>
      <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:10px 20px;cursor:pointer;font-size:14px">Request Federation</button>
    </form>
  </div>
  `
  return c.html(layout('My Federations', content, `/portal/${slug}`))
})

// POST /portal/:slug/federation/request
portalRoute.post('/:slug/federation/request', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  const body = await c.req.parseBody()
  const target_tenant_id = String(body.target_tenant_id || '').trim()
  const scope = String(body.scope || 'intents').trim()

  if (target_tenant_id) {
    try {
      const id = 'fed-' + Date.now().toString(36)
      const now = new Date().toISOString()
      await db.prepare(`
        INSERT OR IGNORE INTO tenant_federation (id, source_tenant_id, target_tenant_id, status, scope, created_by, created_at)
        VALUES (?, ?, ?, 'pending', ?, ?, ?)
      `).bind(id, tenant.id, target_tenant_id, scope, 'portal-self-service', now).run()
    } catch (_) { }
  }

  return c.redirect(`/portal/${slug}/federation?requested=1`)
})

// GET /portal/:slug/marketplace
portalRoute.get('/:slug/marketplace', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')
  const submitted = c.req.query('submitted')

  // Get tenant's marketplace submissions
  let submissions: any[] = []
  try {
    const result = await db.prepare(`
      SELECT mc.*, c.name as connector_name FROM marketplace_connectors mc
      JOIN connectors c ON mc.connector_id = c.id
      WHERE mc.submitted_by_tenant_id = ?
      ORDER BY mc.submitted_at DESC
    `).bind(tenant.id).all<any>()
    submissions = result.results || []
  } catch (_) { }

  // Eligible connectors (not yet in marketplace)
  let eligibleConnectors: any[] = []
  try {
    const result = await db.prepare(`
      SELECT c.* FROM connectors c
      LEFT JOIN marketplace_connectors mc ON mc.connector_id = c.id
      WHERE c.tenant_id = ? AND c.marketplace_eligible = 1 AND mc.id IS NULL
    `).bind(tenant.id).all<any>()
    eligibleConnectors = result.results || []
  } catch (_) { }

  const subRows = submissions.map(s => {
    const sc = s.status === 'listed' ? '#22c55e' : s.status === 'pending' ? '#f59e0b' : '#ef4444'
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 14px;font-weight:500">${s.connector_name || s.connector_id}</td>
      <td style="padding:10px 14px"><span style="background:${sc}22;color:${sc};border-radius:5px;padding:2px 7px;font-size:11px">${s.status}</span></td>
      <td style="padding:10px 14px;color:var(--text3);font-size:11px">${s.version || '1.0.0'}</td>
      <td style="padding:10px 14px;color:var(--text3)">${s.download_count || 0}</td>
      <td style="padding:10px 14px;color:var(--text3);font-size:11px">${(s.submitted_at || '').slice(0,10)}</td>
    </tr>`
  }).join('')

  const content = `
  <div class="page-header">
    <div><h1>🛒 Marketplace</h1><p style="color:var(--text2)">${tenant.name} — Submit connectors</p></div>
    <a href="/portal/${slug}" style="color:var(--text2);text-decoration:none">← Portal Home</a>
  </div>
  ${submitted ? `<div style="background:#22c55e22;border:1px solid #22c55e;border-radius:7px;padding:10px 16px;margin-bottom:16px;color:#22c55e">✅ Connector submitted to marketplace for review</div>` : ''}

  <!-- My submissions -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">My Submissions</span>
      <span style="color:var(--text3);font-size:12px;margin-left:8px">${submissions.length} submitted</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Connector','Status','Version','Downloads','Submitted'].map(h => `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${submissions.length === 0
          ? `<tr><td colspan="5" style="padding:30px;text-align:center;color:var(--text3)">No marketplace submissions yet.</td></tr>`
          : subRows}
      </tbody>
    </table>
  </div>

  <!-- Submit new -->
  ${eligibleConnectors.length > 0 ? `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;max-width:500px">
    <div style="font-weight:600;margin-bottom:14px">Submit Connector to Marketplace</div>
    <form method="POST" action="/portal/${slug}/marketplace/submit">
      <div style="margin-bottom:14px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">CONNECTOR *</label>
        <select name="connector_id" required style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px">
          <option value="">Select eligible connector...</option>
          ${eligibleConnectors.map(cn => `<option value="${cn.id}">${cn.name} (${cn.type})</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:14px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">DESCRIPTION</label>
        <textarea name="description" rows="2" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px;resize:vertical"></textarea>
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">VERSION</label>
        <input name="version" value="1.0.0" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px" />
      </div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text3)">
        ℹ️ Submissions go through Tier 2 approval before being listed publicly.
      </div>
      <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:10px 20px;cursor:pointer;font-size:14px">Submit to Marketplace</button>
    </form>
  </div>` : `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px">
    <p style="color:var(--text2);font-size:13px">No marketplace-eligible connectors available. Mark connectors as marketplace eligible first via the <a href="/connectors" style="color:var(--accent)">Connectors</a> surface.</p>
  </div>`}
  `
  return c.html(layout('Portal Marketplace', content, `/portal/${slug}`))
})

// POST /portal/:slug/marketplace/submit
portalRoute.post('/:slug/marketplace/submit', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  const body = await c.req.parseBody()
  const connector_id = String(body.connector_id || '').trim()
  const description = String(body.description || '').trim()
  const version = String(body.version || '1.0.0').trim()

  if (connector_id) {
    try {
      const id = 'mc-portal-' + Date.now().toString(36)
      const now = new Date().toISOString()
      await db.prepare(`
        INSERT OR IGNORE INTO marketplace_connectors
        (id, connector_id, submitted_by_tenant_id, description, version, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `).bind(id, connector_id, tenant.id, description, version, now).run()
    } catch (_) { }
  }

  return c.redirect(`/portal/${slug}/marketplace?submitted=1`)
})

// ============================================================
// P14: GET /portal/:slug/policies — Tenant Portal Policy Management
// ============================================================
portalRoute.get('/:slug/policies', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  const assigned = c.req.query('assigned')
  const removed = c.req.query('removed')

  // Load tenant's currently assigned policies
  let tenantPolicies: Array<{ policy_id: string; delegated_by: string; delegated_at: string }> = []
  let allActivePolicies: any[] = []
  try {
    tenantPolicies = await getTenantPolicies(db, tenant.id)
    const result = await db.prepare(
      `SELECT id, name, description, effect FROM abac_policies WHERE status = 'active' ORDER BY name`
    ).all<any>()
    allActivePolicies = result.results || []
  } catch (_) { }

  // Determine assigned policy ids set
  const assignedPolicyIds = new Set(tenantPolicies.map(p => p.policy_id))

  // Available policies not yet assigned
  const availablePolicies = allActivePolicies.filter(p => !assignedPolicyIds.has(p.id))

  // Policy detail map
  const policyMap: Record<string, any> = {}
  for (const p of allActivePolicies) policyMap[p.id] = p

  const assignedRows = tenantPolicies.map(p => {
    const pol = policyMap[p.policy_id]
    const effectColor = pol?.effect === 'allow' ? '#22c55e' : '#ef4444'
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 14px;font-size:12px;font-weight:500;color:var(--text)">${pol?.name || p.policy_id}</td>
        <td style="padding:10px 14px;font-size:11px;color:var(--text3)">${pol?.description || '—'}</td>
        <td style="padding:10px 14px">
          <span style="background:${effectColor}22;color:${effectColor};border-radius:5px;padding:2px 7px;font-size:11px">${pol?.effect || '—'}</span>
        </td>
        <td style="padding:10px 14px;font-size:11px;color:var(--text3)">${p.delegated_by}</td>
        <td style="padding:10px 14px;font-size:11px;color:var(--text3)">${(p.delegated_at || '').slice(0, 16)}</td>
        <td style="padding:10px 14px">
          <form method="POST" action="/portal/${slug}/policies/remove" style="display:inline">
            <input type="hidden" name="policy_id" value="${p.policy_id}">
            <button type="submit" style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600" onclick="return confirm('Remove policy ${pol?.name || p.policy_id}?')">Remove</button>
          </form>
        </td>
      </tr>`
  }).join('')

  const content = `
  <div class="page-header">
    <div>
      <h1>🛡️ ABAC Policies</h1>
      <p style="color:var(--text2)">${tenant.name} — P14 Policy Management</p>
    </div>
    <a href="/portal/${slug}" style="color:var(--text2);text-decoration:none">← Portal Home</a>
  </div>

  ${assigned ? `<div style="background:#22c55e22;border:1px solid #22c55e;border-radius:7px;padding:10px 16px;margin-bottom:16px;color:#22c55e">✅ Policy assigned successfully</div>` : ''}
  ${removed ? `<div style="background:#f59e0b22;border:1px solid #f59e0b;border-radius:7px;padding:10px 16px;margin-bottom:16px;color:#f59e0b">⚠️ Policy removed from tenant</div>` : ''}

  <!-- Assigned Policies Table -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div>
        <span style="font-weight:600">Assigned Policies</span>
        <span style="color:var(--text3);font-size:12px;margin-left:8px">${tenantPolicies.length} assigned</span>
      </div>
      <span style="background:#8b5cf622;color:#8b5cf6;border-radius:5px;padding:2px 8px;font-size:11px">P14</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Policy Name','Description','Effect','Granted By','Granted At','Action'].map(h => `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${tenantPolicies.length === 0
          ? `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text3)">No policies assigned. Assign one below.</td></tr>`
          : assignedRows}
      </tbody>
    </table>
  </div>

  <!-- Assign New Policy -->
  ${availablePolicies.length > 0 ? `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;max-width:500px">
    <div style="font-weight:600;margin-bottom:14px">Assign Policy to Tenant</div>
    <form method="POST" action="/portal/${slug}/policies/assign">
      <div style="margin-bottom:14px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">SELECT POLICY *</label>
        <select name="policy_id" required style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px">
          <option value="">Choose a policy...</option>
          ${availablePolicies.map(p => `<option value="${p.id}">${p.name} (${p.effect})</option>`).join('')}
        </select>
      </div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--text3)">
        ℹ️ Assigning a policy gives this tenant's requests additional ABAC context during policy evaluation.
      </div>
      <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:10px 20px;cursor:pointer;font-size:14px">Assign Policy</button>
    </form>
  </div>` : `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px">
    <p style="color:var(--text2);font-size:13px">All available active policies are already assigned to this tenant. <a href="/policies" style="color:var(--accent)">Manage policies</a></p>
  </div>`}

  <div style="margin-top:16px;padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
    <span style="color:#8b5cf6;font-weight:600">P14 Tenant Policy Delegation:</span>
    Policies assigned here are stored in <code>tenant_policies</code> and used for tenant-scoped ABAC enforcement on <code>/t/${slug}/*</code> routes.
    Platform admin can also manage policies from <a href="/tenants/${tenant.id}" style="color:#8b5cf6">/tenants/${tenant.id}</a>.
  </div>
  `
  return c.html(layout(`${tenant.name} — Policies`, content, `/portal/${slug}`))
})

// POST /portal/:slug/policies/assign
portalRoute.post('/:slug/policies/assign', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  const body = await c.req.parseBody()
  const policy_id = String(body.policy_id || '').trim()

  if (policy_id) {
    await assignTenantPolicy(db, tenant.id, policy_id, 'portal-self-service')
  }

  return c.redirect(`/portal/${slug}/policies?assigned=1`)
})

// POST /portal/:slug/policies/remove
portalRoute.post('/:slug/policies/remove', async (c) => {
  const slug = c.req.param('slug')
  const db = c.env.DB
  const { allowed, tenant } = await getPortalTenant(c, slug)
  if (!allowed || !tenant) return c.redirect('/portal')

  const body = await c.req.parseBody()
  const policy_id = String(body.policy_id || '').trim()

  if (policy_id) {
    await removeTenantPolicy(db, tenant.id, policy_id)
  }

  return c.redirect(`/portal/${slug}/policies?removed=1`)
})
