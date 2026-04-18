// ============================================================
// SOVEREIGN OS PLATFORM — REPORTING SERVICE (P10)
// Purpose: Generate downloadable CSV/JSON governance reports
// Engine: D1-backed, edge-compatible, no fs/Node APIs
// Report Types: approval_audit, federation_activity,
//               marketplace_activity, anomaly_history,
//               workflow_runs, platform_summary
// ============================================================

import { createRepo } from './repo'

export type ReportType =
  | 'approval_audit'
  | 'federation_activity'
  | 'marketplace_activity'
  | 'anomaly_history'
  | 'workflow_runs'
  | 'platform_summary'

export type ReportFormat = 'json' | 'csv'

export interface ReportFilters {
  date_from?: string   // ISO date string
  date_to?: string
  tenant_id?: string
  event_type?: string
  status?: string
  limit?: number
}

export interface ReportJob {
  id: string
  tenant_id: string
  report_type: ReportType
  status: 'pending' | 'running' | 'completed' | 'failed'
  format: ReportFormat
  filters_json?: string
  result_data?: string
  row_count: number
  error_message?: string
  created_by: string
  created_at: string
  completed_at?: string
}

export interface ReportResult {
  report_type: ReportType
  format: ReportFormat
  generated_at: string
  tenant_id: string
  filters: ReportFilters
  row_count: number
  data: unknown[]
  csv?: string
}

// ============================================================
// UTILITY: Convert array of objects to CSV string
// ============================================================
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(','))
  ]
  return lines.join('\n')
}

// ============================================================
// UTILITY: Apply date + tenant filters to a row array
// ============================================================
function applyFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: ReportFilters,
  dateField = 'created_at'
): T[] {
  let result = rows
  if (filters.date_from) {
    result = result.filter(r => {
      const d = r[dateField] as string
      return d && d >= filters.date_from!
    })
  }
  if (filters.date_to) {
    result = result.filter(r => {
      const d = r[dateField] as string
      return d && d <= filters.date_to! + 'T23:59:59Z'
    })
  }
  if (filters.tenant_id) {
    result = result.filter(r => r['tenant_id'] === filters.tenant_id)
  }
  if (filters.status) {
    result = result.filter(r => r['status'] === filters.status)
  }
  const limit = filters.limit || 1000
  return result.slice(0, limit)
}

// ============================================================
// GENERATE: approval_audit report
// ============================================================
async function generateApprovalAudit(
  db: D1Database,
  filters: ReportFilters
): Promise<Record<string, unknown>[]> {
  const repo = createRepo(db)
  const approvals = await repo.getApprovalRequests()
  const filtered = applyFilters(approvals as Record<string, unknown>[], filters)
  return filtered.map(a => ({
    id: a['id'],
    tenant_id: a['tenant_id'] || 'tenant-default',
    title: a['title'],
    requester: a['requester'],
    approver: a['approver'] || '',
    status: a['status'],
    tier: a['tier'] || 1,
    priority: a['priority'] || 'normal',
    rationale: a['rationale'] || '',
    created_at: a['created_at'],
    resolved_at: a['resolved_at'] || '',
  }))
}

// ============================================================
// GENERATE: federation_activity report
// ============================================================
async function generateFederationActivity(
  db: D1Database,
  filters: ReportFilters
): Promise<Record<string, unknown>[]> {
  try {
    const result = await db.prepare(`
      SELECT id, tenant_id, target_tenant_id, type, status, 
             agreement_type, created_at, approved_at
      FROM federation_links
      ORDER BY created_at DESC
      LIMIT 1000
    `).all()
    const rows = (result.results || []) as Record<string, unknown>[]
    return applyFilters(rows, filters)
  } catch {
    return []
  }
}

