# 05 — SURFACE MAP

**Document:** Sovereign OS Platform — UI/App Surface to Platform Function Map
**Version:** v5.0
**Status Relevance:** P0–P4 surfaces are LIVE-VERIFIED. P5 surfaces are TARGET.
**Generated:** 2026-04-17
**Relation to doc pack:** This document describes every platform surface
in terms of its governance function, role ownership, status, and data dependencies.

---

## 1. Reading This Document

Each surface entry includes:
- **Purpose** — what governance function this surface serves
- **Role Ownership** — who primarily operates this surface
- **Status** — LIVE-VERIFIED / TARGET / PLANNED
- **Inputs** — what data or actions feed this surface
- **Outputs** — what the surface produces or mutates
- **Dependencies** — what must exist for this surface to function
- **Proof Expectations** — what constitutes evidence this surface works

---

## 2. P0 Core Surfaces (LIVE-VERIFIED via P2.5)

---

### `/dashboard` — Platform Command Home

**Purpose:** Single-pane operational status view. Shows active session context,
pending approvals, blockers, live board snapshot, recent proof outcomes,
and platform health indicators.

**Role Ownership:** All roles read. No mutations from this surface.

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `sessions` table (active session record)
- `approval_requests` table (pending count)
- `priority_items` table (NOW/HOLD blockers)
- `proof_artifacts` table (recent outcomes)
- `platform_alerts` table (unread count) [P4+]

**Outputs:** Read-only display. No mutations.

**Dependencies:** D1 database. Auth middleware (displays role context if key provided).

**Proof Expectations:**
- GET /dashboard → 200 OK
- Shows real counts from D1 queries (not hardcoded)
- Alert banner visible when unread_alerts > 0

---

### `/intent` — Founder Objective Input

**Purpose:** Formal entry point for founder strategic objectives.
Intent records anchor all downstream session work.

**Role Ownership:** Founder (write). All roles (read for context).

**Status:** ✅ LIVE-VERIFIED

**Inputs:** Form: title, strategic_context, urgency, scope_notes, constraints, escalation_notes

**Outputs:** Creates `intents` record in D1.

**Dependencies:** D1 write access. Auth required for POST.

**Proof Expectations:**
- GET /intent → 200 OK, form renders
- POST /intent (auth) → creates intent record
- Intent record visible in active intents table

---

### `/intake` — Session Intake

**Purpose:** Classify and triage incoming requests. Decide lane, urgency,
readiness, and proceed/hold/blocked/approval-needed.

**Role Ownership:** Orchestrator (primary). Architect (oversight).

**Status:** ✅ LIVE-VERIFIED

**Inputs:** Form: title, type, lane, urgency, requester, context_summary, source_refs, readiness_status, decision

**Outputs:** Creates `requests` record in D1.

**Dependencies:** D1 write access. Auth required for POST.

**Proof Expectations:**
- GET /intake → 200 OK, form and intake queue render
- POST /intake (auth) → creates classified request
- Lane indicator chip visible per request

---

### `/architect` — Master Architect Workbench

**Purpose:** Read handoff + live priority + source-of-truth, compose session brief,
define scope boundaries, set acceptance criteria and next locked move.

**Role Ownership:** Master Architect (primary).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- Active session record
- Last handoff record
- Active priority items (top 3)
- Source-of-truth references
- Active constraints

**Outputs:**
- Creates `sessions` record (session brief)
- Creates `handoff_records` record

**Dependencies:** D1 read/write. Auth required for mutations.

**Proof Expectations:**
- GET /architect → 200 OK, live inputs panel renders
- Session brief form functional
- Save handoff → creates handoff_record in D1

---

### `/approvals` — Approval Queue

**Purpose:** Manage all approval-gated actions.
View pending items, approve/reject/return with documented reason.

**Role Ownership:** Architect (Tier 1–2). Founder (Tier 3).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `approval_requests` table (pending items, filtered by tier)

**Outputs:**
- Updates `approval_requests` record: status (approved/rejected/returned), approved_by, reason, resolved_at

**Dependencies:** D1. Auth with role check: Tier 3 requires founder key.

**Proof Expectations:**
- GET /approvals → 200 OK, queue renders
- Tier badges visible (Tier 1: blue, Tier 2: amber, Tier 3: red)
- Approve/reject action with reason → updates D1 record
- Self-approval blocked at application layer

---

### `/proof` — Proof Center

**Purpose:** Review execution results, verify evidence, classify outcomes.
No status advancement without reviewer classification.

**Role Ownership:** Reviewer (classification). Executor (submission, read-only after submit).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `proof_artifacts` table (unclassified artifacts)
- Reviewer role context (auto-filled from auth)

**Outputs:**
- Updates `proof_artifacts` record: outcome_classification, reviewed_by, reviewed_at
- May trigger platform_alert (proof_submitted event) [P4+]

**Dependencies:** D1. Auth required. Reviewer role for classification.

