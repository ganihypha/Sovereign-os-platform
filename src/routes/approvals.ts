// ============================================================
// SOVEREIGN OS PLATFORM — APPROVALS ROUTE (P1)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, badgeApprovalTier, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'
import { abacGuardApprove } from '../lib/abacMiddleware'

export function createApprovalsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const approvals = await repo.getApprovalRequests()

    const pending = approvals.filter(a => a.status === 'pending')
    const resolved = approvals.filter(a => a.status !== 'pending')

    const tierGuide = `
      <div class="card">
        <div class="card-header"><div class="card-title">Approval Tier Model</div></div>
        <div class="grid-4">
          <div class="stat-card">
            <div class="stat-label">Tier 0</div>
            <div style="margin:8px 0"><span class="tier-0">AUTO</span></div>
            <div class="text-sm text-muted">Safe, reversible actions. No human gate required.</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Tier 1</div>
            <div style="margin:8px 0"><span class="tier-1">ASYNC</span></div>
            <div class="text-sm text-muted">Standard operational actions. Async human approval.</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Tier 2</div>
            <div style="margin:8px 0"><span class="tier-2">SYNC</span></div>
            <div class="text-sm text-muted">Sensitive or irreversible. Synchronous human approval.</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Tier 3</div>
            <div style="margin:8px 0"><span class="tier-3">FOUNDER</span></div>
            <div class="text-sm text-muted">Founder-only. Canon promotion, strategic scope change.</div>
          </div>
        </div>
      </div>`

    const pendingCards = pending.length > 0 ? pending.map(a => `
      <div class="card" style="border-left: 3px solid ${a.approval_tier >= 2 ? 'var(--red)' : a.approval_tier === 1 ? 'var(--yellow)' : 'var(--green)'}">
        <div class="card-header">
          <div>
            <span class="mono text-sm text-muted">${a.id}</span>
            <strong style="display:block;margin-top:4px">${a.action_type}</strong>
          </div>
          ${badgeApprovalTier(a.approval_tier)}
        </div>

        <div class="grid-2 mb-4">
          <div>
            <div class="section-title">Requested By</div>
            <p class="text-sm">${a.requested_by}</p>
          </div>
          <div>
            <div class="section-title">Status</div>
            ${badgeStatus(a.status)}
          </div>
        </div>

        <div class="section-title">Risk Summary</div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px">${a.risk_summary}</p>

        <div class="section-title">Payload Summary</div>
        <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:10px;font-size:13px;margin-bottom:16px">${a.payload_summary}</div>

        <div class="section-title">Submitted</div>
        <p class="text-sm text-muted mb-4">${timeAgo(a.timestamp)} — ${a.timestamp}</p>

        <form method="POST" action="/api/approvals/${a.id}/decision" style="border-top:1px solid var(--border);padding-top:16px">
          <div class="form-group">
            <label>Decision Reason / Notes</label>
            <textarea name="reason" placeholder="Explain your approval or rejection reason..."></textarea>
          </div>
          <div class="form-group">
            <label>Approved By</label>
            <input type="text" name="approved_by" placeholder="Your name / role" value="${a.approval_tier >= 3 ? 'Founder' : 'Operator'}">
          </div>
          <div class="btn-group">
            <button type="submit" name="action" value="approved" class="btn btn-green">✓ Approve</button>
            <button type="submit" name="action" value="returned" class="btn btn-yellow">↩ Return for Clarification</button>
            <button type="submit" name="action" value="rejected" class="btn btn-red">✗ Reject</button>
          </div>
        </form>
      </div>`).join('') : `
      <div class="card">
        <p class="text-muted text-sm">No pending approvals. All clear.</p>
      </div>`

    const auditRows = resolved.map(a => `
      <tr>
        <td><span class="mono text-sm">${a.id}</span></td>
        <td>${a.action_type}</td>
        <td>${badgeApprovalTier(a.approval_tier)}</td>
        <td>${a.requested_by}</td>
        <td>${badgeStatus(a.status)}</td>
        <td>${a.approved_by ?? '—'}</td>
        <td class="text-sm text-muted">${a.decision_reason || '—'}</td>
        <td class="text-sm text-muted">${a.resolved_at ? timeAgo(a.resolved_at) : '—'}</td>
      </tr>`).join('')

    const newApprovalForm = `
      <div class="card">
        <div class="card-header"><div class="card-title">Submit Approval Request</div></div>
        <form method="POST" action="/api/approvals">
          <div class="grid-2">
            <div class="form-group">
              <label>Action Type *</label>
              <input type="text" name="action_type" placeholder="e.g. Deploy to production" required>
            </div>
            <div class="form-group">
              <label>Approval Tier *</label>
              <select name="approval_tier" required>
                <option value="0">Tier 0 — Auto-approve</option>
                <option value="1" selected>Tier 1 — Async approval</option>
                <option value="2">Tier 2 — Synchronous</option>
                <option value="3">Tier 3 — Founder only</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Request ID (linked request)</label>
            <input type="text" name="request_id" placeholder="req-xxx">
          </div>
          <div class="form-group">
            <label>Risk Summary</label>
            <textarea name="risk_summary" placeholder="What is the risk if this action goes wrong?"></textarea>
          </div>
          <div class="form-group">
            <label>Payload Summary</label>
            <textarea name="payload_summary" placeholder="What exactly will be done / changed?"></textarea>
          </div>
          <div class="form-group">
            <label>Requested By</label>
            <input type="text" name="requested_by" value="Master Architect">
          </div>
          <button type="submit" class="btn btn-primary">Submit for Approval</button>
        </form>
      </div>`

    const content = `
      <div class="law-bar">Approval Model: Sensitive or irreversible actions must be human-gated. Tier determines who approves and how. Every approval must have traceable audit trail.</div>

      ${tierGuide}

      <div class="grid-2">
        <div>
          <div class="section-title">Pending Approvals (${pending.length})</div>
          ${pendingCards}
        </div>
        <div>
          ${newApprovalForm}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Audit Trail — Resolved Approvals (${resolved.length})</div></div>
        <table>
          <thead><tr><th>ID</th><th>Action</th><th>Tier</th><th>Requested By</th><th>Status</th><th>Approved By</th><th>Reason</th><th>Resolved</th></tr></thead>
          <tbody>${auditRows || '<tr><td colspan="8" class="text-muted">No resolved approvals</td></tr>'}</tbody>
        </table>
      </div>`

    return c.html(layout('Approval Queue', content, '/approvals'))
  })

  return route
}
