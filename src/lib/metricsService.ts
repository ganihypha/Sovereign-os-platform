// ============================================================
// SOVEREIGN OS PLATFORM — METRICS SNAPSHOT SERVICE (P7)
// Periodic snapshot writes to metrics_snapshots table.
// Wires platform state to time-series for /reports timeline.
//
// Rules:
//   - Only reads from real D1 data (no synthetic numbers)
//   - Deduplication: one snapshot per type+period_label per tenant
//   - Does not block primary operations (fire-and-log pattern)
//   - Called at: app load on /health, or POST /api/v1/metrics-snapshot
// ============================================================

import type { Repo } from './repo'

export interface SnapshotInput {
  tenantId?: string
  snapshotType?: 'hourly' | 'daily' | 'weekly'
}

// ---- Take a metrics snapshot ----
// Reads live D1 state and writes a snapshot record.
// Safe to call multiple times — deduplicates by period_label + tenant_id.
export async function takeMetricsSnapshot(
  repo: Repo,
  input: SnapshotInput = {}
): Promise<{ ok: boolean; period_label: string; id?: string }> {
  const tenantId = input.tenantId || 'tenant-default'
  const snapshotType = input.snapshotType || 'daily'

  // Period label: for daily = 'YYYY-MM-DD', hourly = 'YYYY-MM-DD-HH', weekly = 'YYYY-WNN'
  const now = new Date()
  let period_label: string
  if (snapshotType === 'hourly') {
    const pad = (n: number) => n.toString().padStart(2, '0')
    period_label = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}`
  } else if (snapshotType === 'weekly') {
    // ISO week number
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    period_label = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
  } else {
    const pad = (n: number) => n.toString().padStart(2, '0')
    period_label = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
  }

  try {
    // Check for existing snapshot for this period (deduplication)
    const existing = await repo.getMetricsSnapshotByPeriod(tenantId, snapshotType, period_label)
    if (existing) {
      return { ok: true, period_label, id: existing.id }
    }

    // Read current live metrics from D1
    const metrics = await repo.getReportMetrics()
    const executions = await repo.getExecutionEntries ? repo.getExecutionEntries() : Promise.resolve([])
    const connectors = await repo.getConnectors()
    const proofs = await repo.getProofArtifacts()
    const lanes = await repo.getProductLanes ? repo.getProductLanes() : Promise.resolve([])
    const alerts = await repo.getAlerts()
    const canon = await repo.getCanonCandidates()

    const execArr = Array.isArray(executions) ? executions : []
    const lanesArr = Array.isArray(lanes) ? lanes : []

    const snapshotData = {
      captured_at: now.toISOString(),
      metrics_source: repo.isPersistent ? 'd1' : 'in-memory',
    }

    const id = await repo.createMetricsSnapshot({
      tenant_id: tenantId,
      snapshot_type: snapshotType,
      period_label,
      total_sessions: metrics.total_sessions || 0,
      active_sessions: metrics.active_sessions || 0,
      pending_approvals: metrics.pending_approvals || 0,
      running_executions: execArr.filter((e: {status: string}) => e.status === 'running').length,
      active_connectors: connectors.filter((c: {status: string}) => c.status === 'active').length,
      verified_proofs: proofs.filter((p: {outcome: string}) => p.outcome === 'PASS').length,
      active_lanes: lanesArr.filter((l: {status: string}) => l.status === 'active').length,
      unread_alerts: alerts.filter((a: {acknowledged: boolean}) => !a.acknowledged).length,
      canon_candidates: canon.filter((c: {status: string}) => c.status === 'candidate').length,
      snapshot_data: JSON.stringify(snapshotData),
    })
    return { ok: true, period_label, id }
  } catch (_e) {
    return { ok: false, period_label }
  }
}

// ---- Get time-series metrics history ----
// Returns array of snapshots for the given tenant, sorted by created_at asc.
export async function getMetricsHistory(
  repo: Repo,
  tenantId: string = 'tenant-default',
  snapshotType: 'hourly' | 'daily' | 'weekly' = 'daily',
  limit: number = 30
) {
  try {
    return await repo.getMetricsHistory(tenantId, snapshotType, limit)
  } catch (_e) {
    return []
  }
}
