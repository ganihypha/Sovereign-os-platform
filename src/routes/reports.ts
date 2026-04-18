// ============================================================
// SOVEREIGN OS PLATFORM — CROSS-LANE REPORTS (P6 UPGRADE)
// P4: Real D1-aggregated metrics. No fake numbers.
// P6: Added Chart.js visual observability charts.
//     - Execution status donut chart
//     - Session timeline bar chart
//     - Approval funnel bar chart
//     - Connector health pie chart
// All metrics computed from actual D1 queries.
// /reports — visual dashboard with charts
// /api/reports — JSON metrics endpoint
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'

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

    <!-- P6 CHART ROW 2 — Session Timeline -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:24px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Session Activity — Last 7 Days</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:16px">Sessions created per day (from D1 timestamps)</div>
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
    </div>

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

      // 4. Session Timeline Bar (last 7 days)
      const sessCtx = document.getElementById('sessionTimelineChart')
      if (sessCtx) {
        new Chart(sessCtx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(last7Days)},
            datasets: [{
              label: 'Sessions Created',
              data: ${JSON.stringify(sessionCountByDay)},
              backgroundColor: 'rgba(79,142,247,0.7)',
              borderColor: '#4f8ef7',
              borderWidth: 1,
              borderRadius: 4,
              borderSkipped: false
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
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

  return route
}
