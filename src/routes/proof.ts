// ============================================================
// SOVEREIGN OS PLATFORM — PROOF ROUTE (P1)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'

export function createProofRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const [artifacts, workItems] = await Promise.all([
      repo.getProofArtifacts(),
      repo.getWorkItems(),
    ])

    const pending = artifacts.filter(p => p.status === 'pending')
    const reviewed = artifacts.filter(p => p.status === 'reviewed')

    const counts = {
      PASS: artifacts.filter(p => p.outcome_classification === 'PASS').length,
      PARTIAL: artifacts.filter(p => p.outcome_classification === 'PARTIAL').length,
      FAIL: artifacts.filter(p => p.outcome_classification === 'FAIL').length,
      BLOCKED: artifacts.filter(p => p.outcome_classification === 'BLOCKED').length,
    }

    const matrix = `
      <div class="proof-matrix mb-4">
        <div class="proof-cell">
          <div class="proof-cell-label">PASS</div>
          <div class="proof-cell-val" style="color:var(--green)">${counts.PASS}</div>
        </div>
        <div class="proof-cell">
          <div class="proof-cell-label">PARTIAL</div>
          <div class="proof-cell-val" style="color:var(--yellow)">${counts.PARTIAL}</div>
        </div>
        <div class="proof-cell">
          <div class="proof-cell-label">FAIL</div>
          <div class="proof-cell-val" style="color:var(--red)">${counts.FAIL}</div>
        </div>
        <div class="proof-cell">
          <div class="proof-cell-label">BLOCKED</div>
          <div class="proof-cell-val" style="color:var(--orange)">${counts.BLOCKED}</div>
        </div>
      </div>`

    const workItemOptions = workItems.map(w => `<option value="${w.id}">${w.title} (${w.id})</option>`).join('')

    const govRule = `
      <div class="verified-note" style="margin-bottom:16px">
        ⚠ GOVERNANCE RULE: No VERIFIED status without traceable evidence. Proof must be reviewed before status is promoted. Execution does not equal verification.
      </div>`

    const pendingInbox = pending.length > 0 ? pending.map(p => `
      <div class="card" style="border-left:3px solid var(--yellow)">
        <div class="card-header">
          <div>
            <span class="mono text-sm text-muted">${p.id}</span>
            <strong style="display:block;margin-top:4px">Work Item: ${p.work_item_id}</strong>
          </div>
          <div>
            ${badgeStatus(p.outcome_classification)}
            <span class="badge badge-grey" style="margin-left:6px">${p.proof_type}</span>
          </div>
        </div>
        <div class="grid-2">
          <div>
            <div class="section-title">Evidence Link</div>
            <p class="text-sm">${p.evidence_link || '— none provided —'}</p>
          </div>
          <div>
            <div class="section-title">Reviewer</div>
            <p class="text-sm">${p.reviewer}</p>
          </div>
        </div>
        <div class="section-title mt-4">Verification Notes</div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:16px">${p.verification_notes || '— no notes —'}</p>
        <form method="POST" action="/api/proof/${p.id}/review" style="border-top:1px solid var(--border);padding-top:16px">
          <div class="grid-2">
            <div class="form-group">
              <label>Outcome Classification *</label>
              <select name="outcome" required>
                <option value="PASS">PASS</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="FAIL">FAIL</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
            <div class="form-group">
              <label>Reviewer Name</label>
              <input type="text" name="reviewer" value="${p.reviewer}" placeholder="Your name / role">
            </div>
          </div>
          <div class="form-group">
            <label>Review Notes</label>
            <textarea name="notes" placeholder="What was verified? What was not? Any limitations?"></textarea>
          </div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">Submit Review</button>
          </div>
        </form>
      </div>`).join('') : `
      <div class="card">
        <p class="text-muted text-sm">No pending proof artifacts. Inbox is clear.</p>
      </div>`

    const reviewedRows = reviewed.map(p => `
      <tr>
        <td><span class="mono text-sm">${p.id}</span></td>
        <td>${p.work_item_id}</td>
        <td>${p.proof_type}</td>
        <td>${p.evidence_link || '—'}</td>
        <td>${badgeStatus(p.outcome_classification)}</td>
        <td>${p.reviewer}</td>
        <td class="text-sm text-muted">${p.verification_notes.substring(0,60)}</td>
        <td class="text-sm text-muted">${p.reviewed_at ? timeAgo(p.reviewed_at) : '—'}</td>
      </tr>`).join('')

    const submitForm = `
      <div class="card">
        <div class="card-header"><div class="card-title">Submit Proof Artifact</div></div>
        <form method="POST" action="/api/proof">
          <div class="grid-2">
            <div class="form-group">
              <label>Work Item *</label>
              <select name="work_item_id" required>
                <option value="">— Select Work Item —</option>
                ${workItemOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Proof Type *</label>
              <select name="proof_type" required>
                <option value="manual">Manual</option>
                <option value="automated">Automated</option>
                <option value="screenshot">Screenshot</option>
                <option value="log">Log</option>
                <option value="review">Review</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Evidence Link</label>
            <input type="text" name="evidence_link" placeholder="URL, file path, or reference ID">
          </div>
          <div class="form-group">
            <label>Verification Notes *</label>
            <textarea name="verification_notes" placeholder="What was tested/verified? What was observed?" required></textarea>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Initial Outcome Classification</label>
              <select name="outcome_classification">
                <option value="PARTIAL">PARTIAL</option>
                <option value="PASS">PASS</option>
                <option value="FAIL">FAIL</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
            <div class="form-group">
              <label>Submitted By</label>
              <input type="text" name="reviewer" placeholder="Your name / role" value="AI Developer">
            </div>
          </div>
          <button type="submit" class="btn btn-primary">Submit for Review</button>
        </form>
      </div>`

    const content = `
      <div class="law-bar">Proof Layer: All execution results must return as proof artifacts. No status promotion without evidence. Review is mandatory before VERIFIED.</div>
      ${govRule}
      ${matrix}
      <div class="grid-2">
        <div>
          <div class="section-title">Proof Inbox — Pending Review (${pending.length})</div>
          ${pendingInbox}
        </div>
        <div>
          ${submitForm}
          <div class="card">
            <div class="card-header"><div class="card-title">Proof Classification Guide</div></div>
            <table>
              <thead><tr><th>Class</th><th>Meaning</th><th>Next Action</th></tr></thead>
              <tbody>
                <tr><td>${badgeStatus('PASS')}</td><td>Fully verified, acceptance criteria met</td><td>Update live board, update decision log</td></tr>
                <tr><td>${badgeStatus('PARTIAL')}</td><td>Some criteria met, limitations noted</td><td>Log limitations, proceed with caveats</td></tr>
                <tr><td>${badgeStatus('FAIL')}</td><td>Criteria not met, needs rework</td><td>Create new work item, do not promote</td></tr>
                <tr><td>${badgeStatus('BLOCKED')}</td><td>Cannot complete proof due to external blocker</td><td>Add blocker to live board, escalate</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Reviewed Proof Artifacts (${reviewed.length})</div></div>
        <table>
          <thead><tr><th>ID</th><th>Work Item</th><th>Type</th><th>Evidence</th><th>Outcome</th><th>Reviewer</th><th>Notes</th><th>Reviewed</th></tr></thead>
          <tbody>${reviewedRows || '<tr><td colspan="8" class="text-muted">No reviewed artifacts</td></tr>'}</tbody>
        </table>
      </div>`

    return c.html(layout('Proof Center', content, '/proof'))
  })

  return route
}
