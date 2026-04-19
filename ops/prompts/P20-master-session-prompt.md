────────────────────────────────────────────────────────────────────
MASTER SESSION PROMPT — P20
Platform: Sovereign OS Platform
Mission: SSO + OAuth2, API Hardening, Email Route Wiring, DB Error Handling
Baseline: P19 LIVE-VERIFIED (v1.9.0-P19, 97 surfaces, commit 02e3d84)
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
# Expected: {"version":"1.9.0-P19","phase":"P19 — Platform Hardening..."}

# Step 2: Verify key surfaces
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/dashboard      # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/changelog      # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/admin          # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/not-found-xyz  # 404

# Step 3: Confirm migration 0019 applied
# (confirmed — 10 commands applied to sovereign-os-production)
```

## CURRENT BASELINE (P19)

- **Production:** https://sovereign-os-platform.pages.dev
- **GitHub:** https://github.com/ganihypha/Sovereign-os-platform
- **DB:** sovereign-os-production (f6067325-9ea4-44bc-a5fd-e3d19367e657)
- **Migrations:** 0001 → 0019
- **Surfaces:** 97 total (all 200 OK)
- **Git:** 02e3d84 (main)

## P20 SCOPE

### MUST DO (P20 acceptance gate):

1. **Wire email calls into governance routes**
   - `/approvals` POST: call `emailTier3ApprovalRequested()` when tier=3 approval created
   - `/execution` block action: call `emailExecutionBlocked()` when task blocked
   - `/canon` promote action: call `emailCanonCandidateReady()` when candidate submitted
   - All calls must be fire-and-catch (non-blocking)
   - Import from `src/lib/emailService.ts`
   - NOTE: RESEND_API_KEY must be set first: `npx wrangler pages secret put RESEND_API_KEY --project-name sovereign-os-platform`

2. **SSO — OAuth2 skeleton (real implementation)**
   - Currently `/auth/sso` is a stub page
   - Implement real OAuth2 PKCE flow for GitHub OAuth or generic OIDC
   - Store tokens as Cloudflare Pages secrets (never in D1)
   - Create `src/lib/ssoService.ts` — OAuth2 flow handler
   - `/auth/sso/callback` route — handle OAuth redirect
   - POST `/auth/sso/initiate` — redirect to provider
   - Session cookie set after successful OAuth2 login

3. **API Hardening**
   - `/api/v1` and `/api/v2` — add rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset)
   - API key scoped permissions enforcement (already has logic, verify it's enforced)
   - API request logging to D1 (fire-and-catch, log to a new api_request_log table)
   - Add `Cache-Control: no-store` to all sensitive API responses

4. **Database error handling improvements**
   - Wrap all D1 calls in `try/catch` across routes
   - Return user-friendly error message (not raw DB error)
   - Specifically fix surfaces that currently return raw D1 errors in HTML

5. **Migration 0020** — additive schema for new tables

### SHOULD DO (if time allows):
6. Secrets audit surface at `/admin/settings` — show which secrets are configured (boolean only, never values)
7. `/admin/sessions` active session count badge in nav
8. Rate limit visualization on /metrics surface

### OUT OF SCOPE (defer to P21):
- Multi-tenant SSO (per-tenant OAuth providers)
- Billing integration
- SAML support
- Mobile app

## P20 FILE TARGETS

- `migrations/0020_p20_schema.sql` — api_request_log table, sso_sessions table
- `src/lib/ssoService.ts` — NEW: OAuth2 PKCE flow handler
- `src/lib/emailService.ts` — VERIFY: existing (do not change unless bug)
- `src/routes/approvals.ts` — MODIFY: wire emailTier3ApprovalRequested on tier=3 create
- `src/routes/execution.ts` — MODIFY: wire emailExecutionBlocked on block action
- `src/routes/canon.ts` — MODIFY: wire emailCanonCandidateReady on candidate submit
- `src/routes/sso.ts` — MODIFY: replace stub with real OAuth2 PKCE flow
- `src/index.tsx` — MODIFY: version 1.10.0-P20, import sso route update

## P20 MIGRATION TEMPLATE

```sql
-- 0020_p20_schema.sql
-- P20: SSO sessions, API request log
CREATE TABLE IF NOT EXISTS sso_sessions (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,             -- 'github' / 'google' / 'oidc'
  state TEXT NOT NULL,                -- PKCE state (hashed)
  code_verifier_hash TEXT NOT NULL,   -- PKCE code verifier (hashed)
  user_email TEXT NOT NULL DEFAULT '',
  access_token_hash TEXT NOT NULL DEFAULT '',  -- NEVER store plaintext
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sso_provider ON sso_sessions(provider);
CREATE INDEX IF NOT EXISTS idx_sso_created ON sso_sessions(created_at);

CREATE TABLE IF NOT EXISTS api_request_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_version TEXT NOT NULL DEFAULT 'v1',
  path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER NOT NULL DEFAULT 200,
  api_key_id TEXT NOT NULL DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT 'default',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_arl_path ON api_request_log(path);
CREATE INDEX IF NOT EXISTS idx_arl_key ON api_request_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_arl_logged ON api_request_log(logged_at);
```

## P20 ACCEPTANCE GATE

- [ ] Email wired in /approvals (tier=3 triggers emailTier3ApprovalRequested)
- [ ] Email wired in /execution (block triggers emailExecutionBlocked)
- [ ] Email wired in /canon (submit triggers emailCanonCandidateReady)
- [ ] /auth/sso has real OAuth2 PKCE flow (not stub)
- [ ] /auth/sso/callback handles OAuth redirect correctly
- [ ] API rate limit headers present on /api/v1 and /api/v2
- [ ] D1 calls wrapped in try/catch across key routes
- [ ] All P0-P19 surfaces still 200 OK (zero regression)
- [ ] D1 migration 0020 applied to production
- [ ] GitHub pushed + Cloudflare deployed
- [ ] P20 handoff record produced

## VERSIONING

- Version: `1.10.0-P20`
- Phase label: `P20 — SSO + OAuth2, Email Wiring, API Hardening`

## CARRY-FORWARD FROM P19

1. RESEND_API_KEY not set — set via wrangler secret before email wiring test
2. Email calls not yet wired into routes (emailService.ts ready, no callers)
3. /policies/simulate POST full UI test (carry from P18)
4. OPENAI_API_KEY not set (AI Assist gracefully degraded)
5. AUTH0_CLIENT_SECRET / CLERK_SECRET_KEY not set (SSO stubs)

## NEXT AFTER P20

P21 → Multi-tenant SSO + Per-tenant rate limiting + Billing hooks
(See `ops/roadmap/P18-to-GTM-roadmap.md` for full P19→GTM roadmap)

────────────────────────────────────────────────────────────────────
END SESSION PROMPT — P20
────────────────────────────────────────────────────────────────────
