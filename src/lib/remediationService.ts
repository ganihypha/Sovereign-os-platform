// src/lib/remediationService.ts
// P11 — Auto-remediation service (playbooks, runs, alert rule integration)
// ai-generated [human-confirmation-gate: required before canonization]

import { createNotification } from './notificationService'
import { writeAuditEvent } from './auditService'

export interface RemediationPlaybook {
  id: string
  tenant_id: string
  name: string
  description?: string
  trigger_rule_id?: string
  trigger_event?: string
  action_steps_json: string   // JSON array of [{type, params}]
  status: 'active' | 'inactive' | 'draft'
  run_count: number
  last_run_at?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface RemediationRun {
  id: string
  playbook_id: string
  tenant_id: string
  triggered_by: string
  trigger_context_json?: string
  status: 'running' | 'completed' | 'failed' | 'partial'
  steps_total: number
  steps_completed: number
  result_json?: string
  error_message?: string
  triggered_at: string
  completed_at?: string
}

export interface ActionStep {
  type: 'create_notification' | 'log_audit' | 'trigger_webhook' | 'send_email' | 'update_status'
  params: Record<string, any>
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ============================================================
// CRUD: Playbooks
// ============================================================
export async function getPlaybooks(
  db: D1Database,
  tenant_id?: string,
  status?: string
): Promise<RemediationPlaybook[]> {
  let q = `SELECT * FROM remediation_playbooks WHERE 1=1`
  const p: any[] = []
  if (tenant_id) { q += ` AND tenant_id = ?`; p.push(tenant_id) }
  if (status) { q += ` AND status = ?`; p.push(status) }
  q += ` ORDER BY created_at DESC`
  try {
    const result = await db.prepare(q).bind(...p).all<RemediationPlaybook>()
    return result.results || []
  } catch { return [] }
}

export async function getPlaybookById(db: D1Database, id: string): Promise<RemediationPlaybook | null> {
  try {
    return await db.prepare(`SELECT * FROM remediation_playbooks WHERE id = ?`).bind(id).first<RemediationPlaybook>()
  } catch { return null }
}

export async function createPlaybook(
  db: D1Database,
  data: {
    tenant_id?: string
    name: string
    description?: string
    trigger_rule_id?: string
    trigger_event?: string
    action_steps: ActionStep[]
    created_by?: string
  }
): Promise<RemediationPlaybook> {
  const id = generateId('pb')
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO remediation_playbooks
    (id, tenant_id, name, description, trigger_rule_id, trigger_event, action_steps_json, status, run_count, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)
  `).bind(
    id,
    data.tenant_id || 'tenant-default',
    data.name,
    data.description || null,
    data.trigger_rule_id || null,
    data.trigger_event || null,
    JSON.stringify(data.action_steps),
    data.created_by || 'user',
    now, now
  ).run()
  return (await getPlaybookById(db, id))!
}

export async function updatePlaybookStatus(
  db: D1Database,
  id: string,
  status: 'active' | 'inactive' | 'draft'
): Promise<void> {
  await db.prepare(`UPDATE remediation_playbooks SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, new Date().toISOString(), id).run()
}

export async function deletePlaybook(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM remediation_playbooks WHERE id = ?`).bind(id).run()
}

// ============================================================
// CRUD: Runs
// ============================================================
export async function getRunsForPlaybook(
  db: D1Database,
  playbook_id: string,
  limit: number = 20
): Promise<RemediationRun[]> {
  try {
    const result = await db.prepare(`
      SELECT * FROM remediation_runs WHERE playbook_id = ? ORDER BY triggered_at DESC LIMIT ?
    `).bind(playbook_id, limit).all<RemediationRun>()
    return result.results || []
  } catch { return [] }
}

export async function getAllRuns(db: D1Database, tenant_id?: string, limit: number = 50): Promise<RemediationRun[]> {
  try {
    let q = `SELECT * FROM remediation_runs WHERE 1=1`
    const p: any[] = []
    if (tenant_id) { q += ` AND tenant_id = ?`; p.push(tenant_id) }
    q += ` ORDER BY triggered_at DESC LIMIT ?`
    p.push(limit)
    const result = await db.prepare(q).bind(...p).all<RemediationRun>()
    return result.results || []
  } catch { return [] }
}

// ============================================================
// CORE: Execute a remediation playbook
// ============================================================
export async function executePlaybook(
  db: D1Database,
  kv: KVNamespace | undefined,
  playbook: RemediationPlaybook,
  triggered_by: string,
  trigger_context: Record<string, any> = {}
): Promise<RemediationRun> {
  const run_id = generateId('remrun')
  const triggered_at = new Date().toISOString()
  let steps: ActionStep[] = []

  try {
    steps = JSON.parse(playbook.action_steps_json) as ActionStep[]
  } catch {
    steps = []
  }

  // Insert run record as 'running'
  await db.prepare(`
    INSERT INTO remediation_runs
    (id, playbook_id, tenant_id, triggered_by, trigger_context_json, status, steps_total, steps_completed, triggered_at)
    VALUES (?, ?, ?, ?, ?, 'running', ?, 0, ?)
  `).bind(
    run_id,
    playbook.id,
    playbook.tenant_id,
    triggered_by,
    JSON.stringify(trigger_context),
    steps.length,
    triggered_at
  ).run()

  let steps_completed = 0
  let finalStatus: RemediationRun['status'] = 'completed'
  const stepResults: Array<{ step: number; type: string; status: string; result?: string; error?: string }> = []
  let lastError: string | undefined

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    try {
      const result = await executeRemediationStep(db, kv, step, playbook.tenant_id, triggered_by, trigger_context)
      stepResults.push({ step: i + 1, type: step.type, status: 'ok', result })
      steps_completed++
    } catch (err: any) {
      stepResults.push({ step: i + 1, type: step.type, status: 'error', error: err.message })
      lastError = err.message
      finalStatus = steps_completed > 0 ? 'partial' : 'failed'
      break
    }
  }

  const completed_at = new Date().toISOString()

  // Update run record
  await db.prepare(`
    UPDATE remediation_runs
    SET status = ?, steps_completed = ?, result_json = ?, error_message = ?, completed_at = ?
    WHERE id = ?
  `).bind(
    finalStatus,
    steps_completed,
    JSON.stringify(stepResults),
    lastError || null,
    completed_at,
    run_id
  ).run()

  // Update playbook run count + last_run_at
  await db.prepare(`
    UPDATE remediation_playbooks SET run_count = run_count + 1, last_run_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(completed_at, completed_at, playbook.id).run()

  // Log to audit trail
  try {
    await writeAuditEvent(db, {
      tenant_id: playbook.tenant_id,
      event_type: 'remediation_run',
      actor: triggered_by,
      resource_id: playbook.id,
      resource_type: 'remediation_playbook',
      action: `execute_playbook:${finalStatus}`,
      metadata: JSON.stringify({ run_id, steps_total: steps.length, steps_completed, playbook_name: playbook.name })
    })
  } catch { /* non-blocking */ }

  return (await db.prepare(`SELECT * FROM remediation_runs WHERE id = ?`).bind(run_id).first<RemediationRun>())!
}

async function executeRemediationStep(
  db: D1Database,
  kv: KVNamespace | undefined,
  step: ActionStep,
  tenant_id: string,
  actor: string,
  context: Record<string, any>
): Promise<string> {
  switch (step.type) {
    case 'create_notification': {
      const params = step.params
      await createNotification(db, kv, {
        tenant_id,
        event_type: params.event_type || 'system_alert',
        title: params.title || 'Auto-Remediation Action',
        message: params.message || `Remediation step executed by ${actor}`,
        actor: 'auto-remediation',
        reference_id: context.rule_id || undefined,
        reference_type: 'remediation'
      })
      return 'notification created'
    }
    case 'log_audit': {
      await writeAuditEvent(db, {
        tenant_id,
        event_type: 'remediation_step',
        actor: 'auto-remediation',
        resource_id: context.rule_id || 'remediation',
        resource_type: 'remediation',
        action: step.params.event || 'auto_remediation_step',
        metadata: JSON.stringify({ ...step.params, context_summary: context })
      })
      return 'audit event logged'
    }
    case 'trigger_webhook': {
      const webhookUrl = step.params.url
      if (!webhookUrl) throw new Error('trigger_webhook: url param required')
      // Store in webhook_delivery_queue for retry
      const queueId = generateId('whq')
      await db.prepare(`
        INSERT INTO webhook_delivery_queue
        (id, tenant_id, event_type, payload_json, webhook_url, status, retry_count, created_at)
        VALUES (?, ?, 'remediation.action', ?, ?, 'pending', 0, ?)
      `).bind(queueId, tenant_id, JSON.stringify({ step, context }), webhookUrl, new Date().toISOString()).run()
      // Fire-and-forget attempt
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'remediation.action', step, context, timestamp: new Date().toISOString() })
        })
        await db.prepare(`UPDATE webhook_delivery_queue SET status = 'delivered', delivered_at = ? WHERE id = ?`)
          .bind(new Date().toISOString(), queueId).run()
      } catch {
        await db.prepare(`UPDATE webhook_delivery_queue SET status = 'failed' WHERE id = ?`)
          .bind(queueId).run()
      }
      return 'webhook queued'
    }
    case 'send_email': {
      // Graceful degradation: log intent, don't fail if RESEND not configured
      await writeAuditEvent(db, {
        tenant_id,
        event_type: 'remediation_email_intent',
        actor: 'auto-remediation',
        resource_id: 'email',
        resource_type: 'remediation',
        action: 'send_email_intent',
        metadata: JSON.stringify({ recipient: step.params.recipient, subject: step.params.subject })
      })
      return 'email intent logged (RESEND_API_KEY required for live delivery)'
    }
    case 'update_status': {
      // Generic status update (log it, surface-specific logic handled by caller)
      await writeAuditEvent(db, {
        tenant_id,
        event_type: 'remediation_status_update',
        actor: 'auto-remediation',
        resource_id: step.params.resource_id || 'unknown',
        resource_type: step.params.resource_type || 'unknown',
        action: 'update_status',
        metadata: JSON.stringify(step.params)
      })
      return `status update logged: ${JSON.stringify(step.params)}`
    }
    default:
      throw new Error(`Unknown remediation step type: ${(step as any).type}`)
  }
}

// ============================================================
// TRIGGER: Check if any active playbooks are triggered by an event
// ============================================================
export async function triggerPlaybooksByEvent(
  db: D1Database,
  kv: KVNamespace | undefined,
  event_type: string,
  context: Record<string, any> = {}
): Promise<void> {
  try {
    const result = await db.prepare(`
      SELECT * FROM remediation_playbooks WHERE status = 'active' AND trigger_event = ?
    `).bind(event_type).all<RemediationPlaybook>()
    const playbooks = result.results || []
    for (const pb of playbooks) {
      await executePlaybook(db, kv, pb, 'auto-trigger', context).catch(() => { /* non-blocking */ })
    }
  } catch { /* non-blocking */ }
}
