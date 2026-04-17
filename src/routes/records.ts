// ============================================================
// SOVEREIGN OS PLATFORM — RECORDS ROUTE (P1)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'

export function createRecordsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const [decisions, handoffs, canon, proofs] = await Promise.all([
      repo.getDecisionRecords(),
      repo.getHandoffRecords(),
      repo.getCanonCandidates(),
      repo.getProofArtifacts(),
    ])

    const decisionRows = decisions.map(d => `
      <tr>
        <td><span class="mono text-sm">${d.id}</span></td>
        <td>
          <strong>${d.summary.substring(0,70)}</strong>
          <br><span class="badge badge-grey" style="margin-top:4px">${d.decision_type}</span>
        </td>
        <td>${d.decided_by}</td>
        <td style="font-size:12px">${d.outcome}</td>
        <td>${d.canon_candidate_flag ? '<span class="badge badge-cyan">CANON CANDIDATE</span>' : '—'}</td>
        <td class="text-sm text-muted">${timeAgo(d.created_at)}</td>
      </tr>`).join('')

    const handoffRows = handoffs.map(h => `
      <tr>
        <td><span class="mono text-sm">${h.id}</span></td>
        <td>${h.from_role} → ${h.to_role}</td>
        <td style="font-size:12px">${h.handoff_context.substring(0,80)}</td>
        <td style="font-size:12px">${h.open_items.join(', ')}</td>
        <td class="text-sm text-muted">${timeAgo(h.created_at)}</td>
      </tr>`).join('')

    const canonCards = canon.map(c => `
      <div class="card" style="border-left:3px solid ${c.status === 'promoted' ? 'var(--green)' : c.status === 'candidate' ? 'var(--cyan)' : 'var(--text3)'}">
        <div class="card-header">
          <div>
            <span class="mono text-sm text-muted">${c.id}</span>
            <strong style="display:block;margin-top:4px">${c.title}</strong>
          </div>
          ${badgeStatus(c.status)}
        </div>
        <div class="section-title">Content Reference</div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px;font-style:italic">"${c.content_ref}"</p>
        <div class="grid-2">
          <div>
            <div class="section-title">Proposed By</div>
            <p class="text-sm">${c.proposed_by}</p>
          </div>
          <div>
            <div class="section-title">Approved By</div>
            <p class="text-sm">${c.approved_by ?? '— awaiting —'}</p>
          </div>
        </div>
        ${c.review_notes ? `<div class="section-title mt-4">Review Notes</div><p class="text-sm text-muted">${c.review_notes}</p>` : ''}
        ${c.status === 'candidate' ? `
          <div class="verified-note mt-4">
            ⚠ CANON RULE: This cannot auto-promote. Requires Founder ratification before promotion.
          </div>
          <form method="POST" action="/api/canon/${c.id}/promote" style="margin-top:12px">
            <div class="form-group">
              <label>Review Notes</label>
              <textarea name="review_notes" placeholder="Notes before promotion decision..."></textarea>
            </div>
            <div class="form-group">
              <label>Approved By (Founder required for T3)</label>
              <input type="text" name="approved_by" placeholder="Founder / Architect">
            </div>
            <div class="btn-group">
              <button type="submit" name="action" value="promote" class="btn btn-green btn-sm">Promote to Canon</button>
              <button type="submit" name="action" value="reject" class="btn btn-red btn-sm">Reject</button>
            </div>
          </form>` : ''}
      </div>`).join('')

    const newDecisionForm = `
      <div class="card">
        <div class="card-header"><div class="card-title">Log Decision</div></div>
        <form method="POST" action="/api/decisions">
          <div class="grid-2">
            <div class="form-group">
              <label>Decision Type</label>
              <select name="decision_type">
                <option value="intent">Intent</option>
                <option value="approval">Approval</option>
                <option value="scope">Scope</option>
                <option value="escalation">Escalation</option>
                <option value="canon-promotion">Canon Promotion</option>
              </select>
            </div>
            <div class="form-group">
              <label>Decided By</label>
              <input type="text" name="decided_by" placeholder="Founder / Architect" value="Founder">
            </div>
          </div>
          <div class="form-group">
            <label>Summary *</label>
            <textarea name="summary" placeholder="What was decided?" required></textarea>
          </div>
          <div class="form-group">
            <label>Outcome</label>
            <input type="text" name="outcome" placeholder="ACCEPTED / REJECTED / DEFERRED / ...">
          </div>
          <div class="form-group">
            <label>Change Log</label>
            <textarea name="change_log" placeholder="What changed as a result of this decision?"></textarea>
          </div>
          <div class="form-group">
            <label>Mark as Canon Candidate?</label>
            <select name="canon_candidate_flag">
              <option value="false">No</option>
              <option value="true">Yes — requires Founder review</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Log Decision</button>
        </form>
      </div>`

    const newHandoffForm = `
      <div class="card">
        <div class="card-header"><div class="card-title">Create Handoff Record</div></div>
        <form method="POST" action="/api/handoffs">
          <div class="grid-2">
            <div class="form-group">
              <label>From Role</label>
              <input type="text" name="from_role" placeholder="e.g. Founder" value="Founder">
            </div>
            <div class="form-group">
              <label>To Role</label>
              <input type="text" name="to_role" placeholder="e.g. Master Architect" value="Master Architect">
            </div>
          </div>
          <div class="form-group">
            <label>Handoff Context *</label>
            <textarea name="handoff_context" placeholder="What is the handoff context? What must the next role know?" required></textarea>
          </div>
          <div class="form-group">
            <label>Open Items (comma-separated)</label>
            <input type="text" name="open_items" placeholder="Item 1, Item 2, Item 3">
          </div>
          <button type="submit" class="btn btn-primary">Create Handoff</button>
        </form>
      </div>`

    const content = `
      <div class="law-bar">Records Layer: Decision log, handoff registry, proof references, and canon control. Continuity lives here. No session should leave without updating records.</div>

      <div class="grid-2">
        <div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">Decision Log (${decisions.length})</div>
              <a href="/proof" class="btn btn-ghost btn-sm">→ Proof Center</a>
            </div>
            <table>
              <thead><tr><th>ID</th><th>Summary / Type</th><th>By</th><th>Outcome</th><th>Canon</th><th>Date</th></tr></thead>
              <tbody>${decisionRows || '<tr><td colspan="6" class="text-muted">No decisions logged</td></tr>'}</tbody>
            </table>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Handoff Registry (${handoffs.length})</div></div>
            <table>
              <thead><tr><th>ID</th><th>Route</th><th>Context</th><th>Open Items</th><th>Created</th></tr></thead>
              <tbody>${handoffRows || '<tr><td colspan="5" class="text-muted">No handoffs recorded</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div>
          ${newDecisionForm}
          ${newHandoffForm}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Canon Candidates (${canon.length})</div>
          <div class="verified-note" style="margin:0;font-size:11px">Canon is read-heavy and controlled. Never auto-promotes.</div>
        </div>
        <div class="grid-2">${canonCards || '<p class="text-muted text-sm">No canon candidates</p>'}</div>
      </div>`

    return c.html(layout('Records & Canon', content, '/records'))
  })

  return route
}