// ============================================================
// GENERATE: marketplace_activity report
// ============================================================
async function generateMarketplaceActivity(
  db: D1Database,
  filters: ReportFilters
): Promise<Record<string, unknown>[]> {
  try {
    const result = await db.prepare(`
      SELECT id, tenant_id, name, category, status, 
             submitted_by, reviewed_by, install_count, created_at
      FROM marketplace_connectors
      ORDER BY created_at DESC
      LIMIT 1000
    `).all()
    const rows = (result.results || []) as Record<string, unknown>[]
    return applyFilters(rows, filters)
  } catch {
    return []
  }
}

// ============================================================
// GENERATE: anomaly_history report
// ============================================================
async function generateAnomalyHistory(
  db: D1Database,
  filters: ReportFilters
): Promise<Record<string, unknown>[]> {
  try {
    const result = await db.prepare(`
      SELECT id, tenant_id, metric_name, value, z_score,
             is_anomaly, severity, detected_at, resolved_at,
             ai_summary, detection_mode
      FROM anomaly_events
      ORDER BY detected_at DESC
      LIMIT 1000
    `).all()
    const rows = (result.results || []) as Record<string, unknown>[]
    return applyFilters(rows, filters, 'detected_at')
  } catch {
    return []
  }
}

// ============================================================
// GENERATE: workflow_runs report
// ============================================================
async function generateWorkflowRuns(
  db: D1Database,
  filters: ReportFilters
): Promise<Record<string, unknown>[]> {
  try {
    const result = await db.prepare(`
      SELECT wr.id, wr.workflow_id, w.name as workflow_name,
             w.tenant_id, wr.trigger_event, wr.status,
             wr.condition_met, wr.action_result,
             wr.started_at, wr.completed_at,
             wr.error_message
      FROM workflow_runs wr
      LEFT JOIN workflows w ON w.id = wr.workflow_id
      ORDER BY wr.started_at DESC
      LIMIT 1000
    `).all()
    const rows = (result.results || []) as Record<string, unknown>[]
    return applyFilters(rows, filters, 'started_at')
  } catch {
    return []
  }
}

// ============================================================
// GENERATE: platform_summary report
// ============================================================
async function generatePlatformSummary(
  db: D1Database,
  filters: ReportFilters
): Promise<Record<string, unknown>[]> {
  const repo = createRepo(db)
  const [
    sessions, approvals, execEntries, connectors,
    proofs, alerts, tenants
  ] = await Promise.all([
    repo.getSessions(),
    repo.getApprovalRequests(),
    repo.getExecutionEntries(),
    repo.getConnectors(),
    repo.getProofArtifacts(),
    repo.getAlerts(),
    repo.getTenants ? repo.getTenants() : Promise.resolve([]),
  ])

  const now = new Date().toISOString()
  const summary = {
    generated_at: now,
    period_from: filters.date_from || 'all-time',
    period_to: filters.date_to || now,
    tenant_id: filters.tenant_id || 'all-tenants',
    // Sessions
    total_sessions: sessions.length,
    active_sessions: sessions.filter((s: Record<string, unknown>) => s['status'] === 'active').length,
    closed_sessions: sessions.filter((s: Record<string, unknown>) => s['status'] === 'closed').length,
    // Approvals
    total_approvals: approvals.length,
    pending_approvals: approvals.filter((a: Record<string, unknown>) => a['status'] === 'pending').length,
    approved: approvals.filter((a: Record<string, unknown>) => a['status'] === 'approved').length,
    rejected: approvals.filter((a: Record<string, unknown>) => a['status'] === 'rejected').length,
    // Executions
    total_executions: execEntries.length,
    running_executions: execEntries.filter((e: Record<string, unknown>) => e['status'] === 'running').length,
    done_executions: execEntries.filter((e: Record<string, unknown>) => e['status'] === 'done').length,
    blocked_executions: execEntries.filter((e: Record<string, unknown>) => e['status'] === 'blocked').length,
    // Connectors
    total_connectors: connectors.length,
    active_connectors: connectors.filter((c: Record<string, unknown>) => c['status'] === 'active').length,
    // Proofs
    total_proofs: proofs.length,
    proof_pass_rate: proofs.length > 0
      ? Math.round((proofs.filter((p: Record<string, unknown>) => p['outcome_classification'] === 'PASS').length / proofs.length) * 100)
      : 0,
    // Alerts
    total_alerts: alerts.length,
    unread_alerts: alerts.filter((a: Record<string, unknown>) => !a['acknowledged']).length,
    // Tenants
    total_tenants: (tenants as unknown[]).length,
  }
  return [summary]
}

