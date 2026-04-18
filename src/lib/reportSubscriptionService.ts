// ============================================================
// SOVEREIGN OS PLATFORM — REPORT SUBSCRIPTIONS SERVICE (P12)
// Purpose: Scheduled report snapshot management
// Model: KV TTL polling (lazy trigger on page request)
// Delivery: store | email (graceful) | webhook
// ============================================================

export interface ReportSubscription {
  id: string
  tenant_id: string
  report_type: string
  format: string
  schedule: string          // 'hourly' | 'daily' | 'weekly'
  filters_json?: string
  delivery_type: string     // 'store' | 'email' | 'webhook'
  recipient?: string
  active: number            // 1=active, 0=inactive
  last_run_at?: string
  next_run_at?: string
  run_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface ReportSubscriptionRun {
  id: string
  subscription_id: string
  job_id?: string
  status: string
  run_at: string
  completed_at?: string
  error_message?: string
}

// ============================================================
// CRUD: getAllSubscriptions
// ============================================================
export async function getAllSubscriptions(db: D1Database, tenantId?: string): Promise<ReportSubscription[]> {
  try {
    let result
    if (tenantId) {
      result = await db.prepare(`
        SELECT * FROM report_subscriptions WHERE tenant_id = ? ORDER BY created_at DESC
      `).bind(tenantId).all()
    } else {
      result = await db.prepare(`
        SELECT * FROM report_subscriptions ORDER BY created_at DESC
      `).all()
    }
    return (result.results || []) as ReportSubscription[]
  } catch { return [] }
}

export async function getSubscriptionById(db: D1Database, id: string): Promise<ReportSubscription | null> {
  try {
    return await db.prepare(`SELECT * FROM report_subscriptions WHERE id = ?`).bind(id).first() as ReportSubscription | null
  } catch { return null }
}

export async function createSubscription(db: D1Database, data: {
  tenant_id?: string
  report_type: string
  format?: string
  schedule: string
  delivery_type?: string
  recipient?: string
  created_by?: string
}): Promise<ReportSubscription> {
  const id = 'rsub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  const next = computeNextRun(data.schedule, now)
  await db.prepare(`
    INSERT INTO report_subscriptions 
    (id, tenant_id, report_type, format, schedule, delivery_type, recipient, active, last_run_at, next_run_at, run_count, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, 0, ?, ?, ?)
  `).bind(
    id, data.tenant_id || 'system', data.report_type,
    data.format || 'json', data.schedule,
    data.delivery_type || 'store', data.recipient || null,
    next, data.created_by || 'ui', now, now
  ).run()
  return (await getSubscriptionById(db, id))!
}

export async function toggleSubscription(db: D1Database, id: string): Promise<void> {
  const sub = await getSubscriptionById(db, id)
  if (!sub) return
  const newActive = sub.active === 1 ? 0 : 1
  await db.prepare(`UPDATE report_subscriptions SET active = ?, updated_at = ? WHERE id = ?`)
    .bind(newActive, new Date().toISOString(), id).run()
}

export async function deleteSubscription(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM report_subscriptions WHERE id = ?`).bind(id).run()
}

// ============================================================
// CRUD: getSubscriptionRuns
// ============================================================
export async function getSubscriptionRuns(db: D1Database, subscriptionId: string, limit = 20): Promise<ReportSubscriptionRun[]> {
  try {
    const result = await db.prepare(`
      SELECT * FROM report_subscription_runs WHERE subscription_id = ? ORDER BY run_at DESC LIMIT ?
    `).bind(subscriptionId, limit).all()
    return (result.results || []) as ReportSubscriptionRun[]
  } catch { return [] }
}

async function recordRun(db: D1Database, data: {
  subscription_id: string
  job_id?: string
  status: string
  error_message?: string
}): Promise<void> {
  const id = 'rrun-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  try {
    await db.prepare(`
      INSERT INTO report_subscription_runs (id, subscription_id, job_id, status, run_at, completed_at, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, data.subscription_id, data.job_id || null, data.status, now, now, data.error_message || null).run()
  } catch { /* non-blocking */ }
}

// ============================================================
// SCHEDULER: computeNextRun — pure date calculation
// ============================================================
export function computeNextRun(schedule: string, from?: string): string {
  const base = from ? new Date(from) : new Date()
  switch (schedule) {
    case 'hourly':  base.setHours(base.getHours() + 1); break
    case 'daily':   base.setDate(base.getDate() + 1); break
    case 'weekly':  base.setDate(base.getDate() + 7); break
    default:        base.setDate(base.getDate() + 1)
  }
  return base.toISOString()
}

// ============================================================
// CORE: processSubscriptions — KV TTL polling
// Called on each /reports/subscriptions page request (lazy)
// Checks all active subscriptions for due snapshots and runs them
// ============================================================
export async function processSubscriptions(
  db: D1Database,
  kv?: KVNamespace
): Promise<{ processed: number; fired: string[] }> {
  const now = new Date()
  const fired: string[] = []

  try {
    const subs = await getAllSubscriptions(db)
    const due = subs.filter(s => {
      if (s.active !== 1) return false
      if (!s.next_run_at) return true
      return new Date(s.next_run_at) <= now
    })

    for (const sub of due) {
      try {
        // Use KV to prevent double-fire (distributed dedup)
        const kvKey = `rschd:${sub.id}`
        if (kv) {
          const running = await kv.get(kvKey)
          if (running) continue  // already being processed
          await kv.put(kvKey, '1', { expirationTtl: 300 }) // 5 min lock
        }

        // Generate the report job
        const { generateReport } = await import('./reportingService')
        const filters = sub.filters_json ? JSON.parse(sub.filters_json) : {}
        const result = await generateReport(db, sub.report_type as any, sub.format as any, filters)

        // Store result in report_jobs table
        const jobId = 'rjob-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
        await db.prepare(`
          INSERT INTO report_jobs 
          (id, tenant_id, report_type, format, status, filters_json, result_data, row_count, created_by, created_at, completed_at)
          VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, 'scheduler', ?, ?)
        `).bind(
          jobId,
          sub.tenant_id || 'system',
          sub.report_type,
          sub.format || 'json',
          sub.filters_json || null,
          result.format === 'csv' ? result.csv || '' : JSON.stringify(result.data),
          result.row_count,
          now.toISOString(),
          now.toISOString()
        ).run()

        // Update subscription last_run + next_run
        const next = computeNextRun(sub.schedule, now.toISOString())
        await db.prepare(`
          UPDATE report_subscriptions 
          SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1, updated_at = ?
          WHERE id = ?
        `).bind(now.toISOString(), next, now.toISOString(), sub.id).run()

        await recordRun(db, { subscription_id: sub.id, job_id: jobId, status: 'completed' })
        fired.push(sub.id)

        // Release KV lock
        if (kv) await kv.delete(kvKey)

      } catch (err) {
        await recordRun(db, {
          subscription_id: sub.id,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'unknown error'
        })
        if (kv) await kv.delete(`rschd:${sub.id}`).catch(() => {})
      }
    }
  } catch { /* non-blocking */ }

  return { processed: fired.length, fired }
}
