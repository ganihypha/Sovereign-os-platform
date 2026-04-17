// ============================================================
// SOVEREIGN OS PLATFORM — EXECUTION BOARD ROUTE (P3)
// Operational execution board — real work visibility, ownership,
// proof linkage, state progression. No role collapse.
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated, requireAuth } from '../lib/auth'
import { buildRoleContext, roleBadge } from '../lib/roles'
import type { Env } from '../index'

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--orange)',
  normal: 'var(--accent)',
  low: 'var(--text3)',
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'badge-red',
  high: 'badge-orange',
  normal: 'badge-blue',
  low: 'badge-grey',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--yellow)',
  running: 'var(--accent)',
  blocked: 'var(--red)',
  done: 'var(--green)',
  cancelled: 'var(--text3)',
}

export function createExecutionRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ---- GET / — Execution Board ----
  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)
    const roleCtx = buildRoleContext(isAuth)

    const [entries, workItems, sessions, proofs] = await Promise.all([
      repo.getExecutionEntries(),
      repo.getWorkItems(),
      repo.getSessions(),
      repo.getProofArtifacts(),
    ])

    // Enrich entries with work item and session labels
    const enriched = entries.map(e => {
      const wi = workItems.find(w => w.id === e.work_item_id)
      const sess = sessions.find(s => s.id === e.session_id)
      const proof = proofs.find(p => p.id === e.proof_id)
      return { ...e, _wi: wi, _session: sess, _proof: proof }
    })

    // Stats
    const running = entries.filter(e => e.status === 'running')
    const blocked = entries.filter(e => e.status === 'blocked')
    const done = entries.filter(e => e.status === 'done')
    const pending = entries.filter(e => e.status === 'pending')
    const critical = entries.filter(e => e.priority === 'critical' && e.status !== 'done' && e.status !== 'cancelled')

    const statsHtml = `
      <div class="grid-4 mb-4">
        <div class="stat-card">
          <div class="stat-label">Running</div>
          <div class="stat-value" style="color:var(--accent)">${running.length}</div>
          <div class="stat-sub">in execution now</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Blocked</div>
          <div class="stat-value" style="color:var(--red)">${blocked.length}</div>
          <div class="stat-sub">requires attention</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending</div>
          <div class="stat-value" style="color:var(--yellow)">${pending.length}</div>
          <div class="stat-sub">not yet started</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Completed</div>
          <div class="stat-value" style="color:var(--green)">${done.length}</div>
          <div class="stat-sub">done + verified</div>
        </div>
      </div>`

    // Critical alert bar
    const criticalBar = critical.length > 0
      ? `<div class="blocker-bar" style="border-color:var(--orange);color:var(--orange);background:rgba(249,115,22,0.07)">
          ⚡ ${critical.length} critical execution item(s) in progress — status update required before session closeout.
         </div>`
      : ''

    // Blocked execution bar
    const blockedBars = blocked.map(e => `
      <div class="blocker-bar">⛔ BLOCKED: ${e.title} — ${e.blocked_reason || 'No reason specified'}</div>
    `).join('')

    // Board rows grouped by status
    const statusOrder: Array<typeof entries[0]['status']> = ['running', 'blocked', 'pending', 'done', 'cancelled']
    const boardRows = statusOrder.flatMap(status => {
      const group = enriched.filter(e => e.status === status)
      if (group.length === 0) return []
      return group.map(e => `
        <tr>
          <td><span class="mono text-sm">${e.id}</span></td>
          <td>
            <strong>${e.title}</strong>
            ${e._wi ? `<br><span class="text-muted text-sm">WI: ${e._wi.id} — ${e._wi.title.substring(0,50)}</span>` : ''}
            ${e._session ? `<br><span class="text-muted text-sm" style="font-size:11px">Session: ${e._session.title.substring(0,40)}</span>` : ''}
          </td>
          <td><strong style="color:${STATUS_COLOR[e.status]}">${e.status.toUpperCase()}</strong></td>
          <td><span class="badge ${PRIORITY_BADGE[e.priority]}">${e.priority.toUpperCase()}</span></td>
          <td>${e.executor || '<span class="text-muted">—</span>'}</td>
          <td>
            ${e.proof_id ? `<span class="badge badge-green">PROOF LINKED</span>` : '<span class="text-muted text-sm">no proof</span>'}
            ${e._proof ? `<br><span class="text-sm text-muted">${e._proof.outcome_classification}</span>` : ''}
          </td>
          <td class="text-sm text-muted">
            ${e.started_at ? `Started: ${timeAgo(e.started_at)}` : '—'}
            ${e.completed_at ? `<br>Done: ${timeAgo(e.completed_at)}` : ''}
          </td>
          ${isAuth ? `<td>
            <div class="btn-group">
              <button onclick="updateStatus('${e.id}', 'running')" class="btn btn-ghost btn-sm" ${e.status === 'running' ? 'disabled' : ''}>▶ Run</button>
              <button onclick="updateStatus('${e.id}', 'done')" class="btn btn-green btn-sm" ${e.status === 'done' ? 'disabled' : ''}>✓ Done</button>
              <button onclick="updateStatus('${e.id}', 'blocked')" class="btn btn-red btn-sm" ${e.status === 'blocked' ? 'disabled' : ''}>✗ Block</button>
            </div>
          </td>` : '<td></td>'}
        </tr>`)
    }).join('')

    // Create form (auth only)
    const createForm = isAuth ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">New Execution Entry</div>
        </div>
        <form method="POST" action="/api/execution">
          <div class="grid-2">
            <div class="form-group">
              <label>Title *</label>
              <input name="title" placeholder="Execution entry title" required>
            </div>
            <div class="form-group">
              <label>Work Item ID *</label>
              <input name="work_item_id" placeholder="wi-xxx" required>
            </div>
            <div class="form-group">
              <label>Executor</label>
              <input name="executor" placeholder="Who is executing?" value="AI Developer">
            </div>
            <div class="form-group">
              <label>Priority</label>
              <select name="priority">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div class="form-group">
              <label>Session ID (optional)</label>
              <input name="session_id" placeholder="ses-xxx">
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status">
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Context Notes</label>
            <textarea name="context_notes" rows="3" placeholder="Bounded scope, execution context, constraints..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">+ Create Execution Entry</button>
        </form>
      </div>` : `
      <div class="card">
        <div style="text-align:center;padding:20px">
          <div class="text-muted text-sm">Authenticate to create execution entries</div>
          <a href="/auth/login" class="btn btn-primary mt-4" style="display:inline-flex">Authenticate →</a>
        </div>
      </div>`

    const content = `
      <div class="law-bar">Execution Board — L3 Executor Layer | Operating Law: Founder → L1 → L2 → <strong>L3 Executor</strong> → Proof → Review → Live → Canon</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">
        <span style="font-size:12px;color:var(--text2)">Phase:</span>
        <span class="badge badge-cyan">P3 — Execution Board</span>
        <span style="font-size:12px;color:var(--text2);margin-left:8px">Role:</span> ${roleBadge(roleCtx)}
        <span style="font-size:12px;color:var(--text2);margin-left:8px">Total Entries: ${entries.length}</span>
      </div>
      ${criticalBar}
      ${blockedBars}
      ${statsHtml}
      <div class="card">
        <div class="card-header">
          <div class="card-title">Execution Board — All Entries</div>
          <span class="text-muted text-sm">${entries.length} total · ${running.length} running · ${blocked.length} blocked</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Execution</th><th>Status</th><th>Priority</th>
              <th>Executor</th><th>Proof</th><th>Timeline</th>
              <th>${isAuth ? 'Actions' : ''}</th>
            </tr>
          </thead>
          <tbody>
            ${boardRows || '<tr><td colspan="8" class="text-muted">No execution entries yet</td></tr>'}
          </tbody>
        </table>
      </div>
      ${createForm}
      <div class="verified-note">
        ⚠ Platform Law: No execution entry may be marked DONE without a linked proof artifact or documented evidence.
        Execution without proof = PARTIAL at best. Never auto-promote to VERIFIED.
      </div>
      <script>
        async function updateStatus(id, status) {
          const reason = status === 'blocked' ? prompt('Blocked reason:') : '';
          const body = new FormData();
          body.append('status', status);
          if (reason) body.append('blocked_reason', reason);
          const resp = await fetch('/api/execution/' + id + '/status', { method: 'POST', body });
          if (resp.ok) location.reload();
          else alert('Failed: ' + await resp.text());
        }
      </script>`

    return c.html(layout('Execution Board', content, '/execution'))
  })

  return route
}
