# 10 — PRD DOC SYSTEM

**Document:** Sovereign OS Platform — Documentation System as Product Requirement
**Version:** v5.0
**Status Relevance:** This document describes what the documentation system must achieve.
**Generated:** 2026-04-17
**Relation to doc pack:** This document is the requirement spec for the document
pack itself. It defines what good looks like, what failure looks like, and
what the system must deliver to be operationally useful.

---

## 1. Purpose

This document treats the Sovereign OS Platform documentation system as a
product in its own right. Like any platform component, it must have:
- Defined user types and their needs
- Explicit goals and success criteria
- Explicit failure modes
- A quality bar it must meet
- Clear non-goals (what it is not trying to do)

---

## 2. User Types

### Founder / Platform Owner
**Context:** Has ultimate authority. Needs strategic clarity, not operational detail.

**What they need from docs:**
- One-file entry point showing platform state honestly
- Clear statement of what is live, what is planned, what is blocked
- Governance law reference (the 12 non-negotiables)
- Phase history to understand what has already been proven
- Canon promotion policy to exercise ratification authority correctly

**Success condition:** Founder can answer "what is the platform's current state?"
and "what is the next locked move?" without asking any operator.

---

### Master Architect / Session Lead
**Context:** Runs sessions, composes briefs, manages handoffs.

**What they need from docs:**
- Truth lock procedure (07-LIVE-OPS-RUNBOOK)
- Surface map to understand what exists and what doesn't (05-SURFACE-MAP)
- Data model to understand schema before writing migrations (04-DATA-MODEL)
- Handoff template to produce correct session close artifacts (12-HANDOFF-TEMPLATE)
- Phase history to know what must not be reopened (08-PHASE-HISTORY)

**Success condition:** Architect can start a new session, perform truth lock,
scope lock, implement, and produce a valid handoff — all guided by this doc pack.

---

### New Operator / Onboarder
**Context:** Joining the platform mid-stream. Needs to understand context quickly.

**What they need from docs:**
- Executive overview as single entry point (00-EXECUTIVE-OVERVIEW)
- Platform definition to understand what kind of system this is (01-PLATFORM-DEFINITION)
- Glossary to learn platform vocabulary (13-GLOSSARY)
- Runbook to start operating without making mistakes (07-LIVE-OPS-RUNBOOK)

**Success condition:** New operator can understand the platform's purpose,
vocabulary, and basic operational procedures without a synchronous onboarding call.

---

### AI Developer / AI Session
**Context:** AI agent executing a bounded implementation session.

**What they need from docs:**
- Platform identity lock (cannot drift)
- Governance laws (binding constraints on code)
- Surface map (what to build, what not to touch)
- Data model (schema to build against)
- Phase history (what is already done)
- Handoff template (how to close the session)

**Success condition:** AI Developer starts from truth lock, works within scope lock,
produces bounded implementation, closes with honest handoff — all from this doc pack.

---

### External Reviewer / Auditor
**Context:** Reviewing governance compliance, not implementing anything.

**What they need from docs:**
- Operating law (what governance rules apply)
- Phase history (proof of phase progression)
- Canon promotion policy (how decisions are officially elevated)
- Surface map (what surfaces exist and what they do)

**Success condition:** Auditor can verify that governance laws are being followed
and that no law has been silently violated.

---

## 3. Documentation Goals

1. **Durability:** Docs outlive individual sessions. They should be readable
   months after writing without needing the session context that produced them.

2. **Honesty:** Docs must reflect actual state, not aspirational state.
   PARTIAL features are documented as PARTIAL, not VERIFIED.

3. **Operability:** A qualified operator must be able to run a full session
   using only this doc pack. No missing procedures.

4. **Traceability:** Every claim in the docs must be traceable to a phase,
   a migration, a deployment record, or a governance decision.

5. **Non-redundancy:** Docs do not repeat each other extensively.
   Each document has a distinct purpose and cross-references others.

