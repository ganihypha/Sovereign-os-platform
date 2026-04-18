// ============================================================
// SOVEREIGN OS PLATFORM — WORKFLOWS SURFACE (P9)
// Advanced workflow automation: event → condition → action
//
// GET /workflows            — Workflow list view (HTML)
// GET /workflows/templates  — Built-in template library
// GET /workflows/create     — Create workflow form
// POST /workflows/create    — Submit new workflow
// GET /workflows/:id        — Workflow detail + run history
// POST /workflows/:id/submit   — Submit for Tier 1 approval
// POST /workflows/:id/approve  — Approve and activate (auth)
// POST /workflows/:id/deactivate — Deactivate active workflow
// POST /workflows/:id/trigger  — Manual trigger
//
// AUTH: mutations require auth; Tier 1 approval for activation
// AUDIT: all executions logged to audit_log_v2
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { isAuthenticated } from '../lib/auth'
import { layout } from '../layout'
import {
  getWorkflows,
  getWorkflowById,
  getWorkflowRuns,
  createWorkflow,
  submitWorkflowForApproval,
  approveWorkflow,
  deactivateWorkflow,
  executeWorkflow,
  retryWorkflowRun,
  WORKFLOW_TEMPLATES
} from '../lib/workflowService'
import { emitEvent } from '../lib/eventBusService'

export const workflowsRoute = new Hono<{ Bindings: Env }>()

