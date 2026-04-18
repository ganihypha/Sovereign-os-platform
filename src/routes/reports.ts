// ============================================================
// SOVEREIGN OS PLATFORM — CROSS-LANE REPORTS (P10 UPGRADE)
// P4: Real D1-aggregated metrics. No fake numbers.
// P6: Added Chart.js visual observability charts.
// P7: Metrics snapshot time-series (metrics_snapshots table).
//     Timeline chart upgraded to use real snapshots.
//     Auto-triggers daily snapshot on /reports load.
// P10: Downloadable CSV/JSON governance reports (6 report types).
//      Report templates, filters (date range, tenant, status).
//      Report job history tracking via report_jobs table.
// All metrics computed from actual D1 queries.
// /reports — visual dashboard with charts + P10 download panel
// /reports/download — POST: generate + download report
// /reports/jobs — GET: report job history
// /api/reports — JSON metrics endpoint
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'
import { takeMetricsSnapshot, getMetricsHistory } from '../lib/metricsService'
import { generateReport, getReportJobs, REPORT_TYPES, type ReportFormat, type ReportType, type ReportFilters } from '../lib/reportingService'

function metricCard(label: string, value: number, sub: string, color: string): string {
  return `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
    <div style="font-size:11px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">${label}</div>
    <div style="font-size:32px;font-weight:700;color:${color};margin-bottom:4px">${value}</div>
    <div style="font-size:11px;color:var(--text3)">${sub}</div>
  </div>`
}

function statusBar(label: string, value: number, max: number, color: string): string {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return `
  <div style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:12px;color:var(--text2)">${label}</span>
      <span style="font-size:12px;font-weight:600;color:${color}">${value}</span>
    </div>
    <div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">
      <div style="background:${color};height:100%;border-radius:4px;width:${pct}%;transition:width 0.5s"></div>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:3px">${pct}% of ${max}</div>
  </div>`
}

