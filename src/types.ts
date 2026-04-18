// ============================================================
// SOVEREIGN OS PLATFORM — DATA MODEL v2.0 (P7)
// Operating Law: Founder → L1 → L2 → L3 → Proof → Review → Live → Canon
// P2 adds: RoleAssignment, SessionContinuity, GovernanceBoundary, OperatorNote
// P4 adds: ProductLane, PlatformAlert, CanonPromotion
// P5 adds: Tenant, WebhookDeliveryLog, AiAssistLog, PublicApiKey, MetricsSnapshot
// P7 adds: AlertDelivery, TenantBranding, SsoConfig
// ============================================================

export type Lane = 'governance' | 'ops' | 'docs' | 'execution' | 'product-lane'
export type Urgency = 'critical' | 'high' | 'normal' | 'low'
export type RequestType = 'feature' | 'bug' | 'hardening' | 'docs' | 'ops' | 'governance' | 'approval-needed'
export type ReadinessStatus = 'ready' | 'blocked' | 'partial' | 'unknown'
export type RequestDecision = 'proceed' | 'hold' | 'blocked' | 'approval-needed'
export type ApprovalTier = 0 | 1 | 2 | 3
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'returned'
export type WorkItemStatus = 'pending' | 'in-progress' | 'done' | 'blocked'
export type ProofOutcome = 'PASS' | 'PARTIAL' | 'FAIL' | 'BLOCKED'
export type ProofType = 'manual' | 'automated' | 'screenshot' | 'log' | 'review'
export type PriorityCategory = 'NOW' | 'NEXT' | 'LATER' | 'HOLD' | 'NOT_NOW'
export type CanonStatus = 'candidate' | 'under-review' | 'promoted' | 'rejected'
export type DecisionType = 'intent' | 'approval' | 'scope' | 'escalation' | 'canon-promotion'

// ---- Core Entities ----

export interface Intent {
  id: string
  title: string
  objective: string
  strategic_context: string
  urgency: Urgency
  scope_notes: string
  escalation_notes: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  intent_id: string | null
  title: string
  status: 'active' | 'paused' | 'closed'
  session_brief: string
  bounded_brief: string
  scope_in: string[]
  scope_out: string[]
  acceptance_criteria: string[]
  next_locked_move: string
  source_of_truth_refs: string[]
  active_constraints: string[]
  created_at: string
  closed_at: string | null
}

export interface Request {
  id: string
  intent_id: string | null
  session_id: string | null
  request_title: string
  request_type: RequestType
  lane: Lane
  urgency: Urgency
  requester: string
  context_summary: string
  source_refs: string[]
  readiness_status: ReadinessStatus
  decision: RequestDecision
  created_at: string
  updated_at: string
}

export interface ApprovalRequest {
  id: string
  request_id: string
  action_type: string
  approval_tier: ApprovalTier
  risk_summary: string
  payload_summary: string
  requested_by: string
  approved_by: string | null
  status: ApprovalStatus
  decision_reason: string
  timestamp: string
  resolved_at: string | null
}

export interface WorkItem {
  id: string
  request_id: string
  session_id: string | null
  title: string
  description: string
  assigned_to: string
  status: WorkItemStatus
  bounded_scope: string
  created_at: string
  updated_at: string
}

export interface ProofArtifact {
  id: string
  work_item_id: string
  proof_type: ProofType
  evidence_link: string
  verification_notes: string
  outcome_classification: ProofOutcome
  reviewer: string
  status: 'pending' | 'reviewed'
  created_at: string
  reviewed_at: string | null
}

export interface DecisionRecord {
  id: string
  session_id: string | null
  request_id: string | null
  decision_type: DecisionType
  summary: string
  decided_by: string
  outcome: string
  proof_refs: string[]
  canon_candidate_flag: boolean
  change_log: string
  created_at: string
}

export interface HandoffRecord {
  id: string
  session_id: string | null
  from_role: string
  to_role: string
  handoff_context: string
  open_items: string[]
  decision_refs: string[]
  created_at: string
}

