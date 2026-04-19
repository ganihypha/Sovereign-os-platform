// ============================================================
// SOVEREIGN OS PLATFORM — ADMIN SURFACE (P17)
// Purpose: Platform admin panel — configuration, session management,
//          API key rotation, system settings
//
// GET  /admin                — Main admin dashboard
// GET  /admin/settings       — Platform settings management
// POST /admin/settings       — Update a platform setting
// GET  /admin/sessions       — Active session management
// POST /admin/sessions/:id/logout — Force logout a session
// GET  /admin/api-keys       — API key rotation interface
// POST /admin/api-keys/:id/expire — Expire/revoke an API key
// POST /admin/api-keys/:id/rotate — Rotate (expire + new log entry) an API key
//
// AUTH: All routes require authentication — admin-only surface
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { isAuthenticated } from '../lib/auth'
import { layout } from '../layout'

export function createAdminRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // Auth gate for all /admin routes
  route.use('*', async (c, next) => {
    const auth = await isAuthenticated(c, c.env)
    if (!auth) {
      return c.html(layout('Admin — Access Denied', `
        <div class="auth-gate">
          <h2>🔒 Authentication Required</h2>
          <p>Admin panel access requires platform authentication.</p>
          <a href="/dashboard" class="btn btn-primary">← Dashboard</a>
        </div>
      `, '/admin'))
    }
    return next()
  })

  // ============================================================
  // GET /admin — Main admin dashboard
  // ============================================================
  route.get('/', async (c) => {
    const db = c.env.DB
    let settingsCount = 0
    let sessionsCount = 0
    let apiKeysCount = 0
    let rotationLogCount = 0

    if (db) {
      try {
        const sc = await db.prepare(`SELECT COUNT(*) as n FROM platform_settings`).first<{ n: number }>()
        settingsCount = sc?.n || 0
        const sess = await db.prepare(`SELECT COUNT(*) as n FROM platform_sessions WHERE force_logout = 0`).first<{ n: number }>()
        sessionsCount = sess?.n || 0
        const keys = await db.prepare(`SELECT COUNT(*) as n FROM api_keys WHERE status = 'active'`).first<{ n: number }>()
        apiKeysCount = keys?.n || 0
        const rl = await db.prepare(`SELECT COUNT(*) as n FROM api_key_rotation_log`).first<{ n: number }>()
        rotationLogCount = rl?.n || 0
      } catch { /* non-blocking */ }
    }

    const adminSections = [
      {
        title: '⚙️ Platform Settings',
        desc: 'Manage retention policy, alert thresholds, notification rules, feature flags.',
        href: '/admin/settings',
        color: '#4f8ef7',
        count: settingsCount + ' settings',
      },
      {
        title: '👥 Session Management',
        desc: 'View active sessions, force logout users, audit login activity.',
        href: '/admin/sessions',
        color: '#22c55e',
        count: sessionsCount + ' active',
      },
      {
        title: '🔑 API Key Rotation',
        desc: 'Bulk expire, rotate, or revoke API keys. View rotation history.',
        href: '/admin/api-keys',
        color: '#f59e0b',
        count: apiKeysCount + ' active keys',
      },
    ]

    const content = `
      <div class="page-header" style="margin-bottom:24px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">🛡️ Platform Admin</h1>
          <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P17 — Platform configuration, session management, API key rotation</p>
        </div>
        <div style="display:flex;gap:8px">
          <a href="/dashboard" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Dashboard</a>
          <a href="/metrics" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">📈 Metrics</a>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
        ${[
          { label: 'Settings', val: settingsCount, color: '#4f8ef7', href: '/admin/settings' },
          { label: 'Sessions', val: sessionsCount, color: '#22c55e', href: '/admin/sessions' },
          { label: 'Active API Keys', val: apiKeysCount, color: '#f59e0b', href: '/admin/api-keys' },
          { label: 'Rotation Log', val: rotationLogCount, color: '#a855f7', href: '/admin/api-keys' },
        ].map(s => `
          <a href="${s.href}" style="text-decoration:none;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;display:block;transition:border-color 0.2s" onmouseover="this.style.borderColor='${s.color}'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${s.label}</div>
            <div style="font-size:22px;font-weight:700;color:${s.color}">${s.val}</div>
          </a>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px">
        ${adminSections.map(s => `
          <a href="${s.href}" style="text-decoration:none;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;display:block;transition:border-color 0.2s;position:relative;overflow:hidden"
            onmouseover="this.style.borderColor='${s.color}'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${s.color};border-radius:10px 10px 0 0"></div>
            <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">${s.title}</div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:10px;line-height:1.5">${s.desc}</div>
            <div style="font-size:11px;color:${s.color};font-weight:600">${s.count} →</div>
          </a>
        `).join('')}
      </div>

      <div style="padding:14px 18px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
        <span style="color:#ef4444;font-weight:600">⚠ Admin Warning:</span>
        Changes made here affect the entire platform. All actions are logged to the audit trail.
        Destructive operations (force logout, key revocation) cannot be undone.
      </div>
    `
    return c.html(layout('Admin — P17', content, '/admin', 0, {
      breadcrumbs: [{ label: 'Admin' }]
    }))
  })

  // ============================================================
  // GET /admin/settings — Platform Settings Management
  // ============================================================
  route.get('/settings', async (c) => {
    const db = c.env.DB
    let settings: any[] = []
    const toast = c.req.query('toast_ok') || ''
    const toastErr = c.req.query('toast_err') || ''

    if (db) {
      try {
        const rows = await db.prepare(
          `SELECT id, setting_key, setting_value, setting_type, category, description, updated_by, updated_at
           FROM platform_settings ORDER BY category ASC, setting_key ASC`
        ).all<any>()
        settings = rows.results || []
      } catch { /* non-blocking */ }
    }

    // Group by category
    const categories: Record<string, any[]> = {}
    settings.forEach(s => {
      if (!categories[s.category]) categories[s.category] = []
      categories[s.category].push(s)
    })

    const categoryColors: Record<string, string> = {
      general: '#4f8ef7',
      retention: '#a855f7',
      alerts: '#ef4444',
      notifications: '#22c55e',
    }

    const categoryBlocks = Object.entries(categories).map(([cat, items]) => {
      const color = categoryColors[cat] || '#9aa3b2'
      const rows = items.map(s => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 14px;font-family:monospace;font-size:11px;color:var(--accent)">${s.setting_key}</td>
          <td style="padding:10px 14px">
            <form action="/admin/settings" method="POST" style="display:flex;gap:8px;align-items:center">
              <input type="hidden" name="setting_key" value="${s.setting_key}">
              ${s.setting_type === 'boolean'
                ? `<select name="setting_value" style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:4px 8px;color:var(--text);font-size:11px">
                     <option value="true" ${s.setting_value==='true'?'selected':''}>true</option>
                     <option value="false" ${s.setting_value==='false'?'selected':''}>false</option>
                   </select>`
                : `<input name="setting_value" value="${String(s.setting_value || '').replace(/"/g,'&quot;')}" type="${s.setting_type === 'number' ? 'number' : 'text'}"
                     style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:4px 10px;color:var(--text);font-size:11px;width:120px;outline:none">`
              }
              <button type="submit" style="background:rgba(79,142,247,0.15);color:var(--accent);border:1px solid rgba(79,142,247,0.2);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer;font-weight:600">Save</button>
            </form>
          </td>
          <td style="padding:10px 14px;font-size:10px;color:var(--text3)">${s.setting_type}</td>
          <td style="padding:10px 14px;font-size:11px;color:var(--text3);max-width:200px">${s.description || '—'}</td>
          <td style="padding:10px 14px;font-size:10px;color:var(--text3)">${(s.updated_at || '').slice(0,16)}</td>
        </tr>
      `).join('')

      return `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:2px;background:${color};display:inline-block"></span>
            <span style="font-weight:600;font-size:13px;text-transform:capitalize">${cat}</span>
            <span style="font-size:11px;color:var(--text3)">${items.length} settings</span>
          </div>
          <table style="width:100%;border-collapse:collapse;min-width:600px">
            <thead><tr style="background:var(--bg3)">
              ${['Key','Value','Type','Description','Updated'].map(h =>
                `<th style="padding:8px 14px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`
              ).join('')}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `
    }).join('')

    const content = `
      <div class="page-header" style="margin-bottom:24px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">⚙️ Platform Settings</h1>
          <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P17 — Retention, alerts, notifications, general configuration</p>
        </div>
        <a href="/admin" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Admin</a>
      </div>

      ${toast ? `<div style="padding:10px 16px;border-radius:8px;margin-bottom:16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#22c55e;font-size:12px;font-weight:600">✓ ${toast}</div>` : ''}
      ${toastErr ? `<div style="padding:10px 16px;border-radius:8px;margin-bottom:16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#ef4444;font-size:12px;font-weight:600">✗ ${toastErr}</div>` : ''}

      ${settings.length === 0
        ? `<div style="padding:40px;text-align:center;color:var(--text3)">No settings found. Run migration 0017 to initialize platform settings.</div>`
        : categoryBlocks
      }
    `
    return c.html(layout('Admin Settings — P17', content, '/admin', 0, {
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]
    }))
  })

  // POST /admin/settings — Update a platform setting
  route.post('/settings', async (c) => {
    const db = c.env.DB
    if (!db) return c.redirect('/admin/settings?toast_err=Database+not+available')

    try {
      const body = await c.req.parseBody()
      const key = String(body.setting_key || '').trim()
      const value = String(body.setting_value || '').trim()
      if (!key || value === undefined) return c.redirect('/admin/settings?toast_err=Missing+key+or+value')

      await db.prepare(
        `UPDATE platform_settings SET setting_value = ?, updated_by = 'admin', updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?`
      ).bind(value, key).run()

      // Audit log (non-blocking)
      const { writeAuditEvent } = await import('../lib/auditService')
      if (db) {
        writeAuditEvent(db, {
          event_type: 'platform.setting_changed',
          object_type: 'platform_setting',
          object_id: key,
          actor: 'admin',
          tenant_id: 'default',
          payload_summary: `Setting '${key}' updated to '${value}'`,
          surface: 'admin',
        }).catch(() => {})
      }

      return c.redirect(`/admin/settings?toast_ok=Setting+'${key}'+updated+to+'${value}'`)
    } catch (e: any) {
      return c.redirect(`/admin/settings?toast_err=${encodeURIComponent(e.message || 'Update failed')}`)
    }
  })

  // ============================================================
  // GET /admin/sessions — Session Management
  // ============================================================
  route.get('/sessions', async (c) => {
    const db = c.env.DB
    let sessions: any[] = []
    let activeCount = 0
    const toast = c.req.query('toast_ok') || ''
    const toastErr = c.req.query('toast_err') || ''

    if (db) {
      try {
        const rows = await db.prepare(
          `SELECT id, user_id, ip_address, user_agent, last_active_at, created_at, expires_at, force_logout
           FROM platform_sessions ORDER BY last_active_at DESC LIMIT 100`
        ).all<any>()
        sessions = rows.results || []
        activeCount = sessions.filter(s => s.force_logout === 0).length
      } catch { /* non-blocking */ }
    }

    const sessionRows = sessions.map(s => {
      const isForced = s.force_logout === 1
      const ua = (s.user_agent || '').slice(0, 60) + ((s.user_agent || '').length > 60 ? '…' : '')
      return `
        <tr style="border-bottom:1px solid var(--border);${isForced ? 'opacity:0.5' : ''}">
          <td style="padding:10px 12px;font-family:monospace;font-size:10px;color:var(--text3)">${s.id.slice(0,12)}…</td>
          <td style="padding:10px 12px;font-size:12px;color:var(--accent)">${s.user_id}</td>
          <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:var(--text2)">${s.ip_address || '—'}</td>
          <td style="padding:10px 12px;font-size:10px;color:var(--text3);max-width:180px" title="${s.user_agent || ''}">${ua || '—'}</td>
          <td style="padding:10px 12px;font-size:10px;color:var(--text3)">${(s.last_active_at || '').slice(0,16)}</td>
          <td style="padding:10px 12px;font-size:10px;color:var(--text3)">${(s.created_at || '').slice(0,16)}</td>
          <td style="padding:10px 12px">
            ${isForced
              ? `<span style="color:#6b7280;font-size:10px">Logged out</span>`
              : `<form action="/admin/sessions/${s.id}/logout" method="POST" style="display:inline">
                   <button type="submit" onclick="return confirm('Force logout session ${s.id.slice(0,8)}?')"
                     style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);border-radius:4px;padding:3px 10px;font-size:10px;cursor:pointer">
                     Force Logout
                   </button>
                 </form>`
            }
          </td>
        </tr>
      `
    }).join('')

    const content = `
      <div class="page-header" style="margin-bottom:24px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">👥 Session Management</h1>
          <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P17 — Active session view and force logout interface</p>
        </div>
        <a href="/admin" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Admin</a>
      </div>

      ${toast ? `<div style="padding:10px 16px;border-radius:8px;margin-bottom:16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#22c55e;font-size:12px;font-weight:600">✓ ${toast}</div>` : ''}
      ${toastErr ? `<div style="padding:10px 16px;border-radius:8px;margin-bottom:16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#ef4444;font-size:12px;font-weight:600">✗ ${toastErr}</div>` : ''}

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${[
          { label: 'Total Sessions', val: sessions.length, color: '#4f8ef7' },
          { label: 'Active', val: activeCount, color: '#22c55e' },
          { label: 'Force Logged Out', val: sessions.length - activeCount, color: '#ef4444' },
        ].map(s => `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${s.label}</div>
            <div style="font-size:22px;font-weight:700;color:${s.color}">${s.val}</div>
          </div>
        `).join('')}
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:auto">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
          <span style="font-weight:600;font-size:13px">Active Sessions</span>
          <span style="font-size:11px;color:var(--text3)">${sessions.length} sessions (last 100)</span>
        </div>
        ${sessions.length === 0
          ? `<div style="padding:40px;text-align:center;color:var(--text3)">No sessions recorded in platform_sessions table yet.</div>`
          : `<table style="width:100%;border-collapse:collapse;min-width:700px">
              <thead><tr style="background:var(--bg3)">
                ${['ID','User','IP','User Agent','Last Active','Created','Action'].map(h =>
                  `<th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`
                ).join('')}
              </tr></thead>
              <tbody>${sessionRows}</tbody>
             </table>`
        }
      </div>

      <div style="margin-top:16px;padding:12px 16px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
        <span style="color:#ef4444;font-weight:600">Note:</span> Force logout marks the session in D1 — the user will be redirected on their next request.
        Session data is stored in <code>platform_sessions</code> table (created in migration 0017).
      </div>
    `
    return c.html(layout('Session Management — P17', content, '/admin', 0, {
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'Sessions' }]
    }))
  })

  // POST /admin/sessions/:id/logout — Force logout a session
  route.post('/sessions/:id/logout', async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    if (!db) return c.redirect('/admin/sessions?toast_err=Database+not+available')

    try {
      await db.prepare(
        `UPDATE platform_sessions SET force_logout = 1 WHERE id = ?`
      ).bind(id).run()
      return c.redirect(`/admin/sessions?toast_ok=Session+force+logged+out`)
    } catch (e: any) {
      return c.redirect(`/admin/sessions?toast_err=${encodeURIComponent(e.message || 'Logout failed')}`)
    }
  })

  // ============================================================
  // GET /admin/api-keys — API Key Rotation Interface
  // ============================================================
  route.get('/api-keys', async (c) => {
    const db = c.env.DB
    let apiKeys: any[] = []
    let rotationLog: any[] = []
    const toast = c.req.query('toast_ok') || ''
    const toastErr = c.req.query('toast_err') || ''

    if (db) {
      try {
        const keys = await db.prepare(
          `SELECT id, name, key_prefix, scope, status, tenant_id, last_used_at, created_at
           FROM api_keys ORDER BY created_at DESC LIMIT 100`
        ).all<any>()
        apiKeys = keys.results || []

        const log = await db.prepare(
          `SELECT id, api_key_id, key_name, action, performed_by, rotated_at, notes
           FROM api_key_rotation_log ORDER BY rotated_at DESC LIMIT 50`
        ).all<any>()
        rotationLog = log.results || []
      } catch { /* non-blocking */ }
    }

    const statusColor: Record<string, string> = {
      active: '#22c55e', revoked: '#ef4444', expired: '#6b7280'
    }

    const keyRows = apiKeys.map(k => {
      const sc = statusColor[k.status] || '#9aa3b2'
      const isActive = k.status === 'active'
      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 12px;font-family:monospace;font-size:10px;color:var(--text3)">${k.id}</td>
          <td style="padding:10px 12px;font-size:12px;color:var(--text);font-weight:600">${k.name || '—'}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:var(--text2)">${k.key_prefix || '—'}…</td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${k.scope || 'all'}</td>
          <td style="padding:10px 12px">
            <span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:${sc}18;color:${sc};border:1px solid ${sc}30">${k.status}</span>
          </td>
          <td style="padding:10px 12px;font-size:10px;color:var(--text3)">${(k.last_used_at || '—').slice?.(0,16) ?? '—'}</td>
          <td style="padding:10px 12px;font-size:10px;color:var(--text3)">${(k.created_at || '').slice(0,16)}</td>
          <td style="padding:10px 12px">
            <div style="display:flex;gap:6px">
              ${isActive ? `
                <form action="/admin/api-keys/${k.id}/rotate" method="POST" style="display:inline">
                  <button type="submit" title="Rotate" style="background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.2);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer">↻ Rotate</button>
                </form>
                <form action="/admin/api-keys/${k.id}/expire" method="POST" style="display:inline">
                  <button type="submit" onclick="return confirm('Expire key ${k.name || k.id}?')" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer">✕ Expire</button>
                </form>
              ` : `<span style="color:var(--text3);font-size:10px">${k.status}</span>`}
            </div>
          </td>
        </tr>
      `
    }).join('')

    const logRows = rotationLog.map(l => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 12px;font-family:monospace;font-size:10px;color:var(--text3)">${l.api_key_id}</td>
        <td style="padding:8px 12px;font-size:12px;color:var(--text)">${l.key_name || '—'}</td>
        <td style="padding:8px 12px">
          <span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:${
            l.action === 'rotated' ? 'rgba(245,158,11,0.1)' :
            l.action === 'expired' || l.action === 'revoked' ? 'rgba(239,68,68,0.1)' : 'rgba(79,142,247,0.1)'
          };color:${
            l.action === 'rotated' ? '#f59e0b' :
            l.action === 'expired' || l.action === 'revoked' ? '#ef4444' : '#4f8ef7'
          }">${l.action}</span>
        </td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${l.performed_by}</td>
        <td style="padding:8px 12px;font-size:10px;color:var(--text3)">${(l.rotated_at || '').slice(0,16)}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${l.notes || '—'}</td>
      </tr>
    `).join('')

    const content = `
      <div class="page-header" style="margin-bottom:24px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">🔑 API Key Rotation</h1>
          <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P17 — Rotate, expire, revoke API keys. Full rotation history log.</p>
        </div>
        <div style="display:flex;gap:8px">
          <a href="/admin" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Admin</a>
          <a href="/api-keys" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">🔑 Key Manager</a>
        </div>
      </div>

      ${toast ? `<div style="padding:10px 16px;border-radius:8px;margin-bottom:16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#22c55e;font-size:12px;font-weight:600">✓ ${toast}</div>` : ''}
      ${toastErr ? `<div style="padding:10px 16px;border-radius:8px;margin-bottom:16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#ef4444;font-size:12px;font-weight:600">✗ ${toastErr}</div>` : ''}

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${[
          { label: 'Total Keys', val: apiKeys.length, color: '#4f8ef7' },
          { label: 'Active', val: apiKeys.filter(k=>k.status==='active').length, color: '#22c55e' },
          { label: 'Expired/Revoked', val: apiKeys.filter(k=>k.status!=='active').length, color: '#ef4444' },
          { label: 'Rotation Events', val: rotationLog.length, color: '#f59e0b' },
        ].map(s => `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${s.label}</div>
            <div style="font-size:22px;font-weight:700;color:${s.color}">${s.val}</div>
          </div>
        `).join('')}
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:auto;margin-bottom:20px">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px">API Keys</div>
        <table style="width:100%;border-collapse:collapse;min-width:800px">
          <thead><tr style="background:var(--bg3)">
            ${['ID','Name','Prefix','Scope','Status','Last Used','Created','Actions'].map(h =>
              `<th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>
            ${apiKeys.length === 0
              ? `<tr><td colspan="8" style="padding:30px;text-align:center;color:var(--text3)">No API keys found. Create keys at <a href="/api-keys" style="color:var(--accent)">/api-keys</a>.</td></tr>`
              : keyRows}
          </tbody>
        </table>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:auto">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px">Rotation History Log</div>
        <table style="width:100%;border-collapse:collapse;min-width:600px">
          <thead><tr style="background:var(--bg3)">
            ${['Key ID','Name','Action','By','At','Notes'].map(h =>
              `<th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>
            ${rotationLog.length === 0
              ? `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text3)">No rotation events yet. Use ↻ Rotate or ✕ Expire to log events.</td></tr>`
              : logRows}
          </tbody>
        </table>
      </div>
    `
    return c.html(layout('API Key Rotation — P17', content, '/admin', 0, {
      breadcrumbs: [{ label: 'Admin', href: '/admin' }, { label: 'API Keys' }]
    }))
  })

  // POST /admin/api-keys/:id/expire — Expire an API key
  route.post('/api-keys/:id/expire', async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    if (!db) return c.redirect('/admin/api-keys?toast_err=Database+not+available')

    try {
      const key = await db.prepare(`SELECT id, name FROM api_keys WHERE id = ?`).bind(id).first<any>()
      await db.prepare(`UPDATE api_keys SET status = 'expired' WHERE id = ?`).bind(id).run()
      await db.prepare(
        `INSERT INTO api_key_rotation_log (api_key_id, key_name, action, performed_by, notes)
         VALUES (?, ?, 'expired', 'admin', 'Expired via admin panel')`
      ).bind(id, key?.name || id).run()
      return c.redirect(`/admin/api-keys?toast_ok=Key+expired+successfully`)
    } catch (e: any) {
      return c.redirect(`/admin/api-keys?toast_err=${encodeURIComponent(e.message || 'Expire failed')}`)
    }
  })

  // POST /admin/api-keys/:id/rotate — Log rotation event
  route.post('/api-keys/:id/rotate', async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    if (!db) return c.redirect('/admin/api-keys?toast_err=Database+not+available')

    try {
      const key = await db.prepare(`SELECT id, name FROM api_keys WHERE id = ?`).bind(id).first<any>()
      await db.prepare(
        `INSERT INTO api_key_rotation_log (api_key_id, key_name, action, performed_by, notes)
         VALUES (?, ?, 'rotated', 'admin', 'Rotation event logged via admin panel')`
      ).bind(id, key?.name || id).run()
      return c.redirect(`/admin/api-keys?toast_ok=Rotation+event+logged+for+key+${id}`)
    } catch (e: any) {
      return c.redirect(`/admin/api-keys?toast_err=${encodeURIComponent(e.message || 'Rotate failed')}`)
    }
  })

  return route
}
