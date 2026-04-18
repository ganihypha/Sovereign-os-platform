// src/lib/eventArchiveService.ts
// P13 — Event Auto-Archive + Retention Policy
// ai-generated [human-confirmation-gate: required before canonization]
//
// Features:
// - Auto-archive events older than configurable days (default 30)
// - Lazy archive: triggered on each /events page load
// - Manual archive: POST /events/archive-old
// - Retention config in D1 event_retention_config table
// - Archive stats on /events surface
// ============================================================

export interface ArchiveResult {
  archived_count: number
  retention_days: number
  oldest_active_age_days: number | null
  archived_total: number
  ran_at: string
}

export interface RetentionConfig {
  retention_days: number
  auto_archive_enabled: boolean
  archive_batch_size: number
}

// ============================================================
// Get retention config from D1 (with defaults)
// ============================================================
export async function getRetentionConfig(db: D1Database): Promise<RetentionConfig> {
  try {
    const rows = await db.prepare(`
      SELECT key, value FROM event_retention_config
    `).all<{ key: string; value: string }>()

    const cfg: Record<string, string> = {}
    for (const r of rows.results || []) cfg[r.key] = r.value

    return {
      retention_days: parseInt(cfg['retention_days'] || '30', 10),
      auto_archive_enabled: (cfg['auto_archive_enabled'] || 'true') === 'true',
      archive_batch_size: parseInt(cfg['archive_batch_size'] || '100', 10)
    }
  } catch {
    return { retention_days: 30, auto_archive_enabled: true, archive_batch_size: 100 }
  }
}

// ============================================================
// Update retention config
// ============================================================
export async function updateRetentionConfig(
  db: D1Database,
  key: string,
  value: string
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO event_retention_config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).bind(key, value).run()
  } catch { /* non-blocking */ }
}

// ============================================================
// Run auto-archive: move events older than retention_days to event_archives
// ============================================================
export async function runEventArchive(
  db: D1Database,
  forceDays?: number
): Promise<ArchiveResult> {
  const now = new Date().toISOString()
  try {
    const config = await getRetentionConfig(db)
    const days = forceDays ?? config.retention_days

    if (!config.auto_archive_enabled && !forceDays) {
      const totalArchived = await db.prepare(`SELECT COUNT(*) as cnt FROM event_archives`)
        .first<{ cnt: number }>()
      return {
        archived_count: 0,
        retention_days: days,
        oldest_active_age_days: null,
        archived_total: totalArchived?.cnt || 0,
        ran_at: now
      }
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Get events to archive (batch)
    const toArchive = await db.prepare(`
      SELECT id, payload_json, event_type, source_surface, tenant_id, created_at
      FROM platform_events
      WHERE created_at < ?
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(cutoffDate, config.archive_batch_size).all<{
      id: string; payload_json: string | null; event_type: string;
      source_surface: string; tenant_id: string; created_at: string
    }>()

    const events = toArchive.results || []
    let archivedCount = 0

    if (events.length > 0) {
      // Insert into event_archives then delete from platform_events
      for (const evt of events) {
        try {
          const payload = {
            event_type: evt.event_type,
            source_surface: evt.source_surface,
            tenant_id: evt.tenant_id,
            created_at: evt.created_at,
            original_payload: evt.payload_json ? JSON.parse(evt.payload_json) : null
          }
          await db.prepare(`
            INSERT OR IGNORE INTO event_archives (original_event_id, archived_at, payload_json)
            VALUES (?, CURRENT_TIMESTAMP, ?)
          `).bind(evt.id, JSON.stringify(payload)).run()

          await db.prepare(`DELETE FROM platform_events WHERE id = ?`).bind(evt.id).run()
          archivedCount++
        } catch { /* skip individual failures */ }
      }
    }

    // Get oldest active event age
    const oldestActive = await db.prepare(`
      SELECT MIN(created_at) as oldest FROM platform_events
    `).first<{ oldest: string | null }>()

    let oldestAgeDays: number | null = null
    if (oldestActive?.oldest) {
      const ageMs = Date.now() - new Date(oldestActive.oldest).getTime()
      oldestAgeDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
    }

    // Total archived
    const totalArchived = await db.prepare(`SELECT COUNT(*) as cnt FROM event_archives`)
      .first<{ cnt: number }>()

    return {
      archived_count: archivedCount,
      retention_days: days,
      oldest_active_age_days: oldestAgeDays,
      archived_total: totalArchived?.cnt || 0,
      ran_at: now
    }
  } catch {
    return {
      archived_count: 0,
      retention_days: 30,
      oldest_active_age_days: null,
      archived_total: 0,
      ran_at: now
    }
  }
}

// ============================================================
// Get archive stats for /events page display
// ============================================================
export async function getArchiveStats(db: D1Database): Promise<{
  archived_total: number
  oldest_active_age_days: number | null
  retention_days: number
  auto_archive_enabled: boolean
  last_archive_entry: string | null
}> {
  try {
    const [config, totalArchived, oldestActive, lastEntry] = await Promise.all([
      getRetentionConfig(db),
      db.prepare(`SELECT COUNT(*) as cnt FROM event_archives`).first<{ cnt: number }>(),
      db.prepare(`SELECT MIN(created_at) as oldest FROM platform_events`).first<{ oldest: string | null }>(),
      db.prepare(`SELECT MAX(archived_at) as last FROM event_archives`).first<{ last: string | null }>()
    ])

    let oldestAgeDays: number | null = null
    if (oldestActive?.oldest) {
      const ageMs = Date.now() - new Date(oldestActive.oldest).getTime()
      oldestAgeDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))
    }

    return {
      archived_total: totalArchived?.cnt || 0,
      oldest_active_age_days: oldestAgeDays,
      retention_days: config.retention_days,
      auto_archive_enabled: config.auto_archive_enabled,
      last_archive_entry: lastEntry?.last || null
    }
  } catch {
    return {
      archived_total: 0,
      oldest_active_age_days: null,
      retention_days: 30,
      auto_archive_enabled: true,
      last_archive_entry: null
    }
  }
}

// ============================================================
// Get event type analytics (top 5 types + events per day)
// ============================================================
export async function getEventTypeAnalytics(db: D1Database): Promise<{
  top_event_types: Array<{ event_type: string; count: number }>
  events_per_day: Array<{ date: string; count: number }>
}> {
  try {
    const [topTypes, perDay] = await Promise.all([
      db.prepare(`
        SELECT event_type, COUNT(*) as count
        FROM platform_events
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 5
      `).all<{ event_type: string; count: number }>(),
      db.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM platform_events
        WHERE created_at >= DATE('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).all<{ date: string; count: number }>()
    ])

    return {
      top_event_types: topTypes.results || [],
      events_per_day: perDay.results || []
    }
  } catch {
    return { top_event_types: [], events_per_day: [] }
  }
}
