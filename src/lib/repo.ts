// ============================================================
// SOVEREIGN OS PLATFORM — REPOSITORY LAYER (P2)
// Abstraction over D1 (production) with in-memory fallback
// Strategy:
//   - If env.DB (D1) is available → use D1
//   - If not available (no binding) → use in-memory fallback
// This allows local wrangler pages dev without D1 flag to still work.
//
// WHAT PERSISTS (when D1 is bound):
//   All 10 P1 domain objects + audit_log + api_keys
//   P2 additions: session_continuity, governance_boundaries,
//                 operator_notes, role_assignments
//
// WHAT DOES NOT PERSIST (when D1 is NOT bound / in-memory):
//   All data resets on server restart — documented limitation
// ============================================================

import type {
  Intent, Session, Request, ApprovalRequest,
  WorkItem, ProofArtifact, DecisionRecord,
  HandoffRecord, PriorityItem, CanonCandidate,
  SessionContinuity, GovernanceBoundary, OperatorNote, RoleAssignment,
  PlatformRole, ContinuitySnapshotType, NoteType,
  ExecutionEntry, Connector, ExecutionStatus, ExecutionPriority,
  ConnectorType, ConnectorStatus, ConnectorApproval, ConnectorRisk
} from '../types'

// ---- Helpers ----
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function now(): string {
  return new Date().toISOString()
}

// ============================================================
// IN-MEMORY FALLBACK STORE (identical to P0 store)
// Used only when D1 is unavailable (local dev without --d1)
// ============================================================
const mem = {
  intents: [] as Intent[],
  sessions: [] as Session[],
  requests: [] as Request[],
  approvalRequests: [] as ApprovalRequest[],
  workItems: [] as WorkItem[],
  proofArtifacts: [] as ProofArtifact[],
  decisionRecords: [] as DecisionRecord[],
  handoffRecords: [] as HandoffRecord[],
  priorityItems: [] as PriorityItem[],
  canonCandidates: [] as CanonCandidate[],
  // P2 additions
  sessionContinuity: [] as SessionContinuity[],
  governanceBoundaries: [] as GovernanceBoundary[],
  operatorNotes: [] as OperatorNote[],
  roleAssignments: [] as RoleAssignment[],
  // P3 additions
  executionEntries: [] as ExecutionEntry[],
  connectors: [] as Connector[],
  _seeded: false
}

function ensureSeeded() {
  if (mem._seeded) return
  mem._seeded = true
  const ts = now()

  mem.intents.push({
    id: 'int-001', title: 'Build P0 Control Core',
    objective: 'Establish the governed operating platform control core.',
    strategic_context: 'Platform must support intent → intake → orchestration → approval → execution → proof → live state → canon.',
    urgency: 'high', scope_notes: 'P0 only.', escalation_notes: 'Founder approval required for canon promotion.',
    created_by: 'Founder', created_at: ts, updated_at: ts
  })

  mem.sessions.push({
    id: 'ses-001', intent_id: 'int-001', title: 'P1 Hardening — Session 1',
    status: 'active',
    session_brief: 'Harden P0 Control Core: persistence + auth.',
    bounded_brief: 'Scope: D1 persistence, API key auth, route integrity. No new surfaces.',
    scope_in: ['Dashboard', 'Intent desk', 'Session intake', 'Architect workbench', 'Approval queue', 'Proof center', 'Live priority board', 'Records & decision log'],
    scope_out: ['Execution board', 'Connector hub', 'Product lane surfaces'],
    acceptance_criteria: ['All P0 routes work', 'Persistence improved', 'Auth gate functional'],
    next_locked_move: 'Deploy to Cloudflare Pages with D1 binding',
    source_of_truth_refs: ['svereign.os.pltfr.1.1.1', 'svereign.os.hub.1.1.w.wp'],
    active_constraints: ['No role collapse', 'No false verification', 'No secret exposure'],
    created_at: ts, closed_at: null
  })

  mem.requests.push({
    id: 'req-001', intent_id: 'int-001', session_id: 'ses-001',
    request_title: 'P1 Hardening: persistence + auth',
    request_type: 'hardening', lane: 'governance', urgency: 'high',
    requester: 'Master Architect',
    context_summary: 'Replace in-memory store with D1. Add API key auth. Preserve all P0 surfaces.',
    source_refs: ['svereign.os.hub.1.1.w.wp.0.1.1'],
    readiness_status: 'ready', decision: 'proceed', created_at: ts, updated_at: ts
  })

  mem.approvalRequests.push({
    id: 'apr-001', request_id: 'req-001',
    action_type: 'Promote P0 → P1 Hardened Build',
    approval_tier: 2, risk_summary: 'Medium risk: schema migration, auth introduction.',
    payload_summary: 'Deploy P1 hardened platform with D1 persistence and API key auth gate.',
    requested_by: 'Master Architect', approved_by: null, status: 'pending',
    decision_reason: '', timestamp: ts, resolved_at: null
  })

  mem.workItems.push({
    id: 'wi-001', request_id: 'req-001', session_id: 'ses-001',
    title: 'P1 Hardening Implementation', description: 'D1 persistence + API key auth + route verification.',
    assigned_to: 'AI Developer', status: 'in-progress',
    bounded_scope: 'P1 hardening only.', created_at: ts, updated_at: ts
  })

  mem.decisionRecords.push({
    id: 'dec-001', session_id: 'ses-001', request_id: null,
    decision_type: 'intent',
    summary: 'Platform direction locked as Sovereign OS Platform — governed operating platform.',
    decided_by: 'Founder', outcome: 'ACCEPTED — Build P0, then P1 hardening.',
    proof_refs: ['svereign.os.pltfr.1.1.1'], canon_candidate_flag: true,
    change_log: 'Initial platform definition finalized. P1 hardening initiated.', created_at: ts
  })

  mem.handoffRecords.push({
    id: 'hof-001', session_id: 'ses-001', from_role: 'Founder', to_role: 'Master Architect',
    handoff_context: 'P0 complete. Proceed to P1. No scope expansion.',
    open_items: ['Wire D1 persistence', 'Add API key auth', 'Verify routes', 'Update docs'],
    decision_refs: ['dec-001'], created_at: ts
  })

  const cats: Array<[string, string, PriorityItem['category'], boolean]> = [
    ['pri-001', 'Wire D1 persistence for all 10 data objects', 'NOW', true],
    ['pri-002', 'Add API key auth middleware', 'NOW', true],
    ['pri-003', 'Verify all P0 routes after hardening', 'NOW', true],
    ['pri-004', 'Deploy to Cloudflare Pages', 'NEXT', false],
    ['pri-005', 'Execution Board (P2)', 'LATER', false],
    ['pri-006', 'Connector Hub (P2)', 'LATER', false],
    ['pri-007', 'Real-time updates (P2)', 'NOT_NOW', false],
    ['pri-008', 'Role-specific workspaces (P2)', 'NOT_NOW', false],
  ]
  for (const [id, title, category, session_target] of cats) {
    mem.priorityItems.push({ id, title, category, session_target, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: ts, updated_at: ts })
  }

  mem.canonCandidates.push({
    id: 'can-001', title: 'Sovereign OS Platform — Operating Law',
    content_ref: 'Founder → L1 → L2 → L3 → Proof → Review → Live State → Canon',
    proposed_by: 'Founder', status: 'candidate',
    review_notes: 'Awaiting Founder ratification. Must not auto-promote.',
    approved_by: null, promoted_at: null, created_at: ts
  })

  // P2: Seed governance boundaries
  const boundaries: Array<[string, string, string, string]> = [
    ['gb-001', 'governance_vs_product',
     'Governance lane must not be mixed with product lane execution.',
     'architect'],
    ['gb-002', 'approval_gate',
     'All Tier 2+ actions must pass through approval_requests before execution.',
     'orchestrator'],
    ['gb-003', 'proof_before_status',
     'No status may be promoted to VERIFIED or canon without documented proof + reviewer.',
     'reviewer'],
    ['gb-004', 'role_separation',
     'Founder, Architect, Orchestrator, Executor, Reviewer roles must not collapse.',
     'architect'],
  ]
  for (const [id, name, desc, owner] of boundaries) {
    mem.governanceBoundaries.push({
      id, boundary_name: name, description: desc,
      status: 'active', owner_role: owner, last_reviewed: null, created_at: ts
    })
  }

  // P3: Seed execution entries
  mem.executionEntries.push({
    id: 'exec-001', work_item_id: 'wi-001', session_id: 'ses-001',
    title: 'P1-P2.5 Hardening Execution',
    executor: 'AI Developer', status: 'done', priority: 'critical',
    context_notes: 'Full platform hardening from P0 baseline through P2.5 production deploy.',
    proof_id: null, started_at: ts, completed_at: ts, blocked_reason: '',
    created_at: ts, updated_at: ts
  })
  mem.executionEntries.push({
    id: 'exec-002', work_item_id: 'wi-001', session_id: 'ses-001',
    title: 'P3 Operational Expansion — Execution Board + Connector Hub',
    executor: 'AI Developer', status: 'running', priority: 'high',
    context_notes: 'P3: Execution Board, Connector Hub, role registry visibility, dashboard update.',
    proof_id: null, started_at: ts, completed_at: null, blocked_reason: '',
    created_at: ts, updated_at: ts
  })

  // P3: Seed platform connectors
  const connDefs: Array<[string, string, Connector['connector_type'], string, string, Connector['status'], Connector['approval_status'], string, Connector['risk_level'], Connector['lane'], string]> = [
    ['conn-001', 'cloudflare-d1-persistence', 'api',
     'Cloudflare D1 SQLite database — primary persistence layer.',
     'Cloudflare Workers D1 binding (DB)', 'active', 'approved', 'Architect', 'low', 'ops',
     'Core infrastructure connector.'],
    ['conn-002', 'cloudflare-pages-deploy', 'api',
     'Cloudflare Pages deployment pipeline.',
     'wrangler pages deploy', 'active', 'approved', 'Founder', 'medium', 'ops',
     'Deploy via wrangler.'],
    ['conn-003', 'github-repo-push', 'api',
     'GitHub repository — canonical source of truth.',
     'github.com/ganihypha/Sovereign-os-platform', 'active', 'approved', 'Founder', 'medium', 'governance',
     'Main branch is production source of truth.'],
    ['conn-004', 'platform-api-auth', 'api',
     'Platform API Key authentication layer.',
     '/api/* Authorization: Bearer token', 'active', 'approved', 'Architect', 'high', 'governance',
     'SHA-256 Bearer token gate.'],
  ]
  for (const [id, name, type, desc, hint, status, appr, approvedBy, risk, lane, notes] of connDefs) {
    mem.connectors.push({
      id, name, connector_type: type, description: desc, endpoint_hint: hint,
      status, approval_status: appr, approved_by: approvedBy,
      risk_level: risk, lane, last_event_at: ts, event_count: 1,
      owner_role: 'architect', notes,
      created_at: ts, updated_at: ts
    })
  }

  // P4: Seed product lanes
  mem.productLanes.push(
    { id: 'lane-001', name: 'Sovereign OS Platform Core', lane_type: 'governance-core',
      description: 'The platform governance core.', repo_link: 'https://github.com/ganihypha/Sovereign-os-platform',
      owner: 'Founder', owner_role: 'founder', governance_tier: 3, status: 'active',
      approval_status: 'approved', approved_by: 'Founder', notes: 'Root governance lane.',
      created_at: ts, updated_at: ts },
    { id: 'lane-002', name: 'BarberKas', lane_type: 'product-vertical',
      description: 'Barber shop management product lane.', repo_link: '',
      owner: 'Architect', owner_role: 'architect', governance_tier: 2, status: 'active',
      approval_status: 'approved', approved_by: 'Architect', notes: 'Example product vertical.',
      created_at: ts, updated_at: ts }
  )

  // P4: Seed alerts
  mem.platformAlerts.push(
    { id: 'alert-001', alert_type: 'canon_candidate_ready', title: 'Canon Candidate Awaiting Review',
      message: 'Canon candidate "Sovereign OS Platform — Operating Law" is awaiting review.',
      severity: 'info', object_type: 'canon_candidates', object_id: 'can-001',
      acknowledged: false, acknowledged_by: null, acknowledged_at: null, created_at: ts }
  )

  // P2: Seed initial continuity snapshot
  mem.sessionContinuity.push({
    id: 'cont-001',
    session_id: 'ses-001',
    snapshot_type: 'handoff',
    platform_state: {
      intents: 1, sessions: 1, requests: 1, approval_requests: 1,
      work_items: 1, proof_artifacts: 0, decision_records: 1,
      handoff_records: 1, priority_items: 8, canon_candidates: 1,
      pending_approvals: 1, pending_proofs: 0, active_blockers: 0,
    },
    open_items: [
      'Deploy to Cloudflare Pages with D1 binding',
      'Wire PLATFORM_API_KEY secret for production auth',
      'Apply P2 schema migration on production D1',
    ],
    pending_approvals: ['apr-001'],
    pending_proofs: [],
    next_locked_move: 'P2 bounded maturity implementation: role-awareness, continuity, governance boundary, operator notes',
    authored_by: 'Master Architect',
    governance_notes: 'P1 Hardened Control Core delivered. 8 surfaces operational. D1 persistence path wired. Auth gate functional. Proceeding to P2.',
    created_at: ts
  })
}

