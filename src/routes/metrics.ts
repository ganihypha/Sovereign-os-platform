// ============================================================
// SOVEREIGN OS PLATFORM — METRICS SURFACE (P16)
// Purpose: Platform-wide KPIs, trend charts, export
// Surface: /metrics
//
// GET /metrics         — KPIs + Chart.js trend charts (7d/30d)
// GET /metrics/api     — JSON KPIs
// GET /metrics/export  — CSV export of KPI snapshot
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'

async function getMetricsSnapshot(db: D1Database): Promise<Record<string, any>> {
  const now = new Date()
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString()
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString()

  async function count(table: string, where?: string, params?: any[]): Promise<number> {
    try {
      const sql = `SELECT COUNT(*) as n FROM ${table}${where ? ' WHERE ' + where : ''}`
      const stmt = params ? db.prepare(sql).bind(...params) : db.prepare(sql)
      const r = await stmt.first<{ n: number }>()
      return r?.n ?? 0
    } catch { return 0 }
  }

  const [
    totalEvents,      events7d,       events30d,
    totalAudit,       audit7d,
    totalTenants,     activeTenants,
    totalAlertRules,
    alertsFired7d,
    abacDenies7d,     abacDeniesTotal,
    webhookFailed7d,
    totalNotifs,      notifs7d,
    totalWorkflows,   workflowsActive,
    totalIntents,     intentsActive,
    totalConnectors,  connectorsActive,
    totalApprovals,   pendingApprovals,
    exportJobs7d,
  ] = await Promise.all([
    count('events'),
    count('events', 'created_at >= ?', [d7]),
    count('events', 'created_at >= ?', [d30]),
    count('audit_log_v2'),
    count('audit_log_v2', 'created_at >= ?', [d7]),
    count('tenants'),
    count('tenants', "status = 'active'"),
    count('alert_rules'),
    count('audit_log_v2', "event_type = 'alert_rule.triggered' AND created_at >= ?", [d7]),
    count('abac_deny_log', 'created_at >= ?', [d7]),
    count('abac_deny_log'),
    count('audit_log_v2', "event_type = 'webhook.delivery_failed' AND created_at >= ?", [d7]),
    count('notifications'),
    count('notifications', 'created_at >= ?', [d7]),
    count('workflow_definitions'),
    count('workflow_definitions', "status = 'active'"),
    count('intents'),
    count('intents', "status = 'active'"),
    count('connectors'),
    count('connectors', "status = 'active'"),
    count('approval_requests'),
    count('approval_requests', "status = 'pending'"),
    count('audit_export_jobs', 'created_at >= ?', [d7]),
  ])

  return {
    events: { total: totalEvents, last7d: events7d, last30d: events30d },
    audit: { total: totalAudit, last7d: audit7d },
    tenants: { total: totalTenants, active: activeTenants },
    alertRules: { total: totalAlertRules, fired7d: alertsFired7d },
    abac: { denies7d: abacDenies7d, deniesTotal: abacDeniesTotal },
    webhooks: { failed7d: webhookFailed7d },
    notifications: { total: totalNotifs, last7d: notifs7d },
    workflows: { total: totalWorkflows, active: workflowsActive },
    intents: { total: totalIntents, active: intentsActive },
    connectors: { total: totalConnectors, active: connectorsActive },
    approvals: { total: totalApprovals, pending: pendingApprovals },
    exports: { jobs7d: exportJobs7d },
    snapshot_at: now.toISOString(),
  }
}

