// ============================================================
// SOVEREIGN OS PLATFORM — POLICIES SURFACE (P10)
// Purpose: ABAC policy editor — view, create, toggle policies
// Surface: /policies
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'
import {
  getAllPolicies, createPolicy, updatePolicyStatus, deletePolicy,
  SUBJECT_TYPE_OPTIONS, RESOURCE_TYPE_OPTIONS, ACTION_OPTIONS_ABAC,
  type Policy
} from '../lib/abacService'

function effectBadge(effect: 'allow' | 'deny'): string {
  return effect === 'allow'
    ? `<span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3)">ALLOW</span>`
    : `<span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3)">DENY</span>`
}

function statusBadge(status: string): string {
  return status === 'active'
    ? `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.2)">Active</span>`
    : `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:rgba(107,114,128,0.08);color:#6b7280;border:1px solid rgba(107,114,128,0.2)">Inactive</span>`
}

export function createPoliciesRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /policies
  route.get('/', async (c) => {
    const policies = c.env.DB ? await getAllPolicies(c.env.DB) : []

    const rows = policies.map(p => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px;font-size:12px;color:var(--text);font-weight:500">${p.name}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${p.subject_type}: <span style="color:var(--accent)">${p.subject_value}</span></td>
        <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:var(--text2)">${p.resource_type}</td>
        <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:var(--text2)">${p.action}</td>
        <td style="padding:10px 12px">${effectBadge(p.effect)}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${p.priority}</td>
        <td style="padding:10px 12px">${statusBadge(p.status)}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${p.created_by}</td>
        <td style="padding:10px 12px">
          <div style="display:flex;gap:8px;align-items:center">
            <form action="/policies/${p.id}/toggle" method="POST" style="display:inline">
              <button type="submit" style="background:${p.status === 'active' ? 'rgba(107,114,128,0.15)' : 'rgba(34,197,94,0.15)'};color:${p.status === 'active' ? '#9aa3b2' : '#22c55e'};border:none;border-radius:4px;padding:4px 10px;font-size:10px;cursor:pointer;font-weight:600">
                ${p.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </form>
            <form action="/policies/${p.id}/delete" method="POST" style="display:inline" onsubmit="return confirm('Delete policy ${p.name}?')">
              <button type="submit" style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;border-radius:4px;padding:4px 10px;font-size:10px;cursor:pointer;font-weight:600">Delete</button>
            </form>
          </div>
        </td>
      </tr>
    `).join('')

    const content = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">ABAC Policy Editor</h1>
          <div style="font-size:12px;color:var(--text2)">P10 — Attribute-Based Access Control · ${policies.length} policies · <span style="color:#22c55e">${policies.filter(p => p.status === 'active').length} active</span></div>
        </div>
        <div style="display:flex;gap:8px">
          <a href="/api/v2/docs" target="_blank" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:11px;text-decoration:none">API v2 Docs →</a>
        </div>
      </div>

      <!-- Policy Summary Badges -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
        ${[
          { label: 'Total Policies', val: policies.length, color: '#4f8ef7' },
          { label: 'Active', val: policies.filter(p => p.status === 'active').length, color: '#22c55e' },
          { label: 'Allow Rules', val: policies.filter(p => p.effect === 'allow').length, color: '#22d3ee' },
          { label: 'Deny Rules', val: policies.filter(p => p.effect === 'deny').length, color: '#ef4444' },
        ].map(s => `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${s.label}</div>
            <div style="font-size:26px;font-weight:700;color:${s.color}">${s.val}</div>
          </div>
        `).join('')}
      </div>

      <!-- Policy Table -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--bg3)">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Name</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Subject</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Resource</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Action</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Effect</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Priority</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Status</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Created By</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="9" style="padding:24px;text-align:center;color:var(--text3);font-size:12px">No policies defined yet.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Create Policy Form -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
        <h2 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:16px">Create New Policy</h2>
        <form action="/policies/create" method="POST">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Policy Name *</label>
              <input name="name" required placeholder="e.g. Admin Full Access" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Description</label>
              <input name="description" placeholder="Optional description" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Subject Type *</label>
              <select name="subject_type" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${SUBJECT_TYPE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Subject Value *</label>
              <input name="subject_value" required placeholder="admin / viewer / tenant-a" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Resource Type *</label>
              <select name="resource_type" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${RESOURCE_TYPE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Action *</label>
              <select name="action" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${ACTION_OPTIONS_ABAC.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Effect *</label>
              <select name="effect" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:160px 1fr;gap:16px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Priority (lower = higher)</label>
              <input name="priority" type="number" value="100" min="1" max="999" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
            <div style="display:flex;align-items:flex-end">
              <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer">Create Policy</button>
            </div>
          </div>
        </form>
      </div>

      <!-- ABAC Info -->
      <div style="margin-top:16px;padding:12px 16px;background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
        <span style="color:#f97316;font-weight:600">P10 ABAC:</span>
        Policies are evaluated by priority (lowest number wins). At equal priority, DENY beats ALLOW.
        Wildcard <code>*</code> matches all values. Default behavior when no policy matches: <strong>allow</strong> (governance-first, not deny-all).
        AI-generated policy suggestions are tagged and require human confirmation before activation.
      </div>
    `
    return c.html(layout('ABAC Policies', content, '/policies'))
  })

  // POST /policies/create
  route.post('/create', async (c) => {
    if (!c.env.DB) return c.redirect('/policies')
    const body = await c.req.parseBody()
    await createPolicy(c.env.DB, {
      name: body['name'] as string,
      description: body['description'] as string || undefined,
      subject_type: (body['subject_type'] as Policy['subject_type']) || 'role',
      subject_value: body['subject_value'] as string,
      resource_type: body['resource_type'] as string,
      action: body['action'] as string,
      effect: (body['effect'] as 'allow' | 'deny') || 'allow',
      priority: parseInt(body['priority'] as string || '100', 10),
      created_by: 'ui',
    })
    return c.redirect('/policies')
  })

  // POST /policies/:id/toggle
  route.post('/:id/toggle', async (c) => {
    if (!c.env.DB) return c.redirect('/policies')
    const existing = await c.env.DB.prepare(`SELECT status FROM policies WHERE id = ?`).bind(c.req.param('id')).first() as { status: string } | null
    const newStatus = existing?.status === 'active' ? 'inactive' : 'active'
    await updatePolicyStatus(c.env.DB, c.req.param('id'), newStatus)
    return c.redirect('/policies')
  })

  // POST /policies/:id/delete
  route.post('/:id/delete', async (c) => {
    if (!c.env.DB) return c.redirect('/policies')
    await deletePolicy(c.env.DB, c.req.param('id'))
    return c.redirect('/policies')
  })

  return route
}
