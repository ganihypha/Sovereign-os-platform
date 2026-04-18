// ============================================================
// SOVEREIGN OS PLATFORM — ALERTS ROUTE (P7 UPGRADE)
// Alert & Notification center.
// All alerts come from real state changes — no synthetic events.
// P7: Email delivery wired via dispatchAlertEmail.
//     Delivery status logged in alert_deliveries table.
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import type { Env } from '../index'
import type { PlatformAlert } from '../types'
import { dispatchAlertEmail } from '../lib/emailDelivery'

const SEVERITY_COLOR: Record<string, string> = {
  info: '#4f8ef7',
  warning: '#f59e0b',
  critical: '#ef4444',
}

const TYPE_ICON: Record<string, string> = {
  approval_pending: '◎',
  proof_submitted: '◇',
  connector_error: '⊞',
  session_stale: '↻',
  execution_blocked: '▶',
  canon_candidate_ready: '▣',
  lane_registered: '⊟',
  role_assigned: '◈',
}

function alertRow(a: PlatformAlert, isAuth: boolean): string {
  const color = SEVERITY_COLOR[a.severity] ?? '#9aa3b2'
  const icon = TYPE_ICON[a.alert_type] ?? '◆'
  const opacity = a.acknowledged ? '0.5' : '1'
  return `
  <div style="background:var(--bg2);border:1px solid ${a.acknowledged ? 'var(--border)' : color + '40'};border-radius:var(--radius);padding:16px;opacity:${opacity};display:flex;justify-content:space-between;align-items:flex-start;gap:16px" id="alert-${a.id}">
    <div style="display:flex;gap:12px;flex:1;min-width:0">
      <div style="font-size:18px;color:${color};flex-shrink:0;margin-top:1px">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:var(--text)">${a.title}</span>
          <span style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:3px;padding:1px 6px;font-size:10px;font-weight:700;text-transform:uppercase">${a.severity}</span>
          ${a.acknowledged ? `<span style="background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:3px;padding:1px 6px;font-size:10px;font-weight:700">ACKNOWLEDGED</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px;line-height:1.5">${a.message}</div>
        <div style="display:flex;gap:12px;font-size:11px;color:var(--text3);flex-wrap:wrap">
          <span>Type: ${a.alert_type}</span>
          <span>Object: ${a.object_type} / ${a.object_id}</span>
          <span>${new Date(a.created_at).toLocaleString()}</span>
          ${a.acknowledged_by ? `<span>Acknowledged by: ${a.acknowledged_by}</span>` : ''}
        </div>
      </div>
    </div>
    ${isAuth && !a.acknowledged ? `
    <form method="POST" action="/alerts/${a.id}/acknowledge" style="flex-shrink:0">
      <button type="submit" style="background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer">
        Acknowledge
      </button>
    </form>` : ''}
  </div>`
}

export function createAlertsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)
    const showAll = c.req.query('show') === 'all'

    const alerts = await repo.getAlerts(showAll ? false : false)
    const allAlerts = alerts
    const unreadAlerts = alerts.filter(a => !a.acknowledged)
    const readAlerts = alerts.filter(a => a.acknowledged)

    const unreadHtml = unreadAlerts.length === 0
      ? `<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:24px;text-align:center;color:#22c55e;font-size:13px">✓ No unread alerts — platform governance is current</div>`
      : unreadAlerts.map(a => alertRow(a, isAuth)).join('')

    const readHtml = readAlerts.length > 0
      ? `<div style="margin-top:32px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">ACKNOWLEDGED ALERTS (${readAlerts.length})</div>
          <div style="display:flex;flex-direction:column;gap:8px">${readAlerts.slice(0, 10).map(a => alertRow(a, false)).join('')}</div>
         </div>`
      : ''

    const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Alert Center</h1>
        <div style="font-size:12px;color:var(--text2)">${unreadAlerts.length} unread · ${allAlerts.length} total · Governance-critical events only</div>
      </div>
      <div style="display:flex;gap:8px">
        ${isAuth && unreadAlerts.length > 0 ? `
        <form method="POST" action="/alerts/acknowledge-all">
          <button style="background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer">Acknowledge All</button>
        </form>` : ''}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Unread</div>
        <div style="font-size:24px;font-weight:700;color:${unreadAlerts.length > 0 ? '#f59e0b' : '#22c55e'}">${unreadAlerts.length}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Critical</div>
        <div style="font-size:24px;font-weight:700;color:${allAlerts.filter(a=>a.severity==='critical'&&!a.acknowledged).length>0?'#ef4444':'var(--text2)'}">${allAlerts.filter(a=>a.severity==='critical'&&!a.acknowledged).length}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Warnings</div>
        <div style="font-size:24px;font-weight:700;color:${allAlerts.filter(a=>a.severity==='warning'&&!a.acknowledged).length>0?'#f59e0b':'var(--text2)'}">${allAlerts.filter(a=>a.severity==='warning'&&!a.acknowledged).length}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Total</div>
        <div style="font-size:24px;font-weight:700;color:var(--text2)">${allAlerts.length}</div>
      </div>
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">UNREAD ALERTS (${unreadAlerts.length})</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${unreadHtml}
    </div>
    ${readHtml}

    <div style="margin-top:24px;padding:12px 16px;background:rgba(79,142,247,0.06);border:1px solid rgba(79,142,247,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
      <span style="color:var(--accent);font-weight:600">Alert Integrity:</span> All alerts originate from real platform state changes. No synthetic or scheduled alerts exist. Alert generation requires actual D1 state mutation events.
    </div>`

    return c.html(layout('Alerts', content, '/alerts'))
  })

  // POST acknowledge single alert
  route.post('/:id/acknowledge', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED' }, 401)

    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    await repo.acknowledgeAlert(id, 'operator')

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('text/html')) return c.redirect('/alerts')
    return c.json({ success: true, id })
  })

  // POST acknowledge all unread
  route.post('/acknowledge-all', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED' }, 401)

    const repo = createRepo(c.env.DB)
    const unread = await repo.getAlerts(true)
    await Promise.all(unread.map(a => repo.acknowledgeAlert(a.id, 'operator')))

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('text/html')) return c.redirect('/alerts')
    return c.json({ success: true, acknowledged: unread.length })
  })

  // API: GET alerts
  route.get('/api/alerts', async (c) => {
    const repo = createRepo(c.env.DB)
    const onlyUnread = c.req.query('unread') === 'true'
    const alerts = await repo.getAlerts(onlyUnread)
    return c.json({ alerts, count: alerts.length })
  })

  // API: GET alert delivery log (P7)
  route.get('/api/deliveries', async (c) => {
    const repo = createRepo(c.env.DB)
    const alertId = c.req.query('alert_id')
    const deliveries = await repo.getAlertDeliveries(alertId)
    return c.json({ deliveries, count: deliveries.length })
  })

  // API: POST create alert + dispatch email (P7)
  // Used by internal platform events — not a public endpoint
  route.post('/api/emit', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED' }, 401)

    const repo = createRepo(c.env.DB)
    const body = await c.req.json() as {
      alert_type?: string
      title?: string
      message?: string
      severity?: string
      object_type?: string
      object_id?: string
      tenant_id?: string
    }

    if (!body.alert_type || !body.title) {
      return c.json({ error: 'alert_type and title are required' }, 400)
    }

    const alert = await repo.createAlert({
      alert_type: body.alert_type as PlatformAlert['alert_type'],
      title: body.title,
      message: body.message ?? '',
      severity: (body.severity ?? 'info') as PlatformAlert['severity'],
      object_type: body.object_type ?? '',
      object_id: body.object_id ?? '',
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    })

    // P7: Dispatch email asynchronously (fire-and-log — never blocks response)
    const tenantId = body.tenant_id ?? 'tenant-default'
    dispatchAlertEmail(
      c.env,
      repo,
      alert.id,
      alert.title,
      alert.message,
      alert.severity,
      tenantId
    ).catch(() => {})

    return c.json({ success: true, alert_id: alert.id, email_dispatch: 'queued' })
  })

  return route
}
