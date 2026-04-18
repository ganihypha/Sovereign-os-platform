// ============================================================
// SOVEREIGN OS PLATFORM — REMEDIATION SURFACE (P11)
// Purpose: Auto-remediation playbooks — view, create, run, monitor
// Surface: /remediation
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'
import {
  getPlaybooks, getPlaybookById, createPlaybook, updatePlaybookStatus,
  deletePlaybook, executePlaybook, getAllRuns, getRunsForPlaybook,
  type RemediationPlaybook, type RemediationRun
} from '../lib/remediationService'

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active: 'background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3)',
    inactive: 'background:rgba(107,114,128,0.1);color:#9aa3b2;border:1px solid rgba(107,114,128,0.3)',
    draft: 'background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)',
    running: 'background:rgba(79,142,247,0.1);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3)',
    completed: 'background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3)',
    failed: 'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3)',
    partial: 'background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)',
  }
  const style = map[status] || map.draft
  return `<span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;${style}">${status.toUpperCase()}</span>`
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function createRemediationRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /remediation — list all playbooks + recent runs
  route.get('/', async (c) => {
    const [playbooks, recentRuns] = await Promise.all([
      c.env.DB ? getPlaybooks(c.env.DB) : [],
      c.env.DB ? getAllRuns(c.env.DB, undefined, 10) : []
    ])

    const activeCount = playbooks.filter(p => p.status === 'active').length
    const totalRuns = recentRuns.length

    const playbookRows = playbooks.map(p => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${p.name}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${p.description || '—'}</div>
        </td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${p.trigger_event || p.trigger_rule_id || 'manual'}</td>
        <td style="padding:10px 12px">${statusBadge(p.status)}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text2)">${p.run_count}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${p.last_run_at ? timeAgo(p.last_run_at) : 'Never'}</td>
        <td style="padding:10px 12px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <a href="/remediation/${p.id}" style="padding:4px 10px;background:rgba(79,142,247,0.15);color:#4f8ef7;border-radius:4px;font-size:10px;font-weight:600;text-decoration:none">View</a>
            <form action="/remediation/${p.id}/run" method="POST" style="display:inline">
              <button type="submit" style="padding:4px 10px;background:rgba(34,197,94,0.15);color:#22c55e;border:none;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer" ${p.status !== 'active' ? 'disabled' : ''}>Run Now</button>
            </form>
            <form action="/remediation/${p.id}/toggle" method="POST" style="display:inline">
              <button type="submit" style="padding:4px 10px;background:rgba(107,114,128,0.1);color:#9aa3b2;border:none;border-radius:4px;font-size:10px;cursor:pointer">${p.status === 'active' ? 'Deactivate' : 'Activate'}</button>
            </form>
            <form action="/remediation/${p.id}/delete" method="POST" style="display:inline" onsubmit="return confirm('Delete playbook?')">
              <button type="submit" style="padding:4px 10px;background:rgba(239,68,68,0.1);color:#ef4444;border:none;border-radius:4px;font-size:10px;cursor:pointer">Delete</button>
            </form>
          </div>
        </td>
      </tr>
    `).join('')

    const runRows = recentRuns.map(r => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 12px;font-size:11px;font-family:monospace;color:var(--text3)">${r.id}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${r.playbook_id}</td>
        <td style="padding:8px 12px">${statusBadge(r.status)}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${r.steps_completed}/${r.steps_total}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${r.triggered_by}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${timeAgo(r.triggered_at)}</td>
      </tr>
    `).join('')

    const content = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div>
          <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0">Auto-Remediation</h1>
          <p style="color:var(--text3);font-size:13px;margin:4px 0 0">Playbooks for automated incident response and platform self-healing</p>
        </div>
        <div style="display:flex;gap:12px">
          <div style="text-align:center;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:12px 20px">
            <div style="font-size:24px;font-weight:700;color:#22c55e">${activeCount}</div>
            <div style="font-size:11px;color:var(--text3)">Active Playbooks</div>
          </div>
          <div style="text-align:center;background:rgba(79,142,247,0.05);border:1px solid rgba(79,142,247,0.2);border-radius:8px;padding:12px 20px">
            <div style="font-size:24px;font-weight:700;color:#4f8ef7">${playbooks.length}</div>
            <div style="font-size:11px;color:var(--text3)">Total Playbooks</div>
          </div>
          <div style="text-align:center;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:12px 20px">
            <div style="font-size:24px;font-weight:700;color:#fbbf24">${totalRuns}</div>
            <div style="font-size:11px;color:var(--text3)">Recent Runs</div>
          </div>
        </div>
      </div>

      <!-- Create Playbook Form -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">Create New Playbook</div>
        </div>
        <form action="/remediation/create" method="POST">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px">
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Playbook Name *</label>
              <input name="name" required placeholder="e.g. High Approval Queue Escalation" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:12px;box-sizing:border-box">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Trigger Event</label>
              <input name="trigger_event" placeholder="e.g. alert.triggered, approval.queue_high" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:12px;box-sizing:border-box">
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Description</label>
              <input name="description" placeholder="Brief description of this playbook" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:12px;box-sizing:border-box">
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Action Steps (JSON array)</label>
              <textarea name="steps_json" rows="4" placeholder='[{"type":"create_notification","params":{"title":"Alert","event_type":"system_alert","message":"Auto-remediation triggered"}},{"type":"log_audit","params":{"event":"auto_remediation","severity":"info"}}]' style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:11px;font-family:monospace;resize:vertical;box-sizing:border-box"></textarea>
              <div style="font-size:10px;color:var(--text3);margin-top:4px">Step types: create_notification | log_audit | trigger_webhook | send_email | update_status</div>
            </div>
          </div>
          <div style="padding:0 16px 16px">
            <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:12px;font-weight:600;cursor:pointer">Create Playbook</button>
          </div>
        </form>
      </div>

      <!-- Playbooks Table -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">Playbooks (${playbooks.length})</div>
        </div>
        ${playbooks.length === 0 ? '<div style="padding:32px;text-align:center;color:var(--text3)">No playbooks defined yet.</div>' : `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:2px solid var(--border)">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Name</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Trigger</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Status</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Runs</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Last Run</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Actions</th>
            </tr></thead>
            <tbody>${playbookRows}</tbody>
          </table>
        </div>`}
      </div>

      <!-- Recent Runs -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Runs (last 10)</div>
        </div>
        ${recentRuns.length === 0 ? '<div style="padding:32px;text-align:center;color:var(--text3)">No runs yet.</div>' : `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:2px solid var(--border)">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Run ID</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Playbook</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Status</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Steps</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Triggered By</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">When</th>
            </tr></thead>
            <tbody>${runRows}</tbody>
          </table>
        </div>`}
      </div>
    `
    return c.html(layout('Auto-Remediation', content, '/remediation'))
  })

  // GET /remediation/:id — playbook detail
  route.get('/:id', async (c) => {
    const id = c.req.param('id')
    if (!c.env.DB) return c.redirect('/remediation')
    const playbook = await getPlaybookById(c.env.DB, id)
    if (!playbook) return c.html(layout('Not Found', `<div style="padding:40px;text-align:center;color:var(--text3)">Playbook not found: ${id}</div>`, '/remediation'), 404)

    const runs = await getRunsForPlaybook(c.env.DB, id, 20)

    let stepsDisplay = ''
    try {
      const steps = JSON.parse(playbook.action_steps_json)
      stepsDisplay = steps.map((s: any, i: number) => `
        <div style="padding:10px 12px;background:rgba(0,0,0,0.2);border-radius:6px;margin-bottom:8px">
          <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:4px">Step ${i + 1}: ${s.type}</div>
          <pre style="font-size:10px;color:var(--text2);margin:0;white-space:pre-wrap">${JSON.stringify(s.params, null, 2)}</pre>
        </div>
      `).join('')
    } catch { stepsDisplay = `<pre style="font-size:11px;color:var(--text2)">${playbook.action_steps_json}</pre>` }

    const runRows = runs.map(r => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 12px;font-size:11px;font-family:monospace;color:var(--text3)">${r.id}</td>
        <td style="padding:8px 12px">${statusBadge(r.status)}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${r.steps_completed}/${r.steps_total}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${r.triggered_by}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${r.error_message || '—'}</td>
        <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${timeAgo(r.triggered_at)}</td>
      </tr>
    `).join('')

    const content = `
      <div style="margin-bottom:20px">
        <a href="/remediation" style="color:var(--accent);font-size:13px;text-decoration:none">← Back to Remediation</a>
      </div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">${playbook.name}</div>
          <div style="display:flex;gap:8px">
            <form action="/remediation/${id}/run" method="POST" style="display:inline">
              <button type="submit" style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:6px 16px;font-size:12px;font-weight:600;cursor:pointer" ${playbook.status !== 'active' ? 'disabled' : ''}>▶ Run Now</button>
            </form>
            <form action="/remediation/${id}/toggle" method="POST" style="display:inline">
              <button type="submit" style="background:rgba(107,114,128,0.1);color:#9aa3b2;border:1px solid rgba(107,114,128,0.2);border-radius:6px;padding:6px 16px;font-size:12px;cursor:pointer">${playbook.status === 'active' ? 'Deactivate' : 'Activate'}</button>
            </form>
          </div>
        </div>
        <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Status</div>
            ${statusBadge(playbook.status)}
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Trigger Event</div>
            <div style="font-size:13px;color:var(--text2);font-family:monospace">${playbook.trigger_event || '—'}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Total Runs</div>
            <div style="font-size:20px;font-weight:700;color:var(--accent)">${playbook.run_count}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Last Run</div>
            <div style="font-size:13px;color:var(--text2)">${playbook.last_run_at ? timeAgo(playbook.last_run_at) : 'Never'}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Created By</div>
            <div style="font-size:13px;color:var(--text2)">${playbook.created_by}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Created At</div>
            <div style="font-size:13px;color:var(--text2)">${new Date(playbook.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div style="padding:0 16px 16px">
          <div style="font-size:11px;color:var(--text3);font-weight:600;margin-bottom:8px">Action Steps</div>
          ${stepsDisplay || '<div style="color:var(--text3);font-size:12px">No steps defined.</div>'}
        </div>
      </div>
      <!-- Run History -->
      <div class="card">
        <div class="card-header"><div class="card-title">Run History (${runs.length})</div></div>
        ${runs.length === 0 ? '<div style="padding:32px;text-align:center;color:var(--text3)">No runs yet.</div>' : `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="border-bottom:2px solid var(--border)">
              <th style="padding:8px 12px;font-size:11px;color:var(--text3)">Run ID</th>
              <th style="padding:8px 12px;font-size:11px;color:var(--text3)">Status</th>
              <th style="padding:8px 12px;font-size:11px;color:var(--text3)">Steps</th>
              <th style="padding:8px 12px;font-size:11px;color:var(--text3)">Triggered By</th>
              <th style="padding:8px 12px;font-size:11px;color:var(--text3)">Error</th>
              <th style="padding:8px 12px;font-size:11px;color:var(--text3)">When</th>
            </tr></thead>
            <tbody>${runRows}</tbody>
          </table>
        </div>`}
      </div>
    `
    return c.html(layout(`Remediation: ${playbook.name}`, content, '/remediation'))
  })

  // POST /remediation/create
  route.post('/create', async (c) => {
    const body = await c.req.parseBody()
    if (!c.env.DB) return c.redirect('/remediation')

    let steps: any[] = []
    try {
      steps = JSON.parse((body.steps_json as string) || '[]')
    } catch { steps = [] }

    await createPlaybook(c.env.DB, {
      name: body.name as string,
      description: body.description as string,
      trigger_event: body.trigger_event as string,
      action_steps: steps,
      created_by: 'user'
    })
    return c.redirect('/remediation')
  })

  // POST /remediation/:id/run — manual trigger
  route.post('/:id/run', async (c) => {
    const id = c.req.param('id')
    if (!c.env.DB) return c.redirect('/remediation')
    const playbook = await getPlaybookById(c.env.DB, id)
    if (!playbook || playbook.status !== 'active') return c.redirect(`/remediation/${id}`)
    await executePlaybook(c.env.DB, c.env.RATE_LIMITER_KV, playbook, 'manual-user', { source: 'manual_trigger' })
    return c.redirect(`/remediation/${id}`)
  })

  // POST /remediation/:id/toggle
  route.post('/:id/toggle', async (c) => {
    const id = c.req.param('id')
    if (!c.env.DB) return c.redirect('/remediation')
    const playbook = await getPlaybookById(c.env.DB, id)
    if (!playbook) return c.redirect('/remediation')
    await updatePlaybookStatus(c.env.DB, id, playbook.status === 'active' ? 'inactive' : 'active')
    return c.redirect('/remediation')
  })

  // POST /remediation/:id/delete
  route.post('/:id/delete', async (c) => {
    const id = c.req.param('id')
    if (!c.env.DB) return c.redirect('/remediation')
    await deletePlaybook(c.env.DB, id)
    return c.redirect('/remediation')
  })

  return route
}
