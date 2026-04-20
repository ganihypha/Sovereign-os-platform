────────────────────────────────────────────────────────────────────
MASTER SESSION PROMPT — P24
Platform: Sovereign OS Platform
Mission: Marketplace + Federation + Ecosystem Scaffold
Baseline: P23 LIVE-VERIFIED (v2.3.0-P23, 100+ surfaces, commit 001d25e)
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
# Expected: {"version":"2.3.0-P23","phase":"P23 — Reports, Analytics, Export, Cron Metrics"}

# Step 2: Verify key surfaces
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/dashboard      # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/marketplace    # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/federation     # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/reports        # 200
curl -o /dev/null -w "%{http_code}" https://sovereign-os-platform.pages.dev/audit/export/status  # 302

# Step 3: Confirm migration 0025 applied
# (confirmed — 12 commands applied to sovereign-os-production)
```

## CURRENT BASELINE (P23)

- **Production:** https://sovereign-os-platform.pages.dev
- **GitHub:** https://github.com/ganihypha/Sovereign-os-platform
- **DB:** sovereign-os-production (f6067325-9ea4-44bc-a5fd-e3d19367e657)
- **Migrations:** 0001 → 0025
- **Git:** 001d25e (main)
- **Platform Version:** 2.3.0-P23
- **KV:** RATE_LIMITER_KV (b36f941ace3445d68d335d8cebc0803a)
- **AI:** GROQ_API_KEY active (llama-3.3-70b-versatile) ✅
- **Cron:** scheduled() handler wired (CF Dashboard config needed to activate)

## P24 SCOPE

### MUST DO (P24 acceptance gate):

1. **Marketplace Real Connector Templates**
   - `/marketplace` upgrade: add real template library (GitHub, Slack, Jira, Webhook)
   - Connector template schema: `connector_templates` D1 table
   - Template preview: `/marketplace/:id` — show template config + fields
   - Install action: `POST /marketplace/:id/install` — creates connector from template
   - Non-blocking: graceful if connector install fails

2. **Federation Read-Only Sync**
   - `/federation` upgrade: real read-only sync from federated tenant data
   - `federation_sync_log` D1 table (sync events, last_synced_at)
   - `GET /federation/sync-status` — per-tenant sync status
   - `POST /federation/:id/sync` — trigger manual read-only sync
   - Sanitize: never expose cross-tenant private governance data

3. **Webhook Inbound Receiver**
   - `POST /webhooks/inbound/:source` — receive external webhooks (GitHub, Slack, etc.)
   - Validate payload signature (HMAC-SHA256) if secret configured
   - Store to `webhook_inbound_log` D1 table
   - Trigger workflow: route to relevant workflow by source type
   - `GET /webhooks/inbound/log` — view inbound webhook history (auth required)

4. **Ecosystem Scaffold (Developer Portal)**
   - `/ecosystem` — developer portal landing (SDKs, API reference, getting started)
   - `/ecosystem/sdks` — SDK download links (TypeScript, Python, Go stubs)
   - `/ecosystem/quickstart` — step-by-step quickstart guide
   - `/ecosystem/changelog` — link to /changelog

5. **Migration 0026** — additive schema for P24

### SHOULD DO (if time allows):
6. Search analytics export (`/search/analytics/export`) — carried from P23
7. Rate limit visualization in /metrics — Chart.js bar (API usage vs plan limit)
8. Marketplace rating/stars system (connector_ratings table)

### OUT OF SCOPE (defer to P25):
- STRIPE billing full integration
- Auth0/Clerk real OAuth2 callback
- Production SSO testing
- GTM final polish

## P24 FILE TARGETS

- `migrations/0026_p24_schema.sql` — connector_templates, federation_sync_log, webhook_inbound_log
- `src/routes/marketplace.ts` — MODIFY: real template library, install action
- `src/routes/federation.ts` — MODIFY: sync-status + manual sync trigger
- `src/routes/webhooks.ts` — NEW: inbound webhook receiver
- `src/routes/ecosystem.ts` — NEW: developer portal
- `src/index.tsx` — MODIFY: version 2.4.0-P24, mount /webhooks + /ecosystem

## P24 MIGRATION TEMPLATE

```sql
-- 0026_p24_schema.sql
-- P24: Marketplace Templates, Federation Sync, Webhook Inbound, Ecosystem

