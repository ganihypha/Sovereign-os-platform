// ============================================================
// SOVEREIGN OS PLATFORM — PRODUCT LANE DIRECTORY (P4)
// Governs all product lanes operating under platform.
// Lane registration requires Tier 2 approval.
// Executors cannot register/modify lanes.
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import { alertLaneRegistered } from '../lib/alertSystem'
import type { Env } from '../index'
import type { ProductLane, LaneType } from '../types'

const LANE_TYPE_BADGE: Record<string, string> = {
  'governance-core': '<span style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">GOVERNANCE-CORE</span>',
  'product-vertical': '<span style="background:rgba(79,142,247,0.15);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">PRODUCT-VERTICAL</span>',
  'runtime-service': '<span style="background:rgba(34,211,238,0.15);color:#22d3ee;border:1px solid rgba(34,211,238,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">RUNTIME-SERVICE</span>',
  'experiment': '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">EXPERIMENT</span>',
}

const STATUS_BADGE: Record<string, string> = {
  active: '<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">ACTIVE</span>',
  inactive: '<span style="background:rgba(90,100,120,0.15);color:#9aa3b2;border:1px solid rgba(90,100,120,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">INACTIVE</span>',
  archived: '<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">ARCHIVED</span>',
}

const APPROVAL_BADGE: Record<string, string> = {
  pending: '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">PENDING APPROVAL</span>',
  approved: '<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">APPROVED</span>',
  rejected: '<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">REJECTED</span>',
}

function laneCard(lane: ProductLane, isAuth: boolean): string {
  return `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">${lane.name}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${LANE_TYPE_BADGE[lane.lane_type] ?? ''}
          ${STATUS_BADGE[lane.status] ?? ''}
          ${APPROVAL_BADGE[lane.approval_status] ?? ''}
          <span style="background:rgba(90,100,120,0.1);color:var(--text3);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600">Tier ${lane.governance_tier}</span>
        </div>
      </div>
      ${isAuth && lane.lane_type !== 'governance-core' ? `
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${lane.status === 'active' ? `
        <form method="POST" action="/lanes/${lane.id}/status">
          <input type="hidden" name="status" value="inactive">
          <button style="background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer">Deactivate</button>
        </form>` : `
        <form method="POST" action="/lanes/${lane.id}/status">
          <input type="hidden" name="status" value="active">
          <button style="background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer">Activate</button>
        </form>`}
        ${lane.approval_status === 'pending' ? `
        <form method="POST" action="/lanes/${lane.id}/approve">
          <button style="background:rgba(79,142,247,0.1);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3);border-radius:6px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer">Approve</button>
        </form>` : ''}
      </div>` : ''}
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5">${lane.description || 'No description.'}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;font-size:11px;color:var(--text3)">
      <div><span style="color:var(--text2)">Owner:</span> ${lane.owner} (${lane.owner_role})</div>
      ${lane.repo_link ? `<div><span style="color:var(--text2)">Repo:</span> <a href="${lane.repo_link}" target="_blank" style="color:var(--accent)">${lane.repo_link.replace('https://','')}</a></div>` : ''}
      ${lane.approved_by ? `<div><span style="color:var(--text2)">Approved by:</span> ${lane.approved_by}</div>` : ''}
      <div><span style="color:var(--text2)">Registered:</span> ${new Date(lane.created_at).toLocaleDateString()}</div>
    </div>
    ${lane.notes ? `<div style="margin-top:10px;font-size:11px;color:var(--text3);padding-top:10px;border-top:1px solid var(--border)">${lane.notes}</div>` : ''}
  </div>`
}