async function getTrendData(db: D1Database, days: number): Promise<{ labels: string[]; events: number[]; audit: number[]; abac: number[]; notifs: number[] }> {
  const labels: string[] = []
  const evArr: number[] = []
  const auArr: number[] = []
  const abArr: number[] = []
  const noArr: number[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dayStart = d.toISOString().slice(0, 10) + 'T00:00:00.000Z'
    const dayEnd = d.toISOString().slice(0, 10) + 'T23:59:59.999Z'
    labels.push(d.toISOString().slice(5, 10)) // MM-DD

    async function countDay(table: string, where?: string): Promise<number> {
      try {
        const sql = `SELECT COUNT(*) as n FROM ${table} WHERE created_at >= ? AND created_at <= ?` + (where ? ' AND ' + where : '')
        const r = await db.prepare(sql).bind(dayStart, dayEnd).first<{ n: number }>()
        return r?.n ?? 0
      } catch { return 0 }
    }

    const [ev, au, ab, no] = await Promise.all([
      countDay('events'),
      countDay('audit_log_v2'),
      countDay('abac_deny_log'),
      countDay('notifications'),
    ])
    evArr.push(ev)
    auArr.push(au)
    abArr.push(ab)
    noArr.push(no)
  }

  return { labels, events: evArr, audit: auArr, abac: abArr, notifs: noArr }
}

