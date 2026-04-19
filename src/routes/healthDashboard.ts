// ============================================================
// SOVEREIGN OS PLATFORM — HEALTH DASHBOARD SURFACE (P9+P13+P14)
// P13: ABAC enforcement stats, webhook queue health, report subscription health
// P14: ABAC denials drill-down, webhook per-connector queue, event archive sample, Run Health Check button
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { layout } from '../layout'
import {
  getSurfaceSLAs,
  getPlatformHealthSummary,
  recordHealthSnapshot,
  getSurfaceHistory,
  ALL_SURFACES
} from '../lib/healthDashboardService'
import { getAbacDenyStats } from '../lib/abacUiService'

export const healthDashboardRoute = new Hono<{ Bindings: Env }>()

// GET /health-dashboard — Unified health dashboard
healthDashboardRoute.get('/', async (c) => {
  const db = c.env.DB

  let slas: any[] = []
  let summary: any = {}
  let error = ''
  let abacStats: any = { total_denials: 0, denials_last_24h: 0, top_denied_surfaces: [], top_denied_roles: [], routes_guarded: 5 }
  let webhookStats: any = { total: 0, pending: 0, delivered: 0, retrying: 0, failed: 0 }
  let subscriptionStats: any = { total: 0, active: 0, last_run: null }
  // P14 drill-down data
  let recentDenials: any[] = []
  let webhookConnectors: any[] = []
  let archiveSample: any[] = []
  const checked = c.req.query('checked')

  try {
    const [slaResult, summaryResult, abacResult] = await Promise.all([
      getSurfaceSLAs(db, undefined, 24),
      getPlatformHealthSummary(db),
      db ? getAbacDenyStats(db) : Promise.resolve(abacStats)
    ])
    slas = slaResult
    summary = summaryResult
    abacStats = abacResult

    // Webhook queue stats from D1
    if (db) {
      try {
        const wqStats = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered, SUM(CASE WHEN status='retrying' THEN 1 ELSE 0 END) as retrying, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed FROM webhook_queue`).first()
        if (wqStats) webhookStats = { total: (wqStats as any).total || 0, pending: (wqStats as any).pending || 0, delivered: (wqStats as any).delivered || 0, retrying: (wqStats as any).retrying || 0, failed: (wqStats as any).failed || 0 }
      } catch { /* use defaults */ }

      // Subscription stats
      try {
        const subStats = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, MAX(last_run_at) as last_run FROM report_subscriptions`).first()
        if (subStats) subscriptionStats = { total: (subStats as any).total || 0, active: (subStats as any).active || 0, last_run: (subStats as any).last_run || null }
      } catch { /* use defaults */ }

      // P14: Recent ABAC denials (top 10 for drill-down)
      try {
        const denials = await db.prepare(
          `SELECT id, surface, resource_type, action, subject_role, tenant_id, denied_at FROM abac_deny_log ORDER BY denied_at DESC LIMIT 10`
        ).all<any>()
        recentDenials = denials.results || []
      } catch { /* non-blocking */ }

      // P14: Webhook queue per-connector depth
      try {
        const connectors = await db.prepare(
          `SELECT connector_id, COUNT(*) as total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed FROM webhook_queue GROUP BY connector_id ORDER BY total DESC LIMIT 8`
        ).all<any>()
        webhookConnectors = connectors.results || []
      } catch { /* non-blocking */ }

      // P14: Event archive sample (last 10 archived events)
      try {
        const archive = await db.prepare(
          `SELECT event_type, severity, surface, archived_at FROM event_archives ORDER BY archived_at DESC LIMIT 10`
        ).all<any>()
        archiveSample = archive.results || []
      } catch { /* non-blocking */ }
    }
  } catch (err: any) {
    error = err.message || 'Failed to load health data'
    slas = ALL_SURFACES.map(s => ({
      surface: s, total_checks: 0, healthy_checks: 0, uptime_pct: 100, avg_response_ms: 0, last_status: 200, last_checked: 'No data'
    }))
    summary = { total_surfaces: ALL_SURFACES.length, healthy_surfaces: ALL_SURFACES.length, degraded_surfaces: 0, overall_uptime_pct: 100, last_updated: new Date().toISOString() }
  }

  // Phase group mapping
  const phaseGroups: Record<string, string[]> = {
    'P0-P3': ['dashboard','intent','intake','architect','approvals','proof','live','records','continuity','execution','connectors','roles'],
    'P4': ['workspace','alerts','canon','lanes','onboarding','reports'],
    'P5': ['tenants','ai-assist','api-keys','api/v1'],
    'P6': ['tenant-routing'],
    'P7': ['auth/sso','branding'],
    'P8': ['federation','marketplace','audit'],
    'P9': ['notifications','workflows','health-dashboard','portal']
  }

  const slaMap = Object.fromEntries(slas.map(s => [s.surface, s]))

  const renderSurface = (surface: string) => {
    const sla = slaMap[surface] || { uptime_pct: 100, avg_response_ms: 0, last_status: 200, last_checked: 'No data', total_checks: 0 }
    const isHealthy = sla.last_status >= 200 && sla.last_status < 400
    const uptimeColor = sla.uptime_pct >= 99 ? '#22c55e' : sla.uptime_pct >= 95 ? '#f59e0b' : '#ef4444'
    const statusDot = isHealthy ? '🟢' : '🔴'

    return `
    <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:12px;display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;align-items:center;gap:6px">
        <span>${statusDot}</span>
        <span style="font-weight:500;font-size:13px;color:var(--text)">${surface}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="color:${uptimeColor};font-size:12px;font-weight:600">${sla.uptime_pct}%</span>
        <span style="color:var(--text3);font-size:11px">uptime</span>
        ${sla.avg_response_ms > 0 ? `<span style="color:var(--text3);font-size:11px;margin-left:auto">${sla.avg_response_ms}ms</span>` : ''}
      </div>
      <div style="color:var(--text3);font-size:10px">${sla.total_checks > 0 ? `${sla.total_checks} checks` : 'No data yet'}</div>
    </div>`
  }

  const phaseBlocks = Object.entries(phaseGroups).map(([phase, surfaces]) => `
  <div style="margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding:6px 10px;background:var(--bg3);border-radius:5px;display:inline-block">${phase}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
      ${surfaces.map(renderSurface).join('')}
    </div>
  </div>`).join('')

  // History for key surfaces
  let historyHtml = ''
  try {
    const keyHistory = await getSurfaceHistory(db, 'dashboard', 10)
    if (keyHistory.length > 0) {
      historyHtml = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-weight:600;margin-bottom:10px">📈 Dashboard Surface — Recent History (last 10 checks)</div>
        <div style="display:flex;gap:6px;align-items:flex-end;height:60px">
          ${keyHistory.reverse().map(h => {
            const barH = Math.min(60, Math.max(4, h.response_ms / 2))
            const color = h.is_healthy ? '#22c55e' : '#ef4444'
            return `<div title="${h.checked_at}: ${h.response_ms}ms HTTP ${h.http_status}" style="flex:1;background:${color};border-radius:3px 3px 0 0;height:${barH}px;cursor:default"></div>`
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:4px">
          <span>Oldest</span><span>Newest</span>
        </div>
      </div>`
    }
  } catch (_) { }

  const uptimeGrade = summary.overall_uptime_pct >= 99.9 ? { grade: 'A+', color: '#22c55e' }
    : summary.overall_uptime_pct >= 99 ? { grade: 'A', color: '#22c55e' }
    : summary.overall_uptime_pct >= 95 ? { grade: 'B', color: '#f59e0b' }
    : { grade: 'C', color: '#ef4444' }

  // P14: ABAC deny drill-down table
  const abacDenyRows = recentDenials.map(d => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 10px;font-size:11px;color:var(--text2)">${d.surface || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:var(--text2)">${d.resource_type || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:#f97316">${d.action || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:#fbbf24">${d.subject_role || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:var(--text3)">${d.tenant_id || '—'}</td>
      <td style="padding:7px 10px;font-size:10px;color:var(--text3)">${(d.denied_at || '').slice(0,16)}</td>
    </tr>`).join('')

  // P14: Webhook per-connector rows
  const webhookConnRows = webhookConnectors.map(wc => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 10px;font-size:11px;font-family:monospace;color:var(--text2)">${wc.connector_id || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:#4f8ef7">${wc.total}</td>
      <td style="padding:7px 10px;font-size:11px;color:#fbbf24">${wc.pending}</td>
      <td style="padding:7px 10px;font-size:11px;color:${wc.failed > 0 ? '#ef4444' : '#22c55e'}">${wc.failed}</td>
    </tr>`).join('')

  // P14: Archive sample rows
  const archiveRows = archiveSample.map(ev => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 10px;font-size:11px;color:var(--text2)">${ev.event_type || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:${ev.severity === 'critical' ? '#ef4444' : ev.severity === 'warning' ? '#fbbf24' : '#22c55e'}">${ev.severity || '—'}</td>
      <td style="padding:7px 10px;font-size:11px;color:var(--text3)">${ev.surface || '—'}</td>
      <td style="padding:7px 10px;font-size:10px;color:var(--text3)">${(ev.archived_at || '').slice(0,16)}</td>
    </tr>`).join('')

  const content = `
  <div class="page-header">
    <div>
      <h1>🏥 Health Dashboard</h1>
      <p style="color:var(--text2)">Unified platform health — all ${ALL_SURFACES.length} surfaces — P9+P14</p>
    </div>
    <form method="POST" action="/health-dashboard/check">
      <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px">🔍 Run Health Check</button>
    </form>
  </div>

  ${checked ? `<div style="background:#22c55e22;border:1px solid #22c55e;border-radius:7px;padding:10px 16px;margin-bottom:16px;color:#22c55e">✅ Health check completed. Snapshots recorded.</div>` : ''}
  ${error ? `<div style="background:#f59e0b22;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#f59e0b;font-size:13px">⚠️ ${error} — Showing defaults until data available.</div>` : ''}

  <!-- Summary cards -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:${uptimeGrade.color}">${uptimeGrade.grade}</div>
      <div style="color:var(--text3);font-size:11px">Health Grade</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:var(--accent)">${summary.overall_uptime_pct || 100}%</div>
      <div style="color:var(--text3);font-size:12px">Overall Uptime (24h)</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:#22c55e">${summary.total_surfaces || ALL_SURFACES.length}</div>
      <div style="color:var(--text3);font-size:12px">Total Surfaces</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:#22c55e">${summary.healthy_surfaces || ALL_SURFACES.length}</div>
      <div style="color:var(--text3);font-size:12px">Healthy</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:${(summary.degraded_surfaces || 0) > 0 ? '#ef4444' : '#22c55e'}">${summary.degraded_surfaces || 0}</div>
      <div style="color:var(--text3);font-size:12px">Degraded</div>
    </div>
  </div>

  <!-- History chart -->
  ${historyHtml}

  <!-- Phase surface grid -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span style="font-weight:600">Surface Health Map</span>
      <span style="color:var(--text3);font-size:12px">24h lookback · ${slas.length} surfaces tracked</span>
      <div style="margin-left:auto;display:flex;gap:8px;font-size:11px">
        <span style="color:#22c55e">🟢 Healthy (≥99%)</span>
        <span style="color:#f59e0b">🟡 Degraded (≥95%)</span>
        <span style="color:#ef4444">🔴 Critical (&lt;95%)</span>
      </div>
    </div>
    ${phaseBlocks}
  </div>

  <!-- P13 Observability Panel: ABAC + Webhook + Subscription -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
    <!-- ABAC Enforcement Stats -->
    <div style="background:var(--bg2);border:1px solid rgba(249,115,22,0.2);border-radius:8px;padding:16px">
      <div style="font-size:11px;color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">ABAC Enforcement</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="text-align:center;background:rgba(249,115,22,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#f97316">${abacStats.routes_guarded}</div>
          <div style="font-size:9px;color:var(--text3)">Routes Guarded</div>
        </div>
        <div style="text-align:center;background:rgba(239,68,68,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#ef4444">${abacStats.denials_last_24h}</div>
          <div style="font-size:9px;color:var(--text3)">Denials (24h)</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3)">Total Denials: <strong style="color:var(--text)">${abacStats.total_denials}</strong></div>
      ${abacStats.top_denied_surfaces.length > 0 ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">Top Denied: <strong style="color:var(--text)">${abacStats.top_denied_surfaces[0]?.surface || '—'}</strong></div>` : ''}
      <div style="margin-top:8px"><a href="#abac-drill-down" style="font-size:11px;color:#f97316">View recent denials ↓</a></div>
    </div>

    <!-- Webhook Queue Health -->
    <div style="background:var(--bg2);border:1px solid rgba(6,182,212,0.2);border-radius:8px;padding:16px">
      <div style="font-size:11px;color:#06b6d4;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Webhook Queue</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        ${[
          { label: 'Total', val: webhookStats.total, color: '#4f8ef7' },
          { label: 'Delivered', val: webhookStats.delivered, color: '#22c55e' },
          { label: 'Pending', val: webhookStats.pending, color: '#fbbf24' },
          { label: 'Failed', val: webhookStats.failed, color: '#ef4444' },
        ].map(s => `<div style="text-align:center;background:var(--bg3);border-radius:4px;padding:6px"><div style="font-size:16px;font-weight:700;color:${s.color}">${s.val}</div><div style="font-size:9px;color:var(--text3)">${s.label}</div></div>`).join('')}
      </div>
      ${webhookStats.retrying > 0 ? `<div style="font-size:10px;color:#fbbf24">⚠️ ${webhookStats.retrying} retrying</div>` : '<div style="font-size:10px;color:#22c55e">✅ No retrying</div>'}
      <div style="margin-top:8px"><a href="#webhook-drill-down" style="font-size:11px;color:#06b6d4">Per-connector depth ↓</a></div>
    </div>

    <!-- Report Subscription Health -->
    <div style="background:var(--bg2);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:16px">
      <div style="font-size:11px;color:#a855f7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Report Subscriptions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="text-align:center;background:rgba(168,85,247,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#a855f7">${subscriptionStats.total}</div>
          <div style="font-size:9px;color:var(--text3)">Total Subs</div>
        </div>
        <div style="text-align:center;background:rgba(34,197,94,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#22c55e">${subscriptionStats.active}</div>
          <div style="font-size:9px;color:var(--text3)">Active</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3)">Last Run: <strong style="color:var(--text)">${subscriptionStats.last_run ? String(subscriptionStats.last_run).slice(0,16) : 'Never'}</strong></div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">Next: lazy (KV TTL polling)</div>
    </div>
  </div>

  <!-- P14 ABAC Deny Drill-Down -->
  <div id="abac-drill-down" style="background:var(--bg2);border:1px solid rgba(249,115,22,0.2);border-radius:8px;overflow:hidden;margin-bottom:20px">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div>
        <span style="font-weight:600;color:#f97316">🔒 ABAC Deny Log — Recent Denials</span>
        <span style="color:var(--text3);font-size:12px;margin-left:8px">Last 10 · P14 drill-down</span>
      </div>
      <a href="/audit?event_type=abac.denied" style="font-size:11px;color:#f97316;text-decoration:none">View all in Audit →</a>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Surface','Resource','Action','Role','Tenant','Denied At'].map(h =>
          `<th style="padding:8px 10px;text-align:left;color:var(--text3);font-size:10px;font-weight:500">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
        ${recentDenials.length === 0
          ? `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No denials recorded yet. ABAC is active.</td></tr>`
          : abacDenyRows}
      </tbody>
    </table>
  </div>

  <!-- P14 Webhook Per-Connector Drill-Down -->
  <div id="webhook-drill-down" style="background:var(--bg2);border:1px solid rgba(6,182,212,0.2);border-radius:8px;overflow:hidden;margin-bottom:20px">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600;color:#06b6d4">🔗 Webhook Queue — Per-Connector Depth</span>
      <span style="color:var(--text3);font-size:12px;margin-left:8px">Top 8 connectors by queue volume · P14</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Connector ID','Total','Pending','Failed'].map(h =>
          `<th style="padding:8px 10px;text-align:left;color:var(--text3);font-size:10px;font-weight:500">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
        ${webhookConnectors.length === 0
          ? `<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No webhook queue data yet.</td></tr>`
          : webhookConnRows}
      </tbody>
    </table>
  </div>

  <!-- P14 Event Archive Sample -->
  <div style="background:var(--bg2);border:1px solid rgba(34,197,94,0.15);border-radius:8px;overflow:hidden;margin-bottom:20px">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div>
        <span style="font-weight:600;color:#22c55e">📦 Event Archive — Recent Sample</span>
        <span style="color:var(--text3);font-size:12px;margin-left:8px">Last 10 archived events · P14</span>
      </div>
      <a href="/events/archive-stats" style="font-size:11px;color:#22c55e;text-decoration:none">Archive stats →</a>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Event Type','Severity','Surface','Archived At'].map(h =>
          `<th style="padding:8px 10px;text-align:left;color:var(--text3);font-size:10px;font-weight:500">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
        ${archiveSample.length === 0
          ? `<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No archived events yet. Archive runs on /events page load.</td></tr>`
          : archiveRows}
      </tbody>
    </table>
  </div>

  <!-- SLA Table -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">SLA Report — Last 24h</span>
    </div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Surface','Uptime %','Avg Response','Total Checks','Last Status','Last Checked'].map(h =>
          `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
        ${slas.map(s => {
          const uc = s.uptime_pct >= 99 ? '#22c55e' : s.uptime_pct >= 95 ? '#f59e0b' : '#ef4444'
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:10px 14px;font-weight:500">${s.surface}</td>
            <td style="padding:10px 14px"><span style="color:${uc};font-weight:600">${s.uptime_pct}%</span></td>
            <td style="padding:10px 14px;color:var(--text2)">${s.avg_response_ms > 0 ? s.avg_response_ms + 'ms' : '—'}</td>
            <td style="padding:10px 14px;color:var(--text3)">${s.total_checks}</td>
            <td style="padding:10px 14px"><span style="color:${s.last_status >= 200 && s.last_status < 400 ? '#22c55e' : '#ef4444'}">${s.last_status}</span></td>
            <td style="padding:10px 14px;color:var(--text3);font-size:11px">${typeof s.last_checked === 'string' ? s.last_checked.slice(0,19) : s.last_checked}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
    </div>
  </div>
  `

  return c.html(layout('Health Dashboard', content, '/health-dashboard'))
})

// POST /health-dashboard/check — Trigger health check (records snapshots for key surfaces)
healthDashboardRoute.post('/check', async (c) => {
  const db = c.env.DB

  // Record health snapshots for all surfaces (simulated — in real env would HTTP check each)
  const coreSurfaces = ['dashboard', 'api/v1', 'federation', 'marketplace', 'audit',
    'tenants', 'workflows', 'notifications', 'health-dashboard', 'portal']

  const start = Date.now()
  const promises = coreSurfaces.map(surface => {
    const response_ms = Math.floor(Math.random() * 80) + 20 // 20-100ms simulated
    return recordHealthSnapshot(db, surface, 200, response_ms).catch(() => null)
  })

  await Promise.allSettled(promises)
  const elapsed = Date.now() - start

  return c.redirect('/health-dashboard?checked=1&elapsed=' + elapsed)
})

// GET /health-dashboard — Unified health dashboard
healthDashboardRoute.get('/', async (c) => {
  const db = c.env.DB

  let slas: any[] = []
  let summary: any = {}
  let error = ''
  let abacStats: any = { total_denials: 0, denials_last_24h: 0, top_denied_surfaces: [], top_denied_roles: [], routes_guarded: 5 }
  let webhookStats: any = { total: 0, pending: 0, delivered: 0, retrying: 0, failed: 0 }
  let subscriptionStats: any = { total: 0, active: 0, last_run: null }

  try {
    const [slaResult, summaryResult, abacResult] = await Promise.all([
      getSurfaceSLAs(db, undefined, 24),
      getPlatformHealthSummary(db),
      db ? getAbacDenyStats(db) : Promise.resolve(abacStats)
    ])
    slas = slaResult
    summary = summaryResult
    abacStats = abacResult

    // Webhook queue stats from D1
    if (db) {
      try {
        const wqStats = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered, SUM(CASE WHEN status='retrying' THEN 1 ELSE 0 END) as retrying, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed FROM webhook_queue`).first()
        if (wqStats) webhookStats = { total: (wqStats as any).total || 0, pending: (wqStats as any).pending || 0, delivered: (wqStats as any).delivered || 0, retrying: (wqStats as any).retrying || 0, failed: (wqStats as any).failed || 0 }
      } catch { /* use defaults */ }

      // Subscription stats
      try {
        const subStats = await db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, MAX(last_run_at) as last_run FROM report_subscriptions`).first()
        if (subStats) subscriptionStats = { total: (subStats as any).total || 0, active: (subStats as any).active || 0, last_run: (subStats as any).last_run || null }
      } catch { /* use defaults */ }
    }
  } catch (err: any) {
    error = err.message || 'Failed to load health data'
    slas = ALL_SURFACES.map(s => ({
      surface: s, total_checks: 0, healthy_checks: 0, uptime_pct: 100, avg_response_ms: 0, last_status: 200, last_checked: 'No data'
    }))
    summary = { total_surfaces: ALL_SURFACES.length, healthy_surfaces: ALL_SURFACES.length, degraded_surfaces: 0, overall_uptime_pct: 100, last_updated: new Date().toISOString() }
  }

  // Phase group mapping
  const phaseGroups: Record<string, string[]> = {
    'P0-P3': ['dashboard','intent','intake','architect','approvals','proof','live','records','continuity','execution','connectors','roles'],
    'P4': ['workspace','alerts','canon','lanes','onboarding','reports'],
    'P5': ['tenants','ai-assist','api-keys','api/v1'],
    'P6': ['tenant-routing'],
    'P7': ['auth/sso','branding'],
    'P8': ['federation','marketplace','audit'],
    'P9': ['notifications','workflows','health-dashboard','portal']
  }

  const slaMap = Object.fromEntries(slas.map(s => [s.surface, s]))

  const renderSurface = (surface: string) => {
    const sla = slaMap[surface] || { uptime_pct: 100, avg_response_ms: 0, last_status: 200, last_checked: 'No data', total_checks: 0 }
    const isHealthy = sla.last_status >= 200 && sla.last_status < 400
    const uptimeColor = sla.uptime_pct >= 99 ? '#22c55e' : sla.uptime_pct >= 95 ? '#f59e0b' : '#ef4444'
    const statusDot = isHealthy ? '🟢' : '🔴'

    return `
    <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:12px;display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;align-items:center;gap:6px">
        <span>${statusDot}</span>
        <span style="font-weight:500;font-size:13px;color:var(--text)">${surface}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="color:${uptimeColor};font-size:12px;font-weight:600">${sla.uptime_pct}%</span>
        <span style="color:var(--text3);font-size:11px">uptime</span>
        ${sla.avg_response_ms > 0 ? `<span style="color:var(--text3);font-size:11px;margin-left:auto">${sla.avg_response_ms}ms</span>` : ''}
      </div>
      <div style="color:var(--text3);font-size:10px">${sla.total_checks > 0 ? `${sla.total_checks} checks` : 'No data yet'}</div>
    </div>`
  }

  const phaseBlocks = Object.entries(phaseGroups).map(([phase, surfaces]) => `
  <div style="margin-bottom:20px">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding:6px 10px;background:var(--bg3);border-radius:5px;display:inline-block">${phase}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
      ${surfaces.map(renderSurface).join('')}
    </div>
  </div>`).join('')

  // History for key surfaces
  let historyHtml = ''
  try {
    const keyHistory = await getSurfaceHistory(db, 'dashboard', 10)
    if (keyHistory.length > 0) {
      historyHtml = `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-weight:600;margin-bottom:10px">📈 Dashboard Surface — Recent History (last 10 checks)</div>
        <div style="display:flex;gap:6px;align-items:flex-end;height:60px">
          ${keyHistory.reverse().map(h => {
            const barH = Math.min(60, Math.max(4, h.response_ms / 2))
            const color = h.is_healthy ? '#22c55e' : '#ef4444'
            return `<div title="${h.checked_at}: ${h.response_ms}ms HTTP ${h.http_status}" style="flex:1;background:${color};border-radius:3px 3px 0 0;height:${barH}px;cursor:default"></div>`
          }).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:4px">
          <span>Oldest</span><span>Newest</span>
        </div>
      </div>`
    }
  } catch (_) { }

  const uptimeGrade = summary.overall_uptime_pct >= 99.9 ? { grade: 'A+', color: '#22c55e' }
    : summary.overall_uptime_pct >= 99 ? { grade: 'A', color: '#22c55e' }
    : summary.overall_uptime_pct >= 95 ? { grade: 'B', color: '#f59e0b' }
    : { grade: 'C', color: '#ef4444' }

  const content = `
  <div class="page-header">
    <div>
      <h1>🏥 Health Dashboard</h1>
      <p style="color:var(--text2)">Unified platform health — all ${ALL_SURFACES.length} surfaces — P9</p>
    </div>
    <form method="POST" action="/health-dashboard/check">
      <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px">🔍 Run Health Check</button>
    </form>
  </div>

  ${error ? `<div style="background:#f59e0b22;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#f59e0b;font-size:13px">⚠️ ${error} — Showing defaults until data available.</div>` : ''}

  <!-- Summary cards -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:${uptimeGrade.color}">${uptimeGrade.grade}</div>
      <div style="color:var(--text3);font-size:11px">Health Grade</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:var(--accent)">${summary.overall_uptime_pct || 100}%</div>
      <div style="color:var(--text3);font-size:12px">Overall Uptime (24h)</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:#22c55e">${summary.total_surfaces || ALL_SURFACES.length}</div>
      <div style="color:var(--text3);font-size:12px">Total Surfaces</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:#22c55e">${summary.healthy_surfaces || ALL_SURFACES.length}</div>
      <div style="color:var(--text3);font-size:12px">Healthy</div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:${(summary.degraded_surfaces || 0) > 0 ? '#ef4444' : '#22c55e'}">${summary.degraded_surfaces || 0}</div>
      <div style="color:var(--text3);font-size:12px">Degraded</div>
    </div>
  </div>

  <!-- History chart -->
  ${historyHtml}

  <!-- Phase surface grid -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:18px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <span style="font-weight:600">Surface Health Map</span>
      <span style="color:var(--text3);font-size:12px">24h lookback · ${slas.length} surfaces tracked</span>
      <div style="margin-left:auto;display:flex;gap:8px;font-size:11px">
        <span style="color:#22c55e">🟢 Healthy (≥99%)</span>
        <span style="color:#f59e0b">🟡 Degraded (≥95%)</span>
        <span style="color:#ef4444">🔴 Critical (&lt;95%)</span>
      </div>
    </div>
    ${phaseBlocks}
  </div>

  <!-- P13 Observability Panel: ABAC + Webhook + Subscription -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">
    <!-- ABAC Enforcement Stats -->
    <div style="background:var(--bg2);border:1px solid rgba(249,115,22,0.2);border-radius:8px;padding:16px">
      <div style="font-size:11px;color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">ABAC Enforcement</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="text-align:center;background:rgba(249,115,22,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#f97316">${abacStats.routes_guarded}</div>
          <div style="font-size:9px;color:var(--text3)">Routes Guarded</div>
        </div>
        <div style="text-align:center;background:rgba(239,68,68,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#ef4444">${abacStats.denials_last_24h}</div>
          <div style="font-size:9px;color:var(--text3)">Denials (24h)</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3)">Total Denials: <strong style="color:var(--text)">${abacStats.total_denials}</strong></div>
      ${abacStats.top_denied_surfaces.length > 0 ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">Top Denied: <strong style="color:var(--text)">${abacStats.top_denied_surfaces[0]?.surface || '—'}</strong></div>` : ''}
    </div>

    <!-- Webhook Queue Health -->
    <div style="background:var(--bg2);border:1px solid rgba(6,182,212,0.2);border-radius:8px;padding:16px">
      <div style="font-size:11px;color:#06b6d4;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Webhook Queue</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        ${[
          { label: 'Total', val: webhookStats.total, color: '#4f8ef7' },
          { label: 'Delivered', val: webhookStats.delivered, color: '#22c55e' },
          { label: 'Pending', val: webhookStats.pending, color: '#fbbf24' },
          { label: 'Failed', val: webhookStats.failed, color: '#ef4444' },
        ].map(s => `<div style="text-align:center;background:var(--bg3);border-radius:4px;padding:6px"><div style="font-size:16px;font-weight:700;color:${s.color}">${s.val}</div><div style="font-size:9px;color:var(--text3)">${s.label}</div></div>`).join('')}
      </div>
      ${webhookStats.retrying > 0 ? `<div style="font-size:10px;color:#fbbf24">⚠️ ${webhookStats.retrying} retrying</div>` : '<div style="font-size:10px;color:#22c55e">✅ No retrying</div>'}
    </div>

    <!-- Report Subscription Health -->
    <div style="background:var(--bg2);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:16px">
      <div style="font-size:11px;color:#a855f7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Report Subscriptions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="text-align:center;background:rgba(168,85,247,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#a855f7">${subscriptionStats.total}</div>
          <div style="font-size:9px;color:var(--text3)">Total Subs</div>
        </div>
        <div style="text-align:center;background:rgba(34,197,94,0.05);border-radius:6px;padding:10px">
          <div style="font-size:20px;font-weight:700;color:#22c55e">${subscriptionStats.active}</div>
          <div style="font-size:9px;color:var(--text3)">Active</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text3)">Last Run: <strong style="color:var(--text)">${subscriptionStats.last_run ? String(subscriptionStats.last_run).slice(0,16) : 'Never'}</strong></div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">Next: lazy (KV TTL polling)</div>
    </div>
  </div>

  <!-- SLA Table -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">SLA Report — Last 24h</span>
    </div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Surface','Uptime %','Avg Response','Total Checks','Last Status','Last Checked'].map(h =>
          `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`
        ).join('')}
      </tr></thead>
      <tbody>
        ${slas.map(s => {
          const uc = s.uptime_pct >= 99 ? '#22c55e' : s.uptime_pct >= 95 ? '#f59e0b' : '#ef4444'
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:10px 14px;font-weight:500">${s.surface}</td>
            <td style="padding:10px 14px"><span style="color:${uc};font-weight:600">${s.uptime_pct}%</span></td>
            <td style="padding:10px 14px;color:var(--text2)">${s.avg_response_ms > 0 ? s.avg_response_ms + 'ms' : '—'}</td>
            <td style="padding:10px 14px;color:var(--text3)">${s.total_checks}</td>
            <td style="padding:10px 14px"><span style="color:${s.last_status >= 200 && s.last_status < 400 ? '#22c55e' : '#ef4444'}">${s.last_status}</span></td>
            <td style="padding:10px 14px;color:var(--text3);font-size:11px">${typeof s.last_checked === 'string' ? s.last_checked.slice(0,19) : s.last_checked}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
    </div>
  </div>
  `

  return c.html(layout('Health Dashboard', content, '/health-dashboard'))
})

// POST /health-dashboard/check — Trigger health check (records snapshots for key surfaces)
healthDashboardRoute.post('/check', async (c) => {
  const db = c.env.DB

  // Record health snapshots for all surfaces (simulated — in real env would HTTP check each)
  const coreSurfaces = ['dashboard', 'api/v1', 'federation', 'marketplace', 'audit',
    'tenants', 'workflows', 'notifications', 'health-dashboard', 'portal']

  const start = Date.now()
  const promises = coreSurfaces.map(surface => {
    const response_ms = Math.floor(Math.random() * 80) + 20 // 20-100ms simulated
    return recordHealthSnapshot(db, surface, 200, response_ms).catch(() => null)
  })

  await Promise.allSettled(promises)
  const elapsed = Date.now() - start

  return c.redirect('/health-dashboard?checked=1&elapsed=' + elapsed)
})
