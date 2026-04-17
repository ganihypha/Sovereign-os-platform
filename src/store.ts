// ============================================================
// SOVEREIGN OS PLATFORM — IN-MEMORY DATA STORE (P0)
// Replace with Cloudflare D1 in P1
// ============================================================
import type {
  Intent, Session, Request, ApprovalRequest,
  WorkItem, ProofArtifact, DecisionRecord,
  HandoffRecord, PriorityItem, CanonCandidate
} from './types'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function now(): string {
  return new Date().toISOString()
}

// ---- Seed Data ----

export const store = {
  intents: [
    {
      id: 'int-001',
      title: 'Build P0 Control Core',
      objective: 'Establish the governed operating platform control core: intake, architect workbench, approvals, proof, live board, and records.',
      strategic_context: 'Platform must support intent → intake → orchestration → approval → execution → proof → live state → canon.',
      urgency: 'high',
      scope_notes: 'P0 only. No product lanes, no connector hub, no execution board yet.',
      escalation_notes: 'Founder approval required for any canon promotion.',
      created_by: 'Founder',
      created_at: now(),
      updated_at: now()
    }
  ] as Intent[],

  sessions: [
    {
      id: 'ses-001',
      intent_id: 'int-001',
      title: 'P0 Platform Build — Session 1',
      status: 'active',
      session_brief: 'Build all P0 surface scaffolds: /dashboard, /intent, /intake, /architect, /approvals, /proof, /live, /records.',
      bounded_brief: 'Scope is strictly P0 surfaces. No execution board, no connector hub, no product lane features.',
      scope_in: ['Dashboard', 'Intent desk', 'Session intake', 'Architect workbench', 'Approval queue', 'Proof center', 'Live priority board', 'Records & decision log'],
      scope_out: ['Execution board', 'Connector hub', 'Product lane surfaces', 'External integrations'],
      acceptance_criteria: [
        'All 8 P0 routes respond with working UI',
        'Approval tier logic is visible',
        'Proof flow does not bypass review',
        'Live board shows NOW/NEXT/LATER/HOLD/NOT_NOW',
        'Records layer exists with decision + handoff continuity',
        'No false VERIFIED claims',
        'No secret exposure'
      ],
      next_locked_move: 'Complete UI scaffold for all P0 pages, wire data model, verify each surface',
      source_of_truth_refs: ['Platform Definition Pack v1.1', 'Master Session Prompt Final', 'svereign.os.pltfr.1.1.1'],
      active_constraints: ['No role collapse', 'No false verification', 'No secret exposure', 'No undocumented meaningful activity'],
      created_at: now(),
      closed_at: null
    }
  ] as Session[],

  requests: [
    {
      id: 'req-001',
      intent_id: 'int-001',
      session_id: 'ses-001',
      request_title: 'Scaffold all P0 surfaces',
      request_type: 'feature',
      lane: 'governance',
      urgency: 'high',
      requester: 'Master Architect',
      context_summary: 'Build working scaffold for all 8 P0 routes with correct data wiring.',
      source_refs: ['svereign.os.pltfr.1.1.1'],
      readiness_status: 'ready',
      decision: 'proceed',
      created_at: now(),
      updated_at: now()
    }
  ] as Request[],

  approvalRequests: [
    {
      id: 'apr-001',
      request_id: 'req-001',
      action_type: 'Deploy P0 scaffold to production',
      approval_tier: 1,
      risk_summary: 'First platform deployment. Low risk as no external integrations active.',
      payload_summary: 'Deploy Sovereign OS Platform P0 Control Core to Cloudflare Pages.',
      requested_by: 'Master Architect',
      approved_by: null,
      status: 'pending',
      decision_reason: '',
      timestamp: now(),
      resolved_at: null
    }
  ] as ApprovalRequest[],

  workItems: [
    {
      id: 'wi-001',
      request_id: 'req-001',
      session_id: 'ses-001',
      title: 'Build P0 page scaffolds',
      description: 'Implement all 8 P0 pages with correct fields, actions, and status model.',
      assigned_to: 'AI Developer',
      status: 'in-progress',
      bounded_scope: 'P0 pages only. No P1/P2 features.',
      created_at: now(),
      updated_at: now()
    }
  ] as WorkItem[],

  proofArtifacts: [] as ProofArtifact[],

  decisionRecords: [
    {
      id: 'dec-001',
      session_id: 'ses-001',
      request_id: null,
      decision_type: 'intent',
      summary: 'Platform direction locked as Sovereign OS Platform — governed operating platform.',
      decided_by: 'Founder',
      outcome: 'ACCEPTED — Build P0 Control Core first.',
      proof_refs: ['svereign.os.pltfr.1.1.1'],
      canon_candidate_flag: true,
      change_log: 'Initial platform definition finalized.',
      created_at: now()
    }
  ] as DecisionRecord[],

  handoffRecords: [
    {
      id: 'hof-001',
      session_id: 'ses-001',
      from_role: 'Founder',
      to_role: 'Master Architect',
      handoff_context: 'Platform direction defined. Proceed to P0 build. No architecture debate.',
      open_items: ['Build 8 P0 routes', 'Define data model', 'Verify each surface'],
      decision_refs: ['dec-001'],
      created_at: now()
    }
  ] as HandoffRecord[],

  priorityItems: [
    { id: 'pri-001', title: 'Build /dashboard route', category: 'NOW', session_target: true, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-002', title: 'Build /intake route', category: 'NOW', session_target: true, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-003', title: 'Build /architect route', category: 'NOW', session_target: true, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-004', title: 'Build /approvals route', category: 'NOW', session_target: true, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-005', title: 'Build /proof route', category: 'NOW', session_target: true, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-006', title: 'Build /live route', category: 'NOW', session_target: true, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-007', title: 'Build /records route', category: 'NOW', session_target: true, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-008', title: 'Execution Board', category: 'NEXT', session_target: false, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-009', title: 'Connector Hub', category: 'NEXT', session_target: false, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-010', title: 'Role-specific workspaces (Founder, Operator, Reviewer)', category: 'LATER', session_target: false, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-011', title: 'Product lane surfaces', category: 'NOT_NOW', session_target: false, blocker: false, blocker_description: '', resolved: false, resolved_at: null, created_at: now(), updated_at: now() },
    { id: 'pri-012', title: 'Verify npm/wrangler install completion', category: 'HOLD', session_target: false, blocker: true, blocker_description: 'npm install timed out — sandbox constraint', resolved: false, resolved_at: null, created_at: now(), updated_at: now() }
  ] as PriorityItem[],

  canonCandidates: [
    {
      id: 'can-001',
      title: 'Sovereign OS Platform — Operating Law',
      content_ref: 'Founder → L1 → L2 → L3 → Proof → Review → Live State → Canon',
      proposed_by: 'Founder',
      status: 'candidate',
      review_notes: 'Awaiting Founder ratification before canon promotion.',
      approved_by: null,
      promoted_at: null,
      created_at: now()
    }
  ] as CanonCandidate[]
}

