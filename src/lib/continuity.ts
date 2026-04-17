// ============================================================
// SOVEREIGN OS PLATFORM — SESSION CONTINUITY (P2)
//
// Provides structured continuity artifact generation and
// handoff discipline utilities.
//
// Platform Law: No undocumented meaningful activity.
//               Live state over guesswork.
//               Session operating contract must be closeable.
//
// WHAT THIS MODULE DOES:
//   - Builds continuity snapshot from current repo state
//   - Produces structured handoff context for next session
//   - Provides continuity status assessment (healthy/degraded/broken)
//   - Does NOT make decisions — only observes and structures state
// ============================================================

import type { Repo } from './repo'
import type { SessionContinuity, ContinuitySnapshotType } from '../types'

// ---- Continuity health classification ----
export type ContinuityHealth = 'healthy' | 'degraded' | 'broken'

export interface ContinuityAssessment {
  health: ContinuityHealth
  score: number                  // 0–100
  issues: string[]
  recommendations: string[]
  last_snapshot_age_hours: number | null
}

// ---- Build a continuity snapshot from current repo state ----
export async function buildContinuitySnapshot(
  repo: Repo,
  sessionId: string,
  snapshotType: ContinuitySnapshotType,
  authoredBy: string,
  governanceNotes: string,
  nextLockedMove: string
): Promise<Omit<SessionContinuity, 'id' | 'created_at'>> {
  const [
    intents, sessions, requests, approvals,
    workItems, proofs, decisions, handoffs,
    priorities, canon
  ] = await Promise.all([
    repo.getIntents(),
    repo.getSessions(),
    repo.getRequests(),
    repo.getApprovalRequests(),
    repo.getWorkItems(),
    repo.getProofArtifacts(),
    repo.getDecisionRecords(),
    repo.getHandoffRecords(),
    repo.getPriorityItems(),
    repo.getCanonCandidates(),
  ])

  // Identify pending items that need attention
  const pendingApprovals = approvals
    .filter(a => a.status === 'pending')
    .map(a => a.id)

  const pendingProofs = proofs
    .filter(p => p.status === 'pending')
    .map(p => p.id)

  const activeBlockers = priorities
    .filter(p => p.blocker && !p.resolved)
    .map(p => p.title)

  const currentSession = sessions.find(s => s.id === sessionId)
  const openItems: string[] = [
    ...(currentSession?.acceptance_criteria?.filter(c => c) ?? []),
    ...activeBlockers.map(b => `BLOCKER: ${b}`),
    ...(pendingApprovals.length > 0 ? [`${pendingApprovals.length} approval(s) pending`] : []),
    ...(pendingProofs.length > 0 ? [`${pendingProofs.length} proof(s) pending review`] : []),
  ]

  const platformState: Record<string, number> = {
    intents: intents.length,
    sessions: sessions.length,
    requests: requests.length,
    approval_requests: approvals.length,
    work_items: workItems.length,
    proof_artifacts: proofs.length,
    decision_records: decisions.length,
    handoff_records: handoffs.length,
    priority_items: priorities.length,
    canon_candidates: canon.length,
    pending_approvals: pendingApprovals.length,
    pending_proofs: pendingProofs.length,
    active_blockers: activeBlockers.length,
  }

  return {
    session_id: sessionId,
    snapshot_type: snapshotType,
    platform_state: platformState,
    open_items: openItems,
    pending_approvals: pendingApprovals,
    pending_proofs: pendingProofs,
    next_locked_move: nextLockedMove,
    authored_by: authoredBy,
    governance_notes: governanceNotes,
  }
}

