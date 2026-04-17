// ============================================================
// SOVEREIGN OS PLATFORM — CONTINUITY ROUTE (P2)
// Surface: /continuity
// Purpose: Session continuity, handoff discipline, governance boundaries
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated, authStatusBadge } from '../lib/auth'
import { buildRoleContext, roleBadge } from '../lib/roles'
import { assessContinuityHealth, continuityHealthBadge, formatContinuityText } from '../lib/continuity'
import type { Env } from '../index'

export function createContinuityRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /continuity — main surface
  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)
    const roleCtx = buildRoleContext(isAuth)

    const [continuities, sessions, boundaries, notes] = await Promise.all([
      repo.getSessionContinuity(),
      repo.getSessions(),
      repo.getGovernanceBoundaries(),
      repo.getOperatorNotes(),
    ])

    const assessment = await assessContinuityHealth(repo)

    // Continuity snapshots grouped by session
    const sessionMap = new Map(sessions.map(s => [s.id, s]))

    // Unresolved notes
    const unresolvedNotes = notes.filter(n => !n.resolved)

    const authBadge = authStatusBadge(!!c.env.PLATFORM_API_KEY, isAuth)
    const roleB = roleBadge(roleCtx)
    const healthB = continuityHealthBadge(assessment.health, assessment.score)

    // ---- Continuity snapshots ----
    const snapshotsList = continuities.length === 0
      ? `<div class="empty-state"><p>No continuity snapshots yet. Create a checkpoint or handoff to preserve session state.</p></div>`
      : continuities.slice(0, 10).map(c2 => {
          const sess = sessionMap.get(c2.session_id)
          const typeColor = c2.snapshot_type === 'closeout' ? 'var(--green)' : c2.snapshot_type === 'handoff' ? 'var(--blue)' : 'var(--yellow)'
          return `
          <div class="card" style="border-left:3px solid ${typeColor}">
            <div class="card-header">
              <div class="card-title">${c2.snapshot_type.toUpperCase()} — ${sess ? sess.title : c2.session_id}</div>
              <span style="color:var(--muted);font-size:12px">${timeAgo(c2.created_at)}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:8px">
              by <strong>${c2.authored_by}</strong> · ${Object.entries(c2.platform_state).slice(0,4).map(([k,v])=>`${k}:${v}`).join(' · ')}
            </div>
            ${c2.next_locked_move ? `<div style="font-size:12px;background:rgba(79,142,247,0.08);border:1px solid rgba(79,142,247,0.2);border-radius:4px;padding:6px 10px;margin-bottom:6px">
              <strong>Next Locked Move:</strong> ${c2.next_locked_move}
            </div>` : ''}
            ${c2.open_items.length > 0 ? `<div style="font-size:12px;color:var(--muted)">
              Open items: ${c2.open_items.slice(0,3).join(' · ')}${c2.open_items.length > 3 ? ` +${c2.open_items.length - 3} more` : ''}
            </div>` : ''}
            ${c2.governance_notes ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;font-style:italic">${c2.governance_notes}</div>` : ''}
          </div>`
        }).join('')

    // ---- Governance boundaries ----
    const boundaryRows = boundaries.map(b => {
      const statusColor = b.status === 'active' ? 'var(--green)' : b.status === 'under_review' ? 'var(--yellow)' : 'var(--red)'
      return `
      <div class="card" style="border-left:3px solid ${statusColor}">
        <div class="card-header">
          <div class="card-title" style="font-size:13px">${b.boundary_name.replace(/_/g,' ').toUpperCase()}</div>
          <span style="color:${statusColor};font-size:11px;font-weight:700">${b.status.toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:var(--muted)">${b.description}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Owner: ${b.owner_role} · ${b.last_reviewed ? 'Reviewed ' + timeAgo(b.last_reviewed) : 'Not yet reviewed'}</div>
      </div>`
    }).join('')

    // ---- Unresolved notes ----
    const notesList = unresolvedNotes.length === 0
      ? `<div class="empty-state"><p>No unresolved operator notes.</p></div>`
      : unresolvedNotes.slice(0, 8).map(n => {
          const typeColor: Record<string, string> = {
            blocker: 'var(--red)', observation: 'var(--blue)',
            clarification: 'var(--yellow)', reminder: 'var(--green)'
          }
          return `
          <div class="card" style="border-left:3px solid ${typeColor[n.note_type] ?? 'var(--border)'}">
            <div class="card-header">
              <div class="card-title" style="font-size:12px">[${n.note_type.toUpperCase()}] ${n.object_type} / ${n.object_id}</div>
              <span style="color:var(--muted);font-size:11px">${timeAgo(n.created_at)}</span>
            </div>
            <div style="font-size:12px;color:var(--text)">${n.content}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">by ${n.authored_by}</div>
            ${isAuth ? `
            <form method="POST" action="/api/notes/${n.id}/resolve" style="margin-top:8px">
              <button type="submit" class="btn-sm" style="font-size:11px">Mark Resolved</button>
            </form>` : ''}
          </div>`
        }).join('')

    // ---- Assessment panel ----
    const issuesList = assessment.issues.length > 0
      ? assessment.issues.map(i => `<li style="color:var(--yellow);font-size:12px">${i}</li>`).join('')
      : '<li style="color:var(--green);font-size:12px">No issues detected.</li>'
    const recsList = assessment.recommendations.length > 0
      ? assessment.recommendations.map(r2 => `<li style="font-size:12px;color:var(--muted)">${r2}</li>`).join('')
      : '<li style="font-size:12px;color:var(--muted)">No recommendations at this time.</li>'

    // ---- New snapshot form ----
    const snapshotForm = isAuth ? `
    <div class="card">
      <div class="card-header"><div class="card-title">Create Continuity Snapshot</div></div>
      <form method="POST" action="/api/continuity">
        <div class="form-grid">
          <div class="form-group">
            <label>Session ID</label>
            <select name="session_id" class="form-control">
              ${sessions.filter(s => s.status !== 'closed').map(s => `<option value="${s.id}">${s.title}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Snapshot Type</label>
            <select name="snapshot_type" class="form-control">
              <option value="checkpoint">Checkpoint</option>
              <option value="handoff">Handoff</option>
              <option value="closeout">Closeout</option>
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Next Locked Move</label>
            <input type="text" name="next_locked_move" class="form-control" placeholder="What is the next bounded action?">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Governance Notes</label>
            <textarea name="governance_notes" class="form-control" rows="3" placeholder="Context, constraints, or decisions relevant to continuity..."></textarea>
          </div>
          <div class="form-group">
            <label>Authored By</label>
            <input type="text" name="authored_by" class="form-control" value="Master Architect">
          </div>
        </div>
        <button type="submit" class="btn-primary">Create Snapshot</button>
      </form>
    </div>` : ''

    // ---- New operator note form ----
    const noteForm = isAuth ? `
    <div class="card">
      <div class="card-header"><div class="card-title">Add Operator Note</div></div>
      <form method="POST" action="/api/notes">
        <div class="form-grid">
          <div class="form-group">
            <label>Object Type</label>
            <select name="object_type" class="form-control">
              <option value="sessions">Session</option>
              <option value="intents">Intent</option>
              <option value="requests">Request</option>
              <option value="work_items">Work Item</option>
              <option value="approvals">Approval</option>
              <option value="proof">Proof</option>
              <option value="platform">Platform</option>
            </select>
          </div>
          <div class="form-group">
            <label>Object ID (or 'general')</label>
            <input type="text" name="object_id" class="form-control" placeholder="e.g. ses-001 or general">
          </div>
          <div class="form-group">
            <label>Note Type</label>
            <select name="note_type" class="form-control">
              <option value="observation">Observation</option>
              <option value="blocker">Blocker</option>
              <option value="clarification">Clarification</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>
          <div class="form-group">
            <label>Authored By</label>
            <input type="text" name="authored_by" class="form-control" value="Operator">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Note Content</label>
            <textarea name="content" class="form-control" rows="3" required placeholder="Note content..."></textarea>
          </div>
        </div>
        <button type="submit" class="btn-primary">Add Note</button>
      </form>
    </div>` : ''

    const content = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">
      <h1 class="page-title" style="margin:0">Session Continuity</h1>
      ${authBadge} ${roleB}
    </div>

    <!-- Health Assessment -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Continuity Health</div>
        ${healthB}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">ISSUES</div>
          <ul style="padding-left:16px;margin:0">${issuesList}</ul>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">RECOMMENDATIONS</div>
          <ul style="padding-left:16px;margin:0">${recsList}</ul>
        </div>
      </div>
      ${assessment.last_snapshot_age_hours !== null
        ? `<div style="font-size:11px;color:var(--muted);margin-top:12px">Last snapshot: ${assessment.last_snapshot_age_hours}h ago</div>`
        : `<div style="font-size:11px;color:var(--red);margin-top:12px">No continuity snapshots found.</div>`}
    </div>

    <!-- Two-column layout -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <h2 class="section-title">Continuity Snapshots</h2>
        ${snapshotsList}
        ${snapshotForm}
      </div>
      <div>
        <h2 class="section-title">Operator Notes (Unresolved: ${unresolvedNotes.length})</h2>
        ${notesList}
        ${noteForm}
      </div>
    </div>

    <!-- Governance Boundaries -->
    <div style="margin-top:32px">
      <h2 class="section-title">Governance Boundaries</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
        ${boundaryRows}
      </div>
    </div>`

    return c.html(layout('Continuity', content, '/continuity'))
  })

  // GET /continuity/:id/text — raw continuity text export
  route.get('/:id/text', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const continuities = await repo.getSessionContinuity()
    const item = continuities.find(x => x.id === id)
    if (!item) return c.text('Not found', 404)
    return c.text(formatContinuityText(item), 200, { 'Content-Type': 'text/plain' })
  })

  return route
}
