// ============================================================
// SOVEREIGN OS PLATFORM — /changelog SURFACE (P19)
// Reads platform_changelog D1 table (seeded in 0018).
// Shows: version, phase, change_type, description, deployed_at
// Auth: GET open (read-only), consistent with other surfaces.
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'

// ---- Change type badge ----
function changeTypeBadge(changeType: string): string {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    feature:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'Feature' },
    enhancement: { color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)',  label: 'Enhancement' },
    fix:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Fix' },
    breaking:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Breaking' },
    security:    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  label: 'Security' },
    migration:   { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   label: 'Migration' },
    infra:       { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Infra' },
  }
  const t = map[changeType] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: changeType }
  return `<span style="background:${t.bg};color:${t.color};border:1px solid ${t.color}33;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${t.label}</span>`
}

// ---- Format date ----
function fmtDate(dt: string | null): string {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short'
    })
  } catch { return dt }
}

export function createChangelogRoute() {
  const app = new Hono<{ Bindings: Env }>()

  // GET /changelog
  app.get('/', async (c) => {
    let entries: Array<{
      id: number | string
      version: string
      phase: string
      change_type: string
      description: string
      deployed_at: string | null
      created_at: string | null
    }> = []
    let dbError = ''

    // Filter params
    const filterVersion = c.req.query('version') || ''
    const filterType = c.req.query('type') || ''
    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const perPage = 20

    if (c.env.DB) {
      try {
        let query = `SELECT * FROM platform_changelog`
        const conditions: string[] = []
        const bindings: string[] = []

        if (filterVersion) {
          conditions.push(`version LIKE ?`)
          bindings.push(`%${filterVersion}%`)
        }
        if (filterType) {
          conditions.push(`change_type = ?`)
          bindings.push(filterType)
        }

        if (conditions.length > 0) {
          query += ` WHERE ` + conditions.join(' AND ')
        }
        query += ` ORDER BY deployed_at DESC, id DESC LIMIT ? OFFSET ?`
        bindings.push(String(perPage), String((page - 1) * perPage))

        const result = await c.env.DB.prepare(query).bind(...bindings).all()
        entries = (result.results || []) as typeof entries
      } catch (e: unknown) {
        dbError = e instanceof Error ? e.message : 'Database error'
      }
    } else {
      dbError = 'D1 database not connected'
    }

    // Unique change types for filter dropdown
    let allTypes: string[] = ['feature', 'enhancement', 'fix', 'breaking', 'security', 'migration', 'infra']

    const filterBar = `
      <form method="GET" action="/changelog" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <input name="version" value="${filterVersion}" placeholder="Filter version..." style="background:#111318;border:1px solid #232830;color:#e8eaf0;border-radius:6px;padding:7px 12px;font-size:13px;width:180px">
        <select name="type" style="background:#111318;border:1px solid #232830;color:#e8eaf0;border-radius:6px;padding:7px 12px;font-size:13px">
          <option value="">All Types</option>
          ${allTypes.map(t => `<option value="${t}"${filterType === t ? ' selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
        <button type="submit" style="background:#4f8ef7;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer">Filter</button>
        ${(filterVersion || filterType) ? `<a href="/changelog" style="color:#94a3b8;font-size:13px;padding:8px 10px;text-decoration:none">Clear</a>` : ''}
      </form>
    `

    const tableRows = entries.length === 0 ? `
      <tr><td colspan="5" style="text-align:center;padding:40px;color:#6b7890">
        ${dbError ? `<span style="color:#ef4444">⚠ ${dbError}</span>` : 'No changelog entries found.'}
      </td></tr>
    ` : entries.map(e => `
      <tr style="border-bottom:1px solid #1a1d27">
        <td style="padding:12px 10px;font-family:monospace;font-size:12px;color:#4f8ef7;font-weight:700;white-space:nowrap">${e.version || '—'}</td>
        <td style="padding:12px 10px;font-size:13px;color:#cbd5e1;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.phase || ''}">${e.phase || '—'}</td>
        <td style="padding:12px 10px">${changeTypeBadge(e.change_type || '')}</td>
        <td style="padding:12px 10px;font-size:13px;color:#94a3b8;max-width:320px">${e.description || '—'}</td>
        <td style="padding:12px 10px;font-size:12px;color:#6b7890;white-space:nowrap">${fmtDate(e.deployed_at)}</td>
      </tr>
    `).join('')

    const paginationPrev = page > 1
      ? `<a href="/changelog?page=${page - 1}&version=${encodeURIComponent(filterVersion)}&type=${encodeURIComponent(filterType)}" style="color:#4f8ef7;text-decoration:none;padding:6px 12px;border:1px solid #232830;border-radius:4px;font-size:13px">← Prev</a>`
      : `<span style="color:#3a3f4a;padding:6px 12px;border:1px solid #1a1d27;border-radius:4px;font-size:13px">← Prev</span>`
    const paginationNext = entries.length === perPage
      ? `<a href="/changelog?page=${page + 1}&version=${encodeURIComponent(filterVersion)}&type=${encodeURIComponent(filterType)}" style="color:#4f8ef7;text-decoration:none;padding:6px 12px;border:1px solid #232830;border-radius:4px;font-size:13px">Next →</a>`
      : `<span style="color:#3a3f4a;padding:6px 12px;border:1px solid #1a1d27;border-radius:4px;font-size:13px">Next →</span>`

    const content = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:#e8eaf0;margin:0 0 4px">Platform Changelog</h1>
          <p style="color:#6b7890;font-size:13px;margin:0">Version history and deployment record for Sovereign OS Platform</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="background:rgba(79,142,247,0.12);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3);border-radius:4px;padding:4px 10px;font-size:11px;font-weight:700">v1.9.0-P19</span>
        </div>
      </div>

      ${filterBar}

      <div style="background:#111318;border:1px solid #1e2128;border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#0d0f14;border-bottom:1px solid #232830">
              <th style="padding:10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Version</th>
              <th style="padding:10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Phase</th>
              <th style="padding:10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Type</th>
              <th style="padding:10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Description</th>
              <th style="padding:10px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Deployed</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
        <span style="font-size:12px;color:#4a5568">Page ${page} — showing ${entries.length} entries</span>
        <div style="display:flex;gap:8px">${paginationPrev}${paginationNext}</div>
      </div>
    `

    return c.html(layout('Platform Changelog — Sovereign OS', content, '/changelog', 0, {
      breadcrumbs: [
        { label: 'Home', href: '/dashboard' },
        { label: 'Platform Admin' },
        { label: 'Changelog' }
      ]
    }))
  })

  return app
}
