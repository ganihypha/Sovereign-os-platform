// ============================================================
// SOVEREIGN OS PLATFORM — LIVE BOARD ROUTE (P1)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'
import type { PriorityItem } from '../types'

export function createLiveRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const [items, sessions, decisionRecords] = await Promise.all([
      repo.getPriorityItems(),
      repo.getSessions(),
      repo.getDecisionRecords(),
    ])

    const cats = {
      NOW: items.filter(p => p.category === 'NOW' && !p.resolved),
      NEXT: items.filter(p => p.category === 'NEXT' && !p.resolved),
      LATER: items.filter(p => p.category === 'LATER' && !p.resolved),
      HOLD: items.filter(p => p.category === 'HOLD' && !p.resolved),
      NOT_NOW: items.filter(p => p.category === 'NOT_NOW' && !p.resolved),
    }
    const resolved = items.filter(p => p.resolved)
    const blockers = items.filter(p => p.blocker && !p.resolved)
    const activeSession = sessions.find(s => s.status === 'active')
    const sessionTargets = items.filter(p => p.session_target && !p.resolved)

    function catSection(label: string, list: PriorityItem[], cls: string, accent: string) {
      return `
        <div class="card" style="border-top: 3px solid ${accent}">
          <div class="card-header">
            <div class="card-title ${cls}">${label}</div>
            <span class="mono text-sm" style="color:${accent}">${list.length}</span>
          </div>
          ${list.length === 0 ? '<p class="text-muted text-sm">Empty</p>' : list.map(p => `
            <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <input type="checkbox" style="margin-top:3px;cursor:pointer" ${p.resolved ? 'checked' : ''} onchange="markResolved('${p.id}', this.checked)">
              <div style="flex:1">
                <span style="font-size:13px">${p.title}</span>
                ${p.blocker ? `<br><span class="badge badge-red" style="margin-top:4px">BLOCKER: ${p.blocker_description}</span>` : ''}
                ${p.session_target ? '<span class="badge badge-blue" style="margin-left:6px">SESSION TARGET</span>' : ''}
              </div>
              <span class="text-sm text-muted">${timeAgo(p.created_at)}</span>
            </div>`).join('')}
        </div>`
    }

    const boardHtml = `
      <div class="grid-2">
        <div>
          ${catSection('NOW', cats.NOW, 'pri-now', 'var(--red)')}
          ${catSection('NEXT', cats.NEXT, 'pri-next', 'var(--orange)')}
        </div>
        <div>
          ${catSection('LATER', cats.LATER, 'pri-later', 'var(--yellow)')}
          ${catSection('HOLD', cats.HOLD, 'pri-hold', 'var(--text3)')}
          ${catSection('NOT NOW', cats.NOT_NOW, 'pri-not-now', 'var(--text3)')}
        </div>
      </div>`

    const blockerSection = blockers.length > 0 ? `
      <div class="card">
        <div class="card-header"><div class="card-title" style="color:var(--red)">⛔ Active Blockers (${blockers.length})</div></div>
        ${blockers.map(b=>`<div class="blocker-bar"><strong>${b.title}</strong> — ${b.blocker_description}</div>`).join('')}
      </div>` : ''

    const sessionCard = activeSession ? `
      <div class="card" style="border-left:3px solid var(--accent)">
        <div class="card-header"><div class="card-title">Current Session Target</div>${badgeStatus(activeSession.status)}</div>
        <p style="font-weight:600;margin-bottom:8px">${activeSession.title}</p>
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px">${activeSession.bounded_brief}</p>
        <div class="section-title">Next Locked Move</div>
        <div style="background:rgba(79,142,247,0.07);border:1px solid rgba(79,142,247,0.2);border-radius:6px;padding:10px;font-size:13px;color:var(--accent)">
          → ${activeSession.next_locked_move}
        </div>
      </div>` : ''

    const resolvedRows = resolved.slice(0,10).map(p=>`
      <tr>
        <td>${p.title}</td>
        <td><span class="badge badge-grey">${p.category}</span></td>
        <td class="text-sm text-muted">${p.resolved_at ? timeAgo(p.resolved_at) : '—'}</td>
      </tr>`).join('')

    const addForm = `
      <div class="card">
        <div class="card-header"><div class="card-title">Add Priority Item</div></div>
        <form method="POST" action="/api/priority">
          <div class="form-group">
            <label>Title *</label>
            <input type="text" name="title" placeholder="What needs to happen?" required>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Category *</label>
              <select name="category" required>
                <option value="NOW">NOW</option>
                <option value="NEXT">NEXT</option>
                <option value="LATER">LATER</option>
                <option value="HOLD">HOLD</option>
                <option value="NOT_NOW">NOT NOW</option>
              </select>
            </div>
            <div class="form-group">
              <label>Session Target?</label>
              <select name="session_target">
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Is Blocker?</label>
            <select name="blocker">
              <option value="false">No</option>
              <option value="true">Yes — add description below</option>
            </select>
          </div>
          <div class="form-group">
            <label>Blocker Description (if blocker)</label>
            <input type="text" name="blocker_description" placeholder="Why is this blocking progress?">
          </div>
          <button type="submit" class="btn btn-primary">Add to Board</button>
        </form>
      </div>`

    const govSnap = `
      <div class="card">
        <div class="card-header"><div class="card-title">Governance Status Snapshot</div></div>
        <div class="grid-2">
          <div>
            <div class="text-sm text-muted mb-2">Active Sessions</div>
            <strong class="mono">${sessions.filter(s=>s.status==='active').length}</strong>
          </div>
          <div>
            <div class="text-sm text-muted mb-2">Total Decisions</div>
            <strong class="mono">${decisionRecords.length}</strong>
          </div>
          <div>
            <div class="text-sm text-muted mb-2">Session Targets</div>
            <strong class="mono">${sessionTargets.length} open</strong>
          </div>
          <div>
            <div class="text-sm text-muted mb-2">Blockers</div>
            <strong class="mono" style="color:${blockers.length>0?'var(--red)':'var(--green)'}">${blockers.length}</strong>
          </div>
        </div>
      </div>`

    const content = `
      <div class="law-bar">Live State: Reflects actual operational reality. Updates only after proof review. No manual live-state claim without traceable source.</div>
      <script>
        function markResolved(id, checked) {
          fetch('/api/priority/' + id + '/resolve', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ resolved: checked })
          }).then(() => location.reload())
        }
      </script>
      ${blockerSection}
      <div class="grid-2" style="margin-bottom:16px">
        <div>${sessionCard}</div>
        <div>${govSnap}</div>
      </div>
      ${boardHtml}
      <div class="grid-2">
        <div>
          <div class="card">
            <div class="card-header"><div class="card-title">Recently Resolved (${resolved.length})</div></div>
            <table>
              <thead><tr><th>Item</th><th>Was Category</th><th>Resolved</th></tr></thead>
              <tbody>${resolvedRows || '<tr><td colspan="3" class="text-muted">None resolved yet</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div>${addForm}</div>
      </div>`

    return c.html(layout('Live Priority Board', content, '/live'))
  })

  return route
}
