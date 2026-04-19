// ============================================================
// SOVEREIGN OS PLATFORM — WEBHOOK QUEUE PROCESSOR (P12+P14)
// Purpose: Process webhook_delivery_queue with retry backoff
// Retry policy: 1m → 5m → 30m (max 3 retries)
// Called lazily on each /connectors request
// P14: Notify on final delivery failure
// ============================================================

export interface WebhookQueueItem {
  id: string
  connector_id: string
  tenant_id: string
  event_type: string
  target_url: string
  payload_json: string
  payload_hash: string
  status: string          // 'pending' | 'delivered' | 'failed' | 'retrying'
  attempt_count: number
  max_attempts: number
  last_attempt_at?: string
  next_attempt_at?: string
  last_error?: string
  delivered_at?: string
  created_at: string
}

// Retry delays in seconds: attempt 1→60s, attempt 2→300s, attempt 3→1800s
const RETRY_DELAYS = [60, 300, 1800]

function getNextAttemptDelay(attempt: number): number {
  return RETRY_DELAYS[attempt - 1] ?? 1800
}

// ============================================================
// processWebhookQueue — lazy retry processing
// Called on each /connectors request
// Picks up pending/retrying items that are due
// ============================================================
export async function processWebhookQueue(db: D1Database): Promise<{
  processed: number
  delivered: number
  failed: number
  retrying: number
}> {
  const stats = { processed: 0, delivered: 0, failed: 0, retrying: 0 }

  try {
    const now = new Date().toISOString()
    // Pick up items ready to process: pending or retrying + next_attempt_at <= now
    const result = await db.prepare(`
      SELECT * FROM webhook_delivery_queue 
      WHERE (status = 'pending' OR status = 'retrying') 
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        AND attempt_count < max_attempts
      ORDER BY created_at ASC
      LIMIT 10
    `).bind(now).all()

    const items = (result.results || []) as WebhookQueueItem[]

    for (const item of items) {
      stats.processed++
      try {
        // Attempt delivery
        const res = await fetch(item.target_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Platform-Event': item.event_type,
            'X-Delivery-ID': item.id,
          },
          body: item.payload_json,
          signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
        })

        if (res.ok) {
          // Mark delivered
          await db.prepare(`
            UPDATE webhook_delivery_queue 
            SET status = 'delivered', delivered_at = ?, last_attempt_at = ?, attempt_count = attempt_count + 1
            WHERE id = ?
          `).bind(now, now, item.id).run()
          stats.delivered++
        } else {
          // HTTP error — schedule retry or mark failed
          await handleDeliveryFailure(db, item, `HTTP ${res.status}`, stats)
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'network error'
        await handleDeliveryFailure(db, item, errMsg, stats)
      }
    }
  } catch { /* non-blocking */ }

  return stats
}

async function handleDeliveryFailure(
  db: D1Database,
  item: WebhookQueueItem,
  error: string,
  stats: { failed: number; retrying: number }
): Promise<void> {
  const now = new Date()
  const newAttemptCount = item.attempt_count + 1
  const maxAttempts = item.max_attempts || 3

  if (newAttemptCount >= maxAttempts) {
    // Final failure
    await db.prepare(`
      UPDATE webhook_delivery_queue 
      SET status = 'failed', last_error = ?, last_attempt_at = ?, attempt_count = ?, next_attempt_at = NULL
      WHERE id = ?
    `).bind(error.slice(0, 200), now.toISOString(), newAttemptCount, item.id).run()
    stats.failed++

    // P14: Notify on final webhook delivery failure
    try {
      const { notifyWebhookFailed } = await import('./platformNotificationService')
      notifyWebhookFailed(db, {
        webhook_id: item.id,
        connector_id: item.connector_id,
        target_url: item.target_url,
        retry_count: newAttemptCount,
        tenant_id: item.tenant_id
      }).catch(() => {})
    } catch { /* non-blocking */ }
  } else {
    // Schedule retry
    const delaySecs = getNextAttemptDelay(newAttemptCount)
    const nextAttempt = new Date(now.getTime() + delaySecs * 1000).toISOString()
    await db.prepare(`
      UPDATE webhook_delivery_queue 
      SET status = 'retrying', last_error = ?, last_attempt_at = ?, next_attempt_at = ?, attempt_count = ?
      WHERE id = ?
    `).bind(error.slice(0, 200), now.toISOString(), nextAttempt, newAttemptCount, item.id).run()
    stats.retrying++
  }
}

// ============================================================
// enqueueWebhook — add item to delivery queue
// ============================================================
export async function enqueueWebhook(db: D1Database, data: {
  connector_id: string
  tenant_id: string
  event_type: string
  target_url: string
  payload: Record<string, unknown>
}): Promise<string> {
  const id = 'wq-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const payloadJson = JSON.stringify(data.payload)
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payloadJson))
  const payloadHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO webhook_delivery_queue 
    (id, connector_id, tenant_id, event_type, target_url, payload_json, payload_hash, status, attempt_count, max_attempts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 3, ?)
  `).bind(id, data.connector_id, data.tenant_id, data.event_type, data.target_url, payloadJson, payloadHash, now).run()

  return id
}

// ============================================================
// getQueueStats — summary stats for /connectors UI
// ============================================================
export async function getQueueStats(db: D1Database): Promise<{
  pending: number
  delivered: number
  failed: number
  retrying: number
  total: number
}> {
  try {
    const r = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status='retrying' THEN 1 ELSE 0 END) as retrying
      FROM webhook_delivery_queue
    `).first() as Record<string, number> | null
    return {
      total: r?.total || 0,
      pending: r?.pending || 0,
      delivered: r?.delivered || 0,
      failed: r?.failed || 0,
      retrying: r?.retrying || 0,
    }
  } catch {
    return { total: 0, pending: 0, delivered: 0, failed: 0, retrying: 0 }
  }
}

// ============================================================
// getRecentQueueItems — for UI table display
// ============================================================
export async function getRecentQueueItems(db: D1Database, limit = 20): Promise<WebhookQueueItem[]> {
  try {
    const r = await db.prepare(`
      SELECT * FROM webhook_delivery_queue ORDER BY created_at DESC LIMIT ?
    `).bind(limit).all()
    return (r.results || []) as WebhookQueueItem[]
  } catch { return [] }
}
