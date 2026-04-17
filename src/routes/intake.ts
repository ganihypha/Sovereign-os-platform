// ============================================================
// SOVEREIGN OS PLATFORM — INTAKE ROUTE (P1)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'

export function createIntakeRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const [requests, intents, sessions] = await Promise.all([
      repo.getRequests(),
      repo.getIntents(),
      repo.getSessions(),
    ])

    const intentOptions = intents.map(i => `<option value="${i.id}">${i.title}</option>`).join('')
    const sessionOptions = sessions.map(s => `<option value="${s.id}">${s.title}</option>`).join('')

    const rows = requests.map(r => `
      <tr>
        <td><span class="mono text-sm">${r.id}</span></td>
        <td>
          <strong>${r.request_title}</strong><br>
          <span class="text-muted text-sm">${r.context_summary.substring(0,70)}...</span>
        </td>
        <td><span class="badge badge-blue">${r.request_type}</span></td>
        <td><span class="badge badge-grey">${r.lane}</span></td>
        <td>${badgeStatus(r.urgency)}</td>
        <td>${badgeStatus(r.readiness_status)}</td>
        <td>${badgeStatus(r.decision)}</td>
        <td><span class="text-sm text-muted mono">${timeAgo(r.created_at)}</span></td>
      </tr>`).join('')

    const form = `
      <div class="card">
        <div class="card-header"><div class="card-title">New Request / Session Intake</div></div>
        <form method="POST" action="/api/requests">
          <div class="grid-2">
            <div class="form-group">
              <label>Request Title *</label>
              <input type="text" name="request_title" placeholder="Short, clear title" required>
            </div>
            <div class="form-group">
              <label>Request Type *</label>
              <select name="request_type" required>
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="hardening">Hardening</option>
                <option value="docs">Docs</option>
                <option value="ops">Ops</option>
                <option value="governance">Governance</option>
                <option value="approval-needed">Approval Needed</option>
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Lane *</label>
              <select name="lane" required>
                <option value="governance">Governance</option>
                <option value="ops">Ops</option>
                <option value="docs">Docs</option>
                <option value="execution">Execution</option>
                <option value="product-lane">Product Lane</option>
              </select>
            </div>
            <div class="form-group">
              <label>Urgency</label>
              <select name="urgency">
                <option value="critical">Critical</option>
                <option value="high" selected>High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Linked Intent</label>
              <select name="intent_id">
                <option value="">— None —</option>
                ${intentOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Linked Session</label>
              <select name="session_id">
                <option value="">— None —</option>
                ${sessionOptions}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Requester</label>
            <input type="text" name="requester" placeholder="Who is requesting this?" value="Master Architect">
          </div>
          <div class="form-group">
            <label>Context Summary *</label>
            <textarea name="context_summary" placeholder="What is the context? Why is this needed now?" required></textarea>
          </div>
          <div class="form-group">
            <label>Source References</label>
            <input type="text" name="source_refs" placeholder="Comma-separated refs: doc-001, dec-002, ...">
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Readiness Status</label>
              <select name="readiness_status">
                <option value="ready">Ready</option>
                <option value="partial">Partial</option>
                <option value="blocked">Blocked</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div class="form-group">
              <label>Decision *</label>
              <select name="decision" required>
                <option value="proceed">Proceed</option>
                <option value="hold">Hold</option>
                <option value="blocked">Blocked</option>
                <option value="approval-needed">Approval Needed</option>
              </select>
            </div>
          </div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">Submit Request</button>
            <a href="/architect" class="btn btn-ghost">→ Architect Workbench</a>
            <a href="/approvals" class="btn btn-ghost">→ Approval Queue</a>
          </div>
        </form>
      </div>`

    const readinessGuide = `
      <div class="card">
        <div class="card-header"><div class="card-title">Readiness Assessment Guide</div></div>
        <table>
          <thead><tr><th>Status</th><th>Meaning</th><th>Action</th></tr></thead>
          <tbody>
            <tr><td>${badgeStatus('ready')}</td><td>All context, access, and constraints available</td><td>Proceed to architect workbench</td></tr>
            <tr><td>${badgeStatus('partial')}</td><td>Some context missing but can start</td><td>Note limitations in context_summary</td></tr>
            <tr><td>${badgeStatus('blocked')}</td><td>Missing critical access, credential, or decision</td><td>Set decision = BLOCKED, name blocker</td></tr>
            <tr><td>${badgeStatus('unknown')}</td><td>Readiness not yet assessed</td><td>Do intake assessment before proceeding</td></tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Decision Model</div></div>
        <table>
          <thead><tr><th>Decision</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>${badgeStatus('proceed')}</td><td>Ready and bounded — send to architect workbench</td></tr>
            <tr><td>${badgeStatus('hold')}</td><td>Deprioritized — park for LATER/HOLD on live board</td></tr>
            <tr><td>${badgeStatus('blocked')}</td><td>Cannot proceed — log blocker, escalate if needed</td></tr>
            <tr><td>${badgeStatus('approval-needed')}</td><td>Sensitive action — route to approval queue</td></tr>
          </tbody>
        </table>
      </div>`

    const list = `
      <div class="card">
        <div class="card-header"><div class="card-title">Request Queue (${requests.length})</div></div>
        <table>
          <thead><tr><th>ID</th><th>Request</th><th>Type</th><th>Lane</th><th>Urgency</th><th>Readiness</th><th>Decision</th><th>Created</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="text-muted">No requests yet</td></tr>'}</tbody>
        </table>
      </div>`

    const content = `
      <div class="law-bar">Layer 2 — Intake: Classify request, assign lane, check readiness, decide proceed / hold / blocked / approval-needed.</div>
      <div class="grid-2">
        <div>${form}</div>
        <div>${readinessGuide}</div>
      </div>
      ${list}`

    return c.html(layout('Session Intake', content, '/intake'))
  })

  return route
}