// GET /workflows — Workflow list
workflowsRoute.get('/', async (c) => {
  const db = c.env.DB
  const auth = await isAuthenticated(c, c.env)

  let workflows: any[] = []
  let error = ''

  try {
    workflows = await getWorkflows(db)
  } catch (err: any) {
    error = err.message || 'Failed to load workflows'
  }

  const statusColors: Record<string, string> = {
    draft: '#9aa3b2',
    pending_approval: '#f59e0b',
    active: '#22c55e',
    inactive: '#ef4444',
    archived: '#5a6478'
  }

  const triggerLabels: Record<string, string> = {
    approval_submitted: '📋 Approval Submitted',
    anomaly_detected: '⚠️ Anomaly Detected',
    federation_request: '🔗 Federation Request',
    connector_submitted: '🛒 Connector Submitted',
    manual: '👆 Manual Trigger'
  }

  const wfRows = workflows.map(wf => {
    const sc = statusColors[wf.status] || '#9aa3b2'
    const tl = triggerLabels[wf.trigger_event] || wf.trigger_event
    return `
    <tr>
      <td><a href="/workflows/${wf.id}" style="color:var(--accent)">${wf.name}</a>
        ${wf.template_id ? `<span style="background:#f59e0b22;color:#f59e0b;border-radius:4px;padding:1px 5px;font-size:10px;margin-left:6px">template</span>` : ''}
      </td>
      <td><span style="background:${sc}22;color:${sc};border-radius:6px;padding:2px 8px;font-size:11px">${wf.status}</span></td>
      <td style="font-size:12px">${tl}</td>
      <td style="color:var(--text3);font-size:12px">${wf.created_by}</td>
      <td style="color:var(--text3);font-size:12px">${(wf.created_at || '').slice(0,10)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <a href="/workflows/${wf.id}" class="btn-sm">View</a>
          ${wf.status === 'draft' && auth ? `<form method="POST" action="/workflows/${wf.id}/submit" style="display:inline"><button type="submit" class="btn-sm btn-amber">Submit</button></form>` : ''}
          ${wf.status === 'pending_approval' && auth ? `<form method="POST" action="/workflows/${wf.id}/approve" style="display:inline"><button type="submit" class="btn-sm btn-green">Approve</button></form>` : ''}
          ${wf.status === 'active' && auth ? `<form method="POST" action="/workflows/${wf.id}/deactivate" style="display:inline"><button type="submit" class="btn-sm btn-red">Deactivate</button></form>` : ''}
          ${wf.status === 'active' ? `<form method="POST" action="/workflows/${wf.id}/trigger" style="display:inline"><button type="submit" class="btn-sm">▶ Trigger</button></form>` : ''}
        </div>
      </td>
    </tr>`
  }).join('')

  // Stats
  const activeCount = workflows.filter(w => w.status === 'active').length
  const pendingCount = workflows.filter(w => w.status === 'pending_approval').length
  const draftCount = workflows.filter(w => w.status === 'draft').length

  const content = `
  <div class="page-header">
    <div>
      <h1>⚡ Workflows</h1>
      <p style="color:var(--text2)">Automated governance workflow chains — P9</p>
    </div>
    ${auth ? `<a href="/workflows/create" class="btn-primary">+ New Workflow</a>` : ''}
  </div>

  ${error ? `<div style="background:#ef444422;border:1px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#ef4444">${error}</div>` : ''}

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
    ${[
      { label: 'Total', val: workflows.length, color: 'var(--accent)' },
      { label: 'Active', val: activeCount, color: '#22c55e' },
      { label: 'Pending Approval', val: pendingCount, color: '#f59e0b' },
      { label: 'Draft', val: draftCount, color: '#9aa3b2' },
    ].map(s => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 18px">
      <div style="font-size:22px;font-weight:700;color:${s.color}">${s.val}</div>
      <div style="color:var(--text3);font-size:12px">${s.label}</div>
    </div>`).join('')}
  </div>

  <!-- Built-in Templates -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px 18px;margin-bottom:16px">
    <div style="font-weight:600;margin-bottom:10px">📦 Built-in Templates (P9)</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${WORKFLOW_TEMPLATES.map(t => `
      <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:7px;padding:12px">
        <div style="font-size:11px;color:#f59e0b;margin-bottom:4px">${t.id}</div>
        <div style="font-weight:500;font-size:13px;margin-bottom:4px">${t.name}</div>
        <div style="color:var(--text3);font-size:11px">${t.description}</div>
        <div style="margin-top:6px;font-size:11px;color:var(--text2)">Trigger: ${t.trigger_event}</div>
      </div>`).join('')}
    </div>
  </div>

  <!-- Workflow table -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">All Workflows</span>
      <span style="color:var(--text3);font-size:12px;margin-left:8px">${workflows.length} total</span>
    </div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--bg3)">
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-size:12px;font-weight:500">Name</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-size:12px;font-weight:500">Status</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-size:12px;font-weight:500">Trigger</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-size:12px;font-weight:500">Created By</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-size:12px;font-weight:500">Date</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-size:12px;font-weight:500">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${workflows.length === 0
          ? `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text3)">No workflows yet. Create one or use built-in templates.</td></tr>`
          : wfRows}
      </tbody>
    </table>
    </div>
  </div>

  <style>
    .btn-sm { background:var(--bg3);border:1px solid var(--border);color:var(--text2);border-radius:5px;padding:3px 10px;cursor:pointer;font-size:12px;text-decoration:none;display:inline-block; }
    .btn-sm:hover { background:var(--border); }
    .btn-amber { background:#f59e0b22;border-color:#f59e0b;color:#f59e0b; }
    .btn-green { background:#22c55e22;border-color:#22c55e;color:#22c55e; }
    .btn-red { background:#ef444422;border-color:#ef4444;color:#ef4444; }
    .btn-primary { background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;text-decoration:none; }
  </style>
  `

  return c.html(layout('Workflows', content, '/workflows'))
})

// GET /workflows/templates — Template library
workflowsRoute.get('/templates', async (c) => {
  const content = `
  <div class="page-header">
    <div><h1>📦 Workflow Templates</h1><p style="color:var(--text2)">Built-in P9 workflow templates</p></div>
    <a href="/workflows" style="color:var(--text2);text-decoration:none">← Back to Workflows</a>
  </div>
  <div style="display:grid;gap:16px">
    ${WORKFLOW_TEMPLATES.map(t => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="background:#f59e0b22;color:#f59e0b;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600">${t.id}</span>
        <span style="font-weight:600;font-size:15px">${t.name}</span>
      </div>
      <p style="color:var(--text2);margin-bottom:12px">${t.description}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:var(--bg3);border-radius:6px;padding:10px">
          <div style="color:var(--text3);font-size:11px;margin-bottom:4px">TRIGGER EVENT</div>
          <code style="color:var(--accent);font-size:12px">${t.trigger_event}</code>
        </div>
        <div style="background:var(--bg3);border-radius:6px;padding:10px">
          <div style="color:var(--text3);font-size:11px;margin-bottom:4px">ACTION</div>
          <code style="color:var(--green);font-size:12px">${t.action_json.type}</code>
        </div>
      </div>
    </div>`).join('')}
  </div>
  `
  return c.html(layout('Workflow Templates', content, '/workflows'))
})

// GET /workflows/create — Create form
workflowsRoute.get('/create', async (c) => {
  const content = `
  <div class="page-header">
    <div><h1>+ New Workflow</h1><p style="color:var(--text2)">Create a new automated governance workflow</p></div>
    <a href="/workflows" style="color:var(--text2);text-decoration:none">← Back</a>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:24px;max-width:600px">
    <form method="POST" action="/workflows/create">
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">WORKFLOW NAME *</label>
        <input name="name" required placeholder="e.g. Auto-Notify on Approval" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px" />
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">DESCRIPTION</label>
        <textarea name="description" rows="2" placeholder="What does this workflow do?" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px;resize:vertical"></textarea>
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">TRIGGER EVENT *</label>
        <select name="trigger_event" required style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px">
          <option value="approval_submitted">approval_submitted</option>
          <option value="anomaly_detected">anomaly_detected</option>
          <option value="federation_request">federation_request</option>
          <option value="connector_submitted">connector_submitted</option>
          <option value="manual">manual</option>
        </select>
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">NOTIFICATION TITLE (action)</label>
        <input name="notif_title" placeholder="e.g. New Approval Pending" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px" />
      </div>
      <div style="margin-bottom:20px">
        <label style="display:block;color:var(--text2);font-size:12px;margin-bottom:6px">NOTIFICATION MESSAGE (action)</label>
        <textarea name="notif_message" rows="2" placeholder="e.g. A new approval request requires your attention" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text);font-size:14px;resize:vertical"></textarea>
      </div>
      <div style="background:var(--bg3);border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:var(--text3)">
        ℹ️ New workflows start as <strong>draft</strong>. Submit for Tier 1 approval to activate.
      </div>
      <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:10px 20px;cursor:pointer;font-size:14px;font-weight:500">Create Workflow</button>
    </form>
  </div>
  `
  return c.html(layout('Create Workflow', content, '/workflows'))
})

// POST /workflows/create — Submit new workflow
workflowsRoute.post('/create', async (c) => {
  const db = c.env.DB
  const body = await c.req.parseBody()
  const name = String(body.name || '').trim()
  const description = String(body.description || '').trim()
  const trigger_event = String(body.trigger_event || 'manual').trim()
  const notif_title = String(body.notif_title || `${trigger_event} triggered`).trim()
  const notif_message = String(body.notif_message || `Automated workflow notification`).trim()

  if (!name) return c.redirect('/workflows/create?error=name_required')

  const wf = await createWorkflow(db, {
    name, description, trigger_event,
    condition_json: { always: true },
    action_json: {
      type: 'create_notification',
      event_type: trigger_event,
      title: notif_title,
      message: notif_message,
      target: 'admin'
    },
    created_by: 'user'
  })

  return c.redirect(`/workflows/${wf.id}`)
})

// GET /workflows/:id — Workflow detail
workflowsRoute.get('/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const auth = await isAuthenticated(c, c.env)

  const wf = await getWorkflowById(db, id)
  if (!wf) return c.html(layout('Not Found', `<div style="padding:40px;color:var(--red)">Workflow not found: ${id}</div>`, '/workflows'), 404)

  const runs = await getWorkflowRuns(db, id, 10)

  const statusColors: Record<string, string> = {
    draft: '#9aa3b2', pending_approval: '#f59e0b', active: '#22c55e', inactive: '#ef4444', archived: '#5a6478'
  }
  const sc = statusColors[wf.status] || '#9aa3b2'

  const runRows = runs.map(r => {
    const rc = r.status === 'success' ? '#22c55e' : r.status === 'failed' ? '#ef4444' : r.status === 'skipped' ? '#f59e0b' : '#9aa3b2'
    return `<tr>
      <td style="padding:10px 14px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3)">${r.id}</td>
      <td style="padding:10px 14px"><span style="background:${rc}22;color:${rc};border-radius:5px;padding:2px 7px;font-size:11px">${r.status}</span></td>
      <td style="padding:10px 14px;color:var(--text2);font-size:12px">${r.triggered_by}</td>
      <td style="padding:10px 14px;color:var(--text2);font-size:12px">${r.output_summary || r.error_message || '-'}</td>
      <td style="padding:10px 14px;color:var(--text3);font-size:11px">${(r.started_at || '').slice(0,19)}</td>
    </tr>`
  }).join('')

  const content = `
  <div class="page-header">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        <h1>⚡ ${wf.name}</h1>
        <span style="background:${sc}22;color:${sc};border-radius:6px;padding:3px 10px;font-size:12px">${wf.status}</span>
        ${wf.template_id ? `<span style="background:#f59e0b22;color:#f59e0b;border-radius:5px;padding:2px 7px;font-size:11px">${wf.template_id}</span>` : ''}
      </div>
      <p style="color:var(--text2)">${wf.description || 'No description'}</p>
    </div>
    <a href="/workflows" style="color:var(--text2);text-decoration:none">← Back</a>
  </div>

  <!-- Actions -->
  <div style="display:flex;gap:10px;margin-bottom:20px">
    ${wf.status === 'draft' && auth ? `<form method="POST" action="/workflows/${wf.id}/submit"><button type="submit" style="background:#f59e0b22;border:1px solid #f59e0b;color:#f59e0b;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px">Submit for Approval</button></form>` : ''}
    ${wf.status === 'pending_approval' && auth ? `<form method="POST" action="/workflows/${wf.id}/approve"><button type="submit" style="background:#22c55e22;border:1px solid #22c55e;color:#22c55e;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px">Approve & Activate</button></form>` : ''}
    ${wf.status === 'active' ? `<form method="POST" action="/workflows/${wf.id}/trigger"><button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px">▶ Manual Trigger</button></form>` : ''}
    ${wf.status === 'active' && auth ? `<form method="POST" action="/workflows/${wf.id}/deactivate"><button type="submit" style="background:#ef444422;border:1px solid #ef4444;color:#ef4444;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px">Deactivate</button></form>` : ''}
  </div>

  <!-- Details -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="color:var(--text3);font-size:11px;margin-bottom:8px">WORKFLOW CONFIG</div>
      <table style="width:100%;font-size:13px">
        ${[
          ['Trigger Event', `<code style="color:var(--accent)">${wf.trigger_event}</code>`],
          ['Created By', wf.created_by],
          ['Approved By', wf.approved_by || '—'],
          ['Activated', wf.activated_at ? wf.activated_at.slice(0,19) : '—'],
          ['Created', (wf.created_at || '').slice(0,19)],
        ].map(([k,v]) => `<tr><td style="padding:4px 0;color:var(--text3)">${k}</td><td style="padding:4px 0;color:var(--text)">${v}</td></tr>`).join('')}
      </table>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="color:var(--text3);font-size:11px;margin-bottom:8px">CONDITION → ACTION</div>
      <div style="margin-bottom:8px">
        <div style="font-size:11px;color:var(--text3)">Condition:</div>
        <code style="font-size:12px;color:#f59e0b">${wf.condition_json}</code>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text3)">Action:</div>
        <code style="font-size:12px;color:#22c55e;word-break:break-all">${wf.action_json}</code>
      </div>
    </div>
  </div>

  <!-- Run history -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <span style="font-weight:600">Execution History</span>
      <span style="color:var(--text3);font-size:12px;margin-left:8px">${runs.length} runs</span>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg3)">
        ${['Run ID', 'Status', 'Triggered By', 'Output', 'Started'].map(h => `<th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-weight:500">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${runs.length === 0
          ? `<tr><td colspan="5" style="padding:30px;text-align:center;color:var(--text3)">No runs yet. Trigger the workflow to execute.</td></tr>`
          : runRows}
      </tbody>
    </table>
  </div>
  `

  return c.html(layout(`Workflow: ${wf.name}`, content, '/workflows'))
})

// POST /workflows/:id/submit
workflowsRoute.post('/:id/submit', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await submitWorkflowForApproval(db, id)
  return c.redirect(`/workflows/${id}`)
})

// POST /workflows/:id/approve
workflowsRoute.post('/:id/approve', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await approveWorkflow(db, id, 'admin')
  return c.redirect(`/workflows/${id}`)
})

