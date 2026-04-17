# 03 — SYSTEM ARCHITECTURE

**Document:** Sovereign OS Platform — Technical and Governance Architecture Reference
**Version:** v5.0
**Status Relevance:** Reflects P0–P4 (LIVE-VERIFIED) + P5 (TARGET).
**Generated:** 2026-04-17
**Relation to doc pack:** This document maps how the platform is structured technically
and how governance layers correspond to technical modules and surfaces.

---

## 1. Operating Layers

The platform is organized into 7 distinct operating layers.
Each layer has defined functions, outputs, and prohibited actions.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 0 — FOUNDER / STRATEGIC INTENT                          │
│  Source of all strategic direction and final approval authority │
│  Inputs: intent, urgency, constraints, escalation              │
│  Outputs: intent_brief, Tier 3 decisions, canon ratification   │
│  Does NOT: manage daily execution, initiate technical work      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1 — MASTER ARCHITECT / INTENT & STRUCTURE               │
│  Captures intent, clarifies scope, defines session boundaries,  │
│  composes bounded briefs, manages handoff continuity            │
│  Inputs: intent records, handoff, live state, priority board   │
│  Outputs: session_brief, bounded_brief, scope_boundary          │
│  Does NOT: execute implementation work                          │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — ORCHESTRATOR / OPERATIONAL DECISION & GATING        │
│  Receives L1 handoff, normalizes tasks, applies readiness       │
│  gating, routes approvals, detects drift and blockers,          │
│  composes bounded briefs for L3                                 │
│  Inputs: L1 session brief, intake queue, approval states       │
│  Outputs: ready work items, approval routing, blocker flags    │
│  Does NOT: make strategic decisions, self-approve own decisions │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — EXECUTOR / IMPLEMENTATION & PROOF                   │
│  Actual implementation: code, edit, test, output, deploy       │
│  Returns proof and limitation notes                             │
│  Inputs: bounded work items, approved briefs                   │
│  Outputs: executed work, proof_artifacts, limitation notes      │
│  Does NOT: self-review, self-canonize, self-verify             │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4 — PROOF / REVIEW                                      │
│  All execution results reviewed, verified, classified before   │
│  any status advancement                                         │
│  Inputs: proof_artifacts from L3                               │
│  Outputs: classified proofs (PASS/PARTIAL/FAIL/BLOCKED)        │
│  Does NOT: mutate execution items, issue approvals             │
├─────────────────────────────────────────────────────────────────┤
│  Layer 5 — LIVE STATE                                          │
│  Active operational status: handoffs, priorities, blockers,    │
│  build targets, real system conditions                          │
│  Source: D1 database, real-time queries                        │
│  Displays: NOW/NEXT/LATER/HOLD/NOT NOW board, session context  │
│  Does NOT: display data that is not sourced from live D1       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 6 — CANON                                               │
│  Official rules, structures, doctrine, and decisions.          │
│  Only stable, reviewed material may be promoted here.           │
│  Read-heavy. Write-controlled. No auto-promotion path.         │
│  Source: human-approved promotions from proof_artifacts        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Modules

Ten functional modules map the platform's capabilities.

### A. Founder Command Module
- Intent input, strategic priority, governance decisions, overrides, escalation
- Outputs: intent records, Tier 3 approvals, canon ratification records

### B. Master Architect Module
- Read handoff + active priority + source-of-truth
- Intake assessment, bounded brief composition
- Outputs: session_brief, bounded_brief, scope boundaries

### C. Session Intake Module
- Receive incoming requests, classify, map to lanes and layers
- Detect blockers, decide proceed/hold/blocked/approval-needed
- Outputs: classified requests, readiness assessments

### D. Approval & Escalation Module
- Apply tier approval gates (Tier 0–3)
- Manage approval queue, escalation routing, audit trail
- Outputs: approval decisions with full audit record

### E. Orchestration Module
- Scope maintenance, work decomposition, execution path selection
- Continuity enforcement, drift detection, non-regression discipline

### F. Execution Module
- Implementation, tool operation, bounded change execution
- Testing, artifact generation, proof return

### G. Proof & Audit Module
- Evidence collection, outcome tracking, proof artifact storage
- Honest status maintenance, review surface before status promotion

### H. Live Ops Board Module
- NOW/NEXT/LATER/HOLD/NOT NOW display
- Blockers, session target, governance status snapshot

### I. Records & Canon Module
- Decision log, proof tracker, handoff registry
- Official record keeping, canon promotion flow
- Drift prevention between docs and live state

### J. Integration / Connector Module
- Connect to APIs, apps, messaging, repos, deploy surfaces, tools
- Governed registry — not ad hoc. Tier 2 approval for mutations.

---

## 3. Surface Map (All Phases)

### P0–P2.5 Surfaces — Status: LIVE-VERIFIED

