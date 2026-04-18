// ============================================================
// SOVEREIGN OS PLATFORM — FEDERATION SERVICE (P8)
// Cross-tenant intent sharing + federated approval chains
//
// LAWS:
// - No federation without Tier 2 approval
// - source_tenant and target_tenant must both exist and be active
// - Scope is explicit JSON array — no wildcard federation
// - All federation events written to audit_log_v2
// ============================================================
import type { D1Database } from '@cloudflare/workers-types'
import type { TenantFederation, FederatedIntent } from '../types'
import { writeAuditEvent } from './auditService'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function now(): string {
  return new Date().toISOString()
}

// ---- Federation Registry CRUD ----

export async function listFederations(
  db: D1Database | undefined,
  opts: { status?: string; source_tenant_id?: string } = {}
): Promise<TenantFederation[]> {
  if (!db) return []
  try {
    const conditions: string[] = []
    const params: string[] = []
    if (opts.status) { conditions.push('status = ?'); params.push(opts.status) }
    if (opts.source_tenant_id) { conditions.push('source_tenant_id = ?'); params.push(opts.source_tenant_id) }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const rows = await db.prepare(
      `SELECT * FROM tenant_federation ${where} ORDER BY created_at DESC LIMIT 100`
    ).bind(...params).all()
    return (rows.results || []) as unknown as TenantFederation[]
  } catch (_e) { return [] }
}

export async function getFederation(
  db: D1Database | undefined,
  id: string
): Promise<TenantFederation | null> {
  if (!db) return null
  try {
    const row = await db.prepare('SELECT * FROM tenant_federation WHERE id = ?').bind(id).first()
    return (row as unknown as TenantFederation) || null
  } catch (_e) { return null }
}

export async function createFederation(
  db: D1Database | undefined,
  data: {
    source_tenant_id: string
    target_tenant_id: string
    scope: string[]
    federation_notes: string
    created_by: string
  }
): Promise<TenantFederation> {
  const id = 'fed-' + uid()
  const created_at = now()
  const scope = JSON.stringify(data.scope)
  const record: TenantFederation = {
    id,
    source_tenant_id: data.source_tenant_id,
    target_tenant_id: data.target_tenant_id,
    scope,
    status: 'pending',
    approved_by: null,
    approved_at: null,
    revoked_by: null,
    revoked_at: null,
    federation_notes: data.federation_notes,
    created_by: data.created_by,
    created_at,
  }
  if (db) {
    await db.prepare(`
      INSERT INTO tenant_federation
        (id, source_tenant_id, target_tenant_id, scope, status, federation_notes, created_by, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
    `).bind(id, data.source_tenant_id, data.target_tenant_id, scope, data.federation_notes, data.created_by, created_at).run()

    await writeAuditEvent(db, {
      event_type: 'federation.created',
      object_type: 'tenant_federation',
      object_id: id,
      actor: data.created_by,
      tenant_id: data.source_tenant_id,
      payload_summary: `Federation ${data.source_tenant_id} → ${data.target_tenant_id}, scope: ${scope}`,
      surface: '/federation',
    })
  }
  return record
}