// POST /workflows/:id/deactivate
workflowsRoute.post('/:id/deactivate', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  await deactivateWorkflow(db, id)
  return c.redirect(`/workflows/${id}`)
})

// POST /workflows/:id/trigger — Manual trigger
workflowsRoute.post('/:id/trigger', async (c) => {
  const db = c.env.DB
  const kv = c.env.RATE_LIMITER_KV
  const id = c.req.param('id')

  const wf = await getWorkflowById(db, id)
  if (!wf || wf.status !== 'active') return c.redirect(`/workflows/${id}?error=not_active`)

  await executeWorkflow(db, kv, wf, 'manual-trigger', { source: 'manual', workflow_id: id })

  // P12: Emit workflow.triggered event
  if (db) {
    emitEvent(db, {
      event_type: 'workflow.triggered',
      source_surface: 'workflows',
      actor: 'operator',
      resource_id: id,
      resource_type: 'workflow',
      payload: { workflow_name: wf.name, trigger: 'manual' },
      severity: 'info'
    }).catch(() => {})
  }

  return c.redirect(`/workflows/${id}?triggered=1`)
})

// POST /workflows/:run_id/retry — P11: Retry a failed workflow run
workflowsRoute.post('/:run_id/retry', async (c) => {
  const db = c.env.DB
  const kv = c.env.RATE_LIMITER_KV
  const run_id = c.req.param('run_id')

  const newRun = await retryWorkflowRun(db, kv, run_id)
  if (!newRun) return c.json({ error: 'Cannot retry: run not found, not failed, or workflow not active' }, 400)

  // Redirect to workflow detail if we can find workflow_id
  return c.redirect(`/workflows/${newRun.workflow_id}?retry=1`)
})
