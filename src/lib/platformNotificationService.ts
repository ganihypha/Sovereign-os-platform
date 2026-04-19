// ============================================================
// SOVEREIGN OS PLATFORM — PLATFORM NOTIFICATION SERVICE (P14)
// Purpose: Wire platform events → auto-create notifications
//          ABAC deny, event archive, webhook failure → notification
// ai-generated [human-confirmation-gate: required before canonization]
// ============================================================

import { createNotification } from './notificationService'
import { emitEvent } from './eventBusService'

// ============================================================
// emitPlatformNotification
// Fires both a platform_event (event bus) AND a notification (inbox)
// Call this from: logAbacDeny, eventArchiveService, webhookQueueService
// ============================================================
export async function emitPlatformNotification(
  db: D1Database,
  opts: {
    event_type: string
    title: string
    message: string
    severity?: 'info' | 'warning' | 'critical'
    tenant_id?: string
    actor?: string
    surface?: string
    reference_id?: string
    reference_type?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  if (!db) return

  const severity = opts.severity || 'info'
  const tenant_id = opts.tenant_id || 'default'
  const actor = opts.actor || 'system'

  // 1. Emit to event bus (non-blocking)
  emitEvent(db, {
    event_type: opts.event_type,
    surface: opts.surface || 'system',
    severity,
    tenant_id,
    actor,
    payload_json: JSON.stringify({
      title: opts.title,
      message: opts.message,
      reference_id: opts.reference_id,
      ...(opts.metadata || {})
    }),
    read: 0
  }).catch(() => {})

  // 2. Create notification in inbox (non-blocking)
  createNotification(db, {
    tenant_id,
    event_type: opts.event_type,
    title: opts.title,
    message: opts.message,
    actor,
    reference_id: opts.reference_id,
    reference_type: opts.reference_type
  }).catch(() => {})
}

// ============================================================
// notifyAbacDeny — Called on ABAC access denial
// ============================================================
export async function notifyAbacDeny(
  db: D1Database,
  opts: {
    surface: string
    resource_type: string
    action: string
    subject_role: string
    tenant_id?: string
  }
): Promise<void> {
  // Check if notification rule is enabled
  try {
    const rule = await db.prepare(
      `SELECT enabled FROM platform_notification_rules WHERE event_type = 'abac.access_denied' AND enabled = 1`
    ).first<{ enabled: number }>()
    if (!rule) return // Rule disabled or not found
  } catch { return }

  await emitPlatformNotification(db, {
    event_type: 'abac.access_denied',
    title: 'ABAC Access Denied',
    message: `Role '${opts.subject_role}' was denied '${opts.action}' on '${opts.resource_type}' (surface: ${opts.surface})`,
    severity: 'warning',
    tenant_id: opts.tenant_id || 'default',
    actor: `role:${opts.subject_role}`,
    surface: opts.surface,
    reference_id: `${opts.resource_type}:${opts.action}`,
    reference_type: 'abac.deny',
    metadata: {
      surface: opts.surface,
      resource_type: opts.resource_type,
      action: opts.action,
      subject_role: opts.subject_role
    }
  })
}

// ============================================================
// notifyEventArchive — Called after archive cycle completes
// ============================================================
export async function notifyEventArchive(
  db: D1Database,
  opts: {
    archived_count: number
    tenant_id?: string
  }
): Promise<void> {
  if (opts.archived_count === 0) return // No notification if nothing archived

  try {
    const rule = await db.prepare(
      `SELECT enabled FROM platform_notification_rules WHERE event_type = 'event.archived' AND enabled = 1`
    ).first<{ enabled: number }>()
    if (!rule) return
  } catch { return }

  await emitPlatformNotification(db, {
    event_type: 'event.archived',
    title: 'Events Archived',
    message: `Platform event archive cycle completed: ${opts.archived_count} events moved to event_archives.`,
    severity: 'info',
    tenant_id: opts.tenant_id || 'default',
    actor: 'system:archive',
    surface: 'events',
    reference_type: 'event.archive',
    metadata: { archived_count: opts.archived_count }
  })
}

// ============================================================
// notifyWebhookFailed — Called when webhook delivery fails all retries
// ============================================================
export async function notifyWebhookFailed(
  db: D1Database,
  opts: {
    webhook_id?: string
    connector_id?: string
    target_url?: string
    retry_count?: number
    tenant_id?: string
  }
): Promise<void> {
  try {
    const rule = await db.prepare(
      `SELECT enabled FROM platform_notification_rules WHERE event_type = 'webhook.delivery_failed' AND enabled = 1`
    ).first<{ enabled: number }>()
    if (!rule) return
  } catch { return }

  await emitPlatformNotification(db, {
    event_type: 'webhook.delivery_failed',
    title: 'Webhook Delivery Failed',
    message: `Webhook delivery failed after ${opts.retry_count || 'all'} retries. Connector: ${opts.connector_id || '—'}. Target: ${opts.target_url || '—'}`,
    severity: 'critical',
    tenant_id: opts.tenant_id || 'default',
    actor: 'system:webhook',
    surface: 'webhooks',
    reference_id: opts.webhook_id,
    reference_type: 'webhook.delivery',
    metadata: {
      webhook_id: opts.webhook_id,
      connector_id: opts.connector_id,
      target_url: opts.target_url,
      retry_count: opts.retry_count
    }
  })
}

// ============================================================
// notifyAlertRuleTriggered — Called when alert rule fires
// ============================================================
export async function notifyAlertRuleTriggered(
  db: D1Database,
  opts: {
    rule_id?: string
    rule_name?: string
    metric?: string
    value?: number
    threshold?: number
    tenant_id?: string
  }
): Promise<void> {
  try {
    const rule = await db.prepare(
      `SELECT enabled FROM platform_notification_rules WHERE event_type = 'alert_rule.triggered' AND enabled = 1`
    ).first<{ enabled: number }>()
    if (!rule) return
  } catch { return }

  await emitPlatformNotification(db, {
    event_type: 'alert_rule.triggered',
    title: 'Alert Rule Triggered',
    message: `Rule '${opts.rule_name || opts.rule_id}' fired: ${opts.metric} = ${opts.value} (threshold: ${opts.threshold})`,
    severity: 'warning',
    tenant_id: opts.tenant_id || 'default',
    actor: 'system:alert-rules',
    surface: 'alert-rules',
    reference_id: opts.rule_id,
    reference_type: 'alert_rule',
    metadata: {
      rule_id: opts.rule_id,
      rule_name: opts.rule_name,
      metric: opts.metric,
      value: opts.value,
      threshold: opts.threshold
    }
  })
}
