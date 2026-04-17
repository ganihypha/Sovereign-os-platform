# 02 — OPERATING LAW

**Document:** Sovereign OS Platform — Governance Non-Negotiables
**Version:** v5.0
**Status Relevance:** This document is CANON. Laws here are immutable.
**Generated:** 2026-04-17
**Relation to doc pack:** This is the binding constraint layer.
Every implementation decision, surface design, and phase plan must comply
with every law listed here.

---

## 1. Immutable Platform Laws (12 Laws)

These laws are non-negotiable. No phase may override them.
No AI output may weaken them. No performance pressure may suspend them.

---

### LAW 1 — NO ROLE COLLAPSE

**Definition:** The roles Founder, Master Architect, Orchestrator, Executor,
and Reviewer are strictly separate at all times.

**What this prohibits:**
- The same person acting as both Executor and Reviewer on the same artifact
- An AI agent absorbing multiple roles simultaneously
- A process that allows an Orchestrator to self-approve their own orchestration
- Auto-assignment of roles without explicit founder action

**Why it exists:** Role collapse destroys accountability. When the same actor
makes a decision and reviews it, proof becomes meaningless and canon becomes fiction.

---

### LAW 2 — INTENT FIRST

**Definition:** All work flows from explicit founder intent. No execution may
begin without a traceable source in an intent record or governance decision.

**What this prohibits:**
- Execution of work that cannot be traced to any intent or session
- Tool-driven or AI-inferred scope expansion without intent anchor
- "While we're here" scope additions without intake classification

**Why it exists:** Without intent first, the platform becomes a task runner,
not a governance layer.

---

### LAW 3 — NO FALSE VERIFICATION

**Definition:** Nothing may carry the status VERIFIED or LIVE-VERIFIED without
real, inspectable, traceable proof.

**What this prohibits:**
- AI-generated confidence scores substituting for human verification
- Status promotion based on assumption or memory
- Self-certification without an independent reviewer
- Showing VERIFIED in UI without a proof link or verification note

**Why it exists:** False verification destroys the value of canon and
makes the entire proof layer meaningless.

---

### LAW 4 — CANON IS EARNED

**Definition:** No artifact, decision, or output may be promoted to canon
automatically. Every promotion requires explicit human action (founder or architect),
a documented reason, and a review state of at least "reviewed."

**What this prohibits:**
- Auto-promotion by any process, script, or AI agent
- Canon promotion without explicit promotion_reason
- Canon promotion without reviewer role action
- AI-suggested canon candidates being treated as final canon

**Why it exists:** Canon is the platform's stable truth layer.
Automatic promotion corrupts the stability of that layer.

---

### LAW 5 — GOVERNANCE LANE ≠ PRODUCT LANE

**Definition:** Platform governance logic and product vertical business logic
must remain strictly separated.

**What this prohibits:**
- Product lane business logic embedded in platform core repo
- Platform surfaces serving as product UIs for specific verticals
- Product lane data polluting the platform's governance tables
- Governance decisions made for product-lane convenience

**Why it exists:** The moment the governance layer gets entangled with
product logic, it can no longer govern all products fairly and cleanly.

---

### LAW 6 — NO SECRET EXPOSURE

**Definition:** Credentials, API keys, platform secrets, and role keys must
never appear in UI output, API responses, logs, AI outputs, or audit records.

**What this prohibits:**
- Showing raw PLATFORM_API_KEY values anywhere
- Including connector credentials in webhook payloads
- AI outputs that reflect back input containing secrets
- Log entries that contain raw key values

**Why it exists:** Credential exposure is a single point of catastrophic
platform compromise.

---

### LAW 7 — NO UNDOCUMENTED MEANINGFUL ACTIVITY

**Definition:** Every significant governance action, role mutation, approval decision,
canon promotion, AI invocation, and integration event must produce an audit trace.

**What this prohibits:**
- Manual live-state edits without source documentation
- Approval decisions without a recorded reason
- Connector mutations without a registered log entry
- AI assist calls without ai_assist_log entry
- Webhook deliveries without webhook_delivery_log entry

**Why it exists:** Undocumented activity is invisible to continuity.
What is invisible cannot be audited, corrected, or trusted.

---

### LAW 8 — LIVE STATE OVER GUESSWORK

**Definition:** All operational decisions must be based on current live state
read from D1 database and verified endpoints — not from memory, AI inference,
or assumption.

**What this prohibits:**
- Assuming prior session state without reading it from live systems
- AI agents making operational decisions from inferred context
- Status decisions based on "it should be working"
- Phase completion claims without live verification

**Why it exists:** Stale state leads to false assumptions, which produce
bad decisions and corrupt governance records.

---

### LAW 9 — NO GREENFIELD REBUILD

**Definition:** Every phase is an additive expansion of the existing verified baseline.
No phase may reconstruct, redesign, or replace prior verified work without
explicit regression evidence.

**What this prohibits:**
- Rebuilding the data model from scratch in a new phase
- Replacing migrations instead of adding new ones
- Starting over with a different framework while claiming the same platform
- Reopening P0–P4 hardening work without proven regression

**Why it exists:** Greenfield rebuilds destroy the value of prior verified work
and reset the maturity clock to zero.

---

### LAW 10 — STATUS HONESTY

**Definition:** Status labels must precisely and accurately describe current
real state. There are exactly four valid status levels for platform artifacts:

| Status | Meaning |
|--------|---------|
| LIVE-VERIFIED | Deployed to production, tested, URL evidence exists |
| VERIFIED | Built and tested locally or in sandbox, not yet deployed |
| PARTIAL | Exists but is incomplete in material ways |
| PENDING | Defined or planned but not yet built |

**What this prohibits:**
- Calling something LIVE-VERIFIED without a production URL test
- Calling something VERIFIED when it is only designed
- Collapsing PARTIAL into VERIFIED to appear more complete
- Any status inflation motivated by session performance or appearance

**Why it exists:** Status is the foundation of inter-session trust.
Inflated status corrupts every downstream decision that relies on it.

---

### LAW 11 — SMALLEST HONEST DIFF

**Definition:** Every phase, every session, every change should do the minimum
honest work required to reach the stated scope. Speculative features, "nice to have"
additions, and anticipatory architecture are prohibited unless explicitly scoped.

**What this prohibits:**
- Adding P6 features during P5 because they "might be needed"
- Refactoring stable P0–P4 code without a specific governance reason
- Architecture redesign based on anticipated future scale
- "While we're here" changes to unrelated surfaces

**Why it exists:** Unbounded scope expansion degrades quality, creates
undocumented changes, and makes honest classification impossible.

---

### LAW 12 — PRODUCTION CLAIMS REQUIRE PROOF

**Definition:** Any claim that the platform, a feature, or a surface is
"live in production" requires evidence in the form of a verifiable production URL,
a deployment log, or a direct curl/test output confirming the live state.

**What this prohibits:**
- Claiming production deployment without a deployment command log
- Saying "deployed" when wrangler deploy was not actually run
- Presenting a local build as equivalent to production deployment
- Documenting production URLs that have not been verified

**Why it exists:** False production claims corrupt the LIVE-VERIFIED status
tier and undermine the foundation of the platform's trust model.

---

## 2. Role Separation Law

Five roles are defined in the platform. Each role is strictly bounded.

| Role | Layer | Authority | Prohibited From |
|------|-------|-----------|----------------|
| Founder | L0 | Strategic direction, Tier 3 approval, canon ratification | Daily technical management |
| Master Architect | L1 | Intent capture, scope definition, session structure, handoff | Self-executing implementation work |
| Orchestrator | L2 | Readiness gating, approval routing, brief composition | Making strategic decisions, self-approving |
| Executor | L3 | Bounded implementation, proof return | Self-reviewing own work, self-promoting to canon |
| Reviewer | L4 | Proof review, verification, classification | Mutating execution items, issuing approvals |

**Cross-role violations return 403**, never a silent pass.

---

## 3. Proof Law

- All execution work returns proof before changing status
- Proof must be classified (PASS / PARTIAL / FAIL / BLOCKED) by a Reviewer
- Unclassified proof carries no status weight
- No work item may self-advance from PROOF_SUBMITTED to REVIEWED
- Proof is stored in proof_artifacts (D1), linked to work_item

---

## 4. Approval Law

Four tiers. No tier may be skipped by any process, AI, or automation.

| Tier | Name | Gate | Approver |
|------|------|------|---------|
| 0 | Auto | Safe, reversible | System (no human) |
| 1 | Async | Standard governance | Architect or above |
| 2 | Sync | Sensitive mutation | Architect or above (must wait) |
| 3 | Founder Only | Strategic / irreversible | Founder only, cannot be delegated |

---

## 5. Canon Promotion Law

- Candidates must be sourced from a proof_artifact or decision_record
- Review state must be at minimum "under_review" before promotion is eligible
- Promotion requires: explicit human action, promotion_reason (min 20 chars),
  role = founder or architect
- No endpoint, no automation, no AI agent may promote to canon
- Promoted items are LOCKED — no inline edits after promotion
- Rejected candidates receive a rejection_reason — not silently discarded

---

## 6. Live State Law

- Live state is read from D1 database in real time
- No live state surface may display data older than one page load
- Live board changes (NOW/NEXT/LATER/HOLD/NOT NOW) must trace to a decision,
  request, or proof — no manual edits without source
- Live state feeds /dashboard, /live, /reports — all must reflect D1 truth

---

## 7. Documentation Law

- All significant platform changes must update the relevant documentation
- Phase completions require: README update, handoff document, acceptance criteria table
- Session briefs must reference active session record in D1
- Documentation in /docs is the canonical reference — live with the platform

---

## 8. Status Honesty Law

See Law 10 above. In addition:
- AI cannot set or change status labels
- Partial completion of a feature must be documented as PARTIAL, not ignored
- When in doubt between PARTIAL and VERIFIED: use PARTIAL
- The acceptance criteria table in every phase handoff must use exact status labels

---

## 9. Failure and Blocker Handling Law

When a blocker is encountered:
1. Document the blocker with specific detail (not "environment issue")
2. Stop at repo-complete state (commit all work, do not claim deployment)
3. Classify the feature as PARTIAL or PENDING, not VERIFIED
4. Provide exact commands for the next operator to continue
5. Do not claim the session is complete when blockers are unresolved

Failure is acceptable. Undocumented failure is not.

---

*Document Status: CANON*
*Classification: Foundation — Governance constraint layer*
*Next review: Only if explicit governance change proposal is approved by Founder*
