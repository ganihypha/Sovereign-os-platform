// ============================================================
// SOVEREIGN OS PLATFORM — MARKETPLACE SERVICE (P8)
// Connector template marketplace — governed publishing
//
// LAWS:
// - Tier 2 approval required before listing
// - Connector must be approved (connectors.approval_status = 'approved')
// - marketplace_eligible flag must be set on connector
// - All marketplace events written to audit_log_v2
// ============================================================
import type { D1Database } from '@cloudflare/workers-types'
import type { MarketplaceConnector } from '../types'
import { writeAuditEvent } from './auditService'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function now(): string {
  return new Date().toISOString()
}

export async function listMarketplaceConnectors(
  db: D1Database | undefined,
  opts: {
    listing_status?: string
    submitted_tenant_id?: string
    limit?: number
  } = {}
): Promise<MarketplaceConnector[]> {
  if (!db) return []
  try {
    const limit = Math.min(opts.limit || 50, 100)
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (opts.listing_status) { conditions.push('listing_status = ?'); params.push(opts.listing_status) }
    if (opts.submitted_tenant_id) { conditions.push('submitted_tenant_id = ?'); params.push(opts.submitted_tenant_id) }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    params.push(limit)

    const rows = await db.prepare(
      `SELECT * FROM marketplace_connectors ${where} ORDER BY created_at DESC LIMIT ?`
    ).bind(...params).all()
    return (rows.results || []) as unknown as MarketplaceConnector[]
  } catch (_e) { return [] }
}

export async function getMarketplaceConnector(
  db: D1Database | undefined,
  id: string
): Promise<MarketplaceConnector | null> {
  if (!db) return null
  try {
    const row = await db.prepare('SELECT * FROM marketplace_connectors WHERE id = ?').bind(id).first()
    return (row as unknown as MarketplaceConnector) || null
  } catch (_e) { return null }
}

export async function submitConnectorToMarketplace(
  db: D1Database | undefined,
  data: {
    connector_id: string
    submitted_by: string
    submitted_tenant_id: string
    listing_title: string
    listing_description: string
    listing_tags: string[]
    listing_notes: string
    version_tag: string
  }
): Promise<{ ok: boolean; record?: MarketplaceConnector; error?: string }> {
  if (!db) {
    // In-memory mode: return mock record
    const id = 'mkt-' + uid()
    const created_at = now()
    return {
      ok: true,
      record: {
        id,
        connector_id: data.connector_id,
        submitted_by: data.submitted_by,
        submitted_tenant_id: data.submitted_tenant_id,
        listing_status: 'submitted',
        approval_tier: 2,
        approved_by: null,
        approved_at: null,
        rejected_reason: '',
        listing_notes: data.listing_notes,
        listing_title: data.listing_title,
        listing_description: data.listing_description,
        listing_tags: JSON.stringify(data.listing_tags),
        version_tag: data.version_tag,
        downloads: 0,
        created_at,
        updated_at: created_at,
      }
    }
  }

  // Verify connector exists and is approved
  try {
    const connector = await db.prepare(
      'SELECT id, approval_status, marketplace_eligible FROM connectors WHERE id = ?'
    ).bind(data.connector_id).first() as Record<string, unknown> | null

    if (!connector) return { ok: false, error: 'connector-not-found' }
    if (connector.approval_status !== 'approved') return { ok: false, error: 'connector-not-approved' }
    if (!connector.marketplace_eligible) return { ok: false, error: 'connector-not-marketplace-eligible' }

    // Check no existing active submission
    const existing = await db.prepare(
      `SELECT id FROM marketplace_connectors WHERE connector_id = ? AND listing_status NOT IN ('rejected','withdrawn')`
    ).bind(data.connector_id).first()
    if (existing) return { ok: false, error: 'already-submitted' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }

  const id = 'mkt-' + uid()
  const created_at = now()
  const listing_tags = JSON.stringify(data.listing_tags)

  try {
    await db.prepare(`
      INSERT INTO marketplace_connectors
        (id, connector_id, submitted_by, submitted_tenant_id, listing_status, approval_tier,
         listing_notes, listing_title, listing_description, listing_tags, version_tag,
         downloads, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'submitted', 2, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      id, data.connector_id, data.submitted_by, data.submitted_tenant_id,
      data.listing_notes, data.listing_title, data.listing_description,
      listing_tags, data.version_tag, created_at, created_at
    ).run()

    await writeAuditEvent(db, {
      event_type: 'marketplace.submitted',
      object_type: 'marketplace_connectors',
      object_id: id,
      actor: data.submitted_by,
      tenant_id: data.submitted_tenant_id,
      payload_summary: `Connector ${data.connector_id} submitted for marketplace: ${data.listing_title}`,
      surface: '/marketplace',
    })

    const record = await getMarketplaceConnector(db, id)
    return { ok: true, record: record || undefined }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function approveMarketplaceListing(
  db: D1Database | undefined,
  id: string,
  approved_by: string
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: 'no-db' }
  try {
    const approved_at = now()
    await db.prepare(`
      UPDATE marketplace_connectors
      SET listing_status='listed', approved_by=?, approved_at=?, updated_at=?
      WHERE id=? AND listing_status IN ('submitted','under_review')
    `).bind(approved_by, approved_at, approved_at, id).run()

    await writeAuditEvent(db, {
      event_type: 'marketplace.listed',
      object_type: 'marketplace_connectors',
      object_id: id,
      actor: approved_by,
      payload_summary: `Marketplace listing ${id} approved by ${approved_by}`,
      surface: '/marketplace',
    })
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}

export async function rejectMarketplaceListing(
  db: D1Database | undefined,
  id: string,
  rejected_by: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: 'no-db' }
  try {
    const updated_at = now()
    await db.prepare(`
      UPDATE marketplace_connectors
      SET listing_status='rejected', rejected_reason=?, updated_at=?
      WHERE id=? AND listing_status IN ('submitted','under_review')
    `).bind(reason, updated_at, id).run()

    await writeAuditEvent(db, {
      event_type: 'marketplace.rejected',
      object_type: 'marketplace_connectors',
      object_id: id,
      actor: rejected_by,
      payload_summary: `Marketplace listing ${id} rejected: ${reason.slice(0, 100)}`,
      surface: '/marketplace',
    })
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e) } }
}

export async function incrementDownloads(
  db: D1Database | undefined,
  id: string
): Promise<void> {
  if (!db) return
  try {
    await db.prepare(
      'UPDATE marketplace_connectors SET downloads = downloads + 1 WHERE id = ? AND listing_status = \'listed\''
    ).bind(id).run()
  } catch (_e) { /* non-blocking */ }
}
