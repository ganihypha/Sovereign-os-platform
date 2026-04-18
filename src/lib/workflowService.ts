// src/lib/workflowService.ts
// P9 — Workflow automation service (trigger chains: event → condition → action)
// ai-generated [human-confirmation-gate: required before canonization]

import { createNotification } from './notificationService'
import { writeAuditEvent } from './auditService'

export interface Workflow {
  id: string
  tenant_id: string
  name: string
  description?: string
  trigger_event: string
  condition_json: string
  action_json: string
  template_id?: string
  status: string
  created_by: string
  approved_by?: string
  activated_at?: string
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  triggered_by: string
  input_json: string
  status: string
  output_summary?: string
  error_message?: string
  started_at: string
  completed_at?: string
}

export interface CreateWorkflowInput {
  tenant_id?: string
  name: string
  description?: string
  trigger_event: string
  condition_json?: Record<string, any>
  action_json?: Record<string, any>
  created_by?: string
}

// Built-in workflow templates
export const WORKFLOW_TEMPLATES = [
  {
    id: 'tpl-001',
    name: 'Auto-Notify on Approval Pending',
    description: 'When a new approval is submitted, automatically create a notification for admins',
    trigger_event: 'approval_submitted',
    condition_json: { always: true },
    action_json: {
      type: 'create_notification',
      event_type: 'approval_pending',
      title: 'New Approval Pending',
      message: 'A new approval request requires your attention',
      target: 'admin'
    }
  },
  {
    id: 'tpl-002',
    name: 'Anomaly Alert Escalation',
    description: 'When an anomaly is detected, create high-priority notification and log to audit',
    trigger_event: 'anomaly_detected',
    condition_json: { severity: 'any' },
    action_json: {
      type: 'create_notification',
      event_type: 'anomaly_detected',
      title: 'Platform Anomaly Detected',
      message: 'Anomaly detection pipeline flagged unusual activity',
      target: 'admin'
    }
  },
  {
    id: 'tpl-003',
    name: 'Federation Request Notification',
    description: 'When a federation request is created, notify relevant tenant admins',
    trigger_event: 'federation_request',
    condition_json: { always: true },
    action_json: {
      type: 'create_notification',
      event_type: 'federation_request',
      title: 'Federation Request Received',
      message: 'A new federation request requires review and approval',
      target: 'admin'
    }
  }
]

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// Get all workflows (optionally filtered by tenant or status)
export async function getWorkflows(
  db: D1Database,
  tenant_id?: string,
  status?: string
): Promise<Workflow[]> {
  let q = `SELECT * FROM workflows WHERE 1=1`
  const params: any[] = []
  if (tenant_id) { q += ` AND tenant_id = ?`; params.push(tenant_id) }
  if (status) { q += ` AND status = ?`; params.push(status) }
  q += ` ORDER BY created_at DESC`
  const result = await db.prepare(q).bind(...params).all<Workflow>()
  return result.results || []
}

// Get single workflow by id
export async function getWorkflowById(db: D1Database, id: string): Promise<Workflow | null> {
  return db.prepare(`SELECT * FROM workflows WHERE id = ?`).bind(id).first<Workflow>()
}

// Create a new workflow (starts as draft, requires Tier 1 approval to activate)
export async function createWorkflow(
  db: D1Database,
  input: CreateWorkflowInput
): Promise<Workflow> {
  const id = generateId('wf')
  const now = new Date().toISOString()
  const tenant_id = input.tenant_id || 'default'
  const created_by = input.created_by || 'system'
  const condition_json = JSON.stringify(input.condition_json || {})
  const action_json = JSON.stringify(input.action_json || {})

  await db.prepare(`
    INSERT INTO workflows (id, tenant_id, name, description, trigger_event, condition_json, action_json, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `).bind(id, tenant_id, input.name, input.description || null,
    input.trigger_event, condition_json, action_json, created_by, now, now).run()

  return (await getWorkflowById(db, id))!
}

// Submit workflow for Tier 1 approval
export async function submitWorkflowForApproval(
  db: D1Database,
  id: string
): Promise<boolean> {
  const now = new Date().toISOString()
  const result = await db.prepare(`
    UPDATE workflows SET status = 'pending_approval', updated_at = ? WHERE id = ? AND status = 'draft'
  `).bind(now, id).run()
  return result.meta.changes > 0
}

// Approve and activate a workflow (Tier 1 gate)
export async function approveWorkflow(
  db: D1Database,
  id: string,
  approved_by: string
): Promise<boolean> {
  const now = new Date().toISOString()
  const result = await db.prepare(`
    UPDATE workflows SET status = 'active', approved_by = ?, activated_at = ?, updated_at = ?
    WHERE id = ? AND status = 'pending_approval'
  `).bind(approved_by, now, now, id).run()
  return result.meta.changes > 0
}

// Deactivate a workflow
export async function deactivateWorkflow(
  db: D1Database,
  id: string
): Promise<boolean> {
  const now = new Date().toISOString()
  const result = await db.prepare(`
    UPDATE workflows SET status = 'inactive', updated_at = ? WHERE id = ? AND status = 'active'
  `).bind(now, id).run()
  return result.meta.changes > 0
}