// ============================================================
// D1 HELPERS — JSON column encode/decode
// ============================================================
function jsonEncode(v: unknown): string {
  return JSON.stringify(v ?? [])
}
function jsonDecode<T = unknown>(v: string | null | undefined): T {
  try { return JSON.parse(v ?? '[]') } catch { return [] as unknown as T }
}
function bool(v: number | null | undefined): boolean {
  return v === 1
}
function boolInt(v: boolean | null | undefined): number {
  return v ? 1 : 0
}

// ---- Row mappers ----
function rowToIntent(r: Record<string, unknown>): Intent {
  return {
    id: String(r.id), title: String(r.title), objective: String(r.objective ?? ''),
    strategic_context: String(r.strategic_context ?? ''), urgency: r.urgency as Intent['urgency'],
    scope_notes: String(r.scope_notes ?? ''), escalation_notes: String(r.escalation_notes ?? ''),
    created_by: String(r.created_by ?? ''), created_at: String(r.created_at), updated_at: String(r.updated_at)
  }
}
function rowToSession(r: Record<string, unknown>): Session {
  return {
    id: String(r.id), intent_id: r.intent_id ? String(r.intent_id) : null,
    title: String(r.title), status: r.status as Session['status'],
    session_brief: String(r.session_brief ?? ''), bounded_brief: String(r.bounded_brief ?? ''),
    scope_in: jsonDecode<string[]>(r.scope_in as string),
    scope_out: jsonDecode<string[]>(r.scope_out as string),
    acceptance_criteria: jsonDecode<string[]>(r.acceptance_criteria as string),
    next_locked_move: String(r.next_locked_move ?? ''),
    source_of_truth_refs: jsonDecode<string[]>(r.source_of_truth_refs as string),
    active_constraints: jsonDecode<string[]>(r.active_constraints as string),
    created_at: String(r.created_at), closed_at: r.closed_at ? String(r.closed_at) : null
  }
}
function rowToRequest(r: Record<string, unknown>): Request {
  return {
    id: String(r.id), intent_id: r.intent_id ? String(r.intent_id) : null,
    session_id: r.session_id ? String(r.session_id) : null,
    request_title: String(r.request_title), request_type: r.request_type as Request['request_type'],
    lane: r.lane as Request['lane'], urgency: r.urgency as Request['urgency'],
    requester: String(r.requester ?? ''), context_summary: String(r.context_summary ?? ''),
    source_refs: jsonDecode<string[]>(r.source_refs as string),
    readiness_status: r.readiness_status as Request['readiness_status'],
    decision: r.decision as Request['decision'],
    created_at: String(r.created_at), updated_at: String(r.updated_at)
  }
}
function rowToApproval(r: Record<string, unknown>): ApprovalRequest {
  return {
    id: String(r.id), request_id: String(r.request_id), action_type: String(r.action_type),
    approval_tier: Number(r.approval_tier) as ApprovalRequest['approval_tier'],
    risk_summary: String(r.risk_summary ?? ''), payload_summary: String(r.payload_summary ?? ''),
    requested_by: String(r.requested_by ?? ''), approved_by: r.approved_by ? String(r.approved_by) : null,
    status: r.status as ApprovalRequest['status'], decision_reason: String(r.decision_reason ?? ''),
    timestamp: String(r.timestamp), resolved_at: r.resolved_at ? String(r.resolved_at) : null
  }
}
function rowToWorkItem(r: Record<string, unknown>): WorkItem {
  return {
    id: String(r.id), request_id: String(r.request_id), session_id: r.session_id ? String(r.session_id) : null,
    title: String(r.title), description: String(r.description ?? ''),
    assigned_to: String(r.assigned_to ?? ''), status: r.status as WorkItem['status'],
    bounded_scope: String(r.bounded_scope ?? ''),
    created_at: String(r.created_at), updated_at: String(r.updated_at)
  }
}
function rowToProof(r: Record<string, unknown>): ProofArtifact {
  return {
    id: String(r.id), work_item_id: String(r.work_item_id),
    proof_type: r.proof_type as ProofArtifact['proof_type'],
    evidence_link: String(r.evidence_link ?? ''), verification_notes: String(r.verification_notes ?? ''),
    outcome_classification: r.outcome_classification as ProofArtifact['outcome_classification'],
    reviewer: String(r.reviewer ?? ''), status: r.status as ProofArtifact['status'],
    created_at: String(r.created_at), reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null
  }
}
function rowToDecision(r: Record<string, unknown>): DecisionRecord {
  return {
    id: String(r.id), session_id: r.session_id ? String(r.session_id) : null,
    request_id: r.request_id ? String(r.request_id) : null,
    decision_type: r.decision_type as DecisionRecord['decision_type'],
    summary: String(r.summary ?? ''), decided_by: String(r.decided_by ?? ''),
    outcome: String(r.outcome ?? ''), proof_refs: jsonDecode<string[]>(r.proof_refs as string),
    canon_candidate_flag: bool(r.canon_candidate_flag as number),
    change_log: String(r.change_log ?? ''), created_at: String(r.created_at)
  }
}
function rowToHandoff(r: Record<string, unknown>): HandoffRecord {
  return {
    id: String(r.id), session_id: r.session_id ? String(r.session_id) : null,
    from_role: String(r.from_role ?? ''), to_role: String(r.to_role ?? ''),
    handoff_context: String(r.handoff_context ?? ''),
    open_items: jsonDecode<string[]>(r.open_items as string),
    decision_refs: jsonDecode<string[]>(r.decision_refs as string),
    created_at: String(r.created_at)
  }
}
function rowToPriority(r: Record<string, unknown>): PriorityItem {
  return {
    id: String(r.id), title: String(r.title),
    category: r.category as PriorityItem['category'],
    session_target: bool(r.session_target as number),
    blocker: bool(r.blocker as number), blocker_description: String(r.blocker_description ?? ''),
    resolved: bool(r.resolved as number), resolved_at: r.resolved_at ? String(r.resolved_at) : null,
    created_at: String(r.created_at), updated_at: String(r.updated_at)
  }
}
function rowToCanon(r: Record<string, unknown>): CanonCandidate {
  return {
    id: String(r.id), title: String(r.title), content_ref: String(r.content_ref ?? ''),
    proposed_by: String(r.proposed_by ?? ''), status: r.status as CanonCandidate['status'],
    review_notes: String(r.review_notes ?? ''), approved_by: r.approved_by ? String(r.approved_by) : null,
    promoted_at: r.promoted_at ? String(r.promoted_at) : null, created_at: String(r.created_at)
  }
}