6. **Consistency:** Vocabulary is identical across all documents.
   The glossary (13-GLOSSARY) is the tie-breaker for any term conflict.

---

## 4. Success Criteria

The documentation system succeeds when:

- [ ] Any operator can answer "what is live right now?" from this doc pack alone
- [ ] Any operator can produce a valid handoff using the template
- [ ] Any AI Developer can start a P5 session using only this doc pack
- [ ] Any auditor can verify governance compliance from the operating law doc
- [ ] The Founder can answer "what is the next locked move?" without asking anyone
- [ ] No document contradicts another document on any material point
- [ ] All status labels in docs match the actual platform state
- [ ] The vocabulary is consistent across all documents (glossary enforced)
- [ ] A new operator can be onboarded using 00-EXECUTIVE-OVERVIEW alone as entry point

---

## 5. Failure Modes

The documentation system fails when:

```
❌ Status inflation: docs say LIVE-VERIFIED when platform is actually PARTIAL
❌ Vocabulary drift: different docs use different terms for the same concept
❌ Stale docs: phase completes but docs are not updated to reflect real outcomes
❌ Orphaned docs: documents reference surfaces or features that no longer exist
❌ Incomplete handoffs: handoff_records missing required sections
❌ Generic docs: documents that could apply to any platform (no Sovereign OS specificity)
❌ Over-documentation: docs so long that operators stop reading them
❌ Under-documentation: docs so sparse that operators must guess procedures
❌ Contradictions: two documents give conflicting instructions for same procedure
❌ AI noise: session noise (tool calls, debug output) polluting docs
```

---

## 6. Non-Goals

The documentation system is NOT:

- A project management tool (that's the live board and records system)
- A product marketing document (this is operational truth, not pitch material)
- An external user guide for end users of product lanes
  (product lanes document their own user guides)
- A developer API reference for external consumers
  (that is /api/v1/docs, a P5 target surface)
- A complete code reference (the code itself is the code reference)
- A chat log or session transcript

---

## 7. Quality Bar for Documentation

Each document in this pack must meet the following quality standard:

### Structure Quality
- Has a clear title with document purpose
- Has a version and status relevance statement
- Has explicit relation to the rest of the doc pack
- Is organized with numbered sections

### Content Quality
- Uses Sovereign OS Platform vocabulary (not generic DevOps language)
- Does not claim LIVE-VERIFIED status for non-live features
- Does not contain vague statements ("things are working")
- Does not contain session noise (tool invocations, debug output)
- Does not contradict other documents in the pack

### Operational Quality
- An operator can act on the information in the document
- Procedures are specific enough to follow without ambiguity
- Status labels match real platform state

### Honesty Quality
- If a feature is PARTIAL, it says PARTIAL
- If something is a P5 target, it says TARGET, not LIVE
- If a procedure is uncertain, it says TBD or PLANNED
- No inflation of maturity for appearances

---

## 8. Documentation Maintenance Schedule

| Event | Required Doc Update |
|-------|---------------------|
| Phase completion (LIVE-VERIFIED) | 00-EXECUTIVE-OVERVIEW, 03-SYSTEM-ARCHITECTURE, 08-PHASE-HISTORY, 09-PRODUCT-ROADMAP, README |
| New surface deployed | 05-SURFACE-MAP |
| New migration applied | 04-DATA-MODEL, 03-SYSTEM-ARCHITECTURE |
| Governance law change proposal | 02-OPERATING-LAW (only after founder approval) |
| New vocabulary introduced | 13-GLOSSARY |
| Session close | 12-HANDOFF-TEMPLATE (instantiated as handoff_record) |
| New product lane registered | 06-REPO-AND-LANE-STRATEGY, 05-SURFACE-MAP |
| New role created | 13-GLOSSARY, 02-OPERATING-LAW |

---

*Document Status: ACTIVE — applies to current doc pack*
*Classification: Roadmap — Documentation product requirement*
*Next review: After P5 when new documentation requirements (webhooks, AI assist) emerge*
