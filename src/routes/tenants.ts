// ============================================================
// SOVEREIGN OS PLATFORM — TENANT PROVISIONING SURFACE (P5)
// Multi-tenant isolation registry.
// Auth: GET = read-only (unauthenticated), POST = requires auth
// Tenant isolation: tenant A data never readable by tenant B
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { layout, badgeStatus } from '../layout'
import { isAuthenticated } from '../lib/auth'

export function createTenantsRoute() {
  const app = new Hono<{ Bindings: Env }>()

  // GET /tenants — Tenant directory
  app.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    const [tenants, unreadAlerts] = await Promise.all([
      repo.getTenants(),
      repo.getUnreadAlertCount(),
    ])

    const rows = tenants.map(t => `
      <tr>
        <td><a href="/tenants/${t.id}" style="color:var(--accent);font-weight:600">${escHtml(t.name)}</a><br>
          <span style="font-size:11px;color:var(--text2)">slug: <code>${escHtml(t.slug)}</code></span></td>
        <td>${badgeStatus(t.status)}</td>
        <td><span class="badge ${t.approval_status === 'approved' ? 'badge-green' : t.approval_status === 'rejected' ? 'badge-red' : 'badge-yellow'}">${t.approval_status}</span></td>
        <td>${t.plan}</td>
        <td>${t.isolation_mode}</td>
        <td style="font-size:11px;color:var(--text2)">${escHtml(t.owner_name)}</td>
        <td style="font-size:11px;color:var(--text2)">${t.created_at.slice(0,10)}</td>
        ${authenticated ? `<td>
          ${t.slug !== 'default' ? `
          <form method="POST" action="/tenants/${t.id}/approve" style="display:inline">
            <button class="btn btn-sm btn-green" onclick="return confirm('Approve tenant?')">Approve</button>
          </form>
          <form method="POST" action="/tenants/${t.id}/suspend" style="display:inline">
            <button class="btn btn-sm btn-red" onclick="return confirm('Suspend tenant?')">Suspend</button>
          </form>` : '<span style="font-size:11px;color:var(--text2)">root tenant</span>'}
        </td>` : ''}
      </tr>`).join('')

    const body = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Tenant Provisioning</h1>
          <p class="page-subtitle">Multi-tenant isolation registry. P5 — Tier 2 approval required.</p>
        </div>
        ${authenticated ? `<a href="/tenants/new" class="btn btn-primary">+ Register Tenant</a>` : ''}
      </div>

      <div class="card mb-4" style="border-left:3px solid var(--accent)">
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
            <div class="metric-box">
              <div class="metric-value">${tenants.length}</div>
              <div class="metric-label">Total Tenants</div>
            </div>
            <div class="metric-box">
              <div class="metric-value">${tenants.filter(t => t.status === 'active').length}</div>
              <div class="metric-label">Active</div>
            </div>
            <div class="metric-box">
              <div class="metric-value">${tenants.filter(t => t.approval_status === 'pending').length}</div>
              <div class="metric-label">Pending Approval</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Registered Tenants</h2>
          <span class="badge badge-blue">Isolation Mode: Per-Tenant Enforced</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Plan</th>
                <th>Isolation</th>
                <th>Owner</th>
                <th>Created</th>
                ${authenticated ? '<th>Actions</th>' : ''}
              </tr>
            </thead>
            <tbody class="divide-y">${rows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2)">No tenants registered.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="card mt-4" style="background:var(--bg2)">
        <div class="card-body">
          <h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Isolation Proof</h3>
          <p style="font-size:12px;color:var(--text2)">
            Tenant isolation is enforced at the repo layer. Each tenant's data is filtered by <code>tenant_id</code>.
            Cross-tenant reads return empty results. Default tenant holds all P0–P4 backward-compatible data.
            Slug <code>default</code> cannot be deleted or suspended.
          </p>
        </div>
      </div>`

    return c.html(layout('Tenant Provisioning', body, '/tenants', unreadAlerts))
  })

  // GET /tenants/new — Registration form
  app.get('/new', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    const unreadAlerts = await repo.getUnreadAlertCount()

    if (!authenticated) {
      return c.html(layout('Tenant Provisioning', `
        <div class="card border-red-200 bg-red-50">
          <div class="card-body">
            <h2 class="text-red-700">Authentication Required</h2>
            <p>You must be authenticated to register a tenant.</p>
            <a href="/auth/login" class="btn btn-primary mt-4">Login</a>
          </div>
        </div>`, '/tenants', unreadAlerts), 401)
    }

    const body = `
      <div class="page-header">
        <h1 class="page-title">Register New Tenant</h1>
      </div>
      <div class="card">
        <div class="card-body">
          <form method="POST" action="/tenants">
            <div class="form-group">
              <label class="form-label">Tenant Name *</label>
              <input class="form-input" name="name" required placeholder="e.g. BarberKas">
            </div>
            <div class="form-group">
              <label class="form-label">Slug (URL-safe) *</label>
              <input class="form-input" name="slug" required placeholder="e.g. barberkas" pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only">
              <span class="form-hint">Used in X-Tenant-Slug header and API routing</span>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-input" name="description" rows="2" placeholder="Brief description"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Owner Name *</label>
              <input class="form-input" name="owner_name" required placeholder="e.g. Architect">
            </div>
            <div class="form-group">
              <label class="form-label">Owner Email *</label>
              <input class="form-input" name="owner_email" type="email" required placeholder="e.g. owner@company.com">
            </div>
            <div class="form-group">
              <label class="form-label">Plan</label>
              <select class="form-input" name="plan">
                <option value="standard">Standard</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Isolation Mode</label>
              <select class="form-input" name="isolation_mode">
                <option value="shared">Shared (lower isolation, lower cost)</option>
                <option value="isolated">Isolated (strict per-tenant separation)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea class="form-input" name="notes" rows="2"></textarea>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
              <button type="submit" class="btn btn-primary">Register Tenant (Pending Approval)</button>
              <a href="/tenants" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>
      </div>`

    return c.html(layout('Register Tenant', body, '/tenants', unreadAlerts))
  })

  // POST /tenants — Register new tenant
  app.post('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const body = await c.req.parseBody()
    const name = String(body['name'] || '').trim()
    const slug = String(body['slug'] || '').toLowerCase().replace(/[^a-z0-9-]/g, '').trim()
    const description = String(body['description'] || '').trim()
    const owner_name = String(body['owner_name'] || '').trim()
    const owner_email = String(body['owner_email'] || '').trim()
    const plan = (body['plan'] === 'enterprise' ? 'enterprise' : 'standard') as 'standard' | 'enterprise'
    const isolation_mode = (body['isolation_mode'] === 'isolated' ? 'isolated' : 'shared') as 'shared' | 'isolated'
    const notes = String(body['notes'] || '').trim()

    if (!name || !slug || !owner_name || !owner_email) {
      return c.json({ error: 'name, slug, owner_name, owner_email are required' }, 400)
    }
    if (slug === 'default') {
      return c.json({ error: 'Slug "default" is reserved' }, 400)
    }

    // Check slug uniqueness
    const existing = await repo.getTenantBySlug(slug)
    if (existing) return c.json({ error: 'Slug already taken' }, 409)

    const tenant = await repo.createTenant({
      slug, name, description, status: 'active',
      approval_status: 'pending', approved_by: null,
      approval_tier: 2, plan, owner_email, owner_name,
      isolation_mode, notes
    })

    // Emit alert for pending approval
    await repo.createAlert({
      alert_type: 'lane_registered',
      title: `New Tenant Registration Pending: ${name}`,
      message: `Tenant "${name}" (slug: ${slug}) registered and awaiting Tier 2 approval.`,
      severity: 'info',
      object_type: 'tenants',
      object_id: tenant.id,
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    } as Parameters<typeof repo.createAlert>[0])

    return c.redirect('/tenants')
  })

  // POST /tenants/:id/approve — Approve tenant
  app.post('/:id/approve', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const id = c.req.param('id')
    const tenant = await repo.getTenant(id)
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
    if (tenant.slug === 'default') return c.json({ error: 'Cannot modify default tenant' }, 403)

    await repo.updateTenant(id, { approval_status: 'approved', approved_by: 'Architect' })
    return c.redirect('/tenants')
  })

  // POST /tenants/:id/suspend — Suspend tenant
  app.post('/:id/suspend', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const id = c.req.param('id')
    const tenant = await repo.getTenant(id)
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
    if (tenant.slug === 'default') return c.json({ error: 'Cannot suspend default tenant' }, 403)

    await repo.updateTenant(id, { status: 'suspended' })
    return c.redirect('/tenants')
  })

  // GET /tenants/:id — Tenant detail
  app.get('/:id', async (c) => {
    const repo = createRepo(c.env.DB)
    const unreadAlerts = await repo.getUnreadAlertCount()
    const id = c.req.param('id')
    const tenant = await repo.getTenant(id)
    if (!tenant) {
      return c.html(layout('Tenant Not Found', `
        <div class="card"><div class="card-body">
          <h2>Tenant not found</h2>
          <a href="/tenants" class="btn btn-secondary mt-4">Back to Tenants</a>
        </div></div>`, '/tenants', unreadAlerts), 404)
    }

    const body = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${escHtml(tenant.name)}</h1>
          <p class="page-subtitle">slug: <code>${escHtml(tenant.slug)}</code> &middot; ID: <code>${tenant.id}</code></p>
        </div>
        <a href="/tenants" class="btn btn-secondary">Back</a>
      </div>
      <div class="card">
        <div class="card-body">
          <table class="table">
            <tr><th>Status</th><td>${badgeStatus(tenant.status)}</td></tr>
            <tr><th>Approval</th><td><span class="badge ${tenant.approval_status === 'approved' ? 'badge-green' : 'badge-yellow'}">${tenant.approval_status}</span></td></tr>
            <tr><th>Plan</th><td>${tenant.plan}</td></tr>
            <tr><th>Isolation</th><td>${tenant.isolation_mode}</td></tr>
            <tr><th>Owner</th><td>${escHtml(tenant.owner_name)} (${escHtml(tenant.owner_email)})</td></tr>
            <tr><th>Approval Tier</th><td>Tier ${tenant.approval_tier}</td></tr>
            <tr><th>Notes</th><td>${escHtml(tenant.notes)}</td></tr>
            <tr><th>Created</th><td>${tenant.created_at}</td></tr>
          </table>
        </div>
      </div>`

    return c.html(layout(`Tenant: ${tenant.name}`, body, '/tenants', unreadAlerts))
  })

  return app
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
