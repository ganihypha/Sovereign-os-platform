// ============================================================
// SOVEREIGN OS PLATFORM — ARCHITECT ROUTE (P1)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'

export function createArchitectRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const [sessions, handoffs, priorities, intents] = await Promise.all([
      repo.getSessions(),
      repo.getHandoffRecords(),
      repo.getPriorityItems(),
      repo.getIntents(),
    ])

    const activeSession = sessions.find(s => s.status === 'active')
    const latestHandoff = handoffs[handoffs.length - 1]
    const nowItems = priorities.filter(p => p.category === 'NOW' && !p.resolved)

    const sessionDetail = activeSession ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Active Session</div>
          ${badgeStatus(activeSession.status)}
        </div>
        <div class="section-title">Session Title</div>
        <p style="font-weight:600;margin-bottom:16px">${activeSession.title}</p>

        <div class="section-title">Session Brief</div>
        <p style="color:var(--text2);margin-bottom:16px;font-size:13px">${activeSession.session_brief}</p>

        <div class="section-title">Bounded Brief</div>
        <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:12px;font-size:13px;color:var(--text2);margin-bottom:16px">${activeSession.bounded_brief}</div>

        <div class="grid-2">
          <div>
            <div class="section-title">Scope IN</div>
            ${activeSession.scope_in.map(s=>`<div class="tag">✓ ${s}</div>`).join('')}
          </div>
          <div>
            <div class="section-title">Scope OUT</div>
            ${activeSession.scope_out.map(s=>`<div class="tag" style="text-decoration:line-through;opacity:0.6">✗ ${s}</div>`).join('')}
          </div>
        </div>

        <div class="section-title mt-4">Active Constraints</div>
        ${activeSession.active_constraints.map(c=>`<div class="tag" style="border-color:rgba(239,68,68,0.3);color:var(--red)">⚠ ${c}</div>`).join('')}

        <div class="section-title mt-4">Acceptance Criteria</div>
        ${activeSession.acceptance_criteria.map((a,i)=>`
          <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="mono text-sm text-muted">${String(i+1).padStart(2,'0')}</span>
            <span style="font-size:13px">${a}</span>
          </div>`).join('')}

        <div class="section-title mt-4">Next Locked Move</div>
        <div style="background:rgba(79,142,247,0.07);border:1px solid rgba(79,142,247,0.2);border-radius:6px;padding:12px;font-size:13px;color:var(--accent)">
          → ${activeSession.next_locked_move}
        </div>

        <div class="section-title mt-4">Source-of-Truth References</div>
        ${activeSession.source_of_truth_refs.map(r=>`<span class="tag">${r}</span>`).join('')}
      </div>` : `
      <div class="card">
        <div class="card-header"><div class="card-title">No Active Session</div></div>
        <p class="text-muted text-sm">Create a new session brief below to start.</p>
      </div>`

    const handoffCard = latestHandoff ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Latest Handoff</div>
          <span class="text-sm text-muted">${timeAgo(latestHandoff.created_at)}</span>
        </div>
        <div class="section-title">From → To</div>
        <p style="margin-bottom:12px"><strong>${latestHandoff.from_role}</strong> → <strong>${latestHandoff.to_role}</strong></p>
        <div class="section-title">Handoff Context</div>
        <p style="color:var(--text2);font-size:13px;margin-bottom:12px">${latestHandoff.handoff_context}</p>
        <div class="section-title">Open Items</div>
        ${latestHandoff.open_items.map(i=>`<div style="padding:4px 0;font-size:13px">• ${i}</div>`).join('')}
      </div>` : ''

    const prioritySnap = `
      <div class="card">
        <div class="card-header"><div class="card-title">Active Priority — NOW Items</div><a href="/live" class="btn btn-ghost btn-sm">Full Board</a></div>
        ${nowItems.map(p=>`
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--red);font-size:11px;font-weight:700;min-width:36px">NOW</span>
            <span style="font-size:13px">${p.title}</span>
            ${p.session_target ? '<span class="badge badge-blue">TARGET</span>' : ''}
            ${p.blocker ? `<span class="badge badge-red">BLOCKER</span>` : ''}
          </div>`).join('') || '<p class="text-muted text-sm">No NOW items</p>'}
      </div>`

    const newSessionForm = `
      <div class="card">
        <div class="card-header"><div class="card-title">Create New Session Brief</div></div>
        <form method="POST" action="/api/sessions">
          <div class="form-group">
            <label>Session Title *</label>
            <input type="text" name="title" placeholder="e.g. P1 Hardening — Session 2" required>
          </div>
          <div class="form-group">
            <label>Linked Intent ID</label>
            <select name="intent_id">
              <option value="">— None —</option>
              ${intents.map(i=>`<option value="${i.id}">${i.title}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Session Brief *</label>
            <textarea name="session_brief" placeholder="What is the overall objective of this session?" required></textarea>
          </div>
          <div class="form-group">
            <label>Bounded Brief *</label>
            <textarea name="bounded_brief" placeholder="Exact bounded scope — what will and won't be done." required></textarea>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Scope IN (comma-separated)</label>
              <input type="text" name="scope_in" placeholder="Feature A, Page B, Fix C">
            </div>
            <div class="form-group">
              <label>Scope OUT (comma-separated)</label>
              <input type="text" name="scope_out" placeholder="Execution board, Connectors, ...">
            </div>
          </div>
          <div class="form-group">
            <label>Acceptance Criteria (one per line)</label>
            <textarea name="acceptance_criteria" placeholder="Line 1: Route /intake responds&#10;Line 2: Approval tier visible&#10;..."></textarea>
          </div>
          <div class="form-group">
            <label>Next Locked Move</label>
            <input type="text" name="next_locked_move" placeholder="Single most important bounded next action">
          </div>
          <div class="form-group">
            <label>Source-of-Truth References (comma-separated)</label>
            <input type="text" name="source_of_truth_refs" placeholder="Platform Definition Pack v1.1, dec-001">
          </div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">Create Session Brief</button>
          </div>
        </form>
      </div>`

    const content = `
      <div class="law-bar">Layer 1/2 — Master Architect: Read handoff + active priority → form bounded brief → define scope in/out → set acceptance criteria → next locked move.</div>
      <div class="grid-2">
        <div>
          ${sessionDetail}
          ${handoffCard}
        </div>
        <div>
          ${prioritySnap}
          ${newSessionForm}
        </div>
      </div>`

    return c.html(layout('Architect Workbench', content, '/architect'))
  })

  return route
}