**Proof Expectations:**
- GET /proof → 200 OK, inbox renders
- Classification action → updates proof_artifact record
- Reviewed proofs visible in classified section

---

### `/live` — Live Priority Board

**Purpose:** NOW/NEXT/LATER/HOLD/NOT NOW operational board.
Blockers, session target, operational ticker.

**Role Ownership:** All roles (read). Orchestrator/Architect (write/move).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `priority_items` table (all categories)
- Execution queue snapshot [P3+]
- Connector health summary [P3+]

**Outputs:**
- Updates `priority_items` record: category change (move between columns)
- Creates/resolves blocker notes

**Dependencies:** D1. Auth required for mutations.

**Proof Expectations:**
- GET /live → 200 OK, 5-column board renders
- Priority items visible per column from D1
- Move action updates category in D1

---

### `/records` — Decision and Handoff Registry

**Purpose:** Decision log, handoff registry, proof references, canon candidates.
The primary audit trail surface.

**Role Ownership:** All roles (read). Architect/Founder (create decisions).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `decision_records` table
- `handoff_records` table
- `proof_artifacts` table (index view)
- `canon_candidates` table

**Outputs:**
- Creates `decision_records` record
- Links canon candidates to `/canon` surface

**Dependencies:** D1. Auth required for mutations.

**Proof Expectations:**
- GET /records → 200 OK, tabs render (Decisions, Handoffs, Proof Index, Canon Candidates)
- Active handoff pinned at top of Handoffs tab

---

### `/continuity` — Session Continuity (P2)

**Purpose:** Shows active session, last handoff summary, and next locked move.
Continuity anchor for cross-session operational awareness.

**Role Ownership:** All roles (read). Architect (update).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `session_continuity` table
- `handoff_records` table (most recent)
- Active `sessions` record

**Outputs:** Read-only display.

**Proof Expectations:**
- GET /continuity → 200 OK
- Shows active session title and last handoff

---

## 3. P3 Operational Surfaces (LIVE-VERIFIED)

---

### `/execution` — Execution Board

**Purpose:** Execution work items board with status progression (PENDING →
IN_PROGRESS → PROOF_SUBMITTED → REVIEWED), proof linkage, and approval gate indicator.

**Role Ownership:** Executor (work items). Reviewer (advance to REVIEWED).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `execution_items` table
- Form: title, description, context_summary, priority, session_id

**Outputs:**
- Creates/updates `execution_items` records
- PROOF_SUBMITTED → REVIEWED: requires Reviewer role action only

**Dependencies:** D1. Auth required. Role enforcement on status advancement.

**Proof Expectations:**
- GET /execution → 200 OK, work items render
- Status columns visible with correct item distribution
- Executor cannot self-move to REVIEWED

---

### `/connectors` — Connector Hub

**Purpose:** Governed integration registry. All external connections declared,
status-tracked, and auth-posture-safe.

**Role Ownership:** Architect (register/manage). All roles (read status).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `connectors` table
- Form: name, type, status, auth_configured

**Outputs:**
- Creates/updates `connectors` records
- Registration requires Tier 2 approval

**Dependencies:** D1. Auth required. Tier 2 approval for mutations.

**Proof Expectations:**
- GET /connectors → 200 OK, connector cards render
- Auth shown as status only (Configured / Not Configured) — never raw credentials
- Register connector → triggers approval_request Tier 2

---

### `/roles` — Role Registry

**Purpose:** Multi-key role registry. Issue and manage role keys.
No raw key exposure after initial issuance.

**Role Ownership:** Founder (issue keys). All roles (view status).

**Status:** ✅ LIVE-VERIFIED

**Inputs:**
- `role_assignments` table
- Issue role key form (founder only)

**Outputs:**
- Creates/updates `role_assignments` records
- Key shown once at issuance — hash stored immediately

**Dependencies:** D1. Founder auth required for issue/rotate.

**Proof Expectations:**
- GET /roles → 200 OK, role slots visible
- Raw key never visible after initial issuance
- Rotation: deactivates old, issues new

---

## 4. P4 Product Surfaces (LIVE-VERIFIED)

---

### `/w/founder` — Founder Workspace

**Purpose:** Strategic command panel, Tier 3 override approval queue,
canon ratification surface, onboarding completion override.

**Role Ownership:** Founder only. 403 for all other roles on mutations.

**Status:** ✅ LIVE-VERIFIED

**Proof Expectations:**
- GET /w/founder (founder key) → 200 OK
- GET /w/founder (non-founder key) → 403

---

### `/w/architect` — Architect Workspace

**Purpose:** Session brief builder, handoff manager, scope control,
Tier 2 approval routing access. AI assist access in P5+.

**Role Ownership:** Architect. 403 for Executor on mutations.

**Status:** ✅ LIVE-VERIFIED

---

### `/w/orchestrator` — Orchestrator Workspace

**Purpose:** Readiness gating panel, approval routing, orchestration queue,
work item assignment.

