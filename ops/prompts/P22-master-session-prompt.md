────────────────────────────────────────────────────────────────────
MASTER SESSION PROMPT — P22
Platform: Sovereign OS Platform
Mission: AI Integration (real GPT-4), Branding/White-label, Plan Enforcement, Operator Wizard
Baseline: P21 LIVE-VERIFIED (v2.1.0-P21, 99+ surfaces, commit a4187e8)
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
# Expected: {"version":"2.1.0-P21","phase":"P21 — Multi-Tenant SSO..."}

# Step 2: Verify key surfaces
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/dashboard      # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/plans          # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/billing        # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/changelog      # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/not-found-xyz  # 404

# Step 3: Confirm migration 0023 applied
# (confirmed — 17 commands applied to sovereign-os-production)
```

## CURRENT BASELINE (P21)

- **Production:** https://sovereign-os-platform.pages.dev
- **GitHub:** https://github.com/ganihypha/Sovereign-os-platform
- **DB:** sovereign-os-production (f6067325-9ea4-44bc-a5fd-e3d19367e657)
- **Migrations:** 0001 → 0023
- **Git:** a4187e8 (main)
- **Platform Version:** 2.1.0-P21
- **KV:** RATE_LIMITER_KV (b36f941ace3445d68d335d8cebc0803a)

## P22 SCOPE

### MUST DO (P22 acceptance gate):

1. **Real AI Integration (GPT-4)**
   - Set OPENAI_API_KEY via wrangler secret FIRST
   - `/ai-assist` — replace graceful degradation banner with real GPT-4 suggestions
   - `src/lib/aiAssist.ts` — wire real OpenAI API call (currently stub/degraded)
   - AI outputs: ALWAYS tagged 'ai-generated', human gate mandatory (LAW 5)
   - `/api/v1/anomaly-detect` — upgrade to real ML anomaly scoring (not stub)
   - Session brief: AI-generated governance summary (non-blocking, fire-and-catch)
   - All AI calls: non-blocking, graceful on failure

2. **Branding / White-label Basic**
   - `/branding` surface: currently stub — add real tenant branding preview
   - Per-tenant: logo URL, primary color, company name (stored in D1 tenant_branding table)
   - Apply tenant branding in portal: `/portal/:slug` uses tenant CSS variables
   - Welcome email branding: use tenant name/logo in email template

3. **Plan Enforcement at Route Level**
   - Check tenant plan before serving SSO, AI Assist, Federation surfaces
   - `src/lib/planGuard.ts` — NEW: plan gate middleware
   - If tenant plan.sso_allowed = 0 → return 403 "Upgrade to Enterprise for SSO"
   - If tenant plan.ai_assist_allowed = 0 → return 403 "Upgrade to Enterprise for AI Assist"
   - Apply to: /auth/sso/init/:tid, /ai-assist, /federation
   - Graceful degradation: show upgrade CTA, not raw error

4. **Operator Onboarding Wizard**
   - `/onboarding` surface — step-by-step guided setup (reads operator_onboarding D1 table)
   - Steps: Account Setup → Configure Roles → Create First Workflow → Register First Connector → Complete
   - Progress tracking: update operator_onboarding D1 on each step completion
   - Welcome email on step 1 completion (fire-and-catch via emailService.ts)
   - Redirect new tenants to /onboarding if onboarding_complete = 0

5. **Migration 0024** — additive schema for P22

### SHOULD DO (if time allows):
6. Admin secrets dashboard: `/admin/settings` add secrets status section (boolean only, NEVER values)
   - Show: OPENAI_API_KEY configured (boolean), RESEND_API_KEY (boolean), AUTH0 (boolean), STRIPE (boolean)
7. Rate limit visualization on /metrics surface (API call usage vs limit)
8. Tenant branding preview in /branding surface

### OUT OF SCOPE (defer to P23):
- Real Chart.js charts from D1 time-series in /reports
- Scheduled report email delivery
- CSV/PDF export async job queue
- Metrics Cron Trigger

## P22 FILE TARGETS

- `migrations/0024_p22_schema.sql` — tenant_branding table, onboarding_wizard_state
- `src/lib/aiAssist.ts` — MODIFY: wire real OpenAI API call
- `src/lib/planGuard.ts` — NEW: plan gate middleware factory
- `src/routes/branding.ts` — MODIFY: add per-tenant branding preview + D1 persistence
- `src/routes/onboarding.ts` — MODIFY: upgrade stub to full wizard
- `src/routes/sso.ts` — MODIFY: add planGuard check on /init/:tid
- `src/routes/aiassist.ts` — MODIFY: real GPT-4 wiring
- `src/index.tsx` — MODIFY: version 2.2.0-P22, /onboarding route

## P22 MIGRATION TEMPLATE

```sql
-- 0024_p22_schema.sql
-- P22: Tenant branding, onboarding wizard state