export async function approveFederation(
  db: D1Database | undefined,
  id: string,
  approved_by: string
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: 'no-db' }
  try {
    const approved_at = now()
    await db.prepare(`
      UPDATE tenant_federation SET status='approved', approved_by=?, approved_at=? WHERE id=? AND status='pending'
    `).bind(approved_by, approved_at, id).run()
    await writeAuditEvent(db, {
      event_type: 'federation.approved',
      object_type: 'tenant_federation',
      object_id: id,
      actor: approved_by,
      payload_summary: `Federation ${id} approved by ${approved_by}`,
      surface: '/federation',
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function revokeFederation(
  db: D1Database | undefined,
  id: string,
  revoked_by: string
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: 'no-db' }
  try {
    const revoked_at = now()
    await db.prepare(`
      UPDATE tenant_federation SET status='revoked', revoked_by=?, revoked_at=? WHERE id=? AND status='approved'
    `).bind(revoked_by, revoked_at, id).run()
    await writeAuditEvent(db, {
      event_type: 'federation.revoked',
      object_type: 'tenant_federation',
      object_id: id,
      actor: revoked_by,
      payload_summary: `Federation ${id} revoked by ${revoked_by}`,
      surface: '/federation',
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ---- Federated Intent Sharing ----

export async function listFederatedIntents(
  db: D1Database | undefined,
  opts: { target_tenant_id?: string; source_tenant_id?: string; approval_status?: string } = {}
): Promise<FederatedIntent[]> {
  if (!db) return []
  try {
    const conditions: string[] = []
    const params: string[] = []
    if (opts.target_tenant_id) { conditions.push('target_tenant_id = ?'); params.push(opts.target_tenant_id) }
    if (opts.source_tenant_id) { conditions.push('source_tenant_id = ?'); params.push(opts.source_tenant_id) }
    if (opts.approval_status) { conditions.push('approval_status = ?'); params.push(opts.approval_status) }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const rows = await db.prepare(
      `SELECT * FROM federated_intents ${where} ORDER BY created_at DESC LIMIT 100`
    ).bind(...params).all()
    return (rows.results || []) as unknown as FederatedIntent[]
  } catch (_e) { return [] }
}

export async function shareFederatedIntent(
  db: D1Database | undefined,
  data: {
    intent_id: string
    source_tenant_id: string
    target_tenant_id: string
    federation_id: string
    shared_scope: string
    share_notes: string
    shared_by: string
  }
): Promise<{ ok: boolean; record?: FederatedIntent; error?: string }> {
  // Validate federation is approved
  if (db) {
    const fed = await getFederation(db, data.federation_id)
    if (!fed) return { ok: false, error: 'federation-not-found' }
    if (fed.status !== 'approved') return { ok: false, error: `federation-${fed.status}` }
    // Check scope includes 'intents'
    let scope: string[] = []
    try { scope = JSON.parse(fed.scope) } catch { scope = [] }
    if (!scope.includes('intents')) return { ok: false, error: 'federation-scope-denied' }
  }

  const id = 'fedint-' + uid()
  const created_at = now()
  const record: FederatedIntent = {
    id,
    intent_id: data.intent_id,
    source_tenant_id: data.source_tenant_id,
    target_tenant_id: data.target_tenant_id,
    federation_id: data.federation_id,
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    shared_scope: data.shared_scope,
    share_notes: data.share_notes,
    shared_by: data.shared_by,
    created_at,
  }

  if (db) {
    await db.prepare(`
      INSERT INTO federated_intents
        (id, intent_id, source_tenant_id, target_tenant_id, federation_id,
         approval_status, shared_scope, share_notes, shared_by, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).bind(
      id, data.intent_id, data.source_tenant_id, data.target_tenant_id,
      data.federation_id, data.shared_scope, data.share_notes, data.shared_by, created_at
    ).run()

    await writeAuditEvent(db, {
      event_type: 'federated_intent.shared',
      object_type: 'federated_intents',
      object_id: id,
      actor: data.shared_by,
      tenant_id: data.source_tenant_id,
      payload_summary: `Intent ${data.intent_id} shared from ${data.source_tenant_id} to ${data.target_tenant_id}`,
      surface: '/federation',
    })
  }

  return { ok: true, record }
}

export async function approveFederatedIntent(
  db: D1Database | undefined,
  id: string,
  approved_by: string
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: 'no-db' }
  try {
    const approved_at = now()
    await db.prepare(`
      UPDATE federated_intents SET approval_status='approved', approved_by=?, approved_at=?
      WHERE id=? AND approval_status='pending'
    `).bind(approved_by, approved_at, id).run()
    await writeAuditEvent(db, {
      event_type: 'federated_intent.approved',
      object_type: 'federated_intents',
      object_id: id,
      actor: approved_by,
      payload_summary: `Federated intent ${id} approved by ${approved_by}`,
      surface: '/federation',
    })
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}