// ============================================================
// MAIN: generateReport — orchestrates report generation
// ============================================================
export async function generateReport(
  db: D1Database,
  reportType: ReportType,
  format: ReportFormat,
  filters: ReportFilters,
  tenantId = 'tenant-default',
  createdBy = 'api'
): Promise<ReportResult> {
  const generatedAt = new Date().toISOString()

  let data: Record<string, unknown>[] = []

  switch (reportType) {
    case 'approval_audit':
      data = await generateApprovalAudit(db, filters)
      break
    case 'federation_activity':
      data = await generateFederationActivity(db, filters)
      break
    case 'marketplace_activity':
      data = await generateMarketplaceActivity(db, filters)
      break
    case 'anomaly_history':
      data = await generateAnomalyHistory(db, filters)
      break
    case 'workflow_runs':
      data = await generateWorkflowRuns(db, filters)
      break
    case 'platform_summary':
      data = await generatePlatformSummary(db, filters)
      break
    default:
      data = []
  }

  const result: ReportResult = {
    report_type: reportType,
    format,
    generated_at: generatedAt,
    tenant_id: tenantId,
    filters,
    row_count: data.length,
    data,
  }

  if (format === 'csv') {
    result.csv = toCSV(data)
  }

  // Persist report job to D1 (non-blocking, best-effort)
  try {
    const jobId = 'rjob-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
    await db.prepare(`
      INSERT INTO report_jobs (id, tenant_id, report_type, status, format, filters_json, result_data, row_count, created_by, created_at, completed_at)
      VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobId,
      tenantId,
      reportType,
      format,
      JSON.stringify(filters),
      format === 'csv' ? (result.csv || '').slice(0, 8000) : JSON.stringify(data).slice(0, 8000),
      data.length,
      createdBy,
      generatedAt,
      generatedAt
    ).run()
  } catch {
    // non-blocking — report still returns even if job persist fails
  }

  return result
}

// ============================================================
// UTIL: getReportJobs — list recent report jobs
// ============================================================
export async function getReportJobs(
  db: D1Database,
  tenantId?: string,
  limit = 50
): Promise<ReportJob[]> {
  try {
    let query = `SELECT * FROM report_jobs`
    const binds: unknown[] = []
    if (tenantId) {
      query += ` WHERE tenant_id = ?`
      binds.push(tenantId)
    }
    query += ` ORDER BY created_at DESC LIMIT ?`
    binds.push(limit)
    const result = await db.prepare(query).bind(...binds).all()
    return (result.results || []) as ReportJob[]
  } catch {
    return []
  }
}

// ============================================================
// UTIL: Report type display metadata
// ============================================================
export const REPORT_TYPES: { type: ReportType; label: string; description: string; icon: string }[] = [
  { type: 'approval_audit', label: 'Approval Audit', description: 'Full audit trail of all approval requests and decisions', icon: '✓' },
  { type: 'federation_activity', label: 'Federation Activity', description: 'Cross-tenant federation links and partnership events', icon: '⇄' },
  { type: 'marketplace_activity', label: 'Marketplace Activity', description: 'Connector submissions, reviews, and installations', icon: '⊞' },
  { type: 'anomaly_history', label: 'Anomaly History', description: 'Detected anomalies, severity scores, and resolutions', icon: '⚠' },
  { type: 'workflow_runs', label: 'Workflow Runs', description: 'Workflow execution history, triggers, and outcomes', icon: '↻' },
  { type: 'platform_summary', label: 'Platform Summary', description: 'Aggregated platform health metrics snapshot', icon: '≡' },
]