CREATE TABLE IF NOT EXISTS tenant_branding (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT 'Sovereign OS',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#4f8ef7',
  secondary_color TEXT NOT NULL DEFAULT '#8b5cf6',
  favicon_url TEXT,
  support_email TEXT,
  custom_css TEXT,            -- max 4000 chars of safe CSS overrides
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onboarding_wizard_state (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  current_step INTEGER NOT NULL DEFAULT 1,  -- 1-5
  step1_done INTEGER NOT NULL DEFAULT 0,    -- account setup
  step2_done INTEGER NOT NULL DEFAULT 0,    -- roles configured
  step3_done INTEGER NOT NULL DEFAULT 0,    -- first workflow
  step4_done INTEGER NOT NULL DEFAULT 0,    -- first connector
  step5_done INTEGER NOT NULL DEFAULT 0,    -- complete
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## P22 ACCEPTANCE GATE

- [ ] /ai-assist generates real GPT-4 suggestions (not degraded banner)
- [ ] OPENAI_API_KEY set via wrangler secret
- [ ] /api/v1/anomaly-detect returns real scores
- [ ] /branding has per-tenant branding preview + D1 persistence
- [ ] /onboarding wizard is functional (steps 1-5, progress tracked in D1)
- [ ] planGuard checks SSO/AI-assist feature gates
- [ ] Migration 0024 applied to production
- [ ] All P0-P21 surfaces still 200 OK (zero regression)
- [ ] GitHub pushed + Cloudflare deployed
- [ ] P22 handoff record produced

## VERSIONING

- Version: `2.2.0-P22`
- Phase label: `P22 — AI Integration, Branding, Plan Enforcement, Operator Onboarding`

## CARRY-FORWARD FROM P21

1. RESEND_API_KEY not set — set via wrangler secret (all email wiring ready)
2. AUTH0_CLIENT_SECRET / CLERK_SECRET_KEY not set — SSO PKCE ready
3. STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET not set — billing webhook ready
4. Billing HMAC signature verification (needs STRIPE_WEBHOOK_SECRET)
5. /policies/simulate POST full UI test (carry from P18)
6. Per-tenant plan enforcement at route level (P22 MUST DO #3)

## LOCAL DEV COMMAND (P22)

```bash
cd /home/user/webapp
# Apply new migration first:
npx wrangler d1 migrations apply sovereign-os-production --local
# Then start:
pm2 start ecosystem.config.cjs
# ecosystem.config.cjs args: wrangler pages dev dist --d1=sovereign-os-production --kv=RATE_LIMITER_KV --local --ip 0.0.0.0 --port 3000
```

## NEXT AFTER P22

P23 → Reports + Analytics + Export Polish (real Chart.js, scheduled emails, async export jobs)
P24 → Marketplace + Federation + Ecosystem Scaffold
P25 → GTM Final Polish + Launch Readiness
(See `ops/roadmap/P18-to-GTM-roadmap.md` for full roadmap)

────────────────────────────────────────────────────────────────────
END SESSION PROMPT — P22
────────────────────────────────────────────────────────────────────
