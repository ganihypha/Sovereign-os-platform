// ============================================================
// SOVEREIGN OS PLATFORM — PLATFORM SEARCH SURFACE (P15)
// Purpose: Unified platform-wide search across multiple surfaces
// Surface: /search
//
// GET /search?q=...  — HTML search page + results
// GET /search/api?q= — JSON API for search results
//
// Searches: intents (title,body), audit events (event_type,actor),
//           notifications (title,message), tenants (name,slug)
// Returns 20 results max per type
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'

const RESULT_LIMIT = 20

async function searchIntents(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, title, status, created_at FROM intents
       WHERE (title LIKE ? OR body LIKE ?) AND title IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'intent', _url: '/intent', _label: r.title }))
  } catch { return [] }
}

async function searchAuditEvents(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, event_type, actor, tenant_id, created_at FROM audit_log_v2
       WHERE (event_type LIKE ? OR actor LIKE ?) AND event_type IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'audit', _url: '/audit', _label: r.event_type }))
  } catch { return [] }
}

async function searchNotifications(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, title, message, event_type, created_at FROM notifications
       WHERE (title LIKE ? OR message LIKE ?) AND title IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'notification', _url: '/notifications', _label: r.title }))
  } catch { return [] }
}

async function searchTenants(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, name, slug, status, created_at FROM tenants
       WHERE (name LIKE ? OR slug LIKE ?) AND name IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'tenant', _url: `/tenants/${r.id}`, _label: r.name }))
  } catch { return [] }
}

const TYPE_META: Record<string, { icon: string; color: string; badge: string }> = {
  intent:       { icon: '◈', color: '#4f8ef7', badge: 'Intent' },
  audit:        { icon: '🔏', color: '#f59e0b', badge: 'Audit' },
  notification: { icon: '🔔', color: '#22c55e', badge: 'Notification' },
  tenant:       { icon: '⊛', color: '#a855f7', badge: 'Tenant' },
}

