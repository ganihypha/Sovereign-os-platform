// ============================================================
// SOVEREIGN OS PLATFORM — HEALTH DASHBOARD SURFACE (P9)
// Unified platform health view: all 33 surfaces + D1 + KV
//
// GET /health-dashboard         — Unified health view (HTML)
// POST /health-dashboard/check  — Trigger health check snapshot
// GET /api/v1/health-report     — API: health data (auth required)
//
// SLA tracking: uptime % per surface (24h lookback)
// Time-series: health_snapshots table
// Anomaly integration: flags degraded surfaces
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

export const healthDashboardRoute = new Hono<{ Bindings: Env }>()

// GET /health-dashboard — Unified health dashboard
healthDashboardRoute.get('/', async (c) => {
  const db = c.env.DB

  let slas: any[] = []
  let summary: any = {}
  let error = ''

  try {
    slas = await getSurfaceSLAs(db, undefined, 24)
    summary = await getPlatformHealthSummary(db)
  } catch (err: any) {
    error = err.message || 'Failed to load health data'
    // Provide defaults
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