// ---- CRUD Helpers ----

export const db = {
  // Intents
  getIntents: () => store.intents,
  getIntent: (id: string) => store.intents.find(i => i.id === id),
  createIntent: (data: Omit<Intent, 'id' | 'created_at' | 'updated_at'>): Intent => {
    const item = { ...data, id: 'int-' + uid(), created_at: now(), updated_at: now() } as Intent
    store.intents.push(item)
    return item
  },

  // Sessions
  getSessions: () => store.sessions,
  getSession: (id: string) => store.sessions.find(s => s.id === id),
  createSession: (data: Omit<Session, 'id' | 'created_at'>): Session => {
    const item = { ...data, id: 'ses-' + uid(), created_at: now() } as Session
    store.sessions.push(item)
    return item
  },

  // Requests
  getRequests: () => store.requests,
  getRequest: (id: string) => store.requests.find(r => r.id === id),
  createRequest: (data: Omit<Request, 'id' | 'created_at' | 'updated_at'>): Request => {
    const item = { ...data, id: 'req-' + uid(), created_at: now(), updated_at: now() } as Request
    store.requests.push(item)
    return item
  },

  // Approval Requests
  getApprovalRequests: () => store.approvalRequests,
  getApprovalRequest: (id: string) => store.approvalRequests.find(a => a.id === id),
  createApprovalRequest: (data: Omit<ApprovalRequest, 'id' | 'timestamp'>): ApprovalRequest => {
    const item = { ...data, id: 'apr-' + uid(), timestamp: now() } as ApprovalRequest
    store.approvalRequests.push(item)
    return item
  },
  updateApprovalStatus: (id: string, status: ApprovalRequest['status'], approved_by: string, reason: string) => {
    const item = store.approvalRequests.find(a => a.id === id)
    if (item) {
      item.status = status
      item.approved_by = approved_by
      item.decision_reason = reason
      item.resolved_at = now()
    }
    return item
  },

  // Work Items
  getWorkItems: () => store.workItems,
  createWorkItem: (data: Omit<WorkItem, 'id' | 'created_at' | 'updated_at'>): WorkItem => {
    const item = { ...data, id: 'wi-' + uid(), created_at: now(), updated_at: now() } as WorkItem
    store.workItems.push(item)
    return item
  },

  // Proof Artifacts
  getProofArtifacts: () => store.proofArtifacts,
  createProofArtifact: (data: Omit<ProofArtifact, 'id' | 'created_at'>): ProofArtifact => {
    const item = { ...data, id: 'prf-' + uid(), created_at: now() } as ProofArtifact
    store.proofArtifacts.push(item)
    return item
  },

  // Decision Records
  getDecisionRecords: () => store.decisionRecords,
  createDecisionRecord: (data: Omit<DecisionRecord, 'id' | 'created_at'>): DecisionRecord => {
    const item = { ...data, id: 'dec-' + uid(), created_at: now() } as DecisionRecord
    store.decisionRecords.push(item)
    return item
  },

  // Handoff Records
  getHandoffRecords: () => store.handoffRecords,
  createHandoffRecord: (data: Omit<HandoffRecord, 'id' | 'created_at'>): HandoffRecord => {
    const item = { ...data, id: 'hof-' + uid(), created_at: now() } as HandoffRecord
    store.handoffRecords.push(item)
    return item
  },

  // Priority Items
  getPriorityItems: () => store.priorityItems,
  createPriorityItem: (data: Omit<PriorityItem, 'id' | 'created_at' | 'updated_at'>): PriorityItem => {
    const item = { ...data, id: 'pri-' + uid(), created_at: now(), updated_at: now() } as PriorityItem
    store.priorityItems.push(item)
    return item
  },
  updatePriorityItem: (id: string, updates: Partial<PriorityItem>) => {
    const idx = store.priorityItems.findIndex(p => p.id === id)
    if (idx >= 0) store.priorityItems[idx] = { ...store.priorityItems[idx], ...updates, updated_at: now() }
    return store.priorityItems[idx]
  },

  // Canon Candidates
  getCanonCandidates: () => store.canonCandidates,
  createCanonCandidate: (data: Omit<CanonCandidate, 'id' | 'created_at'>): CanonCandidate => {
    const item = { ...data, id: 'can-' + uid(), created_at: now() } as CanonCandidate
    store.canonCandidates.push(item)
    return item
  }
}
