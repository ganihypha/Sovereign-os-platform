// ============================================================
// SOVEREIGN OS PLATFORM — AI ORCHESTRATION ASSIST SURFACE (P5)
// AI = Layer 2 assist only.
// CRITICAL: Human confirmation gate mandatory for every output.
// No auto-approval. No auto-canon-promotion. No secret exposure.
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { layout } from '../layout'
import { isAuthenticated } from '../lib/auth'
import { runAiAssist } from '../lib/aiAssist'
import type { AiAssistType } from '../types'
import { planGuard } from '../lib/planGuard'

export function createAiAssistRoute() {
  const app = new Hono<{ Bindings: Env }>()

  // GET /ai-assist — AI Assist dashboard
  app.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    const [logs, unreadAlerts] = await Promise.all([
      repo.getAiAssistLogs(),
      repo.getUnreadAlertCount(),
    ])

    // P22: AI available if OpenAI OR Groq key is configured
    const hasAiKey = !!(c.env as Record<string, unknown>)['OPENAI_API_KEY']
      || !!(c.env as Record<string, unknown>)['GROQ_API_KEY']
    const aiProvider = (c.env as Record<string, unknown>)['OPENAI_API_KEY']
      ? 'OpenAI (gpt-4o-mini)'
      : (c.env as Record<string, unknown>)['GROQ_API_KEY']
        ? 'Groq (llama-3.3-70b-versatile)'
        : 'none'

    const logRows = logs.slice(0, 20).map(log => `
      <tr>
        <td style="font-size:11px"><code>${log.id.slice(0,8)}</code></td>
        <td><span class="badge badge-blue">${log.assist_type}</span></td>
        <td>
          <span class="badge ${log.confidence_tag === 'reviewed' ? 'badge-green' : 'badge-yellow'}">${log.confidence_tag}</span>
        </td>
        <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">
          ${escHtml(log.output_summary.slice(0,80))}${log.output_summary.length > 80 ? '…' : ''}
        </td>
        <td style="font-size:11px">${log.discarded ? '<span style="color:var(--text3)">Discarded</span>' : log.confirmed_by ? `Confirmed by ${escHtml(log.confirmed_by)}` : '<span style="color:var(--warning)">Pending review</span>'}</td>
        <td style="font-size:11px;color:var(--text2)">${log.created_at.slice(0,16)}</td>
        ${authenticated && !log.confirmed_by && !log.discarded ? `
        <td>
          <form method="POST" action="/ai-assist/${log.id}/confirm" style="display:inline">
            <button class="btn btn-sm btn-green">Confirm</button>
          </form>
          <form method="POST" action="/ai-assist/${log.id}/discard" style="display:inline">
            <button class="btn btn-sm btn-red">Discard</button>
          </form>
        </td>` : `<td style="font-size:11px;color:var(--text3)">—</td>`}
      </tr>`).join('')

    const body = `
      <div class="page-header">
        <div>
          <h1 class="page-title">AI Orchestration Assist</h1>
          <p class="page-subtitle">Layer 2 assist only. Human confirmation required for every output.</p>
        </div>
      </div>

      ${!hasAiKey ? `
      <div class="card mb-4" style="border-left:3px solid var(--warning);background:rgba(245,158,11,0.05)">
        <div class="card-body">
          <strong>⚠ AI Degraded Mode</strong> — <code>OPENAI_API_KEY</code> and <code>GROQ_API_KEY</code> not configured.
          AI suggestions will not be generated. Set either secret via <code>wrangler pages secret put</code> to enable AI assist.
        </div>
      </div>` : `
      <div class="card mb-4" style="border-left:3px solid var(--success);background:rgba(16,185,129,0.05)">
        <div class="card-body">
          <strong>✓ AI Available</strong> — Provider: <strong>${aiProvider}</strong>. All outputs are tagged <code>ai-generated</code> and require human review.
        </div>
      </div>`}

      <div class="card mb-4">
        <div class="card-header">
          <h2 class="card-title">Request AI Assist</h2>
          <span class="badge badge-yellow">Human Gate Mandatory</span>
        </div>
        <div class="card-body">
          ${authenticated ? `
          <form method="POST" action="/ai-assist/generate">
            <div class="form-group">
              <label class="form-label">Assist Type</label>
              <select class="form-input" name="assist_type">
                <option value="session_brief">Session Brief — Generate bounded session brief</option>
                <option value="scope_suggestion">Scope Suggestion — Clarify scope boundaries</option>
                <option value="risk_assessment">Risk Assessment — Identify governance risks</option>
                <option value="review_summary">Review Summary — Summarize for reviewer</option>
                <option value="general">General — Governance-aware analysis</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Context (paste your text here)</label>
              <textarea class="form-input" name="context" rows="5" required
                placeholder="Paste the session intent, work item, or text you want AI to assist with..."></textarea>
              <span class="form-hint">Max 2000 characters. Raw text — do not include secrets.</span>
            </div>
            <div class="form-group">
              <label class="form-label">Session ID (optional)</label>
              <input class="form-input" name="session_id" placeholder="ses-xxx">
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:12px">
              <button type="submit" class="btn btn-primary">Generate (requires review)</button>
              <span style="font-size:11px;color:var(--text2)">Output will appear in the log below. Must be confirmed or discarded.</span>
            </div>
          </form>` : `
          <div style="padding:16px;text-align:center;color:var(--text2)">
            <a href="/auth/login" class="btn btn-primary">Login to use AI Assist</a>
          </div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">AI Assist Log</h2>
          <span class="badge badge-blue">${logs.length} entries</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th><th>Type</th><th>Tag</th><th>Output Preview</th>
                <th>Status</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y">${logRows || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text2)">No AI assist invocations yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`

    return c.html(layout('AI Assist', body, '/ai-assist', unreadAlerts))
  })

  // POST /ai-assist/generate — Invoke AI assist
  // POST /ai-assist/generate — P22: plan gate (ai_assist = enterprise only)
  app.use('/generate', planGuard('ai_assist'))
  app.post('/generate', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const body = await c.req.parseBody()
    const assist_type = (body['assist_type'] as AiAssistType) || 'general'
    const context = String(body['context'] || '').trim().slice(0, 2000)
    const session_id = String(body['session_id'] || '').trim() || undefined

    if (!context) return c.json({ error: 'context is required' }, 400)

    const openAiKey = (c.env as Record<string, unknown>)['OPENAI_API_KEY'] as string | undefined
    // P22: Groq fallback
    const groqKey = (c.env as Record<string, unknown>)['GROQ_API_KEY'] as string | undefined

    const result = await runAiAssist(repo, {
      assist_type,
      context,
      session_id,
      tenant_id: 'tenant-default',
      created_by: 'architect',
    }, openAiKey, groqKey)

    // Show result on a confirmation page
    const unreadAlerts = await repo.getUnreadAlertCount()
    const isDegraded = 'degraded' in result && result.degraded

    const body2 = `
      <div class="page-header">
        <h1 class="page-title">AI Assist Result</h1>
      </div>
      <div class="card mb-4" style="border-left:3px solid var(--warning)">
        <div class="card-body">
          <div class="badge badge-yellow" style="margin-bottom:8px">ai-generated — requires human review</div>
          <p style="font-size:12px;color:var(--text2);margin-bottom:8px">Log ID: <code>${result.log_id}</code> | Model: ${result.model_hint}</p>
          ${isDegraded ? `
          <div style="background:var(--bg2);padding:12px;border-radius:4px;color:var(--text2)">
            <strong>Degraded Mode:</strong> ${result.warning}
          </div>` : `
          <div style="background:var(--bg2);padding:16px;border-radius:4px;white-space:pre-wrap;font-size:13px">
${escHtml(result.output ?? '')}
          </div>
          <p style="font-size:11px;color:var(--warning);margin-top:8px">⚠ ${result.warning}</p>`}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${!isDegraded ? `
        <form method="POST" action="/ai-assist/${result.log_id}/confirm">
          <button class="btn btn-green">✓ Confirm (mark as reviewed)</button>
        </form>
        <form method="POST" action="/ai-assist/${result.log_id}/discard">
          <button class="btn btn-red">✗ Discard</button>
        </form>` : ''}
        <a href="/ai-assist" class="btn btn-secondary">Back to AI Assist</a>
      </div>`

    return c.html(layout('AI Assist Result', body2, '/ai-assist', unreadAlerts))
  })

  // POST /ai-assist/:id/confirm — Human confirms AI output
  app.post('/:id/confirm', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const id = c.req.param('id')
    await repo.confirmAiAssist(id, 'architect')
    return c.redirect('/ai-assist')
  })

  // POST /ai-assist/:id/discard — Human discards AI output
  app.post('/:id/discard', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const id = c.req.param('id')
    await repo.discardAiAssist(id)
    return c.redirect('/ai-assist')
  })

  return app
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
