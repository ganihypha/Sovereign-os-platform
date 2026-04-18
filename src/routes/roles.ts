// ============================================================
// SOVEREIGN OS PLATFORM — ROLE REGISTRY SURFACE (P3)
// Role-based access registry. View and manage role assignments.
// Auth: GET = authenticated only (role data is sensitive)
//       POST = requires auth (assign/revoke role keys)
// Law: No role collapse. Roles are strictly separate.
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { layout } from '../layout'
import { isAuthenticated } from '../lib/auth'
import {
  ROLE_META,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_HIERARCHY,
  buildRoleContext,
  roleBadge
} from '../lib/roles'
import type { PlatformRole } from '../types'

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function createRolesRoute() {
  const app = new Hono<{ Bindings: Env }>()

  // GET /roles — Role Registry
  app.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)

    const unreadAlerts = await repo.getUnreadAlertCount()

    // Role hierarchy display — always visible (no sensitive data)
    const roleCards = ROLE_HIERARCHY.slice().reverse().map(role => {
      const meta = ROLE_META[role]
      const perms = ROLE_DEFAULT_PERMISSIONS[role]
      const colorHex = meta.color
      return `
        <div class="card" style="border-left:3px solid ${colorHex}">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              <span style="background:${colorHex}26;color:${colorHex};border:1px solid ${colorHex}40;border-radius:4px;padding:3px 10px;font-size:12px;font-weight:700">${role.toUpperCase()}</span>
              <span style="color:var(--text2);font-size:12px">${meta.layer}</span>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:8px"><strong style="color:var(--text)">${perms.length} permissions</strong></div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${perms.map(p => `<span style="background:var(--bg3);color:var(--text3);border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;font-family:monospace">${p}</span>`).join('')}
            </div>
          </div>
        </div>`
    }).join('')

    // Role assignments table (requires auth to view)
    let assignmentsHtml = ''
    if (authenticated) {
      const assignments = await repo.getRoleAssignments()
      const rows = assignments.map(a => {
        const meta = ROLE_META[a.role as PlatformRole]
        return `
          <tr>
            <td>
              <span style="background:${meta.color}26;color:${meta.color};border:1px solid ${meta.color}40;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${a.role.toUpperCase()}</span>
            </td>
            <td><strong>${escHtml(a.label)}</strong></td>
            <td><span style="font-size:11px;color:var(--text3);font-family:monospace">${a.key_hash.slice(0, 12)}…</span></td>
            <td>${a.active ? '<span class="badge badge-green">active</span>' : '<span class="badge badge-red">inactive</span>'}</td>
            <td style="font-size:11px;color:var(--text2)">${a.last_used_at ? a.last_used_at.slice(0, 16) : 'never'}</td>
            <td style="font-size:11px;color:var(--text2)">${a.created_at.slice(0, 10)}</td>
          </tr>`
      }).join('')

      assignmentsHtml = `
        <div class="card mt-4">
          <div class="card-header">
            <h2 class="card-title">Role Assignments</h2>
            <span class="badge badge-blue">${assignments.length} assigned</span>
          </div>
          ${assignments.length > 0 ? `
          <div class="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Label</th>
                  <th>Key Hash (prefix)</th>
                  <th>Status</th>
                  <th>Last Used</th>
                  <th>Assigned</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>` : `
          <div class="card-body">
            <p style="color:var(--text2);font-size:13px">No role assignments configured yet.</p>
            <p style="color:var(--text3);font-size:12px;margin-top:8px">
              In single-key auth mode, all authenticated requests default to 'operator' role.
              Add role assignments via API: <code>POST /api/role-assignments</code>
            </p>
          </div>`}
        </div>`

      // Register new role key form
      assignmentsHtml += `
        <div class="card mt-4">
          <div class="card-header">
            <h2 class="card-title">Register Role Key</h2>
            <span class="badge badge-yellow">Tier 2 — Sensitive</span>
          </div>
          <div class="card-body">
            <p style="color:var(--text2);font-size:13px;margin-bottom:16px">
              Assign a separate API key to a role. Key hash is stored — raw key is your responsibility.
              No role collapse allowed: each role must have a distinct key.
            </p>
            <form method="POST" action="/roles/assign">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Role *</label>
                  <select name="role" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:13px">
                    ${ROLE_HIERARCHY.slice().reverse().filter(r => r !== 'operator').map(r =>
                      `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`
                    ).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Label *</label>
                  <input type="text" name="label" placeholder="e.g. Architect Key 1"
                    style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:13px" required>
                </div>
              </div>
              <div style="margin-top:12px">
                <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Raw API Key * (will be hashed — not stored raw)</label>
                <input type="password" name="raw_key" placeholder="Enter the key value to register"
                  style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:13px;font-family:monospace" required>
              </div>
              <div style="margin-top:12px">
                <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Permissions override (JSON array, optional)</label>
                <input type="text" name="permissions" placeholder='["view_all","create_proof"]'
                  style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:13px;font-family:monospace">
              </div>
              <button type="submit" class="btn btn-primary" style="margin-top:16px">Register Role Key</button>
            </form>
          </div>
        </div>`
    } else {
      assignmentsHtml = `
        <div class="card mt-4">
          <div class="card-body" style="text-align:center;padding:40px">
            <p style="color:var(--text2);margin-bottom:16px">Authentication required to view role assignments and register keys.</p>
            <a href="/auth/login" class="btn btn-primary">Login to View Role Registry</a>
          </div>
        </div>`
    }

    const governanceLawHtml = `
      <div class="card mb-4" style="border-left:3px solid var(--accent)">
        <div class="card-body">
          <strong style="color:var(--accent)">LAW 1 — NO ROLE COLLAPSE</strong><br>
          <span style="font-size:12px;color:var(--text2)">
            Roles Founder, Architect, Orchestrator, Executor, and Reviewer are strictly separate at all times.
            The same operator may not act as both Executor and Reviewer on the same artifact.
            Cross-role mutations are blocked at the API layer.
          </span>
        </div>
      </div>`

    const body = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Role Registry</h1>
          <p class="page-subtitle">Platform role model and key assignments. Governance layer: no role collapse.</p>
        </div>
      </div>

      ${governanceLawHtml}

      <div class="card mb-4">
        <div class="card-header">
          <h2 class="card-title">Role Hierarchy (highest authority → lowest)</h2>
          <span class="badge badge-blue">${ROLE_HIERARCHY.length} roles</span>
        </div>
        <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          ${roleCards}
        </div>
      </div>

      ${assignmentsHtml}
    `

    return c.html(layout('Role Registry', body, '/roles', unreadAlerts))
  })

  // POST /roles/assign — Register a new role key assignment
  app.post('/assign', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) {
      return c.json({ error: 'AUTH_REQUIRED', message: 'Authentication required to assign role keys.' }, 401)
    }

    const body = await c.req.parseBody()
    const role = String(body.role || '').trim() as PlatformRole
    const label = String(body.label || '').trim()
    const rawKey = String(body.raw_key || '').trim()
    const permissionsStr = String(body.permissions || '').trim()

    if (!role || !ROLE_HIERARCHY.includes(role)) {
      return c.html(layout('Role Registry', `
        <div class="card">
          <div class="card-body">
            <p style="color:var(--danger)">Invalid role specified.</p>
            <a href="/roles" class="btn btn-primary" style="margin-top:12px">← Back to Roles</a>
          </div>
        </div>`, '/roles'))
    }
    if (!label) {
      return c.html(layout('Role Registry', `
        <div class="card">
          <div class="card-body">
            <p style="color:var(--danger)">Label is required.</p>
            <a href="/roles" class="btn btn-primary" style="margin-top:12px">← Back to Roles</a>
          </div>
        </div>`, '/roles'))
    }
    if (!rawKey || rawKey.length < 8) {
      return c.html(layout('Role Registry', `
        <div class="card">
          <div class="card-body">
            <p style="color:var(--danger)">Key must be at least 8 characters.</p>
            <a href="/roles" class="btn btn-primary" style="margin-top:12px">← Back to Roles</a>
          </div>
        </div>`, '/roles'))
    }

    // Hash the raw key
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    let permissions = ROLE_DEFAULT_PERMISSIONS[role]
    if (permissionsStr) {
      try {
        const parsed = JSON.parse(permissionsStr)
        if (Array.isArray(parsed)) permissions = parsed.map(String)
      } catch { /* use defaults */ }
    }

    await repo.createRoleAssignment({
      role,
      label,
      key_hash: keyHash,
      active: true,
      permissions,
      last_used_at: null,
    })

    return c.redirect('/roles?assigned=1')
  })

  return app
}
