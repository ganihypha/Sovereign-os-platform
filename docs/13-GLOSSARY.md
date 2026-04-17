# 13 — GLOSSARY

**Document:** Sovereign OS Platform — Vocabulary Lock
**Version:** v5.0
**Status Relevance:** This vocabulary applies to all phases and all documentation.
**Generated:** 2026-04-17
**Relation to doc pack:** Every document in this pack uses these terms.
When a term is ambiguous in any document, this glossary is the tiebreaker.

---

## Core Vocabulary

---

### Intent

**Definition:** A formally recorded founder objective that initiates a session
or governs a sequence of work. Intent is not a task. Intent is the strategic
direction from which tasks derive.

**In the platform:** Stored in the `intents` table. Every active session should
link to at least one intent. Work without an intent anchor is suspect.

**Not to be confused with:** A request (which is classified intake) or a work item
(which is executable).

---

### Architect / Master Architect

**Definition:** The Layer 1 governance role responsible for capturing intent,
clarifying scope, defining session structure, composing bounded briefs,
and managing handoff continuity.

**In the platform:** The `/architect` surface and `/w/architect` workspace.
Role key: architect slot in role_assignments.

**Prohibited from:** Executing implementation work (that belongs to Executor).

---

### Orchestrator

**Definition:** The Layer 2 governance role responsible for operational decision-making,
readiness gating, approval routing, work decomposition, drift detection, and
composing bounded work briefs for Executor.

**In the platform:** `/w/orchestrator` workspace. Role key: orchestrator slot.

**Prohibited from:** Making strategic decisions (Founder), self-approving
orchestration decisions.

---

### Executor

**Definition:** The Layer 3 role responsible for actual bounded implementation,
tool operation, testing, artifact generation, and returning proof.

**In the platform:** `/w/executor` workspace, `/execution` surface.

**Prohibited from:** Reviewing own proof, advancing own work item from
PROOF_SUBMITTED to REVIEWED, self-canonizing output.

---

### Reviewer

**Definition:** The Layer 4 role responsible for reviewing proof artifacts,
verifying evidence, and classifying execution outcomes
(PASS / PARTIAL / FAIL / BLOCKED).

**In the platform:** `/w/reviewer` workspace, `/proof` surface.

**Prohibited from:** Mutating execution items, issuing approvals,
initiating new work items.

---

### Proof

**Definition:** Evidence returned by an Executor that an implementation task was
completed. Proof is not verified by the person who produced it. Proof must be
reviewed and classified by a Reviewer before any status advancement.

**In the platform:** `proof_artifacts` D1 table. Submitted to `/proof`.

**Proof types:** code / test / deploy / docs / other

**Classification values:** PASS / PARTIAL / FAIL / BLOCKED

---

### Live State

**Definition:** The current operational truth of the platform as reflected in the
D1 database at the time of query. Live State is never assumed — it is always read.

**In the platform:** `/live` surface (NOW/NEXT/LATER/HOLD/NOT NOW board),
`/dashboard` (live metrics), D1 tables queried in real time.

**Rule:** No surface may display live state based on assumption, AI memory,
or session-level variables. All live state comes from D1.

---

### Canon

**Definition:** The stable, official, promoted body of decisions, rules, structures,
and doctrine that defines the platform's permanent operating truth.

Canon is:
- Earned through proof, review, and explicit promotion
- Locked after promotion (no inline edit)
- Read-heavy by design (write-controlled)
- Never auto-promoted by any automation or AI agent

**In the platform:** `/canon` surface, `canon_candidates` and `canon_promotions`
tables in D1.

---

### Canon Candidate

**Definition:** A reviewed artifact, decision, or output that is eligible for
canon promotion review but has NOT yet been promoted. A candidate is not canon.

**In the platform:** `canon_candidates` D1 table. Promoted via `/canon` surface
with explicit founder or architect action.

---

### Lane

**Definition:** A functional domain or operating vertical that sits under
platform governance. Lanes are registered in `/lanes` and may run their own
product repos — but governance rules still apply.

**Lane types:**
- `governance-core` — Platform governance itself
- `product-vertical` — Business vertical product (e.g., CRM, BarberKas)
- `runtime-service` — Technical service under governance
- `experiment` — Limited-governance experimental lane

**Rule:** Product lane business logic must NOT be embedded in platform core.

---

### Handoff

**Definition:** A structured record produced at the close of a session that
transfers operational truth to the next session. A handoff is not a summary.
It is a governance artifact.

**Required handoff fields:**
- current truth (confirmed from live state)
- scope in / out
- finished work (specific, verifiable)
- partial work (honest — what remains incomplete)
- blockers (specific, not vague)
- next locked move (exact next action for next session)
- proof links
- classification (per feature)

