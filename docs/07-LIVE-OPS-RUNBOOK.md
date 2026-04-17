# 07 — LIVE OPS RUNBOOK

**Document:** Sovereign OS Platform — Operational Procedures and Hygiene
**Version:** v5.0
**Status Relevance:** Applies to all current LIVE-VERIFIED phases (P0–P4).
**Generated:** 2026-04-17
**Relation to doc pack:** This is the procedural guide for operators.
When in doubt about how to proceed, this document is the operating manual.

---

## 1. Truth Lock Routine

**When to use:** At the start of every session, before any code change.

**Purpose:** Confirm the current baseline before any new work begins.
No session may assume prior state without executing this routine.

### Steps

```
STEP 1 — Read last handoff
  → Open /records → Handoffs tab
  → Identify active handoff
  → Read: current_truth, finished_work, partial_work, blockers, next_locked_move

STEP 2 — Verify live endpoints (if starting a new session)
  → curl https://sovereign-os-platform.pages.dev/health
      Expected: { "status": "ok", "persistence": "d1" }
  → curl https://sovereign-os-platform.pages.dev/status
      Expected: 200 OK, all active surfaces listed
  → If any surface returns non-200: STOP, diagnose, fix before proceeding

STEP 3 — Read current repo state (for implementation sessions)
  → Read src/index.tsx — confirm route registrations
  → Read src/lib/repo.ts — confirm data access patterns
  → Read migrations/ — confirm migration state
  → Read wrangler.jsonc — confirm D1 and KV bindings

STEP 4 — Restate confirmed baseline
  → Write a short truth lock summary:
      - What is definitely LIVE-VERIFIED
      - What is PARTIAL (exists but incomplete)
      - What is PENDING (defined but not built)
      - What P5 may touch / must NOT touch

STEP 5 — Proceed only after truth lock is complete
```

**Violation:** If truth lock is skipped and incorrect assumptions are made,
any resulting work is suspect. Revert and restart from truth lock.

---

## 2. Scope Lock Routine

**When to use:** After truth lock, before writing any code.

**Purpose:** Define exact boundaries of the current session's work.
Prevents scope drift and "while we're here" changes.

### Steps

```
STEP 1 — Write files to create (new files only)
STEP 2 — Write files to modify (existing files being changed)
STEP 3 — Write files to preserve (must NOT be touched this session)
STEP 4 — Write schema changes (if any migration is needed)
STEP 5 — Confirm: nothing bleeds into next phase territory
STEP 6 — Confirm: all modifications are additive (no DROP, no replace of stable code)
STEP 7 — Write scope lock summary and proceed
```

**Violation:** Any change outside the scope lock must be explicitly approved
before proceeding. Document the scope change reason.

---

## 3. Verification Routine

**When to use:** After every significant implementation step.

### Local Verification

```bash
# Build first
npm run build

# Start dev server with D1
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs

# Health check
curl localhost:3000/health
# Expected: { "status": "ok", "persistence": "d1" }

# Status check
curl localhost:3000/status
# Expected: all surfaces listed as active

# Surface spot checks (P0 surfaces)
curl localhost:3000/dashboard    → 200 OK
curl localhost:3000/intent       → 200 OK
curl localhost:3000/intake       → 200 OK
curl localhost:3000/architect    → 200 OK
curl localhost:3000/approvals    → 200 OK
curl localhost:3000/proof        → 200 OK
curl localhost:3000/live         → 200 OK
curl localhost:3000/records      → 200 OK
curl localhost:3000/continuity   → 200 OK

# P3 surfaces
curl localhost:3000/execution    → 200 OK
curl localhost:3000/connectors   → 200 OK
curl localhost:3000/roles        → 200 OK

# P4 surfaces (use real API key)
curl -H "X-Platform-Key: $YOUR_KEY" localhost:3000/w/executor   → 200 OK
curl localhost:3000/alerts       → 200 OK
curl localhost:3000/canon        → 200 OK
curl localhost:3000/lanes        → 200 OK
curl localhost:3000/reports      → 200 OK
```

### Production Verification

```bash
# Replace with actual production URL
BASE_URL="https://sovereign-os-platform.pages.dev"

curl $BASE_URL/health
curl $BASE_URL/status
curl $BASE_URL/dashboard
curl -H "X-Platform-Key: $PROD_KEY" $BASE_URL/w/executor
curl $BASE_URL/alerts
curl $BASE_URL/canon
curl $BASE_URL/lanes
curl $BASE_URL/reports
```

---

## 4. Deploy Hygiene

### Pre-Deploy Checklist

```
[ ] Truth lock completed for this session
[ ] Scope lock documented
[ ] All local tests passing (no 500 errors, no build errors)
[ ] Migration draft reviewed (if applicable)
  [ ] Migration uses IF NOT EXISTS / additive columns only
  [ ] No DROP statements
  [ ] Default values specified for all new columns
[ ] No secrets in code (all keys via env vars or Cloudflare secrets)
[ ] .dev.vars is in .gitignore (not committed)
[ ] npm run build succeeds without TypeScript errors
[ ] git status clean (all changes staged)
```

### Deploy Sequence

```bash
# 1. Build
cd /home/user/webapp && npm run build

# 2. Apply migration to production (if new migration)
npx wrangler d1 migrations apply sovereign-os-platform-production
# Verify: MUST complete without error

# 3. Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name sovereign-os-platform

# 4. Verify production
curl https://sovereign-os-platform.pages.dev/health
# Expected: { "status": "ok", "persistence": "d1" }

# 5. Spot-check critical surfaces
curl https://sovereign-os-platform.pages.dev/w/executor
curl https://sovereign-os-platform.pages.dev/alerts
curl https://sovereign-os-platform.pages.dev/canon

# 6. Git commit (if not already done)
git add . && git commit -m "[Phase]: description of what changed"
git push origin main
```

