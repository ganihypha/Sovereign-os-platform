// src/lib/eventBusService.ts
// P11 — Unified Platform Event Bus (all significant events streamed)
// ai-generated [human-confirmation-gate: required before canonization]

export interface PlatformEvent {
  id: string
  tenant_id: string
  event_type: string
  source_surface: string
  actor?: string
  resource_id?: string
  resource_type?: string
  payload_json?: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  read: number
  created_at: string
}

export interface EmitEventInput {
  tenant_id?: string
  event_type: string
  source_surface: string
  actor?: string
  resource_id?: string
  resource_type?: string
  payload?: Record<string, any>
  severity?: PlatformEvent['severity']
}

function generateId(): string {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

// ============================================================
// CORE: Emit an event to the platform event bus
// ============================================================
export async function emitEvent(
  db: D1Database,
  input: EmitEventInput
): Promise<PlatformEvent | null> {
  try {
    const id = generateId()
    const now = new Date().toISOString()
    await db.prepare(`
      INSERT INTO platform_events
      (id, tenant_id, event_type, source_surface, actor, resource_id, resource_type, payload_json, severity, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(
      id,
      input.tenant_id || 'tenant-default',
      input.event_type,
      input.source_surface,
      input.actor || null,
      input.resource_id || null,
      input.resource_type || null,
      input.payload ? JSON.stringify(input.payload) : null,
      input.severity || 'info',
      now
    ).run()
    return await getEventById(db, id)
  } catch {
    return null // non-blocking
  }
}

// ============================================================
// QUERY: Get events with filters
// ============================================================
export async function getEvents(
  db: D1Database,
  opts: {
    tenant_id?: string
    event_type?: string
    source_surface?: string
    severity?: string
    limit?: number
    offset?: number
    unread_only?: boolean
  } = {}
): Promise<{ events: PlatformEvent[]; total: number }> {
  try {
    let q = `SELECT * FROM platform_events WHERE 1=1`
    let qCount = `SELECT COUNT(*) as cnt FROM platform_events WHERE 1=1`
    const p: any[] = []
    const pc: any[] = []

    const addFilter = (clause: string, val: any) => {
      q += clause; qCount += clause; p.push(val); pc.push(val)
    }

    if (opts.tenant_id) addFilter(` AND tenant_id = ?`, opts.tenant_id)
    if (opts.event_type) addFilter(` AND event_type = ?`, opts.event_type)
    if (opts.source_surface) addFilter(` AND source_surface = ?`, opts.source_surface)
    if (opts.severity) addFilter(` AND severity = ?`, opts.severity)
    if (opts.unread_only) { q += ` AND read = 0`; qCount += ` AND read = 0` }

    q += ` ORDER BY created_at DESC`

    const limit = Math.min(opts.limit || 50, 200)
    const offset = opts.offset || 0
    q += ` LIMIT ? OFFSET ?`
    p.push(limit, offset)

    const [events, countResult] = await Promise.all([
      db.prepare(q).bind(...p).all<PlatformEvent>(),
      db.prepare(qCount).bind(...pc).first<{ cnt: number }>()
    ])

    return {
      events: events.results || [],
      total: countResult?.cnt || 0
    }
  } catch {
    return { events: [], total: 0 }
  }
}

export async function getEventById(db: D1Database, id: string): Promise<PlatformEvent | null> {
  try {
    return await db.prepare(`SELECT * FROM platform_events WHERE id = ?`).bind(id).first<PlatformEvent>()
  } catch { return null }
}

// ============================================================
// MARK READ
// ============================================================
export async function markEventRead(db: D1Database, id: string): Promise<void> {
  try {
    await db.prepare(`UPDATE platform_events SET read = 1 WHERE id = ?`).bind(id).run()
  } catch { /* non-blocking */ }
}

export async function markAllEventsRead(db: D1Database, tenant_id: string): Promise<void> {
  try {
    await db.prepare(`UPDATE platform_events SET read = 1 WHERE tenant_id = ?`).bind(tenant_id).run()
  } catch { /* non-blocking */ }
}

// ============================================================
// STATS: Get event summary stats
// ============================================================
export async function getEventStats(db: D1Database, tenant_id?: string): Promise<{
  total: number
  unread: number
  by_severity: Record<string, number>
  by_surface: Record<string, number>
  recent_types: string[]
}> {
  try {
    const tenantFilter = tenant_id ? ` AND tenant_id = ?` : ''
    const bindVal = tenant_id ? [tenant_id] : []

    const [totalRes, unreadRes, bySeverity, bySurface, recentTypes] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM platform_events WHERE 1=1${tenantFilter}`)
        .bind(...bindVal).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM platform_events WHERE read = 0${tenantFilter}`)
        .bind(...bindVal).first<{ cnt: number }>(),
      db.prepare(`SELECT severity, COUNT(*) as cnt FROM platform_events WHERE 1=1${tenantFilter} GROUP BY severity`)
        .bind(...bindVal).all<{ severity: string; cnt: number }>(),
      db.prepare(`SELECT source_surface, COUNT(*) as cnt FROM platform_events WHERE 1=1${tenantFilter} GROUP BY source_surface ORDER BY cnt DESC LIMIT 10`)
        .bind(...bindVal).all<{ source_surface: string; cnt: number }>(),
      db.prepare(`SELECT DISTINCT event_type FROM platform_events WHERE 1=1${tenantFilter} ORDER BY created_at DESC LIMIT 10`)
        .bind(...bindVal).all<{ event_type: string }>()
    ])

    const by_severity: Record<string, number> = {}
    for (const r of bySeverity.results || []) by_severity[r.severity] = r.cnt

    const by_surface: Record<string, number> = {}
    for (const r of bySurface.results || []) by_surface[r.source_surface] = r.cnt

    return {
      total: totalRes?.cnt || 0,
      unread: unreadRes?.cnt || 0,
      by_severity,
      by_surface,
      recent_types: (recentTypes.results || []).map(r => r.event_type)
    }
  } catch {
    return { total: 0, unread: 0, by_severity: {}, by_surface: {}, recent_types: [] }
  }
}

// ============================================================
// KNOWN EVENT TYPES (for documentation / UI)
// ============================================================
export const KNOWN_EVENT_TYPES = [
  'intent.created', 'intent.approved', 'intent.rejected',
  'approval.submitted', 'approval.approved', 'approval.rejected',
  'workflow.triggered', 'workflow.completed', 'workflow.failed',
  'notification.created', 'notification.read',
  'federation.requested', 'federation.approved',
  'marketplace.submitted', 'marketplace.approved',
  'audit.hash_generated', 'audit.chain_verified',
  'alert.triggered', 'alert.resolved',
  'remediation.triggered', 'remediation.completed', 'remediation.failed',
  'tenant.created', 'tenant.updated',
  'connector.registered', 'connector.activated',
  'platform.initialized', 'platform.health_check',
  'api_key.created', 'api_key.revoked',
  'report.generated', 'report.subscribed',
  'abac.policy_evaluated', 'abac.access_denied',
]
