// ============================================================
// SOVEREIGN OS PLATFORM — AUDIT SERVICE v2 (P8)
// Immutable audit trail with SHA-256 event hashing
//
// Every state mutation writes an event to audit_log_v2.
// Hash input: event_type + object_id + actor + created_at
// Stored: event_hash (hex), never raw secrets
//
// LAWS:
// - No UPDATE ever on audit_log_v2 rows (append-only)
// - Payload summary: max 200 chars, no secrets
// - Hash re-verification available on /audit surface
// ============================================================
import type { D1Database } from '@cloudflare/workers-types'
import type { AuditLogV2 } from '../types'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function now(): string {
  return new Date().toISOString()
}

// SHA-256 hash of concatenated inputs — Web Crypto (CF Workers compatible)
export async function computeEventHash(
  event_type: string,
  object_id: string,
  actor: string,
  created_at: string
): Promise<string> {
  const input = `${event_type}|${object_id}|${actor}|${created_at}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface AuditEventInput {
  event_type: string
  object_type: string
  object_id: string
  actor: string
  tenant_id?: string
  payload_summary?: string
  surface?: string
}

// Write a new audit event — always append-only
export async function writeAuditEvent(
  db: D1Database | undefined,
  input: AuditEventInput
): Promise<AuditLogV2 | null> {
  const id = 'audit2-' + uid()
  const created_at = now()
  const tenant_id = input.tenant_id || 'default'
  const payload_summary = (input.payload_summary || '').slice(0, 200)
  const surface = input.surface || ''

  const event_hash = await computeEventHash(
    input.event_type,
    input.object_id,
    input.actor,
    created_at
  )

  const record: AuditLogV2 = {
    id,
    event_type: input.event_type,
    object_type: input.object_type,
    object_id: input.object_id,
    actor: input.actor,
    tenant_id,
    event_hash,
    hash_algorithm: 'sha256',
    payload_summary,
    surface,
    verified: 0,
    created_at,
  }

  if (!db) return record  // in-memory mode: return but don't persist

  try {
    await db.prepare(`
      INSERT INTO audit_log_v2
        (id, event_type, object_type, object_id, actor, tenant_id,
         event_hash, hash_algorithm, payload_summary, surface, verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.id,
      record.event_type,
      record.object_type,
      record.object_id,
      record.actor,
      record.tenant_id,
      record.event_hash,
      record.hash_algorithm,
      record.payload_summary,
      record.surface,
      record.verified,
      record.created_at,
    ).run()
  } catch (e) {
    // Audit write failure is non-blocking — log but don't throw
    console.error('[auditService] write failed:', e)
    return null
  }

  return record
}

// Verify a hash on-read: recompute and compare
export async function verifyAuditHash(entry: AuditLogV2): Promise<boolean> {
  const recomputed = await computeEventHash(
    entry.event_type,
    entry.object_id,
    entry.actor,
    entry.created_at
  )
  return recomputed === entry.event_hash
}

// Fetch audit log v2 with optional filters
export async function getAuditLogV2(
  db: D1Database | undefined,
  opts: {
    tenant_id?: string
    event_type?: string
    object_id?: string
    actor?: string
    limit?: number
    offset?: number
  } = {}
): Promise<AuditLogV2[]> {
  if (!db) return []

  const limit = Math.min(opts.limit || 50, 200)
  const offset = opts.offset || 0
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (opts.tenant_id) { conditions.push('tenant_id = ?'); params.push(opts.tenant_id) }
  if (opts.event_type) { conditions.push('event_type = ?'); params.push(opts.event_type) }
  if (opts.object_id) { conditions.push('object_id = ?'); params.push(opts.object_id) }
  if (opts.actor) { conditions.push('actor = ?'); params.push(opts.actor) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  params.push(limit, offset)

  try {
    const rows = await db.prepare(
      `SELECT * FROM audit_log_v2 ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params).all()
    return (rows.results || []) as unknown as AuditLogV2[]
  } catch (_e) {
    return []
  }
}