// ---- P2 row mappers ----
function rowToSessionContinuity(r: Record<string, unknown>): SessionContinuity {
  return {
    id: String(r.id), session_id: String(r.session_id),
    snapshot_type: r.snapshot_type as ContinuitySnapshotType,
    platform_state: jsonDecode<Record<string, number>>(r.platform_state as string),
    open_items: jsonDecode<string[]>(r.open_items as string),
    pending_approvals: jsonDecode<string[]>(r.pending_approvals as string),
    pending_proofs: jsonDecode<string[]>(r.pending_proofs as string),
    next_locked_move: String(r.next_locked_move ?? ''),
    authored_by: String(r.authored_by ?? ''),
    governance_notes: String(r.governance_notes ?? ''),
    created_at: String(r.created_at)
  }
}
function rowToGovernanceBoundary(r: Record<string, unknown>): GovernanceBoundary {
  return {
    id: String(r.id), boundary_name: String(r.boundary_name),
    description: String(r.description ?? ''),
    status: r.status as GovernanceBoundary['status'],
    owner_role: String(r.owner_role ?? ''),
    last_reviewed: r.last_reviewed ? String(r.last_reviewed) : null,
    created_at: String(r.created_at)
  }
}
function rowToOperatorNote(r: Record<string, unknown>): OperatorNote {
  return {
    id: String(r.id), object_type: String(r.object_type ?? ''),
    object_id: String(r.object_id ?? ''),
    note_type: r.note_type as NoteType,
    content: String(r.content ?? ''),
    authored_by: String(r.authored_by ?? ''),
    resolved: bool(r.resolved as number),
    resolved_at: r.resolved_at ? String(r.resolved_at) : null,
    created_at: String(r.created_at)
  }
}
function rowToRoleAssignment(r: Record<string, unknown>): RoleAssignment {
  return {
    id: String(r.id), role: r.role as PlatformRole,
    label: String(r.label ?? ''), key_hash: String(r.key_hash ?? ''),
    active: bool(r.active as number),
    permissions: jsonDecode<string[]>(r.permissions as string),
    created_at: String(r.created_at),
    last_used_at: r.last_used_at ? String(r.last_used_at) : null
  }
}

// ---- P3 row mappers ----
function rowToExecutionEntry(r: Record<string, unknown>): ExecutionEntry {
  return {
    id: String(r.id),
    work_item_id: String(r.work_item_id ?? ''),
    session_id: r.session_id ? String(r.session_id) : null,
    title: String(r.title ?? ''),
    executor: String(r.executor ?? ''),
    status: r.status as ExecutionStatus,
    priority: r.priority as ExecutionPriority,
    context_notes: String(r.context_notes ?? ''),
    proof_id: r.proof_id ? String(r.proof_id) : null,
    started_at: r.started_at ? String(r.started_at) : null,
    completed_at: r.completed_at ? String(r.completed_at) : null,
    blocked_reason: String(r.blocked_reason ?? ''),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  }
}
function rowToConnector(r: Record<string, unknown>): Connector {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    connector_type: r.connector_type as ConnectorType,
    description: String(r.description ?? ''),
    endpoint_hint: String(r.endpoint_hint ?? ''),
    status: r.status as ConnectorStatus,
    approval_status: r.approval_status as ConnectorApproval,
    approved_by: r.approved_by ? String(r.approved_by) : null,
    risk_level: r.risk_level as ConnectorRisk,
    lane: r.lane as import('../types').Lane,
    last_event_at: r.last_event_at ? String(r.last_event_at) : null,
    event_count: Number(r.event_count ?? 0),
    owner_role: String(r.owner_role ?? ''),
    notes: String(r.notes ?? ''),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  }
}

// ---- P4 row mappers ----
function rowToProductLane(r: Record<string, unknown>): ProductLane {
  return {
    id: String(r.id), name: String(r.name),
    lane_type: r.lane_type as LaneType,
    description: String(r.description ?? ''),
    repo_link: String(r.repo_link ?? ''),
    owner: String(r.owner ?? ''),
    owner_role: String(r.owner_role ?? ''),
    governance_tier: Number(r.governance_tier ?? 2),
    status: r.status as LaneStatus,
    approval_status: r.approval_status as LaneApproval,
    approved_by: r.approved_by ? String(r.approved_by) : null,
    notes: String(r.notes ?? ''),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at)
  }
}
function rowToAlert(r: Record<string, unknown>): PlatformAlert {
  return {
    id: String(r.id),
    alert_type: r.alert_type as AlertType,
    title: String(r.title ?? ''),
    message: String(r.message ?? ''),
    severity: r.severity as AlertSeverity,
    object_type: String(r.object_type ?? ''),
    object_id: String(r.object_id ?? ''),
    acknowledged: bool(r.acknowledged as number),
    acknowledged_by: r.acknowledged_by ? String(r.acknowledged_by) : null,
    acknowledged_at: r.acknowledged_at ? String(r.acknowledged_at) : null,
    created_at: String(r.created_at)
  }
}
function rowToCanonPromotion(r: Record<string, unknown>): CanonPromotion {
  return {
    id: String(r.id),
    canon_candidate_id: String(r.canon_candidate_id ?? ''),
    action: r.action as CanonAction,
    acted_by: String(r.acted_by ?? ''),
    acted_by_role: String(r.acted_by_role ?? ''),
    reason: String(r.reason ?? ''),
    acted_at: String(r.acted_at)
  }
}

