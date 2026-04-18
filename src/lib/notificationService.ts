// src/lib/notificationService.ts
// P9 — Real-time notification service (SSE + KV inbox state)
// ai-generated [human-confirmation-gate: required before canonization]

export interface Notification {
  id: string
  tenant_id: string
  event_type: string
  title: string
  message: string
  read: number
  actor: string
  reference_id?: string
  reference_type?: string
  created_at: string
}

export interface CreateNotificationInput {
  tenant_id?: string
  event_type: string
  title: string
  message: string
  actor?: string
  reference_id?: string
  reference_type?: string
}

function generateId(): string {
  return 'notif-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

// Create a new notification in D1
export async function createNotification(
  db: D1Database,
  input: CreateNotificationInput
): Promise<Notification> {
  const id = generateId()
  const now = new Date().toISOString()
  const tenant_id = input.tenant_id || 'default'
  const actor = input.actor || 'system'

  await db.prepare(`
    INSERT INTO notifications (id, tenant_id, event_type, title, message, read, actor, reference_id, reference_type, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).bind(id, tenant_id, input.event_type, input.title, input.message, actor,
    input.reference_id || null, input.reference_type || null, now).run()

  return {
    id, tenant_id,
    event_type: input.event_type,
    title: input.title,
    message: input.message,
    read: 0, actor,
    reference_id: input.reference_id,
    reference_type: input.reference_type,
    created_at: now
  }
}

// Get notifications for a tenant (paginated)
export async function getNotifications(
  db: D1Database,
  tenant_id: string = 'default',
  limit: number = 50,
  unread_only: boolean = false
): Promise<Notification[]> {
  let query = `SELECT * FROM notifications WHERE tenant_id = ?`
  const params: any[] = [tenant_id]
  if (unread_only) {
    query += ` AND read = 0`
  }
  query += ` ORDER BY created_at DESC LIMIT ?`
  params.push(limit)

  const result = await db.prepare(query).bind(...params).all<Notification>()
  return result.results || []
}

// Mark notification as read
export async function markNotificationRead(
  db: D1Database,
  id: string
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE notifications SET read = 1 WHERE id = ?`
  ).bind(id).run()
  return result.meta.changes > 0
}

// Mark all notifications as read for a tenant
export async function markAllRead(
  db: D1Database,
  tenant_id: string = 'default'
): Promise<number> {
  const result = await db.prepare(
    `UPDATE notifications SET read = 1 WHERE tenant_id = ? AND read = 0`
  ).bind(tenant_id).run()
  return result.meta.changes
}

// Get unread count for a tenant
export async function getUnreadCount(
  db: D1Database,
  tenant_id: string = 'default'
): Promise<number> {
  const result = await db.prepare(
    `SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND read = 0`
  ).bind(tenant_id).first<{ count: number }>()
  return result?.count || 0
}

// Notify via KV: store latest event for SSE polling fallback
export async function publishNotificationKV(
  kv: KVNamespace,
  tenant_id: string,
  notification: Notification
): Promise<void> {
  try {
    const key = `notif:latest:${tenant_id}`
    await kv.put(key, JSON.stringify(notification), { expirationTtl: 300 }) // 5 min TTL
  } catch (_) {
    // KV write failure is non-blocking
  }
}

// Get latest notification from KV (SSE polling fallback)
export async function getLatestFromKV(
  kv: KVNamespace,
  tenant_id: string
): Promise<Notification | null> {
  try {
    const raw = await kv.get(`notif:latest:${tenant_id}`)
    if (!raw) return null
    return JSON.parse(raw) as Notification
  } catch (_) {
    return null
  }
}
