# 12 — HANDOFF TEMPLATE

**Document:** Sovereign OS Platform — Reusable Handoff Structure
**Version:** v5.0
**Status Relevance:** Applies to all phases. Use this template at every session close.
**Generated:** 2026-04-17
**Relation to doc pack:** This template is the standard format for all
`handoff_records` created in the platform. Every operator and every AI session
must use this structure.

---

## Instructions

1. **Fill every section** — blank sections are not acceptable
2. **Use real live state** — read from D1, not from memory or assumption
3. **Be specific** — vague entries (e.g., "things worked") are rejected
4. **Classify honestly** — PARTIAL is acceptable, inflation is not
5. **Commit after creating** — handoff record must be in D1 AND in git history

---

## HANDOFF RECORD TEMPLATE

```
────────────────────────────────────────────────────────────────────
HANDOFF RECORD
Platform: Sovereign OS Platform
Phase: [e.g., P4 / P5 / P5-partial]
Session Date: [YYYY-MM-DD]
Prepared By: [Role / Operator name]
Handoff ID: [auto-generated or manual: HND-YYYY-MM-DD-001]
────────────────────────────────────────────────────────────────────

== SECTION 1 — CURRENT TRUTH ==

What is confirmed working right now, read from live state:

Platform URL: [e.g., https://sovereign-os-platform.pages.dev]
Health Check Result: [paste curl output: { "status": "ok", "persistence": "d1" }]
D1 Migrations Applied: [e.g., 0001–0005]
Role Workspaces: [LIVE / PARTIAL / BLOCKED]
Alert System: [LIVE / PARTIAL / BLOCKED]
Canon Surface: [LIVE / PARTIAL / BLOCKED]
Auth Status: [CONFIGURED / MISSING]

Confirmed LIVE-VERIFIED surfaces:
  [List each surface: /dashboard, /intent, etc.]

Confirmed PARTIAL surfaces (exists but incomplete):
  [List each partial surface with what is incomplete]

Confirmed PENDING surfaces (not yet built):
  [List each planned but unbuilt surface]

────────────────────────────────────────────────────────────────────

== SECTION 2 — SCOPE IN (THIS SESSION) ==

Exact list of what was intended for this session:

  1. [Feature or task]
  2. [Feature or task]
  3. [Feature or task]
  ...

────────────────────────────────────────────────────────────────────

== SECTION 3 — SCOPE OUT (EXPLICITLY NOT THIS SESSION) ==

What was explicitly excluded from this session:

  - [Not built: reason]
  - [Not built: reason]
  ...

────────────────────────────────────────────────────────────────────

== SECTION 4 — FINISHED WORK ==

What was fully completed this session (specific, verifiable):

  ✅ [Specific artifact with evidence]
     Evidence: [commit hash / URL / curl output]

  ✅ [Specific artifact with evidence]
     Evidence: [...]

  ✅ [Migration applied]
     Evidence: [migration command output]

────────────────────────────────────────────────────────────────────

== SECTION 5 — PARTIAL WORK ==

What was started but is not complete (honest):

  🔸 [Feature name]: [exact state — e.g., "route created, tests passing,
      production deploy not yet executed"]
     Status: PARTIAL
     What remains: [specific next steps]

  🔸 [Feature name]: [exact state]
     Status: PARTIAL
     What remains: [...]

────────────────────────────────────────────────────────────────────

== SECTION 6 — BLOCKERS ==

What is blocked, with specific detail:

  🔴 [Blocker description]
     Type: [CRITICAL / HIGH / MEDIUM / LOW]
     Exact error: [paste exact error message or describe exact gap]
     Attempted: [list exact commands / steps tried]
     Not attempted: [what was not tried and why]
     Next operator should: [exact resolution steps]

  🔴 [No blockers this session — state explicitly if true]

────────────────────────────────────────────────────────────────────

== SECTION 7 — NEXT LOCKED MOVE ==

The ONE specific next action the next session must take first:

NEXT LOCKED MOVE: [Exact, specific, actionable next step]

Example (good):
  "Run `npx wrangler d1 migrations apply sovereign-os-platform-production`
   to apply migration 0006, then verify with PRAGMA table_info(tenants),
   then start Step 4 implementation (tenantContext.ts)"

Example (bad — not acceptable):
  "Continue with P5 implementation"

────────────────────────────────────────────────────────────────────

== SECTION 8 — PROOF LINKS ==

Evidence supporting the claims in this handoff:

  Production URL: [https://...]
  Health check output: [paste or reference]
  Build log: [relevant excerpt or "clean build, no errors"]
  Deployment log: [wrangler output or "not deployed this session"]
  Git commit: [commit hash or branch:commit]
  Migration apply: [wrangler output excerpt]
  Test results: [curl outputs or "local tests: all 200 OK"]

────────────────────────────────────────────────────────────────────

== SECTION 9 — CLASSIFICATION ==

Honest classification per feature built or modified this session:

  [Feature 1]:      LIVE-VERIFIED / VERIFIED / PARTIAL / PENDING
  [Feature 2]:      LIVE-VERIFIED / VERIFIED / PARTIAL / PENDING
  [Feature 3]:      LIVE-VERIFIED / VERIFIED / PARTIAL / PENDING
  
  Migration 0006:   APPLIED-LOCAL / APPLIED-PRODUCTION / PENDING
  
  All P0–P4 surfaces (regression):  PASS / FAIL [with detail if FAIL]
  
  Overall session:  LIVE-VERIFIED / VERIFIED / PARTIAL / PENDING

────────────────────────────────────────────────────────────────────

== SECTION 10 — PHASE BOUNDARY NOTES ==

What belongs to next phase and must NOT be opened in this session:

  🔒 [List things that are NOT in scope — be explicit]
  🔒 [White-label branding → P6]
  🔒 [Full AI agent autonomy → P6]
  ...

────────────────────────────────────────────────────────────────────

== SECTION 11 — FOR NEXT OPERATOR ==

Exact commands and context for continuing:

Environment:
  Platform: https://sovereign-os-platform.pages.dev
  D1 DB: sovereign-os-platform-production
  GitHub: [repo URL]

To continue from this handoff:
  1. curl https://sovereign-os-platform.pages.dev/health
     → Confirm: { "status": "ok", "persistence": "d1" }
  2. [Next specific command]
  3. [Next specific command]
  4. Start from: [exact file or feature]

Wrangler commands ready to run (if deploy was not completed):
  npm run build
  npx wrangler d1 migrations apply sovereign-os-platform-production
  npx wrangler pages deploy dist --project-name sovereign-os-platform

────────────────────────────────────────────────────────────────────
END OF HANDOFF RECORD
────────────────────────────────────────────────────────────────────
```

---

## Anti-Patterns (What a Handoff Must NOT Be)

```
❌ "Session went well, most things are working" — not a handoff
❌ "Issues were encountered but resolved" — not a handoff
❌ "See code for details" — not a handoff
❌ "Continue implementing P5" — not a next locked move
❌ A handoff without classification — incomplete
❌ A handoff that claims LIVE-VERIFIED without a production URL
❌ A handoff that says "no blockers" when there are unresolved issues
```

---

## Minimum Acceptable Handoff (When Time is Short)

If time is severely constrained, the minimum acceptable handoff must contain:

1. **Current truth** (at minimum: health check output)
2. **What was finished** (at minimum: one specific named artifact)
3. **Blockers** (explicit statement of blockers or "no blockers")
4. **Next locked move** (exact, specific)
5. **Classification** (at least overall: LIVE-VERIFIED / PARTIAL / PENDING)

Even a minimum handoff must be honest. An honest minimal handoff is always
better than a detailed handoff that inflates status.

---

*Document Status: CANONICAL TEMPLATE — Use for every session close*
*Classification: Operations — Handoff structure*
*Next review: When new handoff fields are required (e.g., tenant context in P5)*