| Route | Purpose | Module |
|-------|---------|--------|
| `/dashboard` | Platform command home | Founder Command, Live Ops |
| `/intent` | Founder objective input | Founder Command |
| `/intake` | Request classification and triage | Session Intake |
| `/architect` | Session brief builder, handoff reader | Master Architect |
| `/approvals` | Approval queue with tier visibility | Approval & Escalation |
| `/proof` | Proof inbox, evidence review, classification | Proof & Audit |
| `/live` | NOW/NEXT/LATER/HOLD/NOT NOW board | Live Ops Board |
| `/records` | Decision log, handoff registry, canon candidates | Records & Canon |
| `/continuity` | Session continuity anchor | Master Architect |
| `/health` | Platform health endpoint | All |
| `/status` | All surfaces status | All |

### P3 Surfaces — Status: LIVE-VERIFIED

| Route | Purpose | Module |
|-------|---------|--------|
| `/execution` | Execution Board — work items, status progression | Execution |
| `/connectors` | Connector Hub — registry, status, auth posture | Integration |
| `/roles` | Role Registry — multi-key, no raw key exposure | Approval & Escalation |

### P4 Surfaces — Status: LIVE-VERIFIED

| Route | Purpose | Module |
|-------|---------|--------|
| `/w/founder` | Founder workspace — strategic command | Founder Command |
| `/w/architect` | Architect workspace — brief builder, handoff | Master Architect |
| `/w/orchestrator` | Orchestrator workspace — gating, routing | Orchestration |
| `/w/executor` | Executor workspace — bounded inbox, proof | Execution |
| `/w/reviewer` | Reviewer workspace — proof inbox, classification | Proof & Audit |
| `/lanes` | Product Lane Directory | Records & Canon |
| `/onboarding` | Onboarding wizard | Founder Command |
| `/alerts` | Alert & notification center | All |
| `/reports` | Cross-lane reporting dashboard | Live Ops Board |
| `/canon` | Canon promotion workflow | Records & Canon |

### P5 Surfaces — Status: TARGET (not yet LIVE-VERIFIED)

| Route | Purpose | Status |
|-------|---------|--------|
| `/tenants` | Tenant directory (super-admin) | P5 TARGET |
| `/t/:slug/*` | Tenant-namespaced routing | P5 TARGET |
| `/ai-assist` | AI Orchestration Assist | P5 TARGET |
| `/api-keys` | API Key management | P5 TARGET |
| `/api/v1/docs` | Public API documentation | P5 TARGET |

---

## 4. Data Object Map

### Core Data Objects (introduced P0–P2, all in D1)

| Object | Table | Phase | Purpose |
|--------|-------|-------|---------|
| intent | intents | P0 | Founder objective record |
| session | sessions | P0 | Active work session |
| request | requests | P0 | Incoming classified request |
| approval_request | approval_requests | P0 | Approval-gated action record |
| work_item | work_items | P0 | Bounded executable unit |
| proof_artifact | proof_artifacts | P0 | Evidence from execution |
| decision_record | decision_records | P0 | Governance decision record |
| handoff_record | handoff_records | P0 | Session continuity anchor |
| priority_item | priority_items | P0 | Live board item |
| canon_candidate | canon_candidates | P0 | Candidate for canon promotion |
| role_assignment | role_assignments | P2 | Role-to-key mapping |
| session_continuity | session_continuity | P2 | Cross-session continuity data |
| governance_boundary | governance_boundaries | P2 | Enforced role separation rule |
| operator_note | operator_notes | P2 | Operator contextual notes |

### Operational Data Objects (introduced P3–P4, all in D1)

| Object | Table | Phase | Purpose |
|--------|-------|-------|---------|
| execution_item | execution_items | P3 | Execution Board work item |
| connector | connectors | P3 | Integration registry entry |
| product_lane | product_lanes | P4 | Governed product lane entry |
| platform_alert | platform_alerts | P4 | Governance event alert |
| canon_promotion | canon_promotions | P4 | Canon promotion audit record |

### P5 Data Objects (TARGET — not yet in production)

| Object | Table | Phase | Purpose |
|--------|-------|-------|---------|
| tenant | tenants | P5 | Multi-tenant entity |
| webhook_delivery_log | webhook_delivery_log | P5 | Outbound webhook delivery record |
| sso_session | sso_sessions | P5 | SSO/OAuth2 session store |
| metrics_snapshot | metrics_snapshots | P5 | Time-series analytics data |
| api_key | api_keys | P5 | Public API key registry |
| ai_assist_log | ai_assist_log | P5 | AI invocation audit trail |

---

## 5. Platform Flow: Intent to Canon

