// ============================================================
// SOVEREIGN OS PLATFORM — ALERT RULES SERVICE (P10)
// Purpose: Configurable alert rules engine
//          condition → threshold → action (notification/audit/webhook)
// Integration: anomalyService, repo, notificationService
// ============================================================

import { createRepo } from './repo'

export interface AlertRule {
  id: string
  tenant_id: string
  name: string
  description?: string
  metric: string
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq'
  threshold: number
  action_type: 'create_notification' | 'send_email' | 'log_audit' | 'trigger_webhook'
  action_json?: string
  status: 'active' | 'inactive' | 'draft'
  cooldown_minutes: number
  last_triggered_at?: string
  trigger_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface AlertRuleTrigger {
  id: string
  rule_id: string
  tenant_id: string
  metric_value: number
  threshold_value: number
  triggered_at: string
  resolved_at?: string
  notification_id?: string
}

export type MetricKey =
  | 'pending_approvals'
  | 'blocked_executions'
  | 'unread_alerts'
  | 'anomaly_score'
  | 'workflow_failures'
  | 'active_sessions'
  | 'total_connectors'
  | 'pending_connectors'

// ============================================================
// EVALUATE: metric operator against threshold
// ============================================================
function evaluate(value: number, operator: AlertRule['operator'], threshold: number): boolean {
  switch (operator) {
    case 'gt':  return value > threshold
    case 'lt':  return value < threshold
    case 'gte': return value >= threshold
    case 'lte': return value <= threshold
    case 'eq':  return value === threshold
    case 'neq': return value !== threshold
    default:    return false
  }
}

// ============================================================
// COLLECT: gather current platform metrics from D1
// ============================================================
export async function collectPlatformMetrics(db: D1Database): Promise<Record<MetricKey, number>> {
  const repo = createRepo(db)
  const [approvals, execEntries, alerts, connectors, sessions] = await Promise.all([
    repo.getApprovalRequests(),
    repo.getExecutionEntries(),
    repo.getAlerts(),
    repo.getConnectors(),
    repo.getSessions(),
  ])

  // Workflow failures from workflow_runs
  let workflowFailures = 0
  try {
    const r = await db.prepare(`SELECT COUNT(*) as cnt FROM workflow_runs WHERE status = 'failed'`).first()
    workflowFailures = (r as { cnt: number } | null)?.cnt || 0
  } catch { /* graceful */ }

  // Latest anomaly score (max z_score in last 24h)
  let anomalyScore = 0
  try {
    const r = await db.prepare(
      `SELECT MAX(z_score) as max_z FROM anomaly_events WHERE detected_at > datetime('now', '-1 day')`
    ).first()
    anomalyScore = Math.round(((r as { max_z: number } | null)?.max_z || 0) * 100) / 100
  } catch { /* graceful */ }

  return {
    pending_approvals: approvals.filter((a: Record<string, unknown>) => a['status'] === 'pending').length,
    blocked_executions: execEntries.filter((e: Record<string, unknown>) => e['status'] === 'blocked').length,
    unread_alerts: alerts.filter((a: Record<string, unknown>) => !a['acknowledged']).length,
    anomaly_score: anomalyScore,
    workflow_failures: workflowFailures,
    active_sessions: sessions.filter((s: Record<string, unknown>) => s['status'] === 'active').length,
    total_connectors: connectors.length,
    pending_connectors: connectors.filter((c: Record<string, unknown>) => c['status'] === 'pending').length,
  }
}

// ============================================================
// EXECUTE: fire rule action
// ============================================================
async function executeRuleAction(
  db: D1Database,
  rule: AlertRule,
  metricValue: number,
  triggerId: string
): Promise<string | undefined> {
  const action = rule.action_json ? JSON.parse(rule.action_json) : {}

  if (rule.action_type === 'create_notification') {
    const notifId = 'notif-rule-' + triggerId
    try {
      await db.prepare(`
        INSERT OR IGNORE INTO notifications
        (id, tenant_id, event_type, title, message, read, actor, reference_id, reference_type, created_at)
        VALUES (?, ?, 'system_alert', ?, ?, 0, 'alert-rules-engine', ?, 'alert_rule', ?)
      `).bind(
        notifId,
        rule.tenant_id,
        action.title || `Alert Rule Triggered: ${rule.name}`,
        (action.message || `Metric ${rule.metric} = ${metricValue} (threshold: ${rule.operator} ${rule.threshold})`) +
          ` [ai-generated: rule engine auto-notification]`,
        rule.id,
        new Date().toISOString()
      ).run()
      return notifId
    } catch { /* graceful */ }
  }

  if (rule.action_type === 'log_audit') {
    try {
      const auditId = 'audit-rule-' + triggerId
      await db.prepare(`
        INSERT OR IGNORE INTO audit_log_v2
        (id, tenant_id, actor, action, resource_type, resource_id, metadata_json, sha256_hash, created_at)
        VALUES (?, ?, 'alert-rules-engine', 'alert_rule_triggered', 'alert_rule', ?, ?, ?, ?)
      `).bind(
        auditId,
        rule.tenant_id,
        rule.id,
        JSON.stringify({ rule_name: rule.name, metric: rule.metric, value: metricValue, threshold: rule.threshold }),
        'rule-trigger-' + auditId,
        new Date().toISOString()
      ).run()
    } catch { /* graceful */ }
  }

  return undefined
}

// ============================================================
// RUN: evaluate all active rules for a tenant
// ============================================================
export async function evaluateAlertRules(
  db: D1Database,
  tenantId = 'tenant-default'
): Promise<{ triggered: number; rules_checked: number; details: string[] }> {
  const rules = await getActiveAlertRules(db, tenantId)
  const metrics = await collectPlatformMetrics(db)
  const now = new Date()

  let triggered = 0
  const details: string[] = []

  for (const rule of rules) {
    const metricValue = metrics[rule.metric as MetricKey] ?? 0

    // Check cooldown
    if (rule.last_triggered_at) {
      const lastTrig = new Date(rule.last_triggered_at)
      const minutesSince = (now.getTime() - lastTrig.getTime()) / 60000
      if (minutesSince < rule.cooldown_minutes) {
        details.push(`SKIPPED ${rule.name}: cooldown (${Math.round(minutesSince)}/${rule.cooldown_minutes} min)`)
        continue
      }
    }

    const shouldTrigger = evaluate(metricValue, rule.operator, rule.threshold)
    if (!shouldTrigger) {
      details.push(`PASS ${rule.name}: ${rule.metric}=${metricValue} (${rule.operator} ${rule.threshold}) = false`)
      continue
    }

    // Trigger the rule
    triggered++
    const triggerId = 'trig-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
    const notifId = await executeRuleAction(db, rule, metricValue, triggerId)

    // Log trigger event
    try {
      await db.prepare(`
        INSERT INTO alert_rule_triggers (id, rule_id, tenant_id, metric_value, threshold_value, triggered_at, notification_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(triggerId, rule.id, tenantId, metricValue, rule.threshold, now.toISOString(), notifId || null).run()

      // Update rule last_triggered_at + count
      await db.prepare(`
        UPDATE alert_rules SET last_triggered_at = ?, trigger_count = trigger_count + 1, updated_at = ?
        WHERE id = ?
      `).bind(now.toISOString(), now.toISOString(), rule.id).run()
    } catch { /* graceful */ }

    details.push(`TRIGGERED ${rule.name}: ${rule.metric}=${metricValue} (${rule.operator} ${rule.threshold}) → ${rule.action_type}`)
  }

  return { triggered, rules_checked: rules.length, details }
}

// ============================================================
// CRUD: getActiveAlertRules
// ============================================================
export async function getActiveAlertRules(db: D1Database, tenantId?: string): Promise<AlertRule[]> {
  try {
    let query = `SELECT * FROM alert_rules WHERE status = 'active'`
    const binds: unknown[] = []
    if (tenantId) {
      query += ` AND tenant_id = ?`
      binds.push(tenantId)
    }
    query += ` ORDER BY created_at DESC`
    const result = await db.prepare(query).bind(...binds).all()
    return (result.results || []) as AlertRule[]
  } catch {
    return []
  }
}

export async function getAllAlertRules(db: D1Database, tenantId?: string): Promise<AlertRule[]> {
  try {
    let query = `SELECT * FROM alert_rules`
    const binds: unknown[] = []
    if (tenantId) {
      query += ` WHERE tenant_id = ?`
      binds.push(tenantId)
    }
    query += ` ORDER BY created_at DESC`
    const result = await db.prepare(query).bind(...binds).all()
    return (result.results || []) as AlertRule[]
  } catch {
    return []
  }
}

export async function getAlertRuleById(db: D1Database, id: string): Promise<AlertRule | null> {
  try {
    const result = await db.prepare(`SELECT * FROM alert_rules WHERE id = ?`).bind(id).first()
    return result as AlertRule | null
  } catch {
    return null
  }
}

export async function createAlertRule(
  db: D1Database,
  data: {
    tenant_id?: string
    name: string
    description?: string
    metric: string
    operator: AlertRule['operator']
    threshold: number
    action_type: AlertRule['action_type']
    action_json?: Record<string, string>
    cooldown_minutes?: number
    created_by?: string
  }
): Promise<AlertRule> {
  const id = 'rule-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO alert_rules
    (id, tenant_id, name, description, metric, operator, threshold, action_type, action_json, status, cooldown_minutes, trigger_count, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, ?, ?)
  `).bind(
    id,
    data.tenant_id || 'tenant-default',
    data.name,
    data.description || null,
    data.metric,
    data.operator,
    data.threshold,
    data.action_type,
    data.action_json ? JSON.stringify(data.action_json) : null,
    data.cooldown_minutes || 60,
    data.created_by || 'user',
    now, now
  ).run()
  return (await getAlertRuleById(db, id))!
}

export async function updateAlertRuleStatus(
  db: D1Database,
  id: string,
  status: 'active' | 'inactive' | 'draft'
): Promise<void> {
  await db.prepare(`UPDATE alert_rules SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, new Date().toISOString(), id).run()
}

export async function deleteAlertRule(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM alert_rules WHERE id = ?`).bind(id).run()
}

export async function getAlertRuleTriggers(
  db: D1Database,
  ruleId?: string,
  tenantId?: string,
  limit = 100
): Promise<AlertRuleTrigger[]> {
  try {
    let query = `SELECT * FROM alert_rule_triggers WHERE 1=1`
    const binds: unknown[] = []
    if (ruleId) { query += ` AND rule_id = ?`; binds.push(ruleId) }
    if (tenantId) { query += ` AND tenant_id = ?`; binds.push(tenantId) }
    query += ` ORDER BY triggered_at DESC LIMIT ?`
    binds.push(limit)
    const result = await db.prepare(query).bind(...binds).all()
    return (result.results || []) as AlertRuleTrigger[]
  } catch {
    return []
  }
}

// ============================================================
// METRIC_LABELS: for UI display
// ============================================================
export const METRIC_OPTIONS: { value: string; label: string }[] = [
  { value: 'pending_approvals', label: 'Pending Approvals' },
  { value: 'blocked_executions', label: 'Blocked Executions' },
  { value: 'unread_alerts', label: 'Unread Alerts' },
  { value: 'anomaly_score', label: 'Anomaly Score (z-score max, last 24h)' },
  { value: 'workflow_failures', label: 'Workflow Failures (total)' },
  { value: 'active_sessions', label: 'Active Sessions' },
  { value: 'total_connectors', label: 'Total Connectors' },
  { value: 'pending_connectors', label: 'Pending Connectors' },
]

export const OPERATOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'gt',  label: '> Greater Than' },
  { value: 'gte', label: '≥ Greater Than or Equal' },
  { value: 'lt',  label: '< Less Than' },
  { value: 'lte', label: '≤ Less Than or Equal' },
  { value: 'eq',  label: '= Equal To' },
  { value: 'neq', label: '≠ Not Equal To' },
]

export const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'create_notification', label: 'Create Notification' },
  { value: 'log_audit', label: 'Log to Audit Trail' },
  { value: 'send_email', label: 'Send Email (requires RESEND_API_KEY)' },
  { value: 'trigger_webhook', label: 'Trigger Webhook' },
]
