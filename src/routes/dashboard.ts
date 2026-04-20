// ============================================================
// SOVEREIGN OS PLATFORM — DASHBOARD ROUTE (P2)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated, authStatusBadge } from '../lib/auth'
import { buildRoleContext, roleBadge } from '../lib/roles'
import { assessContinuityHealth, continuityHealthBadge } from '../lib/continuity'
import type { Env } from '../index'

export function createDashboardRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)
    const roleCtx = buildRoleContext(isAuth)

    const db = c.env.DB

    const [sessions, approvals, priorities, proofs, continuities, notes, execEntries, connectors, alerts, lanes] = await Promise.all([
      repo.getSessions(),
      repo.getApprovalRequests(),
      repo.getPriorityItems(),
      repo.getProofArtifacts(),
      repo.getSessionContinuity(),
      repo.getOperatorNotes(),
      repo.getExecutionEntries(),
      repo.getConnectors(),
      repo.getAlerts ? repo.getAlerts() : Promise.resolve([]),
      repo.getProductLanes ? repo.getProductLanes() : Promise.resolve([]),
    ])

    // P16: Live platform stats from D1
    let liveEventCount = 0
    let liveAuditCount = 0
    let liveNotifCount = 0
    let liveAbacDenies = 0
    let recentAuditEvents: any[] = []
    let unreadNotifCount = 0
    let liveSearchCount = 0  // P20
    let liveSearchRecent24h = 0  // P20

    if (db) {
      try {
        const [ev, au, no, ab, recentAu, unreadNo, sc, sc24] = await Promise.all([
          db.prepare(`SELECT COUNT(*) as n FROM events`).first<{ n: number }>(),
          db.prepare(`SELECT COUNT(*) as n FROM audit_log_v2`).first<{ n: number }>(),
          db.prepare(`SELECT COUNT(*) as n FROM notifications`).first<{ n: number }>(),
          db.prepare(`SELECT COUNT(*) as n FROM abac_deny_log`).first<{ n: number }>(),
          db.prepare(`SELECT id, event_type, actor, tenant_id, created_at FROM audit_log_v2 ORDER BY created_at DESC LIMIT 10`).all<any>(),
          db.prepare(`SELECT COUNT(*) as n FROM notifications WHERE read_at IS NULL`).first<{ n: number }>().catch(() => ({ n: 0 })),
          // P20: search_log counts
          db.prepare(`SELECT COUNT(*) as n FROM search_log`).first<{ n: number }>().catch(() => ({ n: 0 })),
          db.prepare(`SELECT COUNT(*) as n FROM search_log WHERE created_at >= datetime('now', '-24 hours')`).first<{ n: number }>().catch(() => ({ n: 0 })),
        ])
        liveEventCount = ev?.n ?? 0
        liveAuditCount = au?.n ?? 0
        liveNotifCount = no?.n ?? 0
        liveAbacDenies = ab?.n ?? 0
        recentAuditEvents = recentAu.results || []
        unreadNotifCount = unreadNo?.n ?? 0
        liveSearchCount = (sc as any)?.n ?? 0
        liveSearchRecent24h = (sc24 as any)?.n ?? 0
      } catch { /* non-blocking */ }
    }
    const continuityAssessment = await assessContinuityHealth(repo)

    const activeSessions = sessions.filter(s => s.status === 'active')
    const pendingApprovals = approvals.filter(a => a.status === 'pending')
    const blockers = priorities.filter(p => p.blocker && !p.resolved)
    const nowItems = priorities.filter(p => p.category === 'NOW' && !p.resolved)
    const recentProof = proofs.slice(-5).reverse()
    const unresolvedNotes = notes.filter(n => !n.resolved)
    const latestContinuity = [...continuities].sort((a,b) => b.created_at.localeCompare(a.created_at))[0]

    const runningExec = execEntries.filter(e => e.status === 'running')
    const blockedExec = execEntries.filter(e => e.status === 'blocked')
    const activeConnectors = connectors.filter(c => c.status === 'active')
    const unreadAlerts = (alerts as { acknowledged: boolean }[]).filter(a => !a.acknowledged)
    const activeAlertCount = unreadAlerts.length
    const activeLanes = (lanes as { status: string }[]).filter(l => l.status === 'active')

    const persistBadge = repo.isPersistent
      ? '<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">D1 PERSISTENT</span>'
      : '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">IN-MEMORY (no D1 binding)</span>'

    const continuityBadge = continuityHealthBadge(continuityAssessment.health, continuityAssessment.score)

    const statsHtml = `
      <div class="grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-label">Active Sessions</div>
          <div class="stat-value" style="color:var(--green)">${activeSessions.length}</div>
          <div class="stat-sub">of ${sessions.length} total</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending Approvals</div>
          <div class="stat-value" style="color:var(--yellow)">${pendingApprovals.length}</div>
          <div class="stat-sub">${pendingApprovals.filter(a=>a.approval_tier>=2).length} high-tier</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Blockers</div>
          <div class="stat-value" style="color:var(--red)">${blockers.length}</div>
          <div class="stat-sub">resolve before proceeding</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">NOW Items</div>
          <div class="stat-value" style="color:var(--accent)">${nowItems.length}</div>
          <div class="stat-sub">current session targets</div>
        </div>
      </div>
      <div class="grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-label">Continuity Health</div>
          <div style="margin-top:6px">${continuityBadge}</div>
          <div class="stat-sub">${continuities.length} snapshot(s)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Execution Running</div>
          <div class="stat-value" style="color:var(--accent)">${runningExec.length}</div>
          <div class="stat-sub">${blockedExec.length} blocked · <a href="/execution" style="color:var(--accent)">Board →</a></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Connectors</div>
          <div class="stat-value" style="color:var(--green)">${activeConnectors.length}</div>
          <div class="stat-sub">${connectors.length} total · <a href="/connectors" style="color:var(--accent)">Hub →</a></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Auth Status</div>
          <div style="margin-top:6px">${authStatusBadge(!!c.env.PLATFORM_API_KEY, isAuth)}</div>
          <div class="stat-sub">Build: P4 Operationalized</div>
        </div>
      </div>
      <div class="grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-label">Unread Alerts</div>
          <div class="stat-value" style="color:${activeAlertCount > 0 ? 'var(--yellow)' : 'var(--green)'}">${activeAlertCount}</div>
          <div class="stat-sub"><a href="/alerts" style="color:var(--accent)">Alert Center →</a></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Lanes</div>
          <div class="stat-value" style="color:var(--purple)">${activeLanes.length}</div>
          <div class="stat-sub"><a href="/lanes" style="color:var(--accent)">Lane Directory →</a></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Role Workspace</div>
          <div style="margin-top:6px">${roleBadge(roleCtx)}</div>
          <div class="stat-sub"><a href="/workspace" style="color:var(--accent)">Open Workspace →</a></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Platform Reports</div>
          <div class="stat-value" style="color:var(--cyan)">→</div>
          <div class="stat-sub"><a href="/reports" style="color:var(--accent)">View Reports →</a></div>
        </div>
      </div>`

    const sessionRow = activeSessions.map(s => `
      <tr>
        <td><span class="mono text-sm">${s.id}</span></td>
        <td><strong>${s.title}</strong><br><span class="text-muted text-sm">${s.bounded_brief.substring(0,80)}...</span></td>
        <td>${badgeStatus(s.status)}</td>
        <td><span class="text-sm text-muted">${timeAgo(s.created_at)}</span></td>
        <td><a href="/architect" class="btn btn-ghost btn-sm">Open Workbench</a></td>
      </tr>`).join('')

    const approvalRows = pendingApprovals.slice(0,5).map(a => `
      <tr>
        <td><span class="mono text-sm">${a.id}</span></td>
        <td>${a.action_type}</td>
        <td><span class="tier-${a.approval_tier}">T${a.approval_tier}</span></td>
        <td>${badgeStatus(a.status)}</td>
        <td><a href="/approvals" class="btn btn-primary btn-sm">Review</a></td>
      </tr>`).join('')

    const blockerRows = blockers.map(b => `
      <div class="blocker-bar">⛔ ${b.title} — ${b.blocker_description}</div>`).join('')

    const nowRows = nowItems.map(p => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--red);font-size:11px;font-weight:700;min-width:36px">NOW</span>
        <span>${p.title}</span>
        ${p.session_target ? '<span class="badge badge-blue">SESSION TARGET</span>' : ''}
      </div>`).join('')

    // Last continuity snapshot next-locked-move
    const nextMove = latestContinuity?.next_locked_move
      ? `<div style="background:rgba(79,142,247,0.08);border:1px solid rgba(79,142,247,0.2);border-radius:4px;padding:8px 12px;font-size:12px;margin-bottom:12px">
          <strong>Next Locked Move:</strong> ${latestContinuity.next_locked_move}
          <span style="font-size:11px;color:var(--muted);margin-left:8px">— from latest continuity snapshot</span>
         </div>`
      : ''

    // P16: Recent audit activity feed
    const activityFeedHtml = recentAuditEvents.length > 0 ? recentAuditEvents.map(ev => {
      const icons: Record<string, string> = {
        'intent.created': '◈', 'approval.approved': '✓', 'approval.rejected': '✗',
        'abac.access_denied': '🔒', 'webhook.delivery_failed': '⚡', 'event.archived': '📦',
        'anomaly.detected': '⚠',
      }
      const icon = icons[ev.event_type] || '◉'
      const colors: Record<string, string> = {
        'abac.access_denied': 'var(--red)', 'webhook.delivery_failed': 'var(--orange)',
        'anomaly.detected': 'var(--yellow)',
      }
      const color = colors[ev.event_type] || 'var(--text2)'
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="width:28px;height:28px;border-radius:6px;background:var(--bg3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px">${icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:500;color:${color}">${ev.event_type}</div>
            <div style="font-size:11px;color:var(--text3)">Actor: ${ev.actor || '—'} · ${ev.tenant_id ? 'Tenant: ' + ev.tenant_id : 'Platform'}</div>
          </div>
          <div style="font-size:10px;color:var(--text3);flex-shrink:0">${timeAgo(ev.created_at)}</div>
        </div>`
    }).join('') : '<p class="text-muted text-sm">No audit events yet.</p>'

    const content = `
      <div class="law-bar">Operating Law: Founder → L1 Master Architect → L2 Orchestrator → L3 Executor → Proof → Review → Live State → Canon</div>

      <!-- P16: Quick action buttons -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:12px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;align-items:center">
        <span style="font-size:11px;color:var(--text3);margin-right:4px">Quick Actions:</span>
        <a href="/intent" class="btn btn-ghost btn-sm">◈ New Intent</a>
        <a href="/events" class="btn btn-ghost btn-sm">📡 Event Bus</a>
        <a href="/audit?format=csv" class="btn btn-ghost btn-sm">⬇ Export Audit</a>
        <a href="/search" class="btn btn-ghost btn-sm">🔍 Search</a>
        <a href="/metrics" class="btn btn-ghost btn-sm">📈 Metrics</a>
        <a href="/health-dashboard" class="btn btn-ghost btn-sm">🏥 Health</a>
        <span style="margin-left:auto;display:flex;gap:8px;align-items:center">
          <span style="font-size:11px;color:var(--text3)">Storage:</span> ${persistBadge}
          <span class="badge badge-blue" style="font-size:10px">v1.9.0-P20</span>
        </span>
      </div>

      ${nextMove}

      <!-- P16: Live platform event counts row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px">
        <div class="stat-card" style="border-left:3px solid var(--accent)">
          <div class="stat-label">Platform Events</div>
          <div class="stat-value" style="color:var(--accent)">${liveEventCount}</div>
          <div class="stat-sub"><a href="/events" style="color:var(--accent)">Event Bus →</a></div>
        </div>
        <div class="stat-card" style="border-left:3px solid var(--yellow)">
          <div class="stat-label">Audit Trail</div>
          <div class="stat-value" style="color:var(--yellow)">${liveAuditCount}</div>
          <div class="stat-sub"><a href="/audit" style="color:var(--accent)">View Trail →</a></div>
        </div>
        <div class="stat-card" style="border-left:3px solid var(--green)">
          <div class="stat-label">Notifications</div>
          <div class="stat-value" style="color:var(--green)">${liveNotifCount}</div>
          <div class="stat-sub"><a href="/notifications" style="color:var(--accent)">Inbox →</a></div>
        </div>
        <div class="stat-card" style="border-left:3px solid ${liveAbacDenies > 0 ? 'var(--red)' : 'var(--green)'}">
          <div class="stat-label">ABAC Denials</div>
          <div class="stat-value" style="color:${liveAbacDenies > 0 ? 'var(--red)' : 'var(--green)'}">${liveAbacDenies}</div>
          <div class="stat-sub"><a href="/audit/deny-log" style="color:var(--accent)">Deny Log →</a></div>
        </div>
        <div class="stat-card" style="border-left:3px solid var(--emerald)">
          <div class="stat-label">Search Queries</div>
          <div class="stat-value" style="color:var(--emerald)">${liveSearchCount}</div>
          <div class="stat-sub">${liveSearchRecent24h} in last 24h · <a href="/search/analytics" style="color:var(--accent)">Analytics →</a></div>
        </div>
      </div>

      ${statsHtml}
      <div class="grid-2">
        <div>
          <div class="card">
            <div class="card-header"><div class="card-title">Active Sessions</div><a href="/architect" class="btn btn-ghost btn-sm">+ New Brief</a></div>
            <table>
              <thead><tr><th>ID</th><th>Session</th><th>Status</th><th>Age</th><th></th></tr></thead>
              <tbody>${sessionRow || '<tr><td colspan="5" class="text-muted">No active sessions</td></tr>'}</tbody>
            </table>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Current Blockers</div></div>
            ${blockerRows || '<p class="text-muted text-sm">No active blockers</p>'}
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-header"><div class="card-title">Pending Approvals</div><a href="/approvals" class="btn btn-ghost btn-sm">View All</a></div>
            <table>
              <thead><tr><th>ID</th><th>Action</th><th>Tier</th><th>Status</th><th></th></tr></thead>
              <tbody>${approvalRows || '<tr><td colspan="5" class="text-muted">No pending approvals</td></tr>'}</tbody>
            </table>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">NOW — Live Priority Snapshot</div><a href="/live" class="btn btn-ghost btn-sm">Full Board</a></div>
            ${nowRows || '<p class="text-muted text-sm">No NOW items</p>'}
          </div>
        </div>
      </div>
      ${recentProof.length > 0 ? `
      <div class="card">
        <div class="card-header"><div class="card-title">Recent Proof Outcomes</div><a href="/proof" class="btn btn-ghost btn-sm">Proof Center</a></div>
        <table>
          <thead><tr><th>ID</th><th>Work Item</th><th>Type</th><th>Outcome</th><th>Reviewer</th><th>Date</th></tr></thead>
          <tbody>${recentProof.map(p=>`<tr>
            <td class="mono text-sm">${p.id}</td>
            <td>${p.work_item_id}</td>
            <td>${p.proof_type}</td>
            <td>${badgeStatus(p.outcome_classification)}</td>
            <td>${p.reviewer}</td>
            <td class="text-sm text-muted">${timeAgo(p.created_at)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : ''}

      <!-- P16: Recent Activity Feed + System Health -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Recent Activity Feed</div>
            <a href="/audit" class="btn btn-ghost btn-sm">Full Audit Trail →</a>
          </div>
          ${activityFeedHtml}
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">🏥 System Health Summary</div>
            <a href="/health-dashboard" class="btn btn-ghost btn-sm">Full Dashboard →</a>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${[
              { label: 'Platform Version', value: '1.9.0-P20', color: 'var(--accent)' },
              { label: 'Auth Status', value: isAuth ? 'Authenticated' : 'Guest', color: isAuth ? 'var(--green)' : 'var(--yellow)' },
              { label: 'D1 Database', value: repo.isPersistent ? 'D1 Persistent' : 'In-Memory', color: repo.isPersistent ? 'var(--green)' : 'var(--yellow)' },
              { label: 'Active Sessions', value: String(activeSessions.length), color: activeSessions.length > 0 ? 'var(--green)' : 'var(--text3)' },
              { label: 'Pending Approvals', value: String(pendingApprovals.length), color: pendingApprovals.length > 0 ? 'var(--yellow)' : 'var(--green)' },
              { label: 'Active Blockers', value: String(blockers.length), color: blockers.length > 0 ? 'var(--red)' : 'var(--green)' },
            ].map(item => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg3);border-radius:5px">
                <span style="font-size:12px;color:var(--text3)">${item.label}</span>
                <span style="font-size:12px;font-weight:600;color:${item.color}">${item.value}</span>
              </div>`).join('')}
            <div style="display:flex;gap:8px;margin-top:6px">
              <a href="/metrics" class="btn btn-ghost btn-sm" style="flex:1;justify-content:center">📈 Metrics</a>
              <a href="/search" class="btn btn-ghost btn-sm" style="flex:1;justify-content:center">🔍 Search</a>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Governance Status (P2)</div>
          <a href="/continuity" class="btn btn-ghost btn-sm">Continuity Surface →</a>
        </div>
        <div class="grid-3">
          <div><div class="text-sm text-muted mb-2">Proof Rule</div><div class="badge badge-red">NO VERIFIED WITHOUT EVIDENCE</div></div>
          <div><div class="text-sm text-muted mb-2">Role Rule</div><div class="badge badge-yellow">NO ROLE COLLAPSE</div></div>
          <div><div class="text-sm text-muted mb-2">Secret Rule</div><div class="badge badge-purple">READINESS STATUS ONLY</div></div>
          <div><div class="text-sm text-muted mb-2">Continuity</div><div class="badge badge-blue">SESSION HANDOFF TRACKED</div></div>
          <div><div class="text-sm text-muted mb-2">Governance Boundaries</div><div class="badge badge-green">4 ACTIVE BOUNDARIES</div></div>
          <div><div class="text-sm text-muted mb-2">Operator Notes</div><div class="badge badge-cyan">OBSERVABLE STATE</div></div>
          <div><div class="text-sm text-muted mb-2">Execution Board</div><div class="badge badge-cyan">P3 LIVE</div></div>
          <div><div class="text-sm text-muted mb-2">Connector Hub</div><div class="badge badge-purple">P3 LIVE</div></div>
        </div>
      </div>`

    return c.html(layout('Dashboard', content, '/dashboard', activeAlertCount, { notifCount: unreadNotifCount }))
  })

  return route
}