export interface PriorityItem {
  id: string
  title: string
  category: PriorityCategory
  session_target: boolean
  blocker: boolean
  blocker_description: string
  resolved: boolean
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface CanonCandidate {
  id: string
  title: string
  content_ref: string
  proposed_by: string
  status: CanonStatus
  review_notes: string
  approved_by: string | null
  promoted_at: string | null
  created_at: string
}

// ============================================================
// P2 ADDITIONS — Role-Aware, Continuity, Governance Boundary
// ============================================================

export type PlatformRole = 'founder' | 'architect' | 'orchestrator' | 'executor' | 'reviewer' | 'operator'
export type ContinuitySnapshotType = 'handoff' | 'checkpoint' | 'closeout'
export type BoundaryStatus = 'active' | 'suspended' | 'under_review'
export type NoteType = 'observation' | 'blocker' | 'clarification' | 'reminder'

export interface RoleAssignment {
  id: string
  role: PlatformRole
  label: string
  key_hash: string           // SHA-256 of platform key for this role — never exposed
  active: boolean
  permissions: string[]      // e.g. ['approve_tier2', 'promote_canon', 'create_intent']
  created_at: string
  last_used_at: string | null
}

export interface SessionContinuity {
  id: string
  session_id: string
  snapshot_type: ContinuitySnapshotType
  platform_state: Record<string, number>  // counts snapshot at time of creation
  open_items: string[]
  pending_approvals: string[]   // IDs of pending approval_requests
  pending_proofs: string[]      // IDs of pending proof_artifacts
  next_locked_move: string
  authored_by: string
  governance_notes: string
  created_at: string
}

export interface GovernanceBoundary {
  id: string
  boundary_name: string
  description: string
  status: BoundaryStatus
  owner_role: string
  last_reviewed: string | null
  created_at: string
}

export interface OperatorNote {
  id: string
  object_type: string   // 'intents' | 'sessions' | 'requests' | 'work_items' etc
  object_id: string
  note_type: NoteType
  content: string
  authored_by: string
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

// ============================================================
// P3 ADDITIONS — Execution Board + Connector Hub
// ============================================================

// ============================================================
// P4 ADDITIONS — Lane Directory + Alerts + Canon Promotion
// ============================================================

export type LaneType = 'governance-core' | 'product-vertical' | 'runtime-service' | 'experiment'
export type LaneStatus = 'active' | 'inactive' | 'archived'
export type LaneApproval = 'pending' | 'approved' | 'rejected'
export type AlertType =
  | 'approval_pending'
  | 'proof_submitted'
  | 'connector_error'
  | 'session_stale'
  | 'execution_blocked'
  | 'canon_candidate_ready'
  | 'lane_registered'
  | 'role_assigned'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type CanonAction = 'promote' | 'reject'
export type ReviewStatus = 'candidate' | 'under_review' | 'promoted' | 'rejected'

export interface ProductLane {
  id: string
  name: string
  lane_type: LaneType
  description: string
  repo_link: string
  owner: string
  owner_role: string
  governance_tier: number
  status: LaneStatus
  approval_status: LaneApproval
  approved_by: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface PlatformAlert {
  id: string
  alert_type: AlertType
  title: string
  message: string
  severity: AlertSeverity
  object_type: string
  object_id: string
  acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
  created_at: string
}

export interface CanonPromotion {
  id: string
  canon_candidate_id: string
  action: CanonAction
  acted_by: string
  acted_by_role: string
  reason: string
  acted_at: string
}

export type ExecutionStatus = 'pending' | 'running' | 'blocked' | 'done' | 'cancelled'
export type ExecutionPriority = 'critical' | 'high' | 'normal' | 'low'
export type ConnectorType = 'webhook' | 'api' | 'queue' | 'event' | 'custom'
export type ConnectorStatus = 'registered' | 'active' | 'inactive' | 'deprecated' | 'blocked'
export type ConnectorApproval = 'pending' | 'approved' | 'rejected'
export type ConnectorRisk = 'low' | 'medium' | 'high' | 'critical'

export interface ExecutionEntry {
  id: string
  work_item_id: string
  session_id: string | null
  title: string
  executor: string
  status: ExecutionStatus
  priority: ExecutionPriority
  context_notes: string
  proof_id: string | null
  started_at: string | null
  completed_at: string | null
  blocked_reason: string
  created_at: string
  updated_at: string
}

export interface Connector {
  id: string
  name: string
  connector_type: ConnectorType
  description: string
  endpoint_hint: string   // sanitized — no secrets
  status: ConnectorStatus
  approval_status: ConnectorApproval
  approved_by: string | null
  risk_level: ConnectorRisk
  lane: Lane
  last_event_at: string | null
  event_count: number
  owner_role: string
  notes: string
  tenant_id: string        // P5: tenant isolation
  webhook_url: string      // P5: outbound webhook URL (no auth secrets inline)
  created_at: string
  updated_at: string
}

// ============================================================
// P5 TYPES — Multi-Tenant, Webhook Delivery, AI Assist, Public API
// ============================================================

export type TenantStatus = 'active' | 'suspended' | 'archived'
export type TenantApproval = 'pending' | 'approved' | 'rejected'
export type TenantPlan = 'standard' | 'enterprise'
export type TenantIsolation = 'shared' | 'isolated'
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying'
export type AiAssistType = 'session_brief' | 'scope_suggestion' | 'risk_assessment' | 'review_summary' | 'general'
export type ApiKeyScope = 'readonly' | 'readwrite'

export interface Tenant {
  id: string
  slug: string
  name: string
  description: string
  status: TenantStatus
  approval_status: TenantApproval
  approved_by: string | null
  approval_tier: number
  plan: TenantPlan
  owner_email: string
  owner_name: string
  isolation_mode: TenantIsolation
  notes: string
  created_at: string
  updated_at: string
}

export interface WebhookDeliveryLog {
  id: string
  connector_id: string
  tenant_id: string
  event_type: string
  payload_hash: string       // HMAC-SHA256 hash — never raw payload
  target_url_hint: string    // sanitized — no secrets
  attempt: number
  status: WebhookDeliveryStatus
  http_status: number | null
  response_hint: string
  error_message: string
  delivered_at: string | null
  created_at: string
}

export interface AiAssistLog {
  id: string
  tenant_id: string
  session_id: string | null
  assist_type: AiAssistType
  prompt_hash: string        // SHA-256 of prompt — never raw prompt stored
  model_hint: string
  confidence_tag: string     // ALWAYS 'ai-generated' until human confirmed
  output_summary: string     // First 200 chars for audit
  confirmed_by: string | null
  confirmed_at: string | null
  discarded: boolean
  created_by: string
  created_at: string
}

export interface PublicApiKey {
  id: string
  label: string
  tenant_id: string
  key_hash: string           // SHA-256 hash — raw key never stored after issuance
  role_scope: ApiKeyScope
  rate_limit: number
  active: boolean
  last_used_at: string | null
  request_count: number
  issued_by: string
  notes: string
  created_at: string
}

export interface MetricsSnapshot {
  id: string
  tenant_id: string
  snapshot_type: 'hourly' | 'daily' | 'weekly'
  period_label: string
  total_sessions: number
  active_sessions: number
  pending_approvals: number
  running_executions: number
  active_connectors: number
  verified_proofs: number
  active_lanes: number
  unread_alerts: number
  canon_candidates: number
  snapshot_data?: string  // P7: JSON blob for extended metrics
  created_at: string
}

// ============================================================
// P7 TYPES — Alert Delivery, Tenant Branding, SSO Config
// ============================================================

export type AlertDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'
export type SsoProvider = 'auth0' | 'clerk' | 'none'

// ---- AlertDelivery: Email dispatch record for governance alerts ----
export interface AlertDelivery {
  id: string
  alert_id: string
  tenant_id: string
  recipient_email: string
  delivery_status: AlertDeliveryStatus
  provider: string          // 'resend' | 'sendgrid' | 'mock' | 'none'
  provider_message_id: string
  error_message: string
  sent_at: string | null
  created_at: string
}

// ---- TenantBranding: Per-tenant white-label CSS/brand config ----
export interface TenantBranding {
  id: string
  tenant_id: string
  brand_name: string
  logo_url: string
  primary_color: string
  secondary_color: string
  accent_color: string
  text_color: string
  bg_color: string
  font_family: string
  css_vars: string          // JSON: { "--var": "value", ... }
  custom_footer: string
  created_at: string
  updated_at: string
}

// ---- SsoConfig: Per-tenant SSO/OAuth2 provider config ----
export interface SsoConfig {
  id: string
  tenant_id: string
  provider: SsoProvider
  enabled: boolean
  client_id: string
  domain: string
  redirect_uri: string
  scopes: string
  pkce_enabled: boolean
  config_notes: string
  created_by: string
  created_at: string
  updated_at: string
}

// ============================================================
// P8 TYPES — Federated Governance, Marketplace, Audit Hash Trail
// ============================================================

export type FederationStatus = 'pending' | 'approved' | 'rejected' | 'revoked'
export type FederatedIntentStatus = 'pending' | 'approved' | 'rejected'
export type MarketplaceStatus = 'submitted' | 'under_review' | 'listed' | 'rejected' | 'withdrawn'

// ---- TenantFederation: who can share with whom ----
export interface TenantFederation {
  id: string
  source_tenant_id: string
  target_tenant_id: string
  scope: string            // JSON array: ["intents","approvals",...]
  status: FederationStatus
  approved_by: string | null
  approved_at: string | null
  revoked_by: string | null
  revoked_at: string | null
  federation_notes: string
  created_by: string
  created_at: string
}

// ---- FederatedIntent: cross-tenant intent sharing log ----
export interface FederatedIntent {
  id: string
  intent_id: string
  source_tenant_id: string
  target_tenant_id: string
  federation_id: string
  approval_status: FederatedIntentStatus
  approved_by: string | null
  approved_at: string | null
  shared_scope: string
  share_notes: string
  shared_by: string
  created_at: string
}

// ---- MarketplaceConnector: connector marketplace submission ----
export interface MarketplaceConnector {
  id: string
  connector_id: string
  submitted_by: string
  submitted_tenant_id: string
  listing_status: MarketplaceStatus
  approval_tier: number
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string
  listing_notes: string
  listing_title: string
  listing_description: string
  listing_tags: string      // JSON array
  version_tag: string
  downloads: number
  created_at: string
  updated_at: string
}

// ---- AuditLogV2: Immutable audit trail with SHA-256 event hashing ----
export interface AuditLogV2 {
  id: string
  event_type: string
  object_type: string
  object_id: string
  actor: string
  tenant_id: string
  event_hash: string        // SHA-256(event_type+object_id+actor+created_at)
  hash_algorithm: string
  payload_summary: string
  surface: string
  verified: number          // 0 | 1
  created_at: string
}

// ---- AnomalyDetection: ML/AI anomaly detection result ----
export interface AnomalyDetectionResult {
  tenant_id: string
  metric: string
  period: string
  value: number
  baseline: number
  deviation_pct: number
  is_anomaly: boolean
  severity: 'low' | 'medium' | 'high'
  ai_summary: string        // always tagged 'ai-generated'
  confidence: string
  detected_at: string
}