export function createLanesRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)
    const lanes = await repo.getProductLanes()

    const activeLanes = lanes.filter(l => l.status === 'active')
    const pendingLanes = lanes.filter(l => l.approval_status === 'pending')

    const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Lane Directory</h1>
        <div style="font-size:12px;color:var(--text2)">${activeLanes.length} active · ${lanes.length} total registered · ${pendingLanes.length} awaiting approval</div>
      </div>
      ${isAuth ? `
      <button onclick="document.getElementById('register-form').style.display=document.getElementById('register-form').style.display==='none'?'block':'none'" 
        style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer">
        + Register Lane
      </button>` : ''}
    </div>

    ${isAuth ? `
    <div id="register-form" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:24px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:16px">Register New Lane</div>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:6px;padding:12px;margin-bottom:16px;font-size:12px;color:var(--text2)">
        ⚠ Lane registration requires Tier 2 approval. The lane will be in <strong>pending</strong> status until an Architect or Founder approves.
      </div>
      <form method="POST" action="/lanes">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px">Lane Name *</label>
            <input type="text" name="name" required style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:10px;font-size:13px" placeholder="e.g. BarberKas">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px">Lane Type *</label>
            <select name="lane_type" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:10px;font-size:13px">
              <option value="product-vertical">Product Vertical</option>
              <option value="runtime-service">Runtime Service</option>
              <option value="experiment">Experiment</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px">Owner</label>
            <input type="text" name="owner" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:10px;font-size:13px" placeholder="Architect">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px">Repo Link</label>
            <input type="text" name="repo_link" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:10px;font-size:13px" placeholder="https://github.com/...">
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px">Description</label>
          <textarea name="description" rows="2" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:10px;font-size:13px;font-family:inherit;resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" onclick="document.getElementById('register-form').style.display='none'" style="background:var(--bg);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:10px 20px;font-size:13px;cursor:pointer">Cancel</button>
          <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer">Register Lane (Tier 2)</button>
        </div>
      </form>
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:12px">
      ${lanes.length === 0
        ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:32px;text-align:center;color:var(--text2)">No lanes registered yet.</div>`
        : lanes.map(l => laneCard(l, isAuth)).join('')
      }
    </div>`

    return c.html(layout('Lane Directory', content, '/lanes'))
  })

  // POST register new lane
  route.post('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED' }, 401)

    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()

    const name = String(body.name ?? '').trim()
    if (!name) return c.json({ error: 'NAME_REQUIRED' }, 400)

    const laneType = String(body.lane_type ?? 'product-vertical') as LaneType
    if (laneType === 'governance-core') {
      return c.json({ error: 'FORBIDDEN', message: 'Cannot register governance-core lanes manually.' }, 403)
    }

    const lane = await repo.createProductLane({
      name,
      lane_type: laneType,
      description: String(body.description ?? ''),
      repo_link: String(body.repo_link ?? ''),
      owner: String(body.owner ?? 'Architect'),
      owner_role: 'architect',
      governance_tier: 2,
      status: 'inactive',       // starts inactive until approved
      approval_status: 'pending',
      approved_by: null,
      notes: 'Registered via platform UI. Awaiting Tier 2 approval.',
    })

    // Emit alert for lane registration
    await alertLaneRegistered(repo, lane.id, lane.name)

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('text/html')) return c.redirect('/lanes')
    return c.json({ success: true, lane })
  })

  // POST update lane status
  route.post('/:id/status', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED' }, 401)

    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const status = String(body.status ?? 'inactive')

    const lane = await repo.getProductLane(id)
    if (!lane) return c.json({ error: 'NOT_FOUND' }, 404)
    if (lane.lane_type === 'governance-core') {
      return c.json({ error: 'FORBIDDEN', message: 'Cannot change status of governance-core lane.' }, 403)
    }

    await repo.updateProductLane(id, { status: status as ProductLane['status'] })

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('text/html')) return c.redirect('/lanes')
    return c.json({ success: true, id, status })
  })

  // POST approve lane
  route.post('/:id/approve', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED' }, 401)

    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')

    await repo.updateProductLane(id, {
      approval_status: 'approved',
      approved_by: 'operator',
      status: 'active',
    })

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('text/html')) return c.redirect('/lanes')
    return c.json({ success: true, id, approval_status: 'approved' })
  })

  return route
}
