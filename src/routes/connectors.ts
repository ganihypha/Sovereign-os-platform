// ============================================================
// SOVEREIGN OS PLATFORM — CONNECTOR HUB ROUTE (P3)
// Formal connector registry — all integrations must be registered
// here before use. Approval-aware, risk-classified, lane-separated.
// No ad-hoc integration sprawl.
// ============================================================
import { Hono } from 'hono'
import { layout, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import { buildRoleContext, roleBadge } from '../lib/roles'
import type { Env } from '../index'

const APPROVAL_BADGE: Record<string, string> = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
}

const STATUS_BADGE: Record<string, string> = {
  registered: 'badge-blue',
  active: 'badge-green',
  inactive: 'badge-grey',
  deprecated: 'badge-grey',
  blocked: 'badge-red',
}

const RISK_BADGE: Record<string, string> = {
  low: 'badge-green',
  medium: 'badge-yellow',
  high: 'badge-orange',
  critical: 'badge-red',
}

const TYPE_ICON: Record<string, string> = {
  webhook: '⚡',
  api: '⊞',
  queue: '⊟',
  event: '◈',
  custom: '◉',
}

export function createConnectorsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ---- GET / — Connector Hub ----
  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)
    const roleCtx = buildRoleContext(isAuth)

    const connectors = await repo.getConnectors()

    const active = connectors.filter(c => c.status === 'active')
    const pending = connectors.filter(c => c.approval_status === 'pending')
    const blocked = connectors.filter(c => c.status === 'blocked')
    const highRisk = connectors.filter(c => c.risk_level === 'high' || c.risk_level === 'critical')

    const statsHtml = `
      <div class="grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-label">Active</div>
          <div class="stat-value" style="color:var(--green)">${active.length}</div>
          <div class="stat-sub">operational connectors</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending Approval</div>
          <div class="stat-value" style="color:var(--yellow)">${pending.length}</div>
          <div class="stat-sub">awaiting review</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Blocked</div>
          <div class="stat-value" style="color:var(--red)">${blocked.length}</div>
          <div class="stat-sub">requires action</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">High Risk</div>
          <div class="stat-value" style="color:var(--orange)">${highRisk.length}</div>
          <div class="stat-sub">elevated risk level</div>
        </div>
      </div>`

    // Pending approval bar
    const pendingBar = pending.length > 0
      ? `<div class="blocker-bar" style="border-color:var(--yellow);color:var(--yellow);background:rgba(245,158,11,0.07)">
          ⏳ ${pending.length} connector(s) awaiting approval. No connector may become active without Architect sign-off.
         </div>`
      : ''

    // Connector cards
    const connectorCards = connectors.map(conn => `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:18px">${TYPE_ICON[conn.connector_type] || '◉'}</span>
              <strong style="font-size:14px">${conn.name}</strong>
              <span class="badge ${STATUS_BADGE[conn.status]}">${conn.status.toUpperCase()}</span>
              <span class="badge ${APPROVAL_BADGE[conn.approval_status]}">${conn.approval_status.toUpperCase()}</span>
              <span class="badge ${RISK_BADGE[conn.risk_level]}">${conn.risk_level.toUpperCase()} RISK</span>
            </div>
            <div style="margin-top:6px;font-size:12px;color:var(--text2)">${conn.description}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--text3)">
            <div>${conn.connector_type.toUpperCase()}</div>
            <div>Lane: <span style="color:var(--text2)">${conn.lane}</span></div>
            <div>Owner: <span style="color:var(--text2)">${conn.owner_role}</span></div>
            ${conn.approved_by ? `<div>Approved: <span style="color:var(--green)">${conn.approved_by}</span></div>` : ''}
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap">
          <div style="font-size:11px;color:var(--text3)">
            <span style="color:var(--text2)">Endpoint:</span>
            <span class="mono" style="color:var(--accent);font-size:11px">${conn.endpoint_hint}</span>
          </div>
          <div style="font-size:11px;color:var(--text3)">
            Events: <span style="color:var(--text2)">${conn.event_count}</span>
          </div>
          ${conn.last_event_at ? `<div style="font-size:11px;color:var(--text3)">Last: <span style="color:var(--text2)">${timeAgo(conn.last_event_at)}</span></div>` : ''}
          <div style="font-size:11px;color:var(--text3)">ID: <span class="mono">${conn.id}</span></div>
        </div>
        ${conn.notes ? `<div style="margin-top:8px;font-size:11px;color:var(--text3);font-style:italic">${conn.notes}</div>` : ''}
        ${isAuth && conn.approval_status === 'pending' ? `
          <div style="margin-top:10px;display:flex;gap:8px">
            <form method="POST" action="/api/connectors/${conn.id}/approve" style="display:inline">
              <input type="hidden" name="action" value="approve">
              <input type="hidden" name="approved_by" value="Architect">
              <button type="submit" class="btn btn-green btn-sm">✓ Approve</button>
            </form>
            <form method="POST" action="/api/connectors/${conn.id}/approve" style="display:inline">
              <input type="hidden" name="action" value="reject">
              <button type="submit" class="btn btn-red btn-sm">✗ Reject</button>
            </form>
          </div>` : ''}
      </div>`).join('')

    // Register form (auth only)
    const registerForm = isAuth ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Register New Connector</div>
          <span class="text-muted text-sm">All connectors must be registered and approved before use</span>
        </div>
        <div class="verified-note" style="margin-bottom:16px">
          ⚠ Governance Rule: No connector may be used before registration + approval.
          All connectors must be bounded, inspectable, and approval-aware.
        </div>
        <form method="POST" action="/api/connectors">
          <div class="grid-2">
            <div class="form-group">
              <label>Connector Name * (unique slug)</label>
              <input name="name" placeholder="e.g. slack-notify, github-webhook" required>
            </div>
            <div class="form-group">
              <label>Type</label>
              <select name="connector_type">
                <option value="api">API</option>
                <option value="webhook">Webhook</option>
                <option value="queue">Queue</option>
                <option value="event">Event</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div class="form-group">
              <label>Risk Level</label>
              <select name="risk_level">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div class="form-group">
              <label>Lane</label>
              <select name="lane">
                <option value="ops">ops</option>
                <option value="governance">governance</option>
                <option value="execution">execution</option>
                <option value="product-lane">product-lane</option>
              </select>
            </div>
            <div class="form-group">
              <label>Owner Role</label>
              <select name="owner_role">
                <option value="orchestrator">orchestrator</option>
                <option value="architect">architect</option>
                <option value="executor">executor</option>
                <option value="founder">founder</option>
              </select>
            </div>
            <div class="form-group">
              <label>Endpoint Hint (sanitized — no secrets)</label>
              <input name="endpoint_hint" placeholder="e.g. api.example.com/v1/hook — no keys/tokens">
            </div>
          </div>
          <div class="form-group">
            <label>Description *</label>
            <textarea name="description" rows="2" placeholder="What does this connector do? What system does it integrate?" required></textarea>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea name="notes" rows="2" placeholder="Governance notes, constraints, usage rules..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">+ Register Connector</button>
        </form>
      </div>` : `
      <div class="card">
        <div style="text-align:center;padding:20px">
          <div class="text-muted text-sm">Authenticate to register connectors</div>
          <a href="/auth/login" class="btn btn-primary mt-4" style="display:inline-flex">Authenticate →</a>
        </div>
      </div>`

    // Lane separation view
    const laneGroups: Record<string, typeof connectors> = {}
    connectors.forEach(c => {
      if (!laneGroups[c.lane]) laneGroups[c.lane] = []
      laneGroups[c.lane].push(c)
    })
    const laneRows = Object.entries(laneGroups).map(([lane, items]) => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:11px;font-weight:700;color:var(--text3);min-width:120px;text-transform:uppercase">${lane}</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${items.map(c => `<span class="tag" style="font-size:11px">${c.name} <span class="badge ${STATUS_BADGE[c.status]}" style="font-size:10px">${c.status}</span></span>`).join('')}
          </div>
        </div>
      </div>`).join('')

    const content = `
      <div class="law-bar">Connector Hub — Governed Integration Registry | All integrations must be registered, bounded, inspectable, and approval-aware</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">
        <span style="font-size:12px;color:var(--text2)">Phase:</span>
        <span class="badge badge-purple">P3 — Connector Hub</span>
        <span style="font-size:12px;color:var(--text2);margin-left:8px">Role:</span> ${roleBadge(roleCtx)}
        <span style="font-size:12px;color:var(--text2);margin-left:8px">Total: ${connectors.length} registered</span>
      </div>
      ${pendingBar}
      ${statsHtml}
      <div class="card">
        <div class="card-header">
          <div class="card-title">Lane Separation View</div>
          <span class="text-muted text-sm">Governance Lane must not collapse into Product Lane</span>
        </div>
        ${laneRows || '<p class="text-muted text-sm">No connectors registered</p>'}
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Connector Registry</div>
          <span class="text-muted text-sm">${connectors.length} connector(s)</span>
        </div>
        ${connectorCards || '<p class="text-muted text-sm">No connectors registered</p>'}
      </div>
      ${registerForm}`

    return c.html(layout('Connector Hub', content, '/connectors'))
  })

  return route
}