**In the platform:** `handoff_records` D1 table. Displayed in `/continuity`
and `/w/architect`.

---

### Bounded Brief

**Definition:** A precisely scoped instruction document that defines
what will be done (scope in), what will NOT be done (scope out),
acceptance criteria (PASS/FAIL conditions), and the next locked move.

Bounded briefs are the Orchestrator's primary output to the Executor.
They exist to prevent scope drift.

---

### Truth Lock

**Definition:** The discipline of reading and confirming current live state
from actual platform sources before any new session work begins.
No session may start work based on assumed or remembered state.

**Truth lock procedure:**
1. Read current repo state
2. Verify live endpoints (curl production URLs)
3. Read last handoff record
4. Restate confirmed baseline before writing any code

---

### Scope Lock

**Definition:** The discipline of defining exactly what is in scope, exactly
what is out of scope, and exactly which files/tables/surfaces may be touched
— before implementation begins.

Scope lock prevents "while we're here" changes and preserves status honesty.

---

### Live-Verified

**Definition:** A feature, surface, or platform state that has been:
1. Deployed to production (Cloudflare Pages)
2. Tested via real production URL (curl or browser)
3. Documented with evidence (URL or deployment log)

**Not Live-Verified:** Built locally only. Built in sandbox only.
Assumed to work based on prior deployment.

---

### Partial

**Definition:** A feature or surface that exists and has meaningful functionality
but is materially incomplete. PARTIAL is not failure. PARTIAL means honest
acknowledgment of incomplete coverage.

**Rule:** PARTIAL must never be collapsed into VERIFIED or LIVE-VERIFIED.
If something is partial, say PARTIAL.

---

### Pending

**Definition:** A feature, surface, or task that is defined (scoped, designed,
or documented) but has not yet been built.

**Not to be confused with:** PARTIAL (which exists but is incomplete).

---

### Approval Tier

**Definition:** The governance gate level required for a given platform action.

| Tier | Name | Gate |
|------|------|------|
| 0 | Auto | No human gate, system auto-approves safe reversible actions |
| 1 | Async | Standard governance action, architect or above, can proceed after notification |
| 2 | Sync | Sensitive mutation, must wait for explicit approval from architect or above |
| 3 | Founder Only | Strategic or irreversible, founder only, cannot be delegated |

---

### Role Assignment

**Definition:** The explicit mapping of a role key to a platform role (founder,
architect, orchestrator, executor, reviewer). Role keys are hashed and stored
in `role_assignments`. No role is auto-assigned by any SSO or AI mechanism.

---

### Connector

**Definition:** A registered integration entry that connects the platform
to an external service (repo, API, webhook, messaging, deploy surface).
Connectors are governed — registration requires Tier 2 approval.

**Rule:** Auth is shown as status only (Configured ✅ / Missing ⚠️).
Raw credentials never displayed.

---

### Session

**Definition:** A bounded unit of platform work that starts with a truth lock,
proceeds through a scoped brief, produces an execution artifact and proof,
and closes with a handoff record.

A session is not simply a login period. It is a structured operational unit
with defined start state, scope, acceptance criteria, and end state.

---

### Platform Alert

**Definition:** An internal platform notification generated by real governance
events (not synthetic). Alerts are read and acknowledged by operators.
No external delivery (email/SMS) in P0–P4.

**Alert types (P4):**
- approval_pending, proof_submitted, connector_error, session_stale,
  execution_blocked, canon_candidate_ready

---

### Product Lane

**Definition:** A governed product vertical or runtime service registered
in the platform's lane directory. Product lanes operate in their own repos
and runtime environments but are subject to platform governance rules.

---

### Tenant (P5)

**Definition:** An independently governed entity within the platform.
Each tenant has fully isolated data, role assignments, and product lanes.
Tenant provisioning requires Founder-level (Tier 3) approval.

Default single-tenant mode uses `tenant_id = 'default'` and is fully
backward compatible.

---

### AI Assist (P5)

**Definition:** A governed AI assistance capability that operates at Layer 2
(Orchestrator) support level only. AI Assist may generate suggestions for
session briefs, scope outlines, review summaries, and risk assessments.

**Rules:**
- AI output is always tagged: `generated_by_ai: true, requires_human_review: true`
- AI output requires explicit human confirmation before any state mutation
- AI cannot approve its own outputs
- AI cannot promote anything to canon
- AI confidence ≠ verification

---

*Document Status: CANON*
*Classification: Foundation — Vocabulary lock*
*Next review: When new platform-wide terms are formally introduced*
