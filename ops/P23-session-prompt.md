────────────────────────────────────────────────────────────────────
MASTER SESSION PROMPT — P23
Platform: Sovereign OS Platform
Mission: Reports + Analytics Polish, Real Chart.js, Scheduled Reports, Export Jobs
Baseline: P22 LIVE-VERIFIED (v2.2.0-P22, 100+ surfaces, commit 2c1b200)
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
# Expected: {"version":"2.2.0-P22","phase":"P22 — AI Integration..."}

# Step 2: Verify key surfaces
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/dashboard      # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/reports        # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/metrics        # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/ai-assist      # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/not-found-xyz  # 404

# Step 3: Confirm migration 0024 applied
# (confirmed — 17 commands applied to sovereign-os-production)
```

## CURRENT BASELINE (P22)

- **Production:** https://sovereign-os-platform.pages.dev
- **GitHub:** https://github.com/ganihypha/Sovereign-os-platform
- **DB:** sovereign-os-production (f6067325-9ea4-44bc-a5fd-e3d19367e657)
- **Migrations:** 0001 → 0024
- **Git:** 2c1b200 (main)
- **Platform Version:** 2.2.0-P22
- **KV:** RATE_LIMITER_KV (b36f941ace3445d68d335d8cebc0803a)
- **AI:** GROQ_API_KEY active (llama-3.3-70b-versatile) ✅

## P23 SCOPE

### MUST DO (P23 acceptance gate):

1. **Real Chart.js Charts in /reports**
   - Replace static/placeholder chart HTML with real Chart.js from CDN
   - Fetch real D1 time-series data from: metrics_snapshots, audit_log_v2, execution_items
   - Charts: governance activity over time, execution status distribution, anomaly count trend
   - Non-blocking: show loading state, catch D1 errors gracefully
   - Public CDN: `https://cdn.jsdelivr.net/npm/chart.js`

2. **Metrics Cron Trigger (Auto-Snapshot)**
   - Add Cloudflare Cron Trigger to wrangler.jsonc: `"0 * * * *"` (hourly)
   - Handler: write metrics_snapshot to D1 (intent count, execution count, anomaly count)
   - Endpoint: `GET /api/v1/metrics/snapshots` — return last 24h snapshots for charting
   - Non-blocking: cron errors must not affect main surfaces

3. **Audit Export Job**
   - `GET /audit/export` — generate CSV from audit_log_v2 (last 500 records)
   - Response: CSV with headers (id, event_type, tenant_id, actor_role, description, created_at)
   - Status page: `/audit/export/status` — show last export job info
   - Store job result reference in D1 (audit_export_jobs table in migration 0025)
   - Non-blocking: async with job ID, poll for completion

4. **Report Subscription Email Delivery**
   - `/reports/subscriptions` — upgrade stub to real email delivery (if RESEND_API_KEY set)
   - Weekly summary email: top 5 governance events, execution status, anomaly count
   - emailService.ts: add `emailWeeklyReport()` function
   - Graceful degradation: show "email not configured" if RESEND_API_KEY missing

5. **Migration 0025** — additive schema for P23

### SHOULD DO (if time allows):
6. Search analytics export to CSV (`/search/analytics/export`)
7. Rate limit visualization in /metrics — show API usage vs plan limit as Chart.js bar
8. `/reports` filter by date range (last 7d / 30d / 90d) — UI + D1 query

### OUT OF SCOPE (defer to P24):
- Marketplace real connector templates (GitHub, Slack, Jira)
- Federation read-only sync
- Webhook inbound receiver
- STRIPE billing integration

## P23 FILE TARGETS

- `migrations/0025_p23_schema.sql` — audit_export_jobs, metrics_cron_log
- `src/routes/reports.ts` — MODIFY: real Chart.js charts with D1 data
- `src/routes/audit.ts` — MODIFY: add /audit/export and /audit/export/status
- `src/lib/emailService.ts` — MODIFY: add emailWeeklyReport()
- `src/routes/apiv1.ts` — MODIFY: GET /api/v1/metrics/snapshots endpoint
- `src/index.tsx` — MODIFY: version 2.3.0-P23, cron handler, /audit/export route
- `wrangler.jsonc` — MODIFY: add cron trigger

## P23 MIGRATION TEMPLATE

```sql
-- 0025_p23_schema.sql
-- P23: Audit export jobs, metrics cron log

CREATE TABLE IF NOT EXISTS audit_export_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / running / completed / failed
  record_count INTEGER,
  download_url TEXT,                        -- ephemeral (CDN or D1 stored)
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS metrics_cron_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_type TEXT NOT NULL DEFAULT 'hourly',
  intent_count INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  anomaly_count INTEGER NOT NULL DEFAULT 0,
  approval_count INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_cron_log_tenant ON metrics_cron_log(tenant_id, created_at);
```

## P23 ACCEPTANCE GATE

- [ ] /reports shows real Chart.js charts with D1 data
- [ ] /api/v1/metrics/snapshots returns real D1 time-series
- [ ] /audit/export generates real CSV (last 500 records)
- [ ] /audit/export/status shows export job info
- [ ] Cron trigger configured in wrangler.jsonc (hourly metrics snapshot)
- [ ] /reports/subscriptions delivers real email (or shows graceful CTA if RESEND missing)
- [ ] Migration 0025 applied to production
- [ ] All P0-P22 surfaces still 200 OK (zero regression)
- [ ] GitHub pushed + Cloudflare deployed
- [ ] P23 handoff record produced

## VERSIONING

- Version: `2.3.0-P23`
- Phase label: `P23 — Reports, Analytics, Export, Cron Metrics`

## CARRY-FORWARD FROM P22

1. RESEND_API_KEY not set — set via wrangler secret (needed for P23 scheduled reports)
   - `npx wrangler pages secret put RESEND_API_KEY --project-name sovereign-os-platform`
2. OPENAI_API_KEY not set — Groq active (P23 can optionally add gpt-4o for report summaries)
3. AUTH0_CLIENT_SECRET / CLERK_SECRET_KEY not set — SSO PKCE ready
4. STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET not set — billing webhook ready
5. /policies/simulate POST full UI test (carry from P18)
6. Billing HMAC signature verification (needs STRIPE_WEBHOOK_SECRET)

## LOCAL DEV COMMAND (P23)

```bash
cd /home/user/webapp
# Apply new migration first:
npx wrangler d1 migrations apply sovereign-os-production --local
# Then start:
pm2 start ecosystem.config.cjs
# ecosystem.config.cjs args: wrangler pages dev dist --d1=sovereign-os-production --kv=RATE_LIMITER_KV --local --ip 0.0.0.0 --port 3000
```

## NEXT AFTER P23

P24 → Marketplace + Federation + Ecosystem Scaffold
P25 → GTM Final Polish + Launch Readiness
(See `ops/roadmap/P18-to-GTM-roadmap.md` for full roadmap)

────────────────────────────────────────────────────────────────────
END SESSION PROMPT — P23
────────────────────────────────────────────────────────────────────