// ---- Assess continuity health ----
export async function assessContinuityHealth(repo: Repo): Promise<ContinuityAssessment> {
  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  const [approvals, proofs, priorities, continuities, sessions] = await Promise.all([
    repo.getApprovalRequests(),
    repo.getProofArtifacts(),
    repo.getPriorityItems(),
    repo.getSessionContinuity(),
    repo.getSessions(),
  ])

  // Check 1: Active blockers
  const activeBlockers = priorities.filter(p => p.blocker && !p.resolved)
  if (activeBlockers.length > 0) {
    score -= activeBlockers.length * 10
    issues.push(`${activeBlockers.length} unresolved blocker(s): ${activeBlockers.map(b => b.title).join(', ')}`)
    recommendations.push('Resolve or explicitly defer active blockers before session closeout.')
  }

  // Check 2: Pending approvals > 48h old (approximate — no exact timestamps comparison here)
  const pendingApprovals = approvals.filter(a => a.status === 'pending')
  if (pendingApprovals.length > 3) {
    score -= 15
    issues.push(`${pendingApprovals.length} approval requests pending — queue may be stale.`)
    recommendations.push('Process or explicitly defer stale approval queue items.')
  }

  // Check 3: Proof artifacts pending review
  const pendingProofs = proofs.filter(p => p.status === 'pending')
  if (pendingProofs.length > 0) {
    score -= pendingProofs.length * 5
    issues.push(`${pendingProofs.length} proof artifact(s) pending review.`)
    recommendations.push('Review or mark proof artifacts before session handoff.')
  }

  // Check 4: No continuity snapshot for active sessions
  const activeSessions = sessions.filter(s => s.status === 'active')
  for (const s of activeSessions) {
    const snapshots = continuities.filter(c => c.session_id === s.id)
    if (snapshots.length === 0) {
      score -= 10
      issues.push(`Session "${s.title}" has no continuity snapshot.`)
      recommendations.push(`Create a continuity checkpoint or handoff for session "${s.title}".`)
    }
  }

  // Check 5: Persistent storage
  if (!repo.isPersistent) {
    score -= 20
    issues.push('Running in in-memory mode — data will not survive restart.')
    recommendations.push('Wire D1 database binding for production persistence.')
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  // Determine health
  let health: ContinuityHealth = 'healthy'
  if (score < 50) health = 'broken'
  else if (score < 75) health = 'degraded'

  // Calculate last snapshot age
  let last_snapshot_age_hours: number | null = null
  if (continuities.length > 0) {
    const sorted = [...continuities].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const lastTs = new Date(sorted[0].created_at).getTime()
    last_snapshot_age_hours = Math.floor((Date.now() - lastTs) / (1000 * 60 * 60))
  }

  return { health, score, issues, recommendations, last_snapshot_age_hours }
}

// ---- Format continuity snapshot as human-readable text ----
export function formatContinuityText(c: SessionContinuity): string {
  const lines: string[] = [
    `=== CONTINUITY ${c.snapshot_type.toUpperCase()} ===`,
    `Session: ${c.session_id}`,
    `Type: ${c.snapshot_type} | Authored by: ${c.authored_by}`,
    `Created: ${c.created_at}`,
    '',
    '--- Platform State ---',
    ...Object.entries(c.platform_state).map(([k, v]) => `  ${k}: ${v}`),
    '',
    '--- Open Items ---',
    ...(c.open_items.length > 0 ? c.open_items.map(i => `  • ${i}`) : ['  (none)']),
    '',
    '--- Pending Approvals ---',
    ...(c.pending_approvals.length > 0 ? c.pending_approvals.map(i => `  ${i}`) : ['  (none)']),
    '',
    '--- Pending Proofs ---',
    ...(c.pending_proofs.length > 0 ? c.pending_proofs.map(i => `  ${i}`) : ['  (none)']),
    '',
    `--- Next Locked Move ---`,
    `  ${c.next_locked_move || '(not defined)'}`,
    '',
    '--- Governance Notes ---',
    `  ${c.governance_notes || '(none)'}`,
  ]
  return lines.join('\n')
}

// ---- Health badge HTML ----
export function continuityHealthBadge(health: ContinuityHealth, score: number): string {
  const map = {
    healthy:  { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)',   label: 'HEALTHY' },
    degraded: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',  label: 'DEGRADED' },
    broken:   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)',   label: 'BROKEN' },
  }
  const s = map[health]
  return `<span style="background:${s.bg};color:${s.color};border:1px solid ${s.border};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${s.label} ${score}%</span>`
}