export function createMetricsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /metrics — Main KPI dashboard
  route.get('/', async (c) => {
    const periodParam = (c.req.query('period') || '7') as string
    const period = periodParam === '30' ? 30 : 7

    let snap: Record<string, any> = {}
    let trend: { labels: string[]; events: number[]; audit: number[]; abac: number[]; notifs: number[] } = {
      labels: [], events: [], audit: [], abac: [], notifs: []
    }

    if (c.env.DB) {
      ;[snap, trend] = await Promise.all([
        getMetricsSnapshot(c.env.DB),
        getTrendData(c.env.DB, period),
      ])
    } else {
      snap = {
        events: { total: 0, last7d: 0, last30d: 0 },
        audit: { total: 0, last7d: 0 },
        tenants: { total: 0, active: 0 },
        alertRules: { total: 0, fired7d: 0 },
        abac: { denies7d: 0, deniesTotal: 0 },
        webhooks: { failed7d: 0 },
        notifications: { total: 0, last7d: 0 },
        workflows: { total: 0, active: 0 },
        intents: { total: 0, active: 0 },
        connectors: { total: 0, active: 0 },
        approvals: { total: 0, pending: 0 },
        exports: { jobs7d: 0 },
      }
    }

    const abacDenyRate = snap.events?.last7d > 0
      ? ((snap.abac?.denies7d / Math.max(snap.events?.last7d, 1)) * 100).toFixed(1)
      : '0.0'

    const kpiCards = [
      { label: 'Events (7d)', value: snap.events?.last7d ?? 0, sub: `${snap.events?.total ?? 0} total`, color: 'var(--accent)' },
      { label: 'Active Tenants', value: snap.tenants?.active ?? 0, sub: `${snap.tenants?.total ?? 0} total`, color: 'var(--cyan)' },
      { label: 'Alerts Fired (7d)', value: snap.alertRules?.fired7d ?? 0, sub: `${snap.alertRules?.total ?? 0} rules configured`, color: 'var(--yellow)' },
      { label: 'ABAC Deny Rate', value: abacDenyRate + '%', sub: `${snap.abac?.denies7d ?? 0} denials last 7d`, color: snap.abac?.denies7d > 0 ? 'var(--red)' : 'var(--green)' },
      { label: 'Audit Events (7d)', value: snap.audit?.last7d ?? 0, sub: `${snap.audit?.total ?? 0} total in trail`, color: 'var(--orange)' },
      { label: 'Notifications (7d)', value: snap.notifications?.last7d ?? 0, sub: `${snap.notifications?.total ?? 0} total inbox`, color: 'var(--purple)' },
      { label: 'Active Workflows', value: snap.workflows?.active ?? 0, sub: `${snap.workflows?.total ?? 0} total`, color: 'var(--emerald)' },
      { label: 'Pending Approvals', value: snap.approvals?.pending ?? 0, sub: `${snap.approvals?.total ?? 0} total requests`, color: snap.approvals?.pending > 0 ? 'var(--yellow)' : 'var(--text3)' },
    ]

    const kpiHtml = kpiCards.map(k => `
      <div class="stat-card">
        <div class="stat-label">${k.label}</div>
        <div class="stat-value" style="color:${k.color}">${k.value}</div>
        <div class="stat-sub">${k.sub}</div>
      </div>
    `).join('')

    const trendLabelsJson = JSON.stringify(trend.labels)
    const trendEventsJson = JSON.stringify(trend.events)
    const trendAuditJson = JSON.stringify(trend.audit)
    const trendAbacJson = JSON.stringify(trend.abac)
    const trendNotifsJson = JSON.stringify(trend.notifs)

    const content = `
      <div style="max-width:1200px">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4" style="flex-wrap:wrap;gap:12px">
          <div>
            <h1 style="font-size:20px;font-weight:700;margin:0 0 4px">📈 Platform Metrics</h1>
            <p style="color:var(--text3);font-size:12px;margin:0">P16+P17 — Platform-wide KPIs, trend analytics, auto-refresh, snapshots</p>
          </div>
          <div class="flex gap-2" style="flex-wrap:wrap;align-items:center">
            <a href="/metrics?period=7" class="btn ${period === 7 ? 'btn-primary' : 'btn-ghost'} btn-sm">7 Days</a>
            <a href="/metrics?period=30" class="btn ${period === 30 ? 'btn-primary' : 'btn-ghost'} btn-sm">30 Days</a>
            <button id="auto-refresh-btn" onclick="toggleAutoRefresh()" class="btn btn-ghost btn-sm" style="min-width:120px">⏱ Auto-Refresh: OFF</button>
            <button onclick="saveSnapshot()" id="snapshot-btn" class="btn btn-ghost btn-sm">📸 Save Snapshot</button>
            <a href="/metrics/snapshots" class="btn btn-ghost btn-sm">🗂 History</a>
            <a href="/metrics/export" class="btn btn-ghost btn-sm">⬇ CSV</a>
            <a href="/metrics/api" class="btn btn-ghost btn-sm">{ } JSON</a>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid-4 mb-4">
          ${kpiHtml}
        </div>

        <!-- Trend Charts -->
        <div class="grid-2 mb-4">
          <div class="card">
            <div class="card-header">
              <span class="card-title">📡 Events + Audit (${period}d trend)</span>
              <span class="badge badge-blue">Live Data</span>
            </div>
            <canvas id="chart-events-audit" height="200"></canvas>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">🔒 ABAC Denials + Notifications (${period}d)</span>
              <span class="badge badge-orange">Security</span>
            </div>
            <canvas id="chart-abac-notifs" height="200"></canvas>
          </div>
        </div>

        <!-- Summary table -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Platform Summary</span>
            <span class="text-sm text-muted mono">Snapshot at: ${snap.snapshot_at ? snap.snapshot_at.slice(0,19).replace('T',' ') : new Date().toISOString().slice(0,19).replace('T',' ')} UTC</span>
          </div>
          <div class="grid-3" style="gap:1px;background:var(--border);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:0">
            ${[
              ['Platform Events', snap.events?.total ?? 0, snap.events?.last7d ?? 0],
              ['Audit Trail', snap.audit?.total ?? 0, snap.audit?.last7d ?? 0],
              ['Tenants', snap.tenants?.total ?? 0, snap.tenants?.active ?? 0],
              ['Notifications', snap.notifications?.total ?? 0, snap.notifications?.last7d ?? 0],
              ['Intents', snap.intents?.total ?? 0, snap.intents?.active ?? 0],
              ['Connectors', snap.connectors?.total ?? 0, snap.connectors?.active ?? 0],
            ].map(([label, total, recent]) => `
              <div style="background:var(--bg2);padding:16px">
                <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">${label}</div>
                <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono',monospace">${total}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px">${typeof recent === 'number' && recent !== total ? (label.includes('Tenant') || label.includes('Intent') || label.includes('Connector') ? recent + ' active' : recent + ' last 7d') : ''}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Quick links -->
        <div class="card">
          <div class="card-header"><span class="card-title">Quick Navigation</span></div>
          <div class="btn-group">
            <a href="/events" class="btn btn-ghost btn-sm">📡 Events</a>
            <a href="/audit" class="btn btn-ghost btn-sm">🔏 Audit Trail</a>
            <a href="/alert-rules" class="btn btn-ghost btn-sm">🔔 Alert Rules</a>
            <a href="/notifications" class="btn btn-ghost btn-sm">🔔 Notifications</a>
            <a href="/tenants" class="btn btn-ghost btn-sm">⊛ Tenants</a>
            <a href="/workflows" class="btn btn-ghost btn-sm">⚡ Workflows</a>
            <a href="/health-dashboard" class="btn btn-ghost btn-sm">🏥 Health</a>
            <a href="/reports" class="btn btn-ghost btn-sm">📊 Reports</a>
          </div>
        </div>
      </div>

      <div id="auto-refresh-status" style="display:none;padding:8px 16px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:6px;font-size:11px;color:#22c55e;margin-top:8px">
        🟢 Auto-refresh active — updating every 30s. <span id="next-refresh-countdown">30s</span> until next update.
      </div>

      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
      <script>
        const isDark = document.getElementById('html-root').getAttribute('data-theme') !== 'light'
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
        const textColor = isDark ? '#5a6478' : '#9ca3af'
        const trendLabels = ${trendLabelsJson}
        const trendEvents = ${trendEventsJson}
        const trendAudit = ${trendAuditJson}
        const trendAbac = ${trendAbacJson}
        const trendNotifs = ${trendNotifsJson}

        Chart.defaults.color = textColor
        Chart.defaults.borderColor = gridColor

        // Events + Audit chart
        new Chart(document.getElementById('chart-events-audit'), {
          type: 'line',
          data: {
            labels: trendLabels,
            datasets: [
              {
                label: 'Events',
                data: trendEvents,
                borderColor: '#4f8ef7',
                backgroundColor: 'rgba(79,142,247,0.08)',
                tension: 0.3,
                fill: true,
                pointRadius: 3,
              },
              {
                label: 'Audit',
                data: trendAudit,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245,158,11,0.06)',
                tension: 0.3,
                fill: false,
                pointRadius: 3,
              },
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: {
              y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { size: 10 } } },
              x: { grid: { color: gridColor }, ticks: { font: { size: 10 } } },
            },
          }
        })

        // P17: Auto-refresh logic
        let autoRefreshTimer = null;
        let countdown = 30;
        let countdownTimer = null;

        function toggleAutoRefresh() {
          const btn = document.getElementById('auto-refresh-btn');
          const status = document.getElementById('auto-refresh-status');
          if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            clearInterval(countdownTimer);
            autoRefreshTimer = null;
            btn.textContent = '⏱ Auto-Refresh: OFF';
            btn.style.color = '';
            status.style.display = 'none';
          } else {
            autoRefreshTimer = setInterval(() => { location.reload(); }, 30000);
            countdown = 30;
            countdownTimer = setInterval(() => {
              countdown--;
              const el = document.getElementById('next-refresh-countdown');
              if (el) el.textContent = countdown + 's';
              if (countdown <= 0) countdown = 30;
            }, 1000);
            btn.textContent = '⏱ Auto-Refresh: ON';
            btn.style.color = '#22c55e';
            status.style.display = 'block';
          }
        }

        // P17: Save snapshot
        async function saveSnapshot() {
          const btn = document.getElementById('snapshot-btn');
          btn.textContent = '⏳ Saving...';
          btn.disabled = true;
          try {
            const res = await fetch('/metrics/snapshots', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              if (typeof showToast === 'function') showToast('Snapshot Saved', 'Metrics snapshot stored to history', 'success');
              btn.textContent = '✓ Saved!';
              setTimeout(() => { btn.textContent = '📸 Save Snapshot'; btn.disabled = false; }, 2000);
            } else {
              btn.textContent = '✗ Failed';
              setTimeout(() => { btn.textContent = '📸 Save Snapshot'; btn.disabled = false; }, 2000);
            }
          } catch(e) {
            btn.textContent = '✗ Error';
            setTimeout(() => { btn.textContent = '📸 Save Snapshot'; btn.disabled = false; }, 2000);
          }
        }

        // ABAC + Notifications chart
        new Chart(document.getElementById('chart-abac-notifs'), {
          type: 'bar',
          data: {
            labels: trendLabels,
            datasets: [
              {
                label: 'ABAC Denials',
                data: trendAbac,
                backgroundColor: 'rgba(239,68,68,0.5)',
                borderColor: '#ef4444',
                borderWidth: 1,
              },
              {
                label: 'Notifications',
                data: trendNotifs,
                backgroundColor: 'rgba(168,85,247,0.4)',
                borderColor: '#a855f7',
                borderWidth: 1,
              },
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: {
              y: { beginAtZero: true, stacked: false, grid: { color: gridColor }, ticks: { font: { size: 10 } } },
              x: { grid: { color: gridColor }, ticks: { font: { size: 10 } } },
            },
          }
        })
      </script>
    `

    return c.html(layout('Platform Metrics', content, '/metrics', 0, {
      breadcrumbs: [{ label: 'Metrics' }]
    }))
  })

  // GET /metrics/api — JSON KPI endpoint
  route.get('/api', async (c) => {
    if (!c.env.DB) return c.json({ error: 'DB not available' }, 503)
    const snap = await getMetricsSnapshot(c.env.DB)
    return c.json({ status: 'ok', metrics: snap })
  })

  // GET /metrics/snapshots — Snapshot history page
  route.get('/snapshots', async (c) => {
    const db = c.env.DB
    let snapshots: any[] = []
    if (db) {
      try {
        const rows = await db.prepare(
          `SELECT id, snapshot_json, period, created_at FROM platform_metrics_snapshots ORDER BY created_at DESC LIMIT 50`
        ).all<any>()
        snapshots = rows.results || []
      } catch { /* non-blocking */ }
    }

    const snapshotRows = snapshots.map(s => {
      let parsed: any = {}
      try { parsed = JSON.parse(s.snapshot_json || '{}') } catch { /* ignore */ }
      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 12px;font-size:10px;color:var(--text3);font-family:monospace">${s.id}</td>
          <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${s.period || '—'}</td>
          <td style="padding:8px 12px;font-size:11px;color:var(--accent)">${parsed.events?.total ?? '—'}</td>
          <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${parsed.audit?.total ?? '—'}</td>
          <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${parsed.tenants?.active ?? '—'}</td>
          <td style="padding:8px 12px;font-size:11px;color:${(parsed.abac?.denies7d || 0) > 0 ? '#ef4444' : 'var(--text3)'}">${parsed.abac?.denies7d ?? '—'}</td>
          <td style="padding:8px 12px;font-size:10px;color:var(--text3)">${(s.created_at || '').slice(0,16)}</td>
        </tr>
      `
    }).join('')

    const content = `
      <div class="page-header" style="margin-bottom:24px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">🗂 Metrics Snapshot History</h1>
          <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P17 — Stored KPI snapshots for trend comparison</p>
        </div>
        <a href="/metrics" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Metrics</a>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:auto">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px">
          Stored Snapshots <span style="font-size:11px;color:var(--text3);font-weight:400">(${snapshots.length} total, last 50)</span>
        </div>
        <table style="width:100%;border-collapse:collapse;min-width:600px">
          <thead><tr style="background:var(--bg3)">
            ${['ID','Period','Events Total','Audit Total','Active Tenants','ABAC Denies (7d)','Captured At'].map(h =>
              `<th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>
            ${snapshots.length === 0
              ? `<tr><td colspan="7" style="padding:30px;text-align:center;color:var(--text3)">No snapshots yet. Click 📸 Save Snapshot on the metrics page or use the API.</td></tr>`
              : snapshotRows}
          </tbody>
        </table>
      </div>
    `
    return c.html(layout('Metrics Snapshots — P17', content, '/metrics', 0, {
      breadcrumbs: [{ label: 'Metrics', href: '/metrics' }, { label: 'Snapshots' }]
    }))
  })

  // POST /metrics/snapshots — Save current snapshot to history
  route.post('/snapshots', async (c) => {
    const db = c.env.DB
    if (!db) return c.json({ success: false, error: 'DB not available' }, 503)
    try {
      const snap = await getMetricsSnapshot(db)
      const snapshotJson = JSON.stringify(snap)
      await db.prepare(
        `INSERT INTO platform_metrics_snapshots (snapshot_json, period, created_at)
         VALUES (?, '7d', CURRENT_TIMESTAMP)`
      ).bind(snapshotJson).run()
      return c.json({ success: true, snapshot_at: snap.snapshot_at })
    } catch (e: any) {
      return c.json({ success: false, error: e.message || 'Insert failed' }, 500)
    }
  })

  // GET /metrics/export — CSV export
  route.get('/export', async (c) => {
    let snap: Record<string, any> = {}
    if (c.env.DB) {
      snap = await getMetricsSnapshot(c.env.DB)
    }

    const rows = [
      ['Metric', 'Value', 'Period', 'Snapshot At'],
      ['events_total', snap.events?.total ?? 0, 'all-time', snap.snapshot_at ?? ''],
      ['events_last7d', snap.events?.last7d ?? 0, '7d', snap.snapshot_at ?? ''],
      ['events_last30d', snap.events?.last30d ?? 0, '30d', snap.snapshot_at ?? ''],
      ['audit_total', snap.audit?.total ?? 0, 'all-time', snap.snapshot_at ?? ''],
      ['audit_last7d', snap.audit?.last7d ?? 0, '7d', snap.snapshot_at ?? ''],
      ['tenants_total', snap.tenants?.total ?? 0, 'all-time', snap.snapshot_at ?? ''],
      ['tenants_active', snap.tenants?.active ?? 0, 'now', snap.snapshot_at ?? ''],
      ['alert_rules_total', snap.alertRules?.total ?? 0, 'all-time', snap.snapshot_at ?? ''],
      ['alerts_fired_7d', snap.alertRules?.fired7d ?? 0, '7d', snap.snapshot_at ?? ''],
      ['abac_denies_7d', snap.abac?.denies7d ?? 0, '7d', snap.snapshot_at ?? ''],
      ['abac_denies_total', snap.abac?.deniesTotal ?? 0, 'all-time', snap.snapshot_at ?? ''],
      ['webhook_failed_7d', snap.webhooks?.failed7d ?? 0, '7d', snap.snapshot_at ?? ''],
      ['notifications_total', snap.notifications?.total ?? 0, 'all-time', snap.snapshot_at ?? ''],
      ['notifications_7d', snap.notifications?.last7d ?? 0, '7d', snap.snapshot_at ?? ''],
      ['workflows_active', snap.workflows?.active ?? 0, 'now', snap.snapshot_at ?? ''],
      ['intents_total', snap.intents?.total ?? 0, 'all-time', snap.snapshot_at ?? ''],
      ['connectors_active', snap.connectors?.active ?? 0, 'now', snap.snapshot_at ?? ''],
      ['approvals_pending', snap.approvals?.pending ?? 0, 'now', snap.snapshot_at ?? ''],
    ]

    const csv = rows.map(r => r.join(',')).join('\n')
    const date = new Date().toISOString().slice(0, 10)

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sovereign-metrics-${date}.csv"`,
        'Cache-Control': 'no-cache',
      }
    })
  })

  return route
}