export function createSearchRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /search — HTML search page
  route.get('/', async (c) => {
    const q = (c.req.query('q') || '').trim()
    let results: any[] = []
    let searchTime = 0
    let totalResults = 0

    const groups: Record<string, any[]> = {
      intent: [],
      audit: [],
      notification: [],
      tenant: [],
    }

    if (q.length >= 2 && c.env.DB) {
      const t0 = Date.now()
      const [intents, auditEvents, notifications, tenants] = await Promise.all([
        searchIntents(c.env.DB, q),
        searchAuditEvents(c.env.DB, q),
        searchNotifications(c.env.DB, q),
        searchTenants(c.env.DB, q),
      ])
      searchTime = Date.now() - t0
      groups.intent = intents
      groups.audit = auditEvents
      groups.notification = notifications
      groups.tenant = tenants
      results = [...intents, ...auditEvents, ...notifications, ...tenants]
      totalResults = results.length
    }

    function renderGroup(type: string, items: any[]): string {
      if (items.length === 0) return ''
      const meta = TYPE_META[type]
      const rows = items.map(item => `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start">
          <div style="flex-shrink:0;width:32px;height:32px;border-radius:8px;background:${meta.color}18;display:flex;align-items:center;justify-content:center;font-size:14px">${meta.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <a href="${item._url}" style="font-size:13px;font-weight:600;color:var(--text);text-decoration:none">${item._label || item.title || item.event_type || item.name || item.id}</a>
              <span style="padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:${meta.color}18;color:${meta.color}">${meta.badge}</span>
            </div>
            <div style="font-size:11px;color:var(--text3)">
              ${type === 'intent' ? `Status: ${item.status || '—'}` : ''}
              ${type === 'audit' ? `Actor: ${item.actor || '—'} · Tenant: ${item.tenant_id || '—'}` : ''}
              ${type === 'notification' ? `${(item.message || '').slice(0, 80)}${(item.message || '').length > 80 ? '...' : ''}` : ''}
              ${type === 'tenant' ? `Slug: ${item.slug || '—'} · Status: ${item.status || '—'}` : ''}
            </div>
          </div>
          <div style="flex-shrink:0;font-size:10px;color:var(--text3)">${(item.created_at || '').slice(0, 10)}</div>
        </div>
      `).join('')

      return `
        <div style="margin-bottom:16px">
          <div style="padding:8px 16px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;font-weight:600;color:${meta.color}">${meta.icon} ${meta.badge}</span>
            <span style="font-size:11px;color:var(--text3)">${items.length} result${items.length !== 1 ? 's' : ''}</span>
          </div>
          ${rows}
        </div>
      `
    }

    const resultsHtml = q.length < 2
      ? `<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">Enter at least 2 characters to search.</div>`
      : totalResults === 0
      ? `<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">No results found for "<strong style="color:var(--text)">${q}</strong>".</div>`
      : Object.entries(groups).map(([type, items]) => renderGroup(type, items)).join('')

    const content = `
      <div style="max-width:800px;margin:0 auto">
        <div style="margin-bottom:24px">
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0 0 4px">🔍 Platform Search</h1>
          <p style="color:var(--text2);font-size:12px;margin:0">P15 — Unified search across intents, audit events, notifications, tenants</p>
        </div>

        <!-- Search form -->
        <form method="GET" action="/search" style="margin-bottom:24px">
          <div style="display:flex;gap:8px">
            <input
              name="q"
              value="${q.replace(/"/g, '&quot;')}"
              placeholder="Search across intents, audit events, notifications, tenants..."
              autofocus
              style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;color:var(--text);font-size:13px;outline:none"
            >
            <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer">Search</button>
            ${q ? `<a href="/search" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px;text-decoration:none">✕</a>` : ''}
          </div>
        </form>

        ${q.length >= 2 ? `
          <!-- Results summary -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
            <span style="font-size:12px;color:var(--text2)">${totalResults} result${totalResults !== 1 ? 's' : ''} for "<strong style="color:var(--text)">${q}</strong>"</span>
            <span style="font-size:11px;color:var(--text3)">(${searchTime}ms)</span>
            ${Object.entries(groups).filter(([,v]) => v.length > 0).map(([type, items]) => {
              const m = TYPE_META[type]
              return `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:${m.color}18;color:${m.color};border:1px solid ${m.color}30">${m.badge}: ${items.length}</span>`
            }).join('')}
          </div>
        ` : ''}

        <!-- Results -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
          ${resultsHtml}
        </div>

        ${!q ? `
          <!-- Search hints -->
          <div style="margin-top:16px;padding:12px 16px;background:rgba(79,142,247,0.05);border:1px solid rgba(79,142,247,0.15);border-radius:8px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:8px"><span style="color:#4f8ef7;font-weight:600">Searchable surfaces:</span></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
              ${Object.entries(TYPE_META).map(([type, m]) => `
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-size:12px">${m.icon}</span>
                  <span style="font-size:11px;color:${m.color};font-weight:600">${m.badge}</span>
                  <span style="font-size:10px;color:var(--text3)">${type === 'intent' ? 'title, body' : type === 'audit' ? 'event_type, actor' : type === 'notification' ? 'title, message' : 'name, slug'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `

    return c.html(layout('Platform Search — P15', content, '/search'))
  })

  // GET /search/api — JSON API
  route.get('/api', async (c) => {
    const q = (c.req.query('q') || '').trim()
    if (q.length < 2) return c.json({ q, error: 'Query must be at least 2 characters', results: {} })
    if (!c.env.DB) return c.json({ q, error: 'DB not available', results: {} })

    const [intents, auditEvents, notifications, tenants] = await Promise.all([
      searchIntents(c.env.DB, q),
      searchAuditEvents(c.env.DB, q),
      searchNotifications(c.env.DB, q),
      searchTenants(c.env.DB, q),
    ])

    return c.json({
      q,
      total: intents.length + auditEvents.length + notifications.length + tenants.length,
      results: {
        intents: intents.map(({ _type, _url, _label, ...r }) => r),
        audit: auditEvents.map(({ _type, _url, _label, ...r }) => r),
        notifications: notifications.map(({ _type, _url, _label, ...r }) => r),
        tenants: tenants.map(({ _type, _url, _label, ...r }) => r),
      }
    })
  })

  return route
}
