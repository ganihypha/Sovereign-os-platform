────────────────────────────────────────────────────────────────────
MASTER SESSION PROMPT — P19
Platform: Sovereign OS Platform
Mission: Platform Hardening — Email Delivery, Session Tracking,
         Error Pages, /changelog Surface, Secrets Audit
Baseline: P18 LIVE-VERIFIED (v1.8.0-P18, 90 surfaces, commit 2aab7ca)
────────────────────────────────────────────────────────────────────

## OPERATING LAWS (Non-Negotiable — Read Before Every Action)

LAW 1 — NO ROLE COLLAPSE: Founder / Architect / Orchestrator / Executor / Reviewer are separate.
LAW 2 — NO FALSE VERIFY: Never claim a surface is working without proof (HTTP 200 + correct output).
LAW 3 — ADDITIVE ONLY: Migrations must never DROP columns/tables. Always CREATE IF NOT EXISTS.
LAW 4 — NO RAW KEYS: Never expose API keys, role keys, or secrets in any response.
LAW 5 — AI IS LAYER 2: AI cannot auto-approve, auto-promote, or self-execute. Human gate always.
LAW 6 — SMALLEST HONEST DIFF: Do the minimum necessary for the phase. Never scope-creep.
LAW 7 — STATUS HONESTY: PARTIAL means partial. Do not inflate classification.
LAW 8 — REGRESSION ZERO: Every phase must verify all prior surfaces still 200 OK.
LAW 9 — ONE MIGRATION PER PHASE: One numbered migration file per phase, additive only.

## TRUTH LOCK (Execute First — No Exceptions)

```bash
# Step 1: Verify production baseline
curl https://sovereign-os-platform.pages.dev/health
# Expected: {"version":"1.8.0-P18","phase":"P18 — UI/UX Upgrade..."}

# Step 2: Verify key surfaces
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/dashboard   # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/admin        # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/workflows/history  # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/api/v1       # 200

# Step 3: Confirm migration 0018 applied
# (confirmed in P18 — 13 commands applied to sovereign-os-production)
```

## CURRENT BASELINE (P18)

- **Production:** https://sovereign-os-platform.pages.dev
- **GitHub:** https://github.com/ganihypha/Sovereign-os-platform
- **DB:** sovereign-os-production (f6067325-9ea4-44bc-a5fd-e3d19367e657)
- **Migrations:** 0001 → 0018
- **Surfaces:** 90 total (all 200 OK)
- **Git:** 2aab7ca (main)

## P19 SCOPE (Hardening Session)

### MUST DO (P19 acceptance gate):
1. **Wire auth → platform_sessions** — Every login writes a row to platform_sessions table
   - File: `src/lib/auth.ts` (or wherever auth is validated)
   - Write: session_id, role_name, started_at, ip (from request headers)
   - Admin sessions page at /admin/sessions should show real data
2. **Email delivery** — Activate Resend for critical governance events
   - Set secret: `npx wrangler pages secret put RESEND_API_KEY --project-name sovereign-os-platform`
   - Create `src/lib/emailService.ts` — wrapper for Resend API
   - Send email on: Tier 3 approval requested, execution blocked, canon candidate ready
   - Email must not block request (fire-and-catch)
3. **Custom error pages** — Replace CF default 404/500
   - Handle 404 in Hono catch-all: return branded HTML 404 page
   - Handle 500 errors in Hono errorHandler: return branded HTML 500 page
4. **/changelog surface** — New GET /changelog route
   - Reads `platform_changelog` D1 table (seeded in 0018)
   - Table showing: version, phase, change_type, description, deployed_at
   - Add to Platform Admin nav group
5. **Migration 0019** — additive schema for any new tables needed

### SHOULD DO (if time allows):
6. Database timeout/error handling improvements (wrap D1 calls in try/catch with user-friendly messages)
7. Secrets audit: list all configured secrets via /admin/settings or /health extended

### OUT OF SCOPE (defer to P20):
- SSO/OAuth2 implementation
- New auth providers
- Billing integration
- Per-tenant rate limiting

## P19 FILE TARGETS

- `migrations/0019_p19_schema.sql` — New schema (email_log, error_log tables)
- `src/lib/emailService.ts` — NEW: Resend API wrapper
- `src/lib/auth.ts` — MODIFY: Add platform_sessions write on login
- `src/routes/index.ts` or `src/index.tsx` — MODIFY: 404/500 handlers
- `src/routes/changelog.ts` — NEW: /changelog surface
- `src/layout.ts` — MODIFY: Add /changelog to Platform Admin nav group
- `src/index.tsx` — MODIFY: version 1.9.0-P19, import changelog route

## P19 MIGRATION TEMPLATE

```sql
-- 0019_p19_schema.sql
-- P19: Email log, error tracking
CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / sent / failed
  provider TEXT NOT NULL DEFAULT 'resend',
  error_message TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_event ON email_log(event_type);

CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  stack_hint TEXT NOT NULL DEFAULT '',
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_error_path ON error_log(path);
CREATE INDEX IF NOT EXISTS idx_error_code ON error_log(status_code);
```

## P19 ACCEPTANCE GATE

- [ ] Auth login writes to platform_sessions (verified via /admin/sessions showing real data)
- [ ] Real email sent on Tier 3 approval request (verified via Resend dashboard or email inbox)
- [ ] Custom 404 page renders (branded, not CF default)
- [ ] Custom 500 handler renders (branded, not CF default)
- [ ] /changelog surface 200 OK showing P18 entries
- [ ] /changelog added to Platform Admin nav group
- [ ] All P0-P18 surfaces still 200 OK (zero regression)
- [ ] D1 migration 0019 applied to production
- [ ] GitHub pushed + Cloudflare deployed
- [ ] P19 handoff record produced

## VERSIONING

- Version: `1.9.0-P19`
- Phase label: `P19 — Platform Hardening, Email Delivery, Session Tracking, Changelog`

## CARRY-FORWARD FROM P18

1. `/policies/simulate` UI test pending (POST API fixed, UI smoke test not done)
2. `OPENAI_API_KEY` not set (AI Assist gracefully degraded)
3. Federation/Marketplace stubs (not real implementation)

## NEXT AFTER P19

P20 → SSO + OAuth2 + API hardening
(See `ops/roadmap/P18-to-GTM-roadmap.md` for full P19→GTM roadmap)

────────────────────────────────────────────────────────────────────
END SESSION PROMPT — P19
────────────────────────────────────────────────────────────────────
