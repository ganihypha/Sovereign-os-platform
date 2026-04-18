// ============================================================
// SOVEREIGN OS PLATFORM — EVENT BUS SURFACE (P11)
// Purpose: Unified platform event stream — view, filter, mark read
// Surface: /events
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'
import {
  getEvents, getEventStats, markEventRead, markAllEventsRead, emitEvent,
  KNOWN_EVENT_TYPES, type PlatformEvent
} from '../lib/eventBusService'

function severityBadge(severity: string): string {
  const map: Record<string, string> = {
    info: 'background:rgba(79,142,247,0.1);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3)',
    warning: 'background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)',
    error: 'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3)',
    critical: 'background:rgba(139,0,0,0.15);color:#ff4444;border:1px solid rgba(139,0,0,0.4)',
  }
  const style = map[severity] || map.info
  return `<span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;${style}">${severity.toUpperCase()}</span>`
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function createEventsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /events — unified event stream
  route.get('/', async (c) => {
    const severity = c.req.query('severity') || ''
    const surface = c.req.query('surface') || ''
    const event_type = c.req.query('event_type') || ''
    const unread_only = c.req.query('unread') === '1'
    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const limit = 50

    const [{ events, total }, stats] = await Promise.all([
      c.env.DB ? getEvents(c.env.DB, {
        severity: severity || undefined,
        source_surface: surface || undefined,
        event_type: event_type || undefined,
        unread_only,
        limit,
        offset: (page - 1) * limit
      }) : { events: [], total: 0 },
      c.env.DB ? getEventStats(c.env.DB) : { total: 0, unread: 0, by_severity: {}, by_surface: {}, recent_types: [] }
    ])

    const totalPages = Math.ceil(total / limit)

    const severityOrder = ['critical', 'error', 'warning', 'info']
    const severityColors: Record<string, string> = { info: '#4f8ef7', warning: '#fbbf24', error: '#ef4444', critical: '#ff4444' }

    const eventRows = events.map(e => `
      <tr style="border-bottom:1px solid var(--border);opacity:${e.read ? '0.6' : '1'}">
        <td style="padding:8px 12px;font-size:11px;font-family:monospace;color:var(--text3)">${e.id}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--accent)">${e.event_type}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${e.source_surface}</td>
        <td style="padding:8px 12px">${severityBadge(e.severity)}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${e.actor || '—'}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${e.resource_type ? `${e.resource_type}: ${e.resource_id || ''}` : '—'}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${timeAgo(e.created_at)}</td>
        <td style="padding:8px 12px">
          ${!e.read ? `<form action="/events/${e.id}/read" method="POST" style="display:inline"><button type="submit" style="background:rgba(79,142,247,0.1);color:#4f8ef7;border:none;border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer">Mark Read</button></form>` : '<span style="font-size:10px;color:var(--text3)">Read</span>'}
        </td>
      </tr>
    `).join('')

    const statCards = severityOrder.map(sev => {
      const cnt = stats.by_severity[sev] || 0
      const color = severityColors[sev]
      return `
        <div style="text-align:center;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
          <div style="font-size:20px;font-weight:700;color:${color}">${cnt}</div>
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase">${sev}</div>
        </div>
      `
    }).join('')

    const topSurfaces = Object.entries(stats.by_surface)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s, cnt]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--text2)">${s}</span><span style="font-size:12px;color:var(--accent);font-weight:600">${cnt}</span></div>`)
      .join('')

    const filterParams = new URLSearchParams()
    if (severity) filterParams.set('severity', severity)
    if (surface) filterParams.set('surface', surface)
    if (event_type) filterParams.set('event_type', event_type)
    if (unread_only) filterParams.set('unread', '1')

    const prevPage = page > 1 ? `?${new URLSearchParams({ ...Object.fromEntries(filterParams), page: String(page - 1) })}` : null
    const nextPage = page < totalPages ? `?${new URLSearchParams({ ...Object.fromEntries(filterParams), page: String(page + 1) })}` : null

    const content = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0">Event Bus</h1>
          <p style="color:var(--text3);font-size:13px;margin:4px 0 0">Unified platform event stream — all significant events across all surfaces</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="text-align:center;background:rgba(79,142,247,0.05);border:1px solid rgba(79,142,247,0.2);border-radius:8px;padding:10px 16px">
            <div style="font-size:22px;font-weight:700;color:#4f8ef7">${stats.total}</div>
            <div style="font-size:10px;color:var(--text3)">Total Events</div>
          </div>
          <div style="text-align:center;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:10px 16px">
            <div style="font-size:22px;font-weight:700;color:#fbbf24">${stats.unread}</div>
            <div style="font-size:10px;color:var(--text3)">Unread</div>
          </div>
          <form action="/events/read-all" method="POST">
            <button type="submit" style="background:rgba(79,142,247,0.15);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3);border-radius:6px;padding:8px 14px;font-size:12px;cursor:pointer;font-weight:600">Mark All Read</button>
          </form>
        </div>
      </div>

      <!-- Severity Stats -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        ${statCards}
      </div>

      <div style="display:grid;grid-template-columns:1fr 250px;gap:16px">
        <div>
          <!-- Filters -->
          <form method="GET" action="/events" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end">
            <div>
              <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Severity</label>
              <select name="severity" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px">
                <option value="">All</option>
                ${['info','warning','error','critical'].map(s => `<option value="${s}" ${severity === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Surface</label>
              <input name="surface" value="${surface}" placeholder="e.g. workflows" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;width:120px">
            </div>
            <div>
              <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Event Type</label>
              <input name="event_type" value="${event_type}" placeholder="e.g. workflow.triggered" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;width:160px">
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text3);cursor:pointer">
              <input type="checkbox" name="unread" value="1" ${unread_only ? 'checked' : ''}> Unread only
            </label>
            <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer">Filter</button>
            <a href="/events" style="color:var(--text3);font-size:12px;padding:7px 12px;text-decoration:none">Clear</a>
          </form>

          <!-- Events Table -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Events (${total} total, page ${page}/${totalPages || 1})</div>
            </div>
            ${events.length === 0 ? '<div style="padding:32px;text-align:center;color:var(--text3)">No events found.</div>' : `
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse">
                <thead><tr style="border-bottom:2px solid var(--border)">
                  <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">ID</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">Event Type</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">Surface</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">Severity</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">Actor</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">Resource</th>
                  <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3)">When</th>
                  <th style="padding:8px 12px;font-size:10px;color:var(--text3)"></th>
                </tr></thead>
                <tbody>${eventRows}</tbody>
              </table>
            </div>
            <!-- Pagination -->
            <div style="padding:12px 16px;display:flex;gap:12px;align-items:center;border-top:1px solid var(--border)">
              ${prevPage ? `<a href="/events${prevPage}" style="color:var(--accent);font-size:12px;text-decoration:none">← Previous</a>` : ''}
              <span style="font-size:12px;color:var(--text3)">Page ${page} of ${totalPages || 1}</span>
              ${nextPage ? `<a href="/events${nextPage}" style="color:var(--accent);font-size:12px;text-decoration:none">Next →</a>` : ''}
            </div>`}
          </div>
        </div>

        <!-- Sidebar -->
        <div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-header"><div class="card-title" style="font-size:12px">Top Sources</div></div>
            <div style="padding:8px 16px">
              ${topSurfaces || '<div style="color:var(--text3);font-size:11px;padding:8px 0">No data yet</div>'}
            </div>
          </div>
          <div class="card" style="margin-bottom:16px">
            <div class="card-header"><div class="card-title" style="font-size:12px">Emit Test Event</div></div>
            <form action="/events/emit" method="POST" style="padding:12px">
              <div style="margin-bottom:8px">
                <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Event Type</label>
                <input name="event_type" placeholder="platform.test" required style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--text);font-size:11px;box-sizing:border-box">
              </div>
              <div style="margin-bottom:8px">
                <label style="font-size:10px;color:var(--text3);display:block;margin-bottom:3px">Severity</label>
                <select name="severity" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--text);font-size:11px">
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                  <option value="critical">critical</option>
                </select>
              </div>
              <button type="submit" style="width:100%;background:var(--accent);color:#fff;border:none;border-radius:4px;padding:7px;font-size:11px;font-weight:600;cursor:pointer">Emit Event</button>
            </form>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title" style="font-size:12px">Known Event Types</div></div>
            <div style="padding:8px 16px;max-height:300px;overflow-y:auto">
              ${KNOWN_EVENT_TYPES.map(t => `<div style="font-size:10px;color:var(--text3);font-family:monospace;padding:2px 0">${t}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `
    return c.html(layout('Event Bus', content, '/events'))
  })

  // POST /events/emit — emit a test event
  route.post('/emit', async (c) => {
    const body = await c.req.parseBody()
    if (c.env.DB) {
      await emitEvent(c.env.DB, {
        event_type: body.event_type as string || 'platform.test',
        source_surface: 'events-ui',
        actor: 'user',
        severity: (body.severity as any) || 'info',
        payload: { source: 'manual_emit' }
      })
    }
    return c.redirect('/events')
  })

  // POST /events/:id/read
  route.post('/:id/read', async (c) => {
    const id = c.req.param('id')
    if (c.env.DB) await markEventRead(c.env.DB, id)
    return c.redirect('/events')
  })

  // POST /events/read-all
  route.post('/read-all', async (c) => {
    if (c.env.DB) await markAllEventsRead(c.env.DB, 'tenant-default')
    return c.redirect('/events')
  })

  // GET /events/api — JSON API for event stream
  route.get('/api', async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
    const { events, total } = c.env.DB
      ? await getEvents(c.env.DB, {
          severity: c.req.query('severity') || undefined,
          event_type: c.req.query('event_type') || undefined,
          limit
        })
      : { events: [], total: 0 }
    return c.json({ events, total, limit })
  })

  return route
}
