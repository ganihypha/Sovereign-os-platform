// ============================================================
// SOVEREIGN OS PLATFORM — INTENT ROUTE (P1)
// ============================================================
import { Hono } from 'hono'
import { layout, badgeStatus, timeAgo } from '../layout'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'

export function createIntentRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const intents = await repo.getIntents()

    const rows = intents.map(i => `
      <tr>
        <td><span class="mono text-sm">${i.id}</span></td>
        <td>
          <strong>${i.title}</strong><br>
          <span class="text-muted text-sm">${i.objective.substring(0,90)}...</span>
        </td>
        <td>${badgeStatus(i.urgency)}</td>
        <td><span class="text-sm text-muted">${i.created_by}</span></td>
        <td><span class="text-sm text-muted mono">${timeAgo(i.created_at)}</span></td>
      </tr>`).join('')

    const form = `
      <div class="card">
        <div class="card-header"><div class="card-title">New Strategic Intent</div></div>
        <form method="POST" action="/api/intents">
          <div class="grid-2">
            <div class="form-group">
              <label>Intent Title *</label>
              <input type="text" name="title" placeholder="e.g. Build P1 Connector Layer" required>
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
          <div class="form-group">
            <label>Objective *</label>
            <textarea name="objective" placeholder="What needs to be achieved? Be specific about the outcome." required></textarea>
          </div>
          <div class="form-group">
            <label>Strategic Context</label>
            <textarea name="strategic_context" placeholder="Why does this matter? What changes, what doesn't?"></textarea>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Scope Notes</label>
              <textarea name="scope_notes" placeholder="What is in/out of scope?"></textarea>
            </div>
            <div class="form-group">
              <label>Escalation Notes</label>
              <textarea name="escalation_notes" placeholder="What triggers escalation to Founder?"></textarea>
            </div>
          </div>
          <div class="form-group">
            <label>Created By</label>
            <input type="text" name="created_by" value="Founder" placeholder="Founder / Operator">
          </div>
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">Submit Intent</button>
            <a href="/intake" class="btn btn-ghost">→ Go to Intake</a>
          </div>
        </form>
      </div>`

    const list = `
      <div class="card">
        <div class="card-header"><div class="card-title">Intent History</div></div>
        <table>
          <thead><tr><th>ID</th><th>Title / Objective</th><th>Urgency</th><th>By</th><th>Created</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="text-muted">No intents recorded</td></tr>'}</tbody>
        </table>
      </div>`

    const content = `
      <div class="law-bar">Layer 0 — Founder / Strategic Intent: Source of direction, priority, and decisions. Not an execution layer.</div>
      <div class="grid-2">
        <div>${form}</div>
        <div>
          ${list}
          <div class="card">
            <div class="card-header"><div class="card-title">Intent Rules</div></div>
            <ul style="padding-left:18px;color:var(--text2);font-size:13px;line-height:2">
              <li>Intent defines WHAT and WHY, not HOW</li>
              <li>Every session must trace back to an intent</li>
              <li>Scope notes prevent execution drift</li>
              <li>Escalation notes prevent silent blockers</li>
              <li>Urgency gates prioritization on the live board</li>
            </ul>
          </div>
        </div>
      </div>`

    return c.html(layout('Intent Desk', content, '/intent'))
  })

  return route
}
