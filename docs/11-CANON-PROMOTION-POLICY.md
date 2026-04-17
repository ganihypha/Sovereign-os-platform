# 11 — CANON PROMOTION POLICY

**Document:** Sovereign OS Platform — Canon Promotion Control Policy
**Version:** v5.0
**Status Relevance:** This policy is active and applies from P0 onward.
**Generated:** 2026-04-17
**Relation to doc pack:** This is the definitive rule set governing what may
become canon. It applies to all roles, all phases, and all automation.
No exception exists.

---

## 1. What Canon Is

Canon is the platform's **stable, official, promoted body of decisions,
rules, structures, and doctrine** that constitutes permanent operating truth.

Canon is:
- The reference that survives sessions and operators
- The layer that does not change without explicit founder/architect action
- The source a new operator uses to understand what is settled governance truth
- Read-heavy by design — not a task board, not a working document

Canon is **not**:
- A collection of everything ever written
- A repository of unreviewed outputs
- Anything produced by AI without human confirmation and promotion
- Anything that has not passed proof review

---

## 2. Candidate Criteria

An artifact may be nominated as a canon candidate only if it meets ALL of the following:

```
✅ The artifact has a verified proof_artifact or decision_record as source
✅ The artifact is stable: it is not expected to change significantly in the near term
✅ The artifact has real governance value: it defines a rule, decision, operating model,
   or technical architecture that other work should reference
✅ The artifact has been reviewed by at least one party other than its creator
✅ The artifact does not contradict existing canon (must resolve conflicts first)
✅ The artifact is expressed in durable, clear language — not session-specific jargon
```

If any criterion is not met: the artifact is **not eligible** for canon nomination.

---

## 3. Verification Threshold

Before an artifact may be promoted to canon:

1. **Source reference** must be documented: proof_artifact ID or decision_record ID
2. **Review status** must be at minimum `under_review` in `canon_candidates` table
3. **Reviewer action** must have occurred: a Reviewer role must have classified
   the source proof_artifact (PASS or PARTIAL, not FAIL or BLOCKED)
4. **No open blocker** tied to the artifact may exist in priority_items

---

## 4. Who Can Promote

Only two roles may execute a canon promotion:

| Role | Can Nominate as Candidate | Can Promote to Canon |
|------|--------------------------|---------------------|
| Founder | Yes | Yes (final ratification authority) |
| Master Architect | Yes | Yes (with rationale) |
| Orchestrator | Yes | No |
| Executor | No | No |
| Reviewer | Can recommend via review | No |
| AI Agent (any) | No | No |
| Automation / Script | No | No |

**Immutable:** No endpoint, no cron job, no AI output, and no automation
may promote an artifact to canon. The action must be a direct human API call
or UI interaction by a Founder or Architect key.

---

## 5. Required Evidence for Promotion

When executing a promotion action:

```
Required fields (API: POST /api/canon/:id/promote):
  - promotion_reason: TEXT (minimum 20 characters)
    Must explain WHY this is being promoted to canon, not just what it is
  - promoted_by: derived from auth key (Founder or Architect role only)

Required prior state (validated by application layer before promotion):
  - canon_candidates.review_status = 'under_review' or 'pending_review'
  - canon_candidates.status ≠ 'promoted' (cannot re-promote)
  - canon_candidates.status ≠ 'rejected' (rejected cannot be re-promoted without new nomination)
  - No active BLOCKED proof_artifacts linked to this candidate
```

---

## 6. What Must Stay as Working Material

The following types of content must NOT be promoted to canon:

```
🚫 Session briefs and bounded briefs — working material, session-specific
🚫 Draft prompts not yet validated in production — speculative
🚫 Partial implementations (PARTIAL status) — incomplete artifacts
🚫 AI-generated outputs without human confirmation — not verified
🚫 Technical experiments that have not been proof-verified — untested
🚫 Product lane-specific decisions (belong in lane docs, not platform canon)
🚫 Time-sensitive operational notes — these belong in operator_notes
🚫 Redundant material that duplicates existing canon — reduces canon quality
```

---

## 7. Anti-Pollution Rule for Canon

**Definition:** Canon pollution is the promotion of material that should NOT
be in canon, causing the canon layer to become noisy, internally contradictory,
or operationally misleading.

### How Pollution Happens

- Promoting too frequently (every decision becomes "canon")
- Promoting product-lane-specific decisions to platform canon
- Promoting session artifacts that are transient by nature
- Promoting AI-generated content without proper proof chain
- Promoting material that contradicts prior canon without resolving the conflict

### Prevention Rules

1. **Quality gate:** If in doubt, wait. Canon promotion is irreversible
   without an explicit rejection + re-nomination cycle.
2. **Conflict check:** Before promotion, verify the candidate does not
   contradict any existing promoted canon item.
3. **Specificity check:** The candidate must say something durable and
   platform-wide — not something that only applies to the current session.
4. **Volume control:** High-volume promotion devalues canon. Prefer fewer,
   higher-quality canon items over many marginal ones.

---

## 8. Promotion Workflow (Step by Step)

```
1. Work item is completed → proof_artifact created
2. Reviewer classifies proof_artifact → PASS or PARTIAL
3. Architect identifies artifact as canon candidate
4. Architect nominates: creates entry in canon_candidates
   → Status: pending_review
5. Artifact moves to under_review
   → Review: no open blockers, source verified, content durable
6. Architect or Founder visits /canon
7. Founder or Architect provides promotion_reason (min 20 chars)
8. Clicks [Promote to Canon]
9. System:
   a. Validates role (must be founder or architect)
   b. Validates review_status
   c. Validates promotion_reason length
   d. Creates canon_promotions record
   e. Updates canon_candidates.status → promoted
   f. Locks item (no further edits)
10. Canon item appears in canon list — LOCKED
11. Platform alert: canon_candidate_ready acknowledged
```

---

## 9. Rejection Procedure

When an artifact is rejected from canon:

```
1. Founder or Architect visits /canon
2. Clicks [Reject] on the candidate
3. Provides rejection_reason (required, min 10 chars)
4. System:
   a. Updates canon_candidates.status → rejected
   b. Records rejected_at timestamp
   c. Records rejection_reason
5. Rejected candidates:
   - Are NOT deleted
   - Are visible in history (for audit)
   - CANNOT be re-promoted without a new nomination and new review cycle
   - Must resolve the rejection reason before a new nomination is valid
```

---

## 10. AI Governance in Canon Promotion

AI Assist (P5+) may:
- Suggest an artifact as a canon candidate (suggestion only)
- Generate a draft promotion_reason (requires human edit and confirmation)
- List existing canon items for context

AI Assist may NOT:
- Execute a promotion action
- Set review_status to any value
- Bypass the promotion_reason validation
- Mark any artifact as VERIFIED or LIVE-VERIFIED
- Self-confirm its own suggestions

The human confirmation gate (POST /api/ai-assist/confirm/:id) must be executed
by a Founder or Architect before any AI-suggested canon nomination takes effect.

---

*Document Status: CANON — active from P0, applies to all phases*
*Classification: Roadmap — Canon governance policy*
*Next review: Only if explicit governance change proposal is approved by Founder*
