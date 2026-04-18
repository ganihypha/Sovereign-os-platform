// src/lib/healthDashboardService.ts
// P9 — Platform health dashboard service (time-series, SLA tracking)
// ai-generated [human-confirmation-gate: required before canonization]

export interface HealthSnapshot {
  id: string
  surface: string
  http_status: number
  response_ms: number
  is_healthy: number
  checked_at: string
}

export interface SurfaceSLA {
  surface: string
  total_checks: number
  healthy_checks: number
  uptime_pct: number
  avg_response_ms: number
  last_status: number
  last_checked: string
}

// All 29 P0-P8 surfaces + 4 P9 surfaces
export const ALL_SURFACES = [
  // P0
  'dashboard', 'intent', 'intake', 'architect', 'approvals', 'proof', 'live', 'records',
  // P2
  'continuity',
  // P3
  'execution', 'connectors', 'roles',
  // P4
  'workspace', 'alerts', 'canon', 'lanes', 'onboarding', 'reports',
  // P5
  'tenants', 'ai-assist', 'api-keys', 'api/v1',
  // P6
  'tenant-routing',
  // P7
  'auth/sso', 'branding',
  // P8
  'federation', 'marketplace', 'audit',
  // P9
  'notifications', 'workflows', 'health-dashboard', 'portal'
]

function generateId(): string {
  return 'hs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

// Record a health snapshot for a surface
export async function recordHealthSnapshot(
  db: D1Database,
  surface: string,
  http_status: number,
  response_ms: number
): Promise<HealthSnapshot> {
  const id = generateId()
  const is_healthy = http_status >= 200 && http_status < 400 ? 1 : 0
  const checked_at = new Date().toISOString()

  await db.prepare(`
    INSERT INTO health_snapshots (id, surface, http_status, response_ms, is_healthy, checked_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, surface, http_status, response_ms, is_healthy, checked_at).run()

  return { id, surface, http_status, response_ms, is_healthy, checked_at }
}

// Get recent health snapshots for a surface
export async function getSurfaceHistory(
  db: D1Database,
  surface: string,
  limit: number = 24
): Promise<HealthSnapshot[]> {
  const result = await db.prepare(`
    SELECT * FROM health_snapshots WHERE surface = ?
    ORDER BY checked_at DESC LIMIT ?
  `).bind(surface, limit).all<HealthSnapshot>()
  return result.results || []
}

// Compute SLA stats per surface (last N snapshots)
export async function getSurfaceSLAs(
  db: D1Database,
  surfaces?: string[],
  lookback_hours: number = 24
): Promise<SurfaceSLA[]> {
  const since = new Date(Date.now() - lookback_hours * 60 * 60 * 1000).toISOString()
  const surfaceList = surfaces || ALL_SURFACES
  const slas: SurfaceSLA[] = []

  for (const surface of surfaceList) {
    const result = await db.prepare(`
      SELECT
        COUNT(*) as total_checks,
        SUM(is_healthy) as healthy_checks,
        AVG(response_ms) as avg_response_ms,
        MAX(http_status) as last_status,
        MAX(checked_at) as last_checked
      FROM health_snapshots
      WHERE surface = ? AND checked_at >= ?
    `).bind(surface, since).first<any>()

    if (result && result.total_checks > 0) {
      slas.push({
        surface,
        total_checks: result.total_checks,
        healthy_checks: result.healthy_checks || 0,
        uptime_pct: Math.round((result.healthy_checks / result.total_checks) * 10000) / 100,
        avg_response_ms: Math.round(result.avg_response_ms || 0),
        last_status: result.last_status || 200,
        last_checked: result.last_checked || ''
      })
    } else {
      // No data yet — show as pending
      slas.push({
        surface,
        total_checks: 0,
        healthy_checks: 0,
        uptime_pct: 100, // assume healthy until proven otherwise
        avg_response_ms: 0,
        last_status: 200,
        last_checked: 'No data yet'
      })
    }
  }

  return slas
}

// Get overall platform health summary
export async function getPlatformHealthSummary(db: D1Database): Promise<{
  total_surfaces: number
  healthy_surfaces: number
  degraded_surfaces: number
  overall_uptime_pct: number
  last_updated: string
}> {
  const result = await db.prepare(`
    SELECT
      COUNT(DISTINCT surface) as total_surfaces,
      SUM(CASE WHEN is_healthy = 1 THEN 1 ELSE 0 END) as healthy_checks,
      COUNT(*) as total_checks
    FROM health_snapshots
    WHERE checked_at >= datetime('now', '-1 hour')
  `).first<any>()

  const total = ALL_SURFACES.length
  const healthy = result?.healthy_checks || total
  const totalChecks = result?.total_checks || 0
  const uptime = totalChecks > 0
    ? Math.round((healthy / totalChecks) * 10000) / 100
    : 100

  return {
    total_surfaces: total,
    healthy_surfaces: healthy,
    degraded_surfaces: Math.max(0, total - healthy),
    overall_uptime_pct: uptime,
    last_updated: new Date().toISOString()
  }
}

// Prune old snapshots (keep last 7 days)
export async function pruneOldSnapshots(db: D1Database): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const result = await db.prepare(
    `DELETE FROM health_snapshots WHERE checked_at < ?`
  ).bind(cutoff).run()
  return result.meta.changes
}