// ============================================================
// REPOSITORY FACTORY
// Returns a db object that wraps either D1 or in-memory
// ============================================================
export type DB = D1Database | undefined

export function createRepo(DB: DB) {
  // ---- D1 path ----
  if (DB) return createD1Repo(DB)

  // ---- In-memory fallback ----
  ensureSeeded()
  return createMemRepo()
}

// ============================================================
// D1 REPOSITORY
// ============================================================
function createD1Repo(DB: D1Database) {
  return {
    isPersistent: true as const,

    // ---- Intents ----
    async getIntents(): Promise<Intent[]> {
      const { results } = await DB.prepare('SELECT * FROM intents ORDER BY created_at DESC').all()
      return results.map(r => rowToIntent(r as Record<string, unknown>))
    },
    async getIntent(id: string): Promise<Intent | undefined> {
      const r = await DB.prepare('SELECT * FROM intents WHERE id = ?').bind(id).first()
      return r ? rowToIntent(r as Record<string, unknown>) : undefined
    },
    async createIntent(data: Omit<Intent, 'id' | 'created_at' | 'updated_at'>): Promise<Intent> {
      const item = { ...data, id: 'int-' + uid(), created_at: now(), updated_at: now() } as Intent
      await DB.prepare('INSERT INTO intents (id,title,objective,strategic_context,urgency,scope_notes,escalation_notes,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.title, item.objective, item.strategic_context, item.urgency, item.scope_notes, item.escalation_notes, item.created_by, item.created_at, item.updated_at)
        .run()
      return item
    },

    // ---- Sessions ----
    async getSessions(): Promise<Session[]> {
      const { results } = await DB.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all()
      return results.map(r => rowToSession(r as Record<string, unknown>))
    },
    async getSession(id: string): Promise<Session | undefined> {
      const r = await DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first()
      return r ? rowToSession(r as Record<string, unknown>) : undefined
    },
    async createSession(data: Omit<Session, 'id' | 'created_at'>): Promise<Session> {
      const item = { ...data, id: 'ses-' + uid(), created_at: now() } as Session
      await DB.prepare('INSERT INTO sessions (id,intent_id,title,status,session_brief,bounded_brief,scope_in,scope_out,acceptance_criteria,next_locked_move,source_of_truth_refs,active_constraints,created_at,closed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.intent_id, item.title, item.status, item.session_brief, item.bounded_brief, jsonEncode(item.scope_in), jsonEncode(item.scope_out), jsonEncode(item.acceptance_criteria), item.next_locked_move, jsonEncode(item.source_of_truth_refs), jsonEncode(item.active_constraints), item.created_at, item.closed_at)
        .run()
      return item
    },

    // ---- Requests ----
    async getRequests(): Promise<Request[]> {
      const { results } = await DB.prepare('SELECT * FROM requests ORDER BY created_at DESC').all()
      return results.map(r => rowToRequest(r as Record<string, unknown>))
    },
    async getRequest(id: string): Promise<Request | undefined> {
      const r = await DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first()
      return r ? rowToRequest(r as Record<string, unknown>) : undefined
    },
    async createRequest(data: Omit<Request, 'id' | 'created_at' | 'updated_at'>): Promise<Request> {
      const item = { ...data, id: 'req-' + uid(), created_at: now(), updated_at: now() } as Request
      await DB.prepare('INSERT INTO requests (id,intent_id,session_id,request_title,request_type,lane,urgency,requester,context_summary,source_refs,readiness_status,decision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.intent_id, item.session_id, item.request_title, item.request_type, item.lane, item.urgency, item.requester, item.context_summary, jsonEncode(item.source_refs), item.readiness_status, item.decision, item.created_at, item.updated_at)
        .run()
      return item
    },

    // ---- Approval Requests ----
    async getApprovalRequests(): Promise<ApprovalRequest[]> {
      const { results } = await DB.prepare('SELECT * FROM approval_requests ORDER BY timestamp DESC').all()
      return results.map(r => rowToApproval(r as Record<string, unknown>))
    },
    async getApprovalRequest(id: string): Promise<ApprovalRequest | undefined> {
      const r = await DB.prepare('SELECT * FROM approval_requests WHERE id = ?').bind(id).first()
      return r ? rowToApproval(r as Record<string, unknown>) : undefined
    },
    async createApprovalRequest(data: Omit<ApprovalRequest, 'id' | 'timestamp'>): Promise<ApprovalRequest> {
      const item = { ...data, id: 'apr-' + uid(), timestamp: now() } as ApprovalRequest
      await DB.prepare('INSERT INTO approval_requests (id,request_id,action_type,approval_tier,risk_summary,payload_summary,requested_by,approved_by,status,decision_reason,timestamp,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.request_id, item.action_type, item.approval_tier, item.risk_summary, item.payload_summary, item.requested_by, item.approved_by, item.status, item.decision_reason, item.timestamp, item.resolved_at)
        .run()
      return item
    },
    async updateApprovalStatus(id: string, status: ApprovalRequest['status'], approved_by: string, reason: string): Promise<ApprovalRequest | undefined> {
      const ts = now()
      await DB.prepare('UPDATE approval_requests SET status=?,approved_by=?,decision_reason=?,resolved_at=? WHERE id=?')
        .bind(status, approved_by, reason, ts, id).run()
      return this.getApprovalRequest(id)
    },

    // ---- Work Items ----
    async getWorkItems(): Promise<WorkItem[]> {
      const { results } = await DB.prepare('SELECT * FROM work_items ORDER BY created_at DESC').all()
      return results.map(r => rowToWorkItem(r as Record<string, unknown>))
    },
    async createWorkItem(data: Omit<WorkItem, 'id' | 'created_at' | 'updated_at'>): Promise<WorkItem> {
      const item = { ...data, id: 'wi-' + uid(), created_at: now(), updated_at: now() } as WorkItem
      await DB.prepare('INSERT INTO work_items (id,request_id,session_id,title,description,assigned_to,status,bounded_scope,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.request_id, item.session_id, item.title, item.description, item.assigned_to, item.status, item.bounded_scope, item.created_at, item.updated_at)
        .run()
      return item
    },

    // ---- Proof Artifacts ----
    async getProofArtifacts(): Promise<ProofArtifact[]> {
      const { results } = await DB.prepare('SELECT * FROM proof_artifacts ORDER BY created_at DESC').all()
      return results.map(r => rowToProof(r as Record<string, unknown>))
    },
    async createProofArtifact(data: Omit<ProofArtifact, 'id' | 'created_at'>): Promise<ProofArtifact> {
      const item = { ...data, id: 'prf-' + uid(), created_at: now() } as ProofArtifact
      await DB.prepare('INSERT INTO proof_artifacts (id,work_item_id,proof_type,evidence_link,verification_notes,outcome_classification,reviewer,status,created_at,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.work_item_id, item.proof_type, item.evidence_link, item.verification_notes, item.outcome_classification, item.reviewer, item.status, item.created_at, item.reviewed_at)
        .run()
      return item
    },
    async updateProofArtifact(id: string, updates: Partial<ProofArtifact>): Promise<ProofArtifact | undefined> {
      const existing = await this.getProofArtifacts()
      const item = existing.find(p => p.id === id)
      if (!item) return undefined
      const merged = { ...item, ...updates }
      await DB.prepare('UPDATE proof_artifacts SET proof_type=?,evidence_link=?,verification_notes=?,outcome_classification=?,reviewer=?,status=?,reviewed_at=? WHERE id=?')
        .bind(merged.proof_type, merged.evidence_link, merged.verification_notes, merged.outcome_classification, merged.reviewer, merged.status, merged.reviewed_at, id)
        .run()
      return merged
    },

    // ---- Decision Records ----
    async getDecisionRecords(): Promise<DecisionRecord[]> {
      const { results } = await DB.prepare('SELECT * FROM decision_records ORDER BY created_at DESC').all()
      return results.map(r => rowToDecision(r as Record<string, unknown>))
    },
    async createDecisionRecord(data: Omit<DecisionRecord, 'id' | 'created_at'>): Promise<DecisionRecord> {
      const item = { ...data, id: 'dec-' + uid(), created_at: now() } as DecisionRecord
      await DB.prepare('INSERT INTO decision_records (id,session_id,request_id,decision_type,summary,decided_by,outcome,proof_refs,canon_candidate_flag,change_log,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.session_id, item.request_id, item.decision_type, item.summary, item.decided_by, item.outcome, jsonEncode(item.proof_refs), boolInt(item.canon_candidate_flag), item.change_log, item.created_at)
        .run()
      return item
    },

    // ---- Handoff Records ----
    async getHandoffRecords(): Promise<HandoffRecord[]> {
      const { results } = await DB.prepare('SELECT * FROM handoff_records ORDER BY created_at DESC').all()
      return results.map(r => rowToHandoff(r as Record<string, unknown>))
    },
    async createHandoffRecord(data: Omit<HandoffRecord, 'id' | 'created_at'>): Promise<HandoffRecord> {
      const item = { ...data, id: 'hof-' + uid(), created_at: now() } as HandoffRecord
      await DB.prepare('INSERT INTO handoff_records (id,session_id,from_role,to_role,handoff_context,open_items,decision_refs,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(item.id, item.session_id, item.from_role, item.to_role, item.handoff_context, jsonEncode(item.open_items), jsonEncode(item.decision_refs), item.created_at)
        .run()
      return item
    },

    // ---- Priority Items ----
    async getPriorityItems(): Promise<PriorityItem[]> {
      const { results } = await DB.prepare('SELECT * FROM priority_items ORDER BY created_at ASC').all()
      return results.map(r => rowToPriority(r as Record<string, unknown>))
    },
    async createPriorityItem(data: Omit<PriorityItem, 'id' | 'created_at' | 'updated_at'>): Promise<PriorityItem> {
      const item = { ...data, id: 'pri-' + uid(), created_at: now(), updated_at: now() } as PriorityItem
      await DB.prepare('INSERT INTO priority_items (id,title,category,session_target,blocker,blocker_description,resolved,resolved_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.title, item.category, boolInt(item.session_target), boolInt(item.blocker), item.blocker_description, boolInt(item.resolved), item.resolved_at, item.created_at, item.updated_at)
        .run()
      return item
    },
    async updatePriorityItem(id: string, updates: Partial<PriorityItem>): Promise<PriorityItem | undefined> {
      const ts = now()
      const all = await this.getPriorityItems()
      const item = all.find(p => p.id === id)
      if (!item) return undefined
      const merged = { ...item, ...updates, updated_at: ts }
      await DB.prepare('UPDATE priority_items SET title=?,category=?,session_target=?,blocker=?,blocker_description=?,resolved=?,resolved_at=?,updated_at=? WHERE id=?')
        .bind(merged.title, merged.category, boolInt(merged.session_target), boolInt(merged.blocker), merged.blocker_description, boolInt(merged.resolved), merged.resolved_at, merged.updated_at, id)
        .run()
      return merged
    },

    // ---- Canon Candidates ----
    async getCanonCandidates(): Promise<CanonCandidate[]> {
      const { results } = await DB.prepare('SELECT * FROM canon_candidates ORDER BY created_at DESC').all()
      return results.map(r => rowToCanon(r as Record<string, unknown>))
    },
    async createCanonCandidate(data: Omit<CanonCandidate, 'id' | 'created_at'>): Promise<CanonCandidate> {
      const item = { ...data, id: 'can-' + uid(), created_at: now() } as CanonCandidate
      await DB.prepare('INSERT INTO canon_candidates (id,title,content_ref,proposed_by,status,review_notes,approved_by,promoted_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.title, item.content_ref, item.proposed_by, item.status, item.review_notes, item.approved_by, item.promoted_at, item.created_at)
        .run()
      return item
    },
    async updateCanonCandidate(id: string, updates: Partial<CanonCandidate>): Promise<CanonCandidate | undefined> {
      const all = await this.getCanonCandidates()
      const item = all.find(c => c.id === id)
      if (!item) return undefined
      const merged = { ...item, ...updates }
      await DB.prepare('UPDATE canon_candidates SET status=?,review_notes=?,approved_by=?,promoted_at=? WHERE id=?')
        .bind(merged.status, merged.review_notes, merged.approved_by, merged.promoted_at, id)
        .run()
      return merged
    },

    // ---- Audit Log ----
    async logAudit(actor: string, action: string, object_type: string, object_id: string, detail: string, ip: string = ''): Promise<void> {
      await DB.prepare('INSERT INTO audit_log (id,actor,action,object_type,object_id,detail,ip,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind('aud-' + uid(), actor, action, object_type, object_id, detail, ip, now())
        .run()
    },
    async getAuditLog(limit = 50): Promise<Record<string, unknown>[]> {
      const { results } = await DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').bind(limit).all()
      return results as Record<string, unknown>[]
    },

    // ---- API Keys ----
    async getApiKeyByHash(hash: string): Promise<Record<string, unknown> | null> {
      return DB.prepare('SELECT * FROM api_keys WHERE key_hash=? AND active=1').bind(hash).first()
    },
    async createApiKey(label: string, keyHash: string, role: string): Promise<void> {
      await DB.prepare('INSERT INTO api_keys (id,key_hash,label,role,active,created_at) VALUES (?,?,?,?,1,?)')
        .bind('ak-' + uid(), keyHash, label, role, now()).run()
    },
    async touchApiKey(hash: string): Promise<void> {
      await DB.prepare('UPDATE api_keys SET last_used_at=? WHERE key_hash=?').bind(now(), hash).run()
    },

    // ---- P2: Session Continuity ----
    async getSessionContinuity(sessionId?: string): Promise<SessionContinuity[]> {
      const q = sessionId
        ? DB.prepare('SELECT * FROM session_continuity WHERE session_id=? ORDER BY created_at DESC').bind(sessionId)
        : DB.prepare('SELECT * FROM session_continuity ORDER BY created_at DESC')
      const { results } = await q.all()
      return results.map(r => rowToSessionContinuity(r as Record<string, unknown>))
    },
    async createSessionContinuity(data: Omit<SessionContinuity, 'id' | 'created_at'>): Promise<SessionContinuity> {
      const item = { ...data, id: 'cont-' + uid(), created_at: now() } as SessionContinuity
      await DB.prepare('INSERT INTO session_continuity (id,session_id,snapshot_type,platform_state,open_items,pending_approvals,pending_proofs,next_locked_move,authored_by,governance_notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.session_id, item.snapshot_type, jsonEncode(item.platform_state), jsonEncode(item.open_items), jsonEncode(item.pending_approvals), jsonEncode(item.pending_proofs), item.next_locked_move, item.authored_by, item.governance_notes, item.created_at)
        .run()
      return item
    },

    // ---- P2: Governance Boundaries ----
    async getGovernanceBoundaries(): Promise<GovernanceBoundary[]> {
      const { results } = await DB.prepare('SELECT * FROM governance_boundaries ORDER BY created_at ASC').all()
      return results.map(r => rowToGovernanceBoundary(r as Record<string, unknown>))
    },
    async updateGovernanceBoundary(id: string, updates: Partial<GovernanceBoundary>): Promise<GovernanceBoundary | undefined> {
      const all = await this.getGovernanceBoundaries()
      const item = all.find(b => b.id === id)
      if (!item) return undefined
      const merged = { ...item, ...updates }
      await DB.prepare('UPDATE governance_boundaries SET status=?,description=?,last_reviewed=? WHERE id=?')
        .bind(merged.status, merged.description, merged.last_reviewed, id).run()
      return merged
    },

    // ---- P2: Operator Notes ----
    async getOperatorNotes(objectType?: string, objectId?: string): Promise<OperatorNote[]> {
      let q
      if (objectType && objectId) {
        q = DB.prepare('SELECT * FROM operator_notes WHERE object_type=? AND object_id=? ORDER BY created_at DESC').bind(objectType, objectId)
      } else if (objectType) {
        q = DB.prepare('SELECT * FROM operator_notes WHERE object_type=? ORDER BY created_at DESC').bind(objectType)
      } else {
        q = DB.prepare('SELECT * FROM operator_notes ORDER BY created_at DESC LIMIT 100')
      }
      const { results } = await q.all()
      return results.map(r => rowToOperatorNote(r as Record<string, unknown>))
    },
    async createOperatorNote(data: Omit<OperatorNote, 'id' | 'created_at'>): Promise<OperatorNote> {
      const item = { ...data, id: 'note-' + uid(), created_at: now() } as OperatorNote
      await DB.prepare('INSERT INTO operator_notes (id,object_type,object_id,note_type,content,authored_by,resolved,resolved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.object_type, item.object_id, item.note_type, item.content, item.authored_by, boolInt(item.resolved), item.resolved_at, item.created_at)
        .run()
      return item
    },
    async resolveOperatorNote(id: string): Promise<void> {
      await DB.prepare('UPDATE operator_notes SET resolved=1,resolved_at=? WHERE id=?').bind(now(), id).run()
    },

    // ---- P2: Role Assignments ----
    async getRoleAssignments(): Promise<RoleAssignment[]> {
      const { results } = await DB.prepare('SELECT * FROM role_assignments ORDER BY role ASC').all()
      return results.map(r => rowToRoleAssignment(r as Record<string, unknown>))
    },
    async getRoleByKeyHash(hash: string): Promise<RoleAssignment | null> {
      const r = await DB.prepare('SELECT * FROM role_assignments WHERE key_hash=? AND active=1').bind(hash).first()
      return r ? rowToRoleAssignment(r as Record<string, unknown>) : null
    },
    async createRoleAssignment(data: Omit<RoleAssignment, 'id' | 'created_at'>): Promise<RoleAssignment> {
      const item = { ...data, id: 'role-' + uid(), created_at: now() } as RoleAssignment
      await DB.prepare('INSERT INTO role_assignments (id,role,label,key_hash,active,permissions,created_at,last_used_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(item.id, item.role, item.label, item.key_hash, boolInt(item.active), jsonEncode(item.permissions), item.created_at, item.last_used_at)
        .run()
      return item
    },
    async touchRoleAssignment(hash: string): Promise<void> {
      await DB.prepare('UPDATE role_assignments SET last_used_at=? WHERE key_hash=?').bind(now(), hash).run()
    },

    // ---- P3: Execution Entries ----
    async getExecutionEntries(sessionId?: string): Promise<ExecutionEntry[]> {
      const q = sessionId
        ? DB.prepare('SELECT * FROM execution_entries WHERE session_id=? ORDER BY created_at DESC').bind(sessionId)
        : DB.prepare('SELECT * FROM execution_entries ORDER BY created_at DESC')
      const { results } = await q.all()
      return results.map(r => rowToExecutionEntry(r as Record<string, unknown>))
    },
    async getExecutionEntry(id: string): Promise<ExecutionEntry | undefined> {
      const r = await DB.prepare('SELECT * FROM execution_entries WHERE id=?').bind(id).first()
      return r ? rowToExecutionEntry(r as Record<string, unknown>) : undefined
    },
    async createExecutionEntry(data: Omit<ExecutionEntry, 'id' | 'created_at' | 'updated_at'>): Promise<ExecutionEntry> {
      const item = { ...data, id: 'exec-' + uid(), created_at: now(), updated_at: now() } as ExecutionEntry
      await DB.prepare('INSERT INTO execution_entries (id,work_item_id,session_id,title,executor,status,priority,context_notes,proof_id,started_at,completed_at,blocked_reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.work_item_id, item.session_id, item.title, item.executor, item.status, item.priority, item.context_notes, item.proof_id, item.started_at, item.completed_at, item.blocked_reason, item.created_at, item.updated_at)
        .run()
      return item
    },
    async updateExecutionEntry(id: string, updates: Partial<ExecutionEntry>): Promise<ExecutionEntry | undefined> {
      const ts = now()
      const all = await this.getExecutionEntries()
      const item = all.find(e => e.id === id)
      if (!item) return undefined
      const merged = { ...item, ...updates, updated_at: ts }
      await DB.prepare('UPDATE execution_entries SET status=?,priority=?,executor=?,context_notes=?,proof_id=?,started_at=?,completed_at=?,blocked_reason=?,updated_at=? WHERE id=?')
        .bind(merged.status, merged.priority, merged.executor, merged.context_notes, merged.proof_id, merged.started_at, merged.completed_at, merged.blocked_reason, merged.updated_at, id)
        .run()
      return merged
    },

    // ---- P3: Connectors ----
    async getConnectors(): Promise<Connector[]> {
      const { results } = await DB.prepare('SELECT * FROM connectors ORDER BY created_at ASC').all()
      return results.map(r => rowToConnector(r as Record<string, unknown>))
    },
    async getConnector(id: string): Promise<Connector | undefined> {
      const r = await DB.prepare('SELECT * FROM connectors WHERE id=?').bind(id).first()
      return r ? rowToConnector(r as Record<string, unknown>) : undefined
    },
    async createConnector(data: Omit<Connector, 'id' | 'created_at' | 'updated_at'>): Promise<Connector> {
      const item = { ...data, id: 'conn-' + uid(), created_at: now(), updated_at: now() } as Connector
      await DB.prepare('INSERT INTO connectors (id,name,connector_type,description,endpoint_hint,status,approval_status,approved_by,risk_level,lane,last_event_at,event_count,owner_role,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.name, item.connector_type, item.description, item.endpoint_hint, item.status, item.approval_status, item.approved_by, item.risk_level, item.lane, item.last_event_at, item.event_count, item.owner_role, item.notes, item.created_at, item.updated_at)
        .run()
      return item
    },
    async updateConnector(id: string, updates: Partial<Connector>): Promise<Connector | undefined> {
      const ts = now()
      const all = await this.getConnectors()
      const item = all.find(c => c.id === id)
      if (!item) return undefined
      const merged = { ...item, ...updates, updated_at: ts }
      await DB.prepare('UPDATE connectors SET status=?,approval_status=?,approved_by=?,risk_level=?,notes=?,last_event_at=?,event_count=?,updated_at=? WHERE id=?')
        .bind(merged.status, merged.approval_status, merged.approved_by, merged.risk_level, merged.notes, merged.last_event_at, merged.event_count, merged.updated_at, id)
        .run()
      return merged
    },

    // ---- P4: Product Lanes ----
    async getProductLanes(): Promise<ProductLane[]> {
      const { results } = await DB.prepare('SELECT * FROM product_lanes ORDER BY created_at ASC').all()
      return results.map(r => rowToProductLane(r as Record<string, unknown>))
    },
    async getProductLane(id: string): Promise<ProductLane | undefined> {
      const r = await DB.prepare('SELECT * FROM product_lanes WHERE id=?').bind(id).first()
      return r ? rowToProductLane(r as Record<string, unknown>) : undefined
    },
    async createProductLane(data: Omit<ProductLane, 'id' | 'created_at' | 'updated_at'>): Promise<ProductLane> {
      const item = { ...data, id: 'lane-' + uid(), created_at: now(), updated_at: now() } as ProductLane
      await DB.prepare('INSERT INTO product_lanes (id,name,lane_type,description,repo_link,owner,owner_role,governance_tier,status,approval_status,approved_by,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.name, item.lane_type, item.description, item.repo_link, item.owner, item.owner_role, item.governance_tier, item.status, item.approval_status, item.approved_by, item.notes, item.created_at, item.updated_at)
        .run()
      return item
    },
    async updateProductLane(id: string, updates: Partial<ProductLane>): Promise<ProductLane | undefined> {
      const ts = now()
      const item = await this.getProductLane(id)
      if (!item) return undefined
      const merged = { ...item, ...updates, updated_at: ts }
      await DB.prepare('UPDATE product_lanes SET status=?,approval_status=?,approved_by=?,notes=?,updated_at=? WHERE id=?')
        .bind(merged.status, merged.approval_status, merged.approved_by, merged.notes, merged.updated_at, id)
        .run()
      return merged
    },

    // ---- P4: Platform Alerts ----
    async getAlerts(onlyUnread?: boolean): Promise<PlatformAlert[]> {
      const sql = onlyUnread
        ? 'SELECT * FROM platform_alerts WHERE acknowledged=0 ORDER BY created_at DESC'
        : 'SELECT * FROM platform_alerts ORDER BY created_at DESC'
      const { results } = await DB.prepare(sql).all()
      return results.map(r => rowToAlert(r as Record<string, unknown>))
    },
    async createAlert(data: Omit<PlatformAlert, 'id' | 'created_at'>): Promise<PlatformAlert> {
      const item = { ...data, id: 'alert-' + uid(), created_at: now() } as PlatformAlert
      await DB.prepare('INSERT INTO platform_alerts (id,alert_type,title,message,severity,object_type,object_id,acknowledged,acknowledged_by,acknowledged_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(item.id, item.alert_type, item.title, item.message, item.severity, item.object_type, item.object_id, boolInt(item.acknowledged), item.acknowledged_by, item.acknowledged_at, item.created_at)
        .run()
      return item
    },
    async acknowledgeAlert(id: string, by: string): Promise<void> {
      await DB.prepare('UPDATE platform_alerts SET acknowledged=1,acknowledged_by=?,acknowledged_at=? WHERE id=?')
        .bind(by, now(), id)
        .run()
    },
    async getUnreadAlertCount(): Promise<number> {
      const r = await DB.prepare('SELECT COUNT(*) as cnt FROM platform_alerts WHERE acknowledged=0').first()
      return Number((r as Record<string, unknown>)?.cnt ?? 0)
    },

    // ---- P4: Canon Promotions ----
    async getCanonPromotions(candidateId?: string): Promise<CanonPromotion[]> {
      const sql = candidateId
        ? 'SELECT * FROM canon_promotions WHERE canon_candidate_id=? ORDER BY acted_at DESC'
        : 'SELECT * FROM canon_promotions ORDER BY acted_at DESC'
      const { results } = candidateId
        ? await DB.prepare(sql).bind(candidateId).all()
        : await DB.prepare(sql).all()
      return results.map(r => rowToCanonPromotion(r as Record<string, unknown>))
    },
    async createCanonPromotion(data: Omit<CanonPromotion, 'id'>): Promise<CanonPromotion> {
      const item = { ...data, id: 'cprom-' + uid() } as CanonPromotion
      await DB.prepare('INSERT INTO canon_promotions (id,canon_candidate_id,action,acted_by,acted_by_role,reason,acted_at) VALUES (?,?,?,?,?,?,?)')
        .bind(item.id, item.canon_candidate_id, item.action, item.acted_by, item.acted_by_role, item.reason, item.acted_at)
        .run()
      return item
    },

    // ---- P4: Reports / Metrics ----
    async getReportMetrics(): Promise<Record<string, number>> {
      const [sessions, approvals, execEntries, connectors, proofs, lanes, alerts, canonItems] = await Promise.all([
        DB.prepare('SELECT COUNT(*) as cnt FROM sessions').first(),
        DB.prepare('SELECT COUNT(*) as cnt FROM approval_requests WHERE status=\'pending\'').first(),
        DB.prepare('SELECT COUNT(*) as cnt FROM execution_entries WHERE status=\'running\'').first(),
        DB.prepare('SELECT COUNT(*) as cnt FROM connectors WHERE status=\'active\'').first(),
        DB.prepare('SELECT COUNT(*) as cnt FROM proof_artifacts WHERE status=\'reviewed\'').first(),
        DB.prepare('SELECT COUNT(*) as cnt FROM product_lanes WHERE status=\'active\'').first(),
        DB.prepare('SELECT COUNT(*) as cnt FROM platform_alerts WHERE acknowledged=0').first(),
        DB.prepare('SELECT COUNT(*) as cnt FROM canon_candidates WHERE status=\'candidate\'').first(),
      ])
      return {
        total_sessions: Number((sessions as Record<string,unknown>)?.cnt ?? 0),
        pending_approvals: Number((approvals as Record<string,unknown>)?.cnt ?? 0),
        running_executions: Number((execEntries as Record<string,unknown>)?.cnt ?? 0),
        active_connectors: Number((connectors as Record<string,unknown>)?.cnt ?? 0),
        verified_proofs: Number((proofs as Record<string,unknown>)?.cnt ?? 0),
        active_lanes: Number((lanes as Record<string,unknown>)?.cnt ?? 0),
        unread_alerts: Number((alerts as Record<string,unknown>)?.cnt ?? 0),
        canon_candidates: Number((canonItems as Record<string,unknown>)?.cnt ?? 0),
      }
    }
  }
}

// ============================================================
// IN-MEMORY REPOSITORY (fallback — same interface as D1)
// ============================================================
function createMemRepo() {
  return {
    isPersistent: false as const,

    async getIntents() { return [...mem.intents] },
    async getIntent(id: string) { return mem.intents.find(i => i.id === id) },
    async createIntent(data: Omit<Intent, 'id' | 'created_at' | 'updated_at'>) {
      const item = { ...data, id: 'int-' + uid(), created_at: now(), updated_at: now() } as Intent
      mem.intents.push(item); return item
    },

    async getSessions() { return [...mem.sessions] },
    async getSession(id: string) { return mem.sessions.find(s => s.id === id) },
    async createSession(data: Omit<Session, 'id' | 'created_at'>) {
      const item = { ...data, id: 'ses-' + uid(), created_at: now() } as Session
      mem.sessions.push(item); return item
    },

    async getRequests() { return [...mem.requests] },
    async getRequest(id: string) { return mem.requests.find(r => r.id === id) },
    async createRequest(data: Omit<Request, 'id' | 'created_at' | 'updated_at'>) {
      const item = { ...data, id: 'req-' + uid(), created_at: now(), updated_at: now() } as Request
      mem.requests.push(item); return item
    },

    async getApprovalRequests() { return [...mem.approvalRequests] },
    async getApprovalRequest(id: string) { return mem.approvalRequests.find(a => a.id === id) },
    async createApprovalRequest(data: Omit<ApprovalRequest, 'id' | 'timestamp'>) {
      const item = { ...data, id: 'apr-' + uid(), timestamp: now() } as ApprovalRequest
      mem.approvalRequests.push(item); return item
    },
    async updateApprovalStatus(id: string, status: ApprovalRequest['status'], approved_by: string, reason: string) {
      const item = mem.approvalRequests.find(a => a.id === id)
      if (item) { item.status = status; item.approved_by = approved_by; item.decision_reason = reason; item.resolved_at = now() }
      return item
    },

    async getWorkItems() { return [...mem.workItems] },
    async createWorkItem(data: Omit<WorkItem, 'id' | 'created_at' | 'updated_at'>) {
      const item = { ...data, id: 'wi-' + uid(), created_at: now(), updated_at: now() } as WorkItem
      mem.workItems.push(item); return item
    },

    async getProofArtifacts() { return [...mem.proofArtifacts] },
    async createProofArtifact(data: Omit<ProofArtifact, 'id' | 'created_at'>) {
      const item = { ...data, id: 'prf-' + uid(), created_at: now() } as ProofArtifact
      mem.proofArtifacts.push(item); return item
    },
    async updateProofArtifact(id: string, updates: Partial<ProofArtifact>) {
      const idx = mem.proofArtifacts.findIndex(p => p.id === id)
      if (idx >= 0) mem.proofArtifacts[idx] = { ...mem.proofArtifacts[idx], ...updates }
      return mem.proofArtifacts[idx]
    },

    async getDecisionRecords() { return [...mem.decisionRecords] },
    async createDecisionRecord(data: Omit<DecisionRecord, 'id' | 'created_at'>) {
      const item = { ...data, id: 'dec-' + uid(), created_at: now() } as DecisionRecord
      mem.decisionRecords.push(item); return item
    },

    async getHandoffRecords() { return [...mem.handoffRecords] },
    async createHandoffRecord(data: Omit<HandoffRecord, 'id' | 'created_at'>) {
      const item = { ...data, id: 'hof-' + uid(), created_at: now() } as HandoffRecord
      mem.handoffRecords.push(item); return item
    },

    async getPriorityItems() { return [...mem.priorityItems] },
    async createPriorityItem(data: Omit<PriorityItem, 'id' | 'created_at' | 'updated_at'>) {
      const item = { ...data, id: 'pri-' + uid(), created_at: now(), updated_at: now() } as PriorityItem
      mem.priorityItems.push(item); return item
    },
    async updatePriorityItem(id: string, updates: Partial<PriorityItem>) {
      const idx = mem.priorityItems.findIndex(p => p.id === id)
      if (idx >= 0) mem.priorityItems[idx] = { ...mem.priorityItems[idx], ...updates, updated_at: now() }
      return mem.priorityItems[idx]
    },

    async getCanonCandidates() { return [...mem.canonCandidates] },
    async createCanonCandidate(data: Omit<CanonCandidate, 'id' | 'created_at'>) {
      const item = { ...data, id: 'can-' + uid(), created_at: now() } as CanonCandidate
      mem.canonCandidates.push(item); return item
    },
    async updateCanonCandidate(id: string, updates: Partial<CanonCandidate>) {
      const idx = mem.canonCandidates.findIndex(c => c.id === id)
      if (idx >= 0) mem.canonCandidates[idx] = { ...mem.canonCandidates[idx], ...updates }
      return mem.canonCandidates[idx]
    },

    async logAudit(_actor: string, _action: string, _object_type: string, _object_id: string, _detail: string, _ip = '') {
      // In-memory: no-op (audit only tracked in D1)
    },
    async getAuditLog(_limit = 50) { return [] as Record<string, unknown>[] },

    async getApiKeyByHash(_hash: string) { return null as Record<string, unknown> | null },
    async createApiKey(_label: string, _keyHash: string, _role: string) {},
    async touchApiKey(_hash: string) {},

    // P2: Session Continuity
    async getSessionContinuity(sessionId?: string) {
      if (sessionId) return mem.sessionContinuity.filter(c => c.session_id === sessionId)
      return [...mem.sessionContinuity]
    },
    async createSessionContinuity(data: Omit<SessionContinuity, 'id' | 'created_at'>) {
      const item = { ...data, id: 'cont-' + uid(), created_at: now() } as SessionContinuity
      mem.sessionContinuity.push(item); return item
    },

    // P2: Governance Boundaries
    async getGovernanceBoundaries() { return [...mem.governanceBoundaries] },
    async updateGovernanceBoundary(id: string, updates: Partial<GovernanceBoundary>) {
      const idx = mem.governanceBoundaries.findIndex(b => b.id === id)
      if (idx >= 0) mem.governanceBoundaries[idx] = { ...mem.governanceBoundaries[idx], ...updates }
      return mem.governanceBoundaries[idx]
    },

    // P2: Operator Notes
    async getOperatorNotes(objectType?: string, objectId?: string) {
      let list = [...mem.operatorNotes]
      if (objectType) list = list.filter(n => n.object_type === objectType)
      if (objectId) list = list.filter(n => n.object_id === objectId)
      return list
    },
    async createOperatorNote(data: Omit<OperatorNote, 'id' | 'created_at'>) {
      const item = { ...data, id: 'note-' + uid(), created_at: now() } as OperatorNote
      mem.operatorNotes.push(item); return item
    },
    async resolveOperatorNote(id: string) {
      const idx = mem.operatorNotes.findIndex(n => n.id === id)
      if (idx >= 0) { mem.operatorNotes[idx].resolved = true; mem.operatorNotes[idx].resolved_at = now() }
    },

    // P2: Role Assignments
    async getRoleAssignments() { return [...mem.roleAssignments] },
    async getRoleByKeyHash(_hash: string) { return null as RoleAssignment | null },
    async createRoleAssignment(data: Omit<RoleAssignment, 'id' | 'created_at'>) {
      const item = { ...data, id: 'role-' + uid(), created_at: now() } as RoleAssignment
      mem.roleAssignments.push(item); return item
    },
    async touchRoleAssignment(_hash: string) {},

    // P3: Execution Entries
    async getExecutionEntries(sessionId?: string) {
      if (sessionId) return mem.executionEntries.filter(e => e.session_id === sessionId)
      return [...mem.executionEntries]
    },
    async getExecutionEntry(id: string) { return mem.executionEntries.find(e => e.id === id) },
    async createExecutionEntry(data: Omit<ExecutionEntry, 'id' | 'created_at' | 'updated_at'>) {
      const item = { ...data, id: 'exec-' + uid(), created_at: now(), updated_at: now() } as ExecutionEntry
      mem.executionEntries.push(item); return item
    },
    async updateExecutionEntry(id: string, updates: Partial<ExecutionEntry>) {
      const idx = mem.executionEntries.findIndex(e => e.id === id)
      if (idx >= 0) mem.executionEntries[idx] = { ...mem.executionEntries[idx], ...updates, updated_at: now() }
      return mem.executionEntries[idx]
    },

    // P3: Connectors
    async getConnectors() { return [...mem.connectors] },
    async getConnector(id: string) { return mem.connectors.find(c => c.id === id) },
    async createConnector(data: Omit<Connector, 'id' | 'created_at' | 'updated_at'>) {
      const item = { ...data, id: 'conn-' + uid(), created_at: now(), updated_at: now() } as Connector
      mem.connectors.push(item); return item
    },
    async updateConnector(id: string, updates: Partial<Connector>) {
      const idx = mem.connectors.findIndex(c => c.id === id)
      if (idx >= 0) mem.connectors[idx] = { ...mem.connectors[idx], ...updates, updated_at: now() }
      return mem.connectors[idx]
    },

    // P4: Product Lanes
    async getProductLanes() { return [...mem.productLanes] },
    async getProductLane(id: string) { return mem.productLanes.find(l => l.id === id) },
    async createProductLane(data: Omit<ProductLane, 'id' | 'created_at' | 'updated_at'>) {
      const item = { ...data, id: 'lane-' + uid(), created_at: now(), updated_at: now() } as ProductLane
      mem.productLanes.push(item); return item
    },
    async updateProductLane(id: string, updates: Partial<ProductLane>) {
      const idx = mem.productLanes.findIndex(l => l.id === id)
      if (idx >= 0) mem.productLanes[idx] = { ...mem.productLanes[idx], ...updates, updated_at: now() }
      return mem.productLanes[idx]
    },

    // P4: Platform Alerts
    async getAlerts(onlyUnread?: boolean) {
      if (onlyUnread) return mem.platformAlerts.filter(a => !a.acknowledged)
      return [...mem.platformAlerts]
    },
    async createAlert(data: Omit<PlatformAlert, 'id' | 'created_at'>) {
      const item = { ...data, id: 'alert-' + uid(), created_at: now() } as PlatformAlert
      mem.platformAlerts.push(item); return item
    },
    async acknowledgeAlert(id: string, by: string) {
      const idx = mem.platformAlerts.findIndex(a => a.id === id)
      if (idx >= 0) { mem.platformAlerts[idx].acknowledged = true; mem.platformAlerts[idx].acknowledged_by = by; mem.platformAlerts[idx].acknowledged_at = now() }
    },
    async getUnreadAlertCount() {
      return mem.platformAlerts.filter(a => !a.acknowledged).length
    },

    // P4: Canon Promotions
    async getCanonPromotions(candidateId?: string) {
      if (candidateId) return mem.canonPromotions.filter(p => p.canon_candidate_id === candidateId)
      return [...mem.canonPromotions]
    },
    async createCanonPromotion(data: Omit<CanonPromotion, 'id'>) {
      const item = { ...data, id: 'cprom-' + uid() } as CanonPromotion
      mem.canonPromotions.push(item); return item
    },

    // P4: Reports
    async getReportMetrics(): Promise<Record<string, number>> {
      return {
        total_sessions: mem.sessions.length,
        pending_approvals: mem.approvalRequests.filter(a => a.status === 'pending').length,
        running_executions: mem.executionEntries.filter(e => e.status === 'running').length,
        active_connectors: mem.connectors.filter(c => c.status === 'active').length,
        verified_proofs: mem.proofArtifacts.filter(p => p.status === 'reviewed').length,
        active_lanes: mem.productLanes.filter(l => l.status === 'active').length,
        unread_alerts: mem.platformAlerts.filter(a => !a.acknowledged).length,
        canon_candidates: mem.canonCandidates.filter(c => c.status === 'candidate').length,
      }
    }
  }
}

export type Repo = ReturnType<typeof createRepo>