export function createReportsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /reports — visual dashboard with Chart.js observability charts
  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)

    // P7: Auto-trigger daily snapshot (fire-and-forget — never blocks page)
    takeMetricsSnapshot(repo, { tenantId: 'tenant-default', snapshotType: 'daily' }).catch(() => {})

    // Fetch all real data from D1
    const [
      sessions, approvals, workItems, proofs,
      execEntries, connectors, priorities, canonItems,
      alerts, lanes
    ] = await Promise.all([
      repo.getSessions(),
      repo.getApprovalRequests(),
      repo.getWorkItems ? repo.getWorkItems() : Promise.resolve([]),
      repo.getProofArtifacts(),
      repo.getExecutionEntries(),
      repo.getConnectors(),
      repo.getPriorityItems(),
      repo.getCanonCandidates(),
      repo.getAlerts(),
      repo.getProductLanes(),
    ])

    const metrics = {
      total_sessions: sessions.length,
      active_sessions: sessions.filter(s => s.status === 'active').length,
      closed_sessions: sessions.filter(s => s.status === 'closed').length,
      pending_approvals: approvals.filter(a => a.status === 'pending').length,
      resolved_approvals: approvals.filter(a => a.status !== 'pending').length,
      running_executions: execEntries.filter(e => e.status === 'running').length,
      done_executions: execEntries.filter(e => e.status === 'done').length,
      blocked_executions: execEntries.filter(e => e.status === 'blocked').length,
      total_executions: execEntries.length,
      active_connectors: connectors.filter(c => c.status === 'active').length,
      pending_connectors: connectors.filter(c => c.status === 'pending').length,
      inactive_connectors: connectors.filter(c => c.status === 'inactive').length,
      total_connectors: connectors.length,
      pending_proofs: proofs.filter(p => p.status === 'pending').length,
      reviewed_proofs: proofs.filter(p => p.status === 'reviewed').length,
      total_proofs: proofs.length,
      proof_pass_rate: proofs.length > 0
        ? Math.round((proofs.filter(p => p.outcome_classification === 'PASS').length / proofs.length) * 100)
        : 0,
      active_lanes: lanes.filter(l => l.status === 'active').length,
      total_lanes: lanes.length,
      unread_alerts: alerts.filter(a => !a.acknowledged).length,
      total_alerts: alerts.length,
      canon_candidates: canonItems.filter(c => c.status === 'candidate').length,
      promoted_canon: canonItems.filter(c => c.status === 'promoted').length,
      blockers: priorities.filter(p => p.blocker && !p.resolved).length,
      now_items: priorities.filter(p => p.category === 'NOW' && !p.resolved).length,
    }

    // Build last-7-days session data from actual session created_at timestamps
    const last7Days: string[] = []
    const sessionCountByDay: number[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
      last7Days.push(label)
      const dateStr = d.toISOString().slice(0, 10)
      sessionCountByDay.push(sessions.filter(s => s.created_at && s.created_at.startsWith(dateStr)).length)
    }

    // P7: Fetch metrics_snapshots time-series for timeline chart
    const snapshotHistory = await getMetricsHistory(repo, 'tenant-default', 'daily', 30)
    const hasSnapshots = snapshotHistory.length > 0
    const snapshotLabels = hasSnapshots
      ? snapshotHistory.map(s => s.period_label)
      : last7Days
    const snapshotSessions = hasSnapshots
      ? snapshotHistory.map(s => s.active_sessions)
      : sessionCountByDay
    const snapshotExecs = hasSnapshots
      ? snapshotHistory.map(s => s.running_executions)
      : sessionCountByDay.map(() => 0)

    const content = `
    <!-- Chart.js CDN — P6 Observability Charts -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Cross-Lane Reports</h1>
        <div style="font-size:12px;color:var(--text2)">Real-time governance health metrics · All data from D1 · Generated ${new Date().toLocaleString()}</div>
        <div style="margin-top:4px;font-size:11px;color:#22c55e">● P6 — Visual Observability Charts Active</div>
      </div>
      <a href="/api/reports" target="_blank" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;text-decoration:none">
        Export JSON →
      </a>
    </div>

    <!-- Primary Metrics -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px">
      ${metricCard('Active Sessions', metrics.active_sessions, `of ${metrics.total_sessions} total`, '#22c55e')}
      ${metricCard('Pending Approvals', metrics.pending_approvals, `of ${metrics.pending_approvals + metrics.resolved_approvals} total`, metrics.pending_approvals > 0 ? '#f59e0b' : '#22c55e')}
      ${metricCard('Running Executions', metrics.running_executions, `of ${metrics.total_executions} total`, '#4f8ef7')}
      ${metricCard('Active Connectors', metrics.active_connectors, `of ${metrics.total_connectors} registered`, '#22d3ee')}
      ${metricCard('Unread Alerts', metrics.unread_alerts, `of ${metrics.total_alerts} total`, metrics.unread_alerts > 0 ? '#f59e0b' : '#22c55e')}
      ${metricCard('Active Lanes', metrics.active_lanes, `of ${metrics.total_lanes} registered`, '#a855f7')}
      ${metricCard('Canon Candidates', metrics.canon_candidates, `${metrics.promoted_canon} promoted`, '#f59e0b')}
      ${metricCard('Active Blockers', metrics.blockers, `NOW items: ${metrics.now_items}`, metrics.blockers > 0 ? '#ef4444' : '#22c55e')}
    </div>

    <!-- P6 OBSERVABILITY CHARTS ROW 1 -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px">

      <!-- Chart 1: Execution Status Donut -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Execution Status</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Live breakdown from D1</div>
        <div style="position:relative;height:180px;display:flex;align-items:center;justify-content:center">
          <canvas id="execDonutChart" width="180" height="180"></canvas>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:8px;flex-wrap:wrap">
          <span style="font-size:10px;color:#4f8ef7">● Running (${metrics.running_executions})</span>
          <span style="font-size:10px;color:#22c55e">● Done (${metrics.done_executions})</span>
          <span style="font-size:10px;color:#ef4444">● Blocked (${metrics.blocked_executions})</span>
        </div>
      </div>

      <!-- Chart 2: Connector Health Pie -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Connector Health</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Registry status distribution</div>
        <div style="position:relative;height:180px;display:flex;align-items:center;justify-content:center">
          <canvas id="connPieChart" width="180" height="180"></canvas>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:8px;flex-wrap:wrap">
          <span style="font-size:10px;color:#22d3ee">● Active (${metrics.active_connectors})</span>
          <span style="font-size:10px;color:#f59e0b">● Pending (${metrics.pending_connectors})</span>
          <span style="font-size:10px;color:#9aa3b2">● Inactive (${metrics.inactive_connectors})</span>
        </div>
      </div>

      <!-- Chart 3: Approval Funnel -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Approval Funnel</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:12px">Pending vs Resolved</div>
        <div style="position:relative;height:180px;display:flex;align-items:center;justify-content:center">
          <canvas id="approvalBarChart" width="220" height="180"></canvas>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:8px;flex-wrap:wrap">
          <span style="font-size:10px;color:#f59e0b">● Pending (${metrics.pending_approvals})</span>
          <span style="font-size:10px;color:#22c55e">● Resolved (${metrics.resolved_approvals})</span>
        </div>
      </div>
    </div>

    <!-- P6 CHART ROW 2 — Session Timeline (P7: upgraded to use metrics_snapshots) -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:13px;font-weight:600;color:var(--text)">Platform Metrics Timeline</div>
        <span style="font-size:10px;padding:2px 8px;border-radius:3px;${hasSnapshots ? 'background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3)' : 'background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.3)'}">
          ${hasSnapshots ? `● ${snapshotHistory.length} snapshots from D1` : '⚠ Using session timestamps (no snapshots yet)'}
        </span>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:16px">
        ${hasSnapshots ? 'Real metrics_snapshots time-series — P7 LIVE' : 'Visit /reports daily to accumulate snapshots for richer timeline'}
      </div>
      <canvas id="sessionTimelineChart" height="80"></canvas>
    </div>

    <!-- Legacy bar charts -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <!-- Execution Health -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:16px">Execution Board Health</div>
        ${statusBar('Running', metrics.running_executions, metrics.total_executions, '#4f8ef7')}
        ${statusBar('Done', metrics.done_executions, metrics.total_executions, '#22c55e')}
        ${statusBar('Blocked', metrics.blocked_executions, metrics.total_executions, '#ef4444')}
        <div style="margin-top:12px;font-size:11px;color:var(--text3)">Blocked items require immediate resolution before progression.</div>
      </div>

      <!-- Proof Health -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:16px">Proof Verification Health</div>
        ${statusBar('Reviewed', metrics.reviewed_proofs, metrics.total_proofs, '#22c55e')}
        ${statusBar('Pending Review', metrics.pending_proofs, metrics.total_proofs, '#f59e0b')}
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;color:var(--text2)">PASS Rate</span>
            <span style="font-size:12px;font-weight:600;color:${metrics.proof_pass_rate > 70 ? '#22c55e' : '#f59e0b'}">${metrics.proof_pass_rate}%</span>
          </div>
          <div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">
            <div style="background:${metrics.proof_pass_rate > 70 ? '#22c55e' : '#f59e0b'};height:100%;border-radius:4px;width:${metrics.proof_pass_rate}%"></div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text3)">Proof PASS rate above 70% indicates healthy execution quality.</div>
      </div>
    </div>

    <!-- Session & Approval Status -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:16px">Session & Approval Status</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">
        ${statusBar('Active Sessions', metrics.active_sessions, metrics.total_sessions, '#22c55e')}
        ${statusBar('Closed Sessions', metrics.closed_sessions, metrics.total_sessions, '#9aa3b2')}
        ${statusBar('Pending Approvals', metrics.pending_approvals, metrics.pending_approvals + metrics.resolved_approvals, '#f59e0b')}
        ${statusBar('Resolved Approvals', metrics.resolved_approvals, metrics.pending_approvals + metrics.resolved_approvals, '#22c55e')}
      </div>
    </div>

    <div style="padding:12px 16px;background:rgba(79,142,247,0.06);border:1px solid rgba(79,142,247,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
      <span style="color:var(--accent);font-weight:600">Data Integrity:</span> All metrics are computed from real D1 database queries.
      No hardcoded or synthetic data exists in this report. Metrics refresh on each page load.
      Use <a href="/api/reports" style="color:var(--accent)">/api/reports</a> for programmatic access.
      <span style="color:#22c55e;margin-left:8px">● P6 Chart.js observability layer active.</span>
      <span style="color:#a855f7;margin-left:8px">● P7 metrics_snapshots time-series active (${snapshotHistory.length} snapshots).</span>
      <span style="color:#f97316;margin-left:8px">● P10 Governance Report Downloads active.</span>
    </div>

    <!-- P10: GOVERNANCE REPORT DOWNLOAD PANEL -->
    <div style="margin-top:24px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <h2 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">Governance Report Downloads</h2>
          <div style="font-size:11px;color:var(--text3)">P10 — Export governance data as CSV or JSON · All data from D1</div>
        </div>
        <a href="/reports/jobs" style="font-size:11px;color:var(--accent);text-decoration:none;border:1px solid rgba(79,142,247,0.3);padding:6px 12px;border-radius:6px">View Report History →</a>
      </div>

      <form action="/reports/download" method="POST" id="report-download-form">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Report Type</label>
            <select name="report_type" id="reportType" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
              ${REPORT_TYPES.map(r => `<option value="${r.type}">${r.icon} ${r.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Format</label>
            <select name="format" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
              <option value="csv">CSV (Excel-compatible)</option>
              <option value="json">JSON (API-compatible)</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Status Filter (optional)</label>
            <select name="status" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Date From (optional)</label>
            <input type="date" name="date_from" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Date To (optional)</label>
            <input type="date" name="date_to" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Max Rows</label>
            <select name="limit" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
              <option value="100">100 rows</option>
              <option value="500" selected>500 rows</option>
              <option value="1000">1000 rows</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <button type="submit" style="background:#f97316;color:#fff;border:none;border-radius:6px;padding:10px 24px;font-size:13px;font-weight:600;cursor:pointer">
            ↓ Generate &amp; Download Report
          </button>
          <span id="reportTypeDesc" style="font-size:11px;color:var(--text3)">Select a report type to see description.</span>
        </div>
      </form>
    </div>

    <script>
    (function(){
      const descs = ${JSON.stringify(REPORT_TYPES.reduce((acc, r) => { (acc as Record<string,string>)[r.type] = r.description; return acc }, {} as Record<string,string>))};
      const sel = document.getElementById('reportType');
      const desc = document.getElementById('reportTypeDesc');
      function updateDesc() { if(sel && desc) desc.textContent = descs[sel.value] || ''; }
      if(sel) { sel.addEventListener('change', updateDesc); updateDesc(); }
    })();
    </script>

    <!-- P6 Chart.js Initialization Scripts -->
    <script>
    (function() {
      // Common chart options for dark theme
      Chart.defaults.color = '#9aa3b2'
      Chart.defaults.borderColor = '#2a2d35'
      Chart.defaults.font.family = "'Inter', 'SF Mono', monospace"
      Chart.defaults.font.size = 11

      // 1. Execution Status Donut
      const execCtx = document.getElementById('execDonutChart')
      if (execCtx) {
        new Chart(execCtx, {
          type: 'doughnut',
          data: {
            labels: ['Running', 'Done', 'Blocked'],
            datasets: [{
              data: [${metrics.running_executions}, ${metrics.done_executions}, ${metrics.blocked_executions}],
              backgroundColor: ['#4f8ef7', '#22c55e', '#ef4444'],
              borderWidth: 0,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return ' ' + ctx.label + ': ' + ctx.parsed } } } },
            cutout: '65%'
          }
        })
      }

      // 2. Connector Health Pie
      const connCtx = document.getElementById('connPieChart')
      if (connCtx) {
        new Chart(connCtx, {
          type: 'pie',
          data: {
            labels: ['Active', 'Pending', 'Inactive'],
            datasets: [{
              data: [${metrics.active_connectors}, ${metrics.pending_connectors}, ${metrics.inactive_connectors}],
              backgroundColor: ['#22d3ee', '#f59e0b', '#9aa3b2'],
              borderWidth: 0,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return ' ' + ctx.label + ': ' + ctx.parsed } } } }
          }
        })
      }

      // 3. Approval Funnel Bar
      const appCtx = document.getElementById('approvalBarChart')
      if (appCtx) {
        new Chart(appCtx, {
          type: 'bar',
          data: {
            labels: ['Pending', 'Resolved'],
            datasets: [{
              label: 'Approvals',
              data: [${metrics.pending_approvals}, ${metrics.resolved_approvals}],
              backgroundColor: ['#f59e0b', '#22c55e'],
              borderRadius: 6,
              borderSkipped: false
            }]
          },
          options: {
            responsive: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#9aa3b2' } },
              y: { grid: { color: '#2a2d35' }, ticks: { color: '#9aa3b2', stepSize: 1 }, beginAtZero: true }
            }
          }
        })
      }

      // 4. Platform Metrics Timeline — P7 real metrics_snapshots
      const sessCtx = document.getElementById('sessionTimelineChart')
      if (sessCtx) {
        new Chart(sessCtx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(snapshotLabels)},
            datasets: [
              {
                label: 'Active Sessions',
                data: ${JSON.stringify(snapshotSessions)},
                backgroundColor: 'rgba(79,142,247,0.7)',
                borderColor: '#4f8ef7',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
              },
              {
                label: 'Running Executions',
                data: ${JSON.stringify(snapshotExecs)},
                backgroundColor: 'rgba(34,211,238,0.5)',
                borderColor: '#22d3ee',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
              }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: true, labels: { color: '#9aa3b2', boxWidth: 12, font: { size: 10 } } } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#9aa3b2' } },
              y: { grid: { color: '#2a2d35' }, ticks: { color: '#9aa3b2', stepSize: 1 }, beginAtZero: true }
            }
          }
        })
      }
    })()
    </script>`

    return c.html(layout('Reports', content, '/reports'))
  })

  // ============================================================
  // P10: POST /reports/download — generate + stream CSV or JSON
  // ============================================================
  route.post('/download', async (c) => {
    if (!c.env.DB) return c.text('DB not configured', 503)
    const body = await c.req.parseBody()
    const reportType = (body['report_type'] as ReportType) || 'platform_summary'
    const format = (body['format'] as ReportFormat) || 'json'
    const filters: ReportFilters = {
      date_from: body['date_from'] as string || undefined,
      date_to: body['date_to'] as string || undefined,
      status: body['status'] as string || undefined,
      limit: parseInt(body['limit'] as string || '500', 10),
    }

    try {
      const result = await generateReport(c.env.DB, reportType, format, filters, 'tenant-default', 'ui-download')

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
      const filename = `sovereign-os-${reportType}-${timestamp}.${format}`

      if (format === 'csv') {
        return new Response(result.csv || '', {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Report-Rows': String(result.row_count),
            'X-Report-Type': reportType,
          }
        })
      } else {
        const jsonOutput = JSON.stringify({
          meta: {
            report_type: result.report_type,
            generated_at: result.generated_at,
            tenant_id: result.tenant_id,
            filters: result.filters,
            row_count: result.row_count,
            platform: 'Sovereign OS Platform',
            version: '1.0.0-P10',
          },
          data: result.data
        }, null, 2)
        return new Response(jsonOutput, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Report-Rows': String(result.row_count),
          }
        })
      }
    } catch (err) {
      return c.html(layout('Report Error', `
        <div style="padding:24px;color:#ef4444;background:var(--bg2);border-radius:8px;border:1px solid rgba(239,68,68,0.3)">
          <h2 style="font-size:16px;font-weight:700;margin-bottom:8px">Report Generation Failed</h2>
          <p style="font-size:13px;color:var(--text2)">${String(err)}</p>
          <a href="/reports" style="display:inline-block;margin-top:12px;color:var(--accent);font-size:12px">← Back to Reports</a>
        </div>
      `, '/reports'), 500)
    }
  })

  // ============================================================
  // P10: GET /reports/jobs — report job history
  // ============================================================
  route.get('/jobs', async (c) => {
    if (!c.env.DB) {
      return c.html(layout('Report History', `<div style="padding:24px;color:var(--text2)">DB not configured</div>`, '/reports'))
    }
    const jobs = await getReportJobs(c.env.DB, undefined, 50)

    const rows = jobs.map(j => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px;font-size:12px;font-family:monospace;color:var(--text3)">${j.id}</td>
        <td style="padding:10px 12px;font-size:12px;color:var(--text)">${j.report_type.replace(/_/g, ' ')}</td>
        <td style="padding:10px 12px;font-size:12px">
          <span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;
            background:${j.format === 'csv' ? 'rgba(34,197,94,0.1)' : 'rgba(79,142,247,0.1)'};
            color:${j.format === 'csv' ? '#22c55e' : '#4f8ef7'};
            border:1px solid ${j.format === 'csv' ? 'rgba(34,197,94,0.3)' : 'rgba(79,142,247,0.3)'}">
            ${j.format.toUpperCase()}
          </span>
        </td>
        <td style="padding:10px 12px;font-size:12px;color:var(--text2)">${j.row_count}</td>
        <td style="padding:10px 12px;font-size:12px;color:var(--text3)">${j.created_by}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${j.created_at ? new Date(j.created_at).toLocaleString() : ''}</td>
      </tr>
    `).join('')

    const content = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Report Job History</h1>
          <div style="font-size:12px;color:var(--text2)">P10 — Recent report generation log · ${jobs.length} records</div>
        </div>
        <a href="/reports" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;text-decoration:none">← Back to Reports</a>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--bg3)">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Job ID</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Report Type</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Format</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Rows</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Created By</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Generated At</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--text3);font-size:12px">No report jobs yet — generate a report above.</td></tr>'}
          </tbody>
        </table>
      </div>
    `
    return c.html(layout('Report History', content, '/reports'))
  })

  return route
}