**Role Ownership:** Orchestrator.

**Status:** ✅ LIVE-VERIFIED

---

### `/w/executor` — Executor Workspace

**Purpose:** Bounded work inbox, execution log, proof submission.
Cannot see: Founder strategic panel, Tier 3 approval queue.

**Role Ownership:** Executor.

**Status:** ✅ LIVE-VERIFIED

**Proof Expectations:**
- GET /w/executor (executor key) → 200 OK
- Founder panel NOT visible to executor

---

### `/w/reviewer` — Reviewer Workspace

**Purpose:** Proof inbox, verification matrix, classification authority.
Cannot mutate execution items or issue approvals.

**Role Ownership:** Reviewer.

**Status:** ✅ LIVE-VERIFIED

---

### `/lanes` — Product Lane Directory

**Purpose:** Lists all registered product lanes, their type, status, and repo reference.
Registration requires Tier 2 approval.

**Role Ownership:** All roles (read). Founder/Architect (register).

**Status:** ✅ LIVE-VERIFIED

**Inputs:** `product_lanes` table

**Proof Expectations:**
- GET /lanes → 200 OK, lane directory renders from D1

---

### `/onboarding` — Onboarding Wizard

**Purpose:** First-run experience for new operators. Step-by-step platform orientation.
Completion tracked in D1 (`sessions.onboarding_completed`).

**Status:** ✅ LIVE-VERIFIED

---

### `/alerts` — Alert and Notification Center

**Purpose:** Internal platform alerts for governance events (approval_pending,
proof_submitted, connector_error, session_stale, execution_blocked, canon_candidate_ready).
Acknowledge and dismiss workflow.

**Status:** ✅ LIVE-VERIFIED

**Dependencies:** `platform_alerts` D1 table. Real events only — no synthetic alerts.

**Proof Expectations:**
- GET /alerts → 200 OK, alert list renders
- Acknowledge action → updates acknowledged flag in D1

---

### `/reports` — Cross-Lane Reporting Dashboard

**Purpose:** Real D1-computed metrics across lanes and governance activities.
No fake data. No hardcoded values.

**Status:** ✅ LIVE-VERIFIED

**Inputs:** Real-time D1 COUNT queries across sessions, approvals, execution_items,
connectors, proof_artifacts.

**Proof Expectations:**
- GET /reports → 200 OK, metrics render from real D1 data

---

### `/canon` — Canon Promotion Workflow

**Purpose:** Canon candidate review and promotion surface.
Founder/architect gate only. No auto-promotion path.

**Status:** ✅ LIVE-VERIFIED

**Inputs:** `canon_candidates` table (review_status = under_review)

**Outputs:**
- Promote: creates `canon_promotions` record, updates `canon_candidates` status → promoted
- Reject: updates `canon_candidates` status → rejected, records rejection_reason

**Dependencies:** D1. Founder or Architect auth required for promote/reject.

**Proof Expectations:**
- GET /canon → 200 OK
- Promote action requires promotion_reason (min 20 chars)
- Non-founder/architect keys return 403 on promote action

---

## 5. P5 Target Surfaces (Not Yet LIVE-VERIFIED)

---

### `/tenants` — Tenant Directory

**Purpose:** Super-admin surface for viewing all tenant entities.
Tenant provisioning requires Tier 3 approval.

**Status:** 🎯 P5 TARGET

---

### `/t/:slug/*` — Tenant-Namespaced Routing

**Purpose:** All platform surfaces accessible within tenant context.
Tenant isolation enforced at repo.ts layer.

**Status:** 🎯 P5 TARGET

---

### `/ai-assist` — AI Orchestration Assist

**Purpose:** Governed AI assistance for session briefs, scope suggestions,
review summaries, and risk assessments. Human confirmation gate on all outputs.

**Status:** 🎯 P5 TARGET

---

### `/api-keys` — API Key Management

**Purpose:** Issue, view, and revoke public API keys.
Keys shown once at issuance, hash stored immediately.

**Status:** 🎯 P5 TARGET

---

## 6. API Surface (/api/v1/* — P5 Target)

Public, rate-limited, sanitized API endpoints for external consumers.

| Endpoint | Auth | Status |
|----------|------|--------|
| GET /api/v1/health | None | P5 TARGET |
| GET /api/v1/sessions/:id/status | API Key | P5 TARGET |
| GET /api/v1/approvals/:id/status | API Key | P5 TARGET |
| POST /api/v1/requests | API Key | P5 TARGET |
| POST /api/v1/proof | API Key | P5 TARGET |
| GET /api/v1/metrics | API Key | P5 TARGET |

All /api/v1/* responses are sanitized: no internal governance IDs,
no raw credentials, no governance metadata beyond what is needed.

---

*Document Status: P0–P4 LIVE-VERIFIED. P5 entries marked TARGET.*
*Classification: Operations — Surface reference*
*Next review: After each new surface is deployed and verified*
