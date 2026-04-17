// ============================================================
// SOVEREIGN OS PLATFORM — CROSS-LANE REPORTS (P4)
// Real D1-aggregated metrics. No fake numbers.
// All metrics computed from actual D1 queries.
// /reports — visual dashboard
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

  // GET /reports — visual dashboard
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

    const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Cross-Lane Reports</h1>
        <div style="font-size:12px;color:var(--text2)">Real-time governance health metrics · All data from D1 · Generated ${new Date().toLocaleString()}</div>
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
    </div>`

    return c.html(layout('Reports', content, '/reports'))
  })

  return route
}