CREATE TABLE IF NOT EXISTS connector_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'generic',   -- github / slack / jira / webhook / generic
  description TEXT,
  icon_url TEXT,
  config_schema TEXT NOT NULL DEFAULT '{}',      -- JSON schema for config fields
  default_config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'published',      -- draft / published / deprecated
  install_count INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS federation_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  federation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  sync_type TEXT NOT NULL DEFAULT 'read-only',
  records_synced INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',        -- success / failed / partial
  error_message TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_inbound_log (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'unknown',        -- github / slack / jira / unknown
  tenant_id TEXT NOT NULL DEFAULT 'default',
  payload_hash TEXT,                             -- HMAC-SHA256 of payload
  signature_valid INTEGER NOT NULL DEFAULT 0,
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'received',       -- received / processed / failed
  workflow_triggered TEXT,
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_connector_templates_source ON connector_templates(source_type, status);
CREATE INDEX IF NOT EXISTS idx_federation_sync_log_id ON federation_sync_log(federation_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_webhook_inbound_log_source ON webhook_inbound_log(source, received_at);
```

## P24 ACCEPTANCE GATE

- [ ] /marketplace shows real connector templates (GitHub, Slack, Jira, Webhook)
- [ ] /marketplace/:id shows template preview + install form
- [ ] POST /marketplace/:id/install creates connector from template
- [ ] /federation/sync-status shows per-tenant sync status
- [ ] POST /federation/:id/sync triggers manual read-only sync
- [ ] POST /webhooks/inbound/:source receives and logs external webhooks
- [ ] /webhooks/inbound/log shows inbound webhook history
- [ ] /ecosystem developer portal landing (SDKs, quickstart, changelog)
- [ ] Migration 0026 applied to production
- [ ] All P0-P23 surfaces still 200 OK (zero regression)
- [ ] GitHub pushed + Cloudflare deployed
- [ ] P24 handoff record produced

## VERSIONING

- Version: `2.4.0-P24`
- Phase label: `P24 — Marketplace, Federation, Ecosystem Scaffold`

## CARRY-FORWARD FROM P23

1. **RESEND_API_KEY not set** — emailWeeklyReport() skips gracefully
   - `npx wrangler pages secret put RESEND_API_KEY --project-name sovereign-os-platform`
2. **Cron trigger not activated** — needs CF Dashboard config:
   - Pages → sovereign-os-platform → Settings → Functions → Cron Triggers → "0 * * * *"
3. **OPENAI_API_KEY not set** — Groq active as fallback
4. **AUTH0_CLIENT_SECRET / CLERK_SECRET_KEY not set** — SSO PKCE ready
5. **STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET not set** — billing hooks ready
6. **Search analytics export** (`/search/analytics/export`) — carry from P23 SHOULD DO

## LOCAL DEV COMMAND (P24)

```bash
cd /home/user/webapp
# Apply new migration first:
npx wrangler d1 migrations apply sovereign-os-production --local
# Then start:
pm2 start ecosystem.config.cjs
# ecosystem.config.cjs args: wrangler pages dev dist --d1=sovereign-os-production --kv=RATE_LIMITER_KV --local --ip 0.0.0.0 --port 3000
```

## NEXT AFTER P24

P25 → GTM Final Polish + Launch Readiness + STRIPE full integration
(See `ops/roadmap/P18-to-GTM-roadmap.md` for full roadmap)

────────────────────────────────────────────────────────────────────
END SESSION PROMPT — P24
────────────────────────────────────────────────────────────────────