### If Deploy Fails

```
1. Do NOT claim production deployment
2. Document exact error output
3. Classify as: IMPLEMENTED + REPO-COMPLETE + PRODUCTION-PENDING
4. Provide exact wrangler commands for next operator
5. Stop at current verified state — do not attempt recovery changes without new truth lock
```

---

## 5. Secret Posture Rules

```
RULE 1 — Secrets are NEVER in code
  All secrets must be in .dev.vars (local) or Cloudflare Pages secrets (production)
  Never hardcode any key in src/, public/, or docs/

RULE 2 — Secrets are NEVER in logs
  If a secret appears in a log or console output, rotate it immediately
  Then document the rotation as a governance decision

RULE 3 — Secrets are NEVER shown in UI
  UI shows: "Configured ✅" or "Not Configured ⚠️"
  Never the raw value

RULE 4 — Secrets are NEVER in API responses
  Public API responses must be audited for secret leakage before deployment
  Including: webhook payloads (store as hash), AI outputs, role key values

RULE 5 — Secret rotation procedure
  1. Create new secret value
  2. Put new value as Cloudflare secret: npx wrangler pages secret put KEY_NAME
  3. Verify new value works in production
  4. Revoke old secret at source (if external API key)
  5. Document rotation in decision_records

CURRENT CONFIGURED SECRETS (P4 LIVE-VERIFIED):
  ✅ PLATFORM_API_KEY — platform auth key
  🎯 AI_ASSIST_API_KEY — P5 target
  🎯 SSO_CLIENT_SECRET — P5 target
  🎯 PLATFORM_JWT_SECRET — P5 target
```

---

## 6. Status Checking Procedure

### Platform Health Check

```bash
# Quick health check
curl https://sovereign-os-platform.pages.dev/health
# Expected response:
# {
#   "status": "ok",
#   "persistence": "d1",
#   "phase": "P4",
#   "timestamp": "..."
# }
```

### D1 Status Check (Local)

```bash
# List all tables
npx wrangler d1 execute sovereign-os-platform-production --local \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# Check sessions
npx wrangler d1 execute sovereign-os-platform-production --local \
  --command="SELECT COUNT(*) as count FROM sessions"

# Check migration state
npx wrangler d1 execute sovereign-os-platform-production --local \
  --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'd1_migrations'"
```

### PM2 Service Check

```bash
pm2 list               # Show all services
pm2 logs --nostream    # View recent logs (non-blocking)
pm2 restart webapp     # Restart if needed (clean port first)
```

---

## 7. Handoff Discipline

**Rule:** Every session that makes meaningful changes to the platform MUST produce a handoff.

### When to Create a Handoff

- After any implementation session (P0–P5+)
- When pausing a session mid-work (partial handoff)
- When transitioning between phases
- When handing off to a different operator or AI session

### Handoff Creation Procedure

```
1. Open /records → Handoffs tab → Create New Handoff
2. Fill all required fields:
   - current_truth: read from live D1 state + verified endpoints
   - scope_in: exactly what was completed this session
   - scope_out: explicitly what was NOT done
   - finished_work: specific, named artifacts (not vague "done some work")
   - partial_work: honest partial items with exact state
   - blockers: specific blockers with exact error or gap described
   - next_locked_move: exact next action for next session
   - proof_links: URLs, commit hashes, curl outputs
   - classification: LIVE-VERIFIED / VERIFIED / PARTIAL / PENDING per feature
3. Save handoff_record to D1
4. Verify: handoff appears in /continuity as active handoff
```

### Anti-Patterns

```
❌ "Completed most of the work" — not a handoff
❌ "Environment issues" — not a blocker description
❌ "Next: continue P5" — not a next locked move
❌ Handoff without classification — incomplete
❌ Handoff before truth lock — invalid
```

---

## 8. Continuity Update Rules

After every session with meaningful changes:

```
1. Update /continuity:
   - Set last_active_session to this session's title
   - Update next_locked_move to exact next action
   - Link last_handoff_id to the new handoff record

2. Update README.md:
   - Reflect new phase status
   - Update active surfaces list
   - Update any changed URL or deployment details

3. Git commit:
   git add .
   git commit -m "[Phase N]: brief, honest description of what changed"
   git push origin main
```

---

## 9. Issue and Blocker Procedure

When a blocker is encountered during a session:

```
STEP 1 — Document the blocker precisely
  NOT: "wrangler isn't working"
  YES: "wrangler pages deploy fails with error: [exact error message]. 
        Attempted commands: [exact commands run]. 
        Context: migration 0006 applied locally but prod deploy blocked by [reason]."

STEP 2 — Classify the blocking severity
  CRITICAL: Prevents core P0–P4 surfaces from functioning
  HIGH: Prevents current phase new feature from completing
  MEDIUM: Limits a non-critical feature
  LOW: Cosmetic or enhancement issue

STEP 3 — Log blocker in priority_items with category=HOLD
  Title: "[BLOCKED] exact description"
  Blocker_note: full error context

STEP 4 — Stop at repo-complete state
  - Commit all changes
  - Push to GitHub
  - Do NOT attempt recovery changes without new truth lock

STEP 5 — Create handoff with blocker documented
  - partial_work: the feature that is blocked
  - blockers: exact error, exact command, exact context
  - next_locked_move: "Resolve [blocker] then [specific next step]"
```

---

*Document Status: LIVE-VERIFIED (procedures based on P0–P4 operational experience)*
*Classification: Operations — Procedural guide*
*Next review: After P5 operations introduce new procedures (webhooks, AI assist, tenants)*