```
1. Founder enters INTENT (/intent)
   → intent record created in D1

2. Request INTAKE (/intake)
   → Request classified (type, lane, urgency, readiness)
   → Decision: proceed / hold / blocked / approval-needed

3. ARCHITECT reviews handoff + priority, composes session brief (/architect)
   → session brief generated, scope in/out defined
   → Next locked move set

4. APPROVAL QUEUE (/approvals)
   → Tier 1–3 items queued
   → Tier 0 auto-approved
   → Tier 3 requires founder action

5. EXECUTION (/execution)
   → Work items bounded, assigned to Executor role
   → Status progression: PENDING → IN_PROGRESS → PROOF_SUBMITTED

6. PROOF REVIEW (/proof)
   → Executor submits evidence
   → Reviewer classifies: PASS / PARTIAL / FAIL / BLOCKED
   → Status advances to REVIEWED only after classification

7. LIVE STATE update (/live)
   → Priority board updated based on reviewed outcomes
   → Blockers logged or resolved

8. RECORDS & CANON (/records, /canon)
   → Stable, reviewed outputs become canon candidates
   → Canon promotion: explicit founder/architect action required
   → Promoted items locked (no inline edit)
```

---

## 6. Runtime vs. Governance Boundaries

```
INSIDE PLATFORM GOVERNANCE (controlled, audited, governed):
  ✅ All routes in /dashboard through /canon
  ✅ Role workspace isolation (/w/:role)
  ✅ Auth middleware (X-Platform-Key validation)
  ✅ D1 database queries and mutations
  ✅ Approval tier enforcement
  ✅ Canon promotion gate

OUTSIDE PLATFORM GOVERNANCE (product lane territory):
  ❌ Product vertical business logic (belongs in lane repos)
  ❌ Product-specific UI not tied to governance surfaces
  ❌ Product-lane data tables in platform D1

GOVERNED INTEGRATION (controlled entry point):
  ↔ Connectors registered in /connectors (Tier 2 approval)
  ↔ Public API (/api/v1/*) — sanitized, rate-limited, P5 target
  ↔ Webhooks — governed delivery, no raw payload, logged
  ↔ AI Assist — L2 only, human confirmation gate, audit logged
```

---

## 7. Cross-Session Continuity Logic

The platform is designed to preserve operational truth across sessions:

1. **Handoff records** — every session close must produce a handoff_record
   with: current truth, scope in/out, finished work, partial work,
   blockers, next locked move, proof links, classification.

2. **Session continuity** — `/continuity` surface shows active session,
   last handoff, and next locked move at all times.

3. **D1 persistence** — all critical data persists across sessions
   via Cloudflare D1. No in-memory state survives a worker restart.

4. **Canon as stable anchor** — promoted canon items persist as
   the stable reference layer that does not change between sessions
   unless explicitly re-promoted.

---

## 8. Deployment Architecture

**Platform:** Cloudflare Pages (Edge Workers)
**Runtime:** Hono framework (TypeScript)
**Database:** Cloudflare D1 (SQLite, globally distributed)
**Storage:** Cloudflare KV (rate limiting counters, config — P5+)
**Deploy URL:** https://sovereign-os-platform.pages.dev
**Production Branch:** main
**Migrations Applied (P4 LIVE-VERIFIED):** 0001 → 0005

### Migration History

| Migration | Phase | Content |
|-----------|-------|---------|
| 0001_initial_schema.sql | P1 | 10 core tables (P0 data objects) |
| 0002_seed_data.sql | P1 | Initial seed data |
| 0003_p2_schema.sql | P2 | role_assignments, session_continuity, governance_boundaries, operator_notes |
| 0004_p3_schema.sql | P3 | execution_items, connectors, role_assignments extensions |
| 0005_p4_schema.sql | P4 | product_lanes, platform_alerts, canon_promotions, sessions.onboarding_completed |
| 0006_p5_schema.sql | P5 | tenants, webhook_delivery_log, sso_sessions, metrics_snapshots, api_keys, ai_assist_log + tenant_id columns [TARGET] |

### Environment Secrets

| Secret | Status | Purpose |
|--------|--------|---------|
| PLATFORM_API_KEY | ✅ CONFIGURED | Master auth key |
| AI_ASSIST_API_KEY | 🎯 P5 TARGET | AI provider key (server-side only) |
| SSO_CLIENT_SECRET | 🎯 P5 TARGET | OAuth2 client secret |
| PLATFORM_JWT_SECRET | 🎯 P5 TARGET | JWT signing key |

---

## 9. Source-of-Truth Hierarchy

When conflicts arise between documents, live state, and AI outputs:

```
1. Explicit founder decision (highest authority)
2. Current approved L1 handoff
3. Current approved L2 decision artifacts
4. Governance canon (this doc pack, promoted items)
5. Current live operational state (D1 database)
6. Verified proof artifacts
7. Supporting reference documents
8. Legacy or historical material
9. AI inferences or assumptions (lowest authority)
```

---

*Document Status: LIVE-VERIFIED for P0–P4. P5 sections marked TARGET.*
*Classification: Foundation — Architecture reference*
*Next review: After P5 LIVE-VERIFIED*