// Get workflow runs for a workflow
export async function getWorkflowRuns(
  db: D1Database,
  workflow_id: string,
  limit: number = 20
): Promise<WorkflowRun[]> {
  const result = await db.prepare(`
    SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?
  `).bind(workflow_id, limit).all<WorkflowRun>()
  return result.results || []
}

// Execute a workflow (trigger chain: evaluate condition → run action)
export async function executeWorkflow(
  db: D1Database,
  kv: KVNamespace,
  workflow: Workflow,
  triggered_by: string,
  input_data: Record<string, any>
): Promise<WorkflowRun> {
  const run_id = generateId('wfrun')
  const started_at = new Date().toISOString()

  // Insert run record as 'running'
  await db.prepare(`
    INSERT INTO workflow_runs (id, workflow_id, triggered_by, input_json, status, started_at)
    VALUES (?, ?, ?, ?, 'running', ?)
  `).bind(run_id, workflow.id, triggered_by, JSON.stringify(input_data), started_at).run()

  let status = 'success'
  let output_summary = ''
  let error_message: string | undefined

  try {
    const action = JSON.parse(workflow.action_json)
    const condition = JSON.parse(workflow.condition_json)

    // Evaluate condition (simple: always true, or check field match)
    const conditionMet = evaluateCondition(condition, input_data)
    if (!conditionMet) {
      status = 'skipped'
      output_summary = 'Condition not met — workflow skipped'
    } else {
      // Execute action
      output_summary = await executeAction(db, kv, action, workflow.tenant_id, triggered_by)
    }
  } catch (err: any) {
    status = 'failed'
    error_message = err.message || 'Unknown error'
  }

  const completed_at = new Date().toISOString()

  // Update run record
  await db.prepare(`
    UPDATE workflow_runs SET status = ?, output_summary = ?, error_message = ?, completed_at = ?
    WHERE id = ?
  `).bind(status, output_summary, error_message || null, completed_at, run_id).run()

  // Log to audit_log_v2
  try {
    await writeAuditEvent(db, {
      event_type: 'workflow_executed',
      object_type: 'workflow',
      object_id: workflow.id,
      actor: triggered_by,
      tenant_id: workflow.tenant_id,
      payload_summary: `Workflow "${workflow.name}" run ${run_id}: ${status}`,
      surface: 'workflows'
    })
  } catch (_) { /* non-blocking */ }

  return {
    id: run_id,
    workflow_id: workflow.id,
    triggered_by,
    input_json: JSON.stringify(input_data),
    status,
    output_summary,
    error_message,
    started_at,
    completed_at
  }
}

function evaluateCondition(condition: Record<string, any>, input: Record<string, any>): boolean {
  if (condition.always === true) return true
  if (condition.never === true) return false
  // Check field match conditions
  for (const [key, val] of Object.entries(condition)) {
    if (key === 'severity' && val === 'any') return true
    if (input[key] !== undefined && input[key] === val) return true
  }
  return true // default: execute if no specific condition blocks
}

async function executeAction(
  db: D1Database,
  kv: KVNamespace,
  action: Record<string, any>,
  tenant_id: string,
  actor: string
): Promise<string> {
  if (action.type === 'create_notification') {
    const notif = await createNotification(db, {
      tenant_id,
      event_type: action.event_type || 'system_alert',
      title: action.title || 'Workflow Notification',
      message: action.message || 'Automated workflow notification',
      actor: `workflow-engine:${actor}`
    })
    // Also publish to KV for SSE
    try {
      await kv.put(
        `notif:latest:${tenant_id}`,
        JSON.stringify(notif),
        { expirationTtl: 300 }
      )
    } catch (_) { /* non-blocking */ }
    return `Notification created: ${notif.id}`
  }

  if (action.type === 'log_audit') {
    await writeAuditEvent(db, {
      event_type: 'workflow_action',
      object_type: 'workflow',
      object_id: action.object_id || 'workflow',
      actor,
      tenant_id,
      payload_summary: action.summary || 'Workflow action executed',
      surface: 'workflows'
    })
    return `Audit event logged`
  }

  return `Action type "${action.type}" acknowledged (no-op)`
}

// Trigger all active workflows matching a given event
export async function triggerWorkflowsByEvent(
  db: D1Database,
  kv: KVNamespace,
  event_type: string,
  triggered_by: string,
  input_data: Record<string, any>,
  tenant_id?: string
): Promise<WorkflowRun[]> {
  let q = `SELECT * FROM workflows WHERE status = 'active' AND trigger_event = ?`
  const params: any[] = [event_type]
  if (tenant_id) { q += ` AND (tenant_id = ? OR tenant_id = 'default')`; params.push(tenant_id) }

  const result = await db.prepare(q).bind(...params).all<Workflow>()
  const workflows = result.results || []
  const runs: WorkflowRun[] = []

  for (const wf of workflows) {
    try {
      const run = await executeWorkflow(db, kv, wf, triggered_by, input_data)
      runs.push(run)
    } catch (_) { /* non-blocking per workflow */ }
  }
  return runs
}
