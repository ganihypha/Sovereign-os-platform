// ============================================================
// SOVEREIGN OS PLATFORM — ALERT SYSTEM (P4)
// Generates governance alerts from real state changes.
// No synthetic alerts — every alert must trace to a real event.
// ============================================================

import type { Repo } from './repo'
import type { AlertType, AlertSeverity } from '../types'

export interface AlertPayload {
  alert_type: AlertType
  title: string
  message: string
  severity: AlertSeverity
  object_type: string
  object_id: string
}

// ---- Create a governance alert (only from real state changes) ----
export async function emitAlert(repo: Repo, payload: AlertPayload): Promise<void> {
  try {
    await repo.createAlert({
      ...payload,
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    })
  } catch (_e) {
    // Alert failure must not block primary operation
  }
}

// ---- Emit: approval pending ----
export async function alertApprovalPending(
  repo: Repo,
  approvalId: string,
  actionType: string,
  tier: number
): Promise<void> {
  await emitAlert(repo, {
    alert_type: 'approval_pending',
    title: `Approval Required: ${actionType}`,
    message: `Tier ${tier} approval request (${approvalId}) requires action. Tier ${tier} approvals need ${tier >= 2 ? 'Architect or Founder' : 'any authorized role'}.`,
    severity: tier >= 2 ? 'warning' : 'info',
    object_type: 'approval_requests',
    object_id: approvalId,
  })
}

// ---- Emit: proof submitted ----
export async function alertProofSubmitted(
  repo: Repo,
  proofId: string,
  workItemTitle: string
): Promise<void> {
  await emitAlert(repo, {
    alert_type: 'proof_submitted',
    title: `Proof Submitted: ${workItemTitle}`,
    message: `Proof artifact (${proofId}) has been submitted and awaits reviewer classification.`,
    severity: 'info',
    object_type: 'proof_artifacts',
    object_id: proofId,
  })
}

// ---- Emit: execution blocked ----
export async function alertExecutionBlocked(
  repo: Repo,
  execId: string,
  title: string,
  reason: string
): Promise<void> {
  await emitAlert(repo, {
    alert_type: 'execution_blocked',
    title: `Execution Blocked: ${title}`,
    message: `Execution item (${execId}) is blocked. Reason: ${reason || 'No reason provided.'}`,
    severity: 'warning',
    object_type: 'execution_entries',
    object_id: execId,
  })
}

// ---- Emit: canon candidate ready ----
export async function alertCanonCandidateReady(
  repo: Repo,
  candidateId: string,
  title: string
): Promise<void> {
  await emitAlert(repo, {
    alert_type: 'canon_candidate_ready',
    title: `Canon Candidate Ready: ${title}`,
    message: `Canon candidate (${candidateId}) has been proposed and is awaiting Founder/Architect review for promotion.`,
    severity: 'info',
    object_type: 'canon_candidates',
    object_id: candidateId,
  })
}

// ---- Emit: lane registered ----
export async function alertLaneRegistered(
  repo: Repo,
  laneId: string,
  laneName: string
): Promise<void> {
  await emitAlert(repo, {
    alert_type: 'lane_registered',
    title: `Lane Registered: ${laneName}`,
    message: `Product lane "${laneName}" (${laneId}) has been registered and is pending approval.`,
    severity: 'info',
    object_type: 'product_lanes',
    object_id: laneId,
  })
}
