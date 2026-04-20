# Sovereign OS Platform

## Platform Overview
**Sovereign OS Platform** is a **layered operating/control platform** for governed execution,
approval, proof, continuity, and multi-lane coordination across apps, tools, product lanes, and sessions.

It is **not a single application.** It is a platform that governs how applications, integrations,
product lanes, and operators interact — with enforced role boundaries, approval gates, proof
requirements, and a stable canon layer that survives sessions.

---

## Current Status

| Item | Value |
|------|-------|
| **Version** | `2.0.0-P22` |
| **Phase** | P22 — Layout Refactor, Version Consistency, D1 Verification, Perf Observability |
| **Status** | ✅ LIVE-VERIFIED |
| **Production** | https://sovereign-os-platform.pages.dev |
| **GitHub** | https://github.com/ganihypha/Sovereign-os-platform |
| **Latest Commit** | `80512a7` |
| **D1 Database** | `sovereign-os-production` (f6067325-9ea4-44bc-a5fd-e3d19367e657) |
| **Migrations Applied** | 0001 → 0022 |
| **Active Surfaces** | 97 total (90 P0-P18 + 7 P19/P20/P21 new/enhanced) |
| **KV Namespace** | RATE_LIMITER_KV (b36f941ace3445d68d335d8cebc0803a) |

---

## Production URLs

| Endpoint | Purpose |
|----------|---------|
| `https://sovereign-os-platform.pages.dev` | Platform root → /dashboard |
| `https://sovereign-os-platform.pages.dev/health` | Health check (unauthenticated) |
| `https://sovereign-os-platform.pages.dev/status` | Platform status (unauthenticated) |
| `https://sovereign-os-platform.pages.dev/api/v1/health` | API v1 health (unauthenticated) |
| `https://sovereign-os-platform.pages.dev/api/v1/docs` | API documentation |
| `https://sovereign-os-platform.pages.dev/auth/sso` | SSO/OAuth2 integration (P7) |
| `https://sovereign-os-platform.pages.dev/branding` | Tenant white-label branding (P7) |
| `https://sovereign-os-platform.pages.dev/federation` | Federation Registry (P8) |
| `https://sovereign-os-platform.pages.dev/marketplace` | Connector Marketplace (P8) |
| `https://sovereign-os-platform.pages.dev/audit` | Immutable Audit Trail (P8) |
| `https://sovereign-os-platform.pages.dev/notifications` | Real-time Notifications (P9) |
| `https://sovereign-os-platform.pages.dev/workflows` | Workflow Automation (P9) |
| `https://sovereign-os-platform.pages.dev/health-dashboard` | Platform Health Dashboard (P9) |
| `https://sovereign-os-platform.pages.dev/portal/default` | Tenant Self-Service Portal (P9) |
| `https://sovereign-os-platform.pages.dev/reports` | Enhanced Governance Reports (P10) |
| `https://sovereign-os-platform.pages.dev/api/v2/docs` | API v2 Documentation (P10) |
| `https://sovereign-os-platform.pages.dev/policies` | ABAC Policy Editor (P10) |
| `https://sovereign-os-platform.pages.dev/alert-rules` | Alert Rules Engine (P10) |
| `https://sovereign-os-platform.pages.dev/remediation` | Auto-Remediation Playbooks (P11) |
| `https://sovereign-os-platform.pages.dev/events` | Unified Event Bus (P11) |
| `https://sovereign-os-platform.pages.dev/docs` | Developer Documentation (P11) |
| `https://sovereign-os-platform.pages.dev/policies/simulate` | ABAC Dry-Run Simulate (P11) |
| `https://sovereign-os-platform.pages.dev/metrics` | Platform Metrics KPIs + Charts (P16) |
| `https://sovereign-os-platform.pages.dev/metrics/api` | Metrics JSON API (P16) |
| `https://sovereign-os-platform.pages.dev/audit/:id` | Audit Event Detail View (P16) |
| `https://sovereign-os-platform.pages.dev/audit/search` | Audit Full-Text Search (P16) |
| `https://sovereign-os-platform.pages.dev/search` | Platform-Wide Unified Search (P15+P16) |

---

## Active Surfaces (41 total — all LIVE-VERIFIED)

### P0 Core (8 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Platform Dashboard | `/dashboard` | Command center |
| Intent Desk | `/intent` | Founder intent recording |
| Session Intake | `/intake` | Request intake + classification |
| Architect Workbench | `/architect` | Session architecture + scoping |
| Approval Queue | `/approvals` | Tier 1/2/3 approval management |
| Proof Center | `/proof` | Proof artifact submission + verification |
| Live Priority Board | `/live` | Real-time blocker + priority tracking |
| Records & Decision Log | `/records` | Immutable audit trail |

### P2 (1 surface)
| Surface | Path | Role |
|---------|------|------|
| Continuity Hub | `/continuity` | Session handoff + platform state |

### P3 (3 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Execution Board | `/execution` | Work item tracking (Kanban) |
| Connector Hub | `/connectors` | Governed external integrations |
| Role Registry | `/roles` | Platform role management |

### P4 (6 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Role Workspace | `/workspace` | Role-differentiated workspaces |
| Alert Center | `/alerts` | Governance-critical notifications |
| Canon Promotion | `/canon` | Promote outputs to platform canon |
| Lane Directory | `/lanes` | Product lane management |
| Onboarding | `/onboarding` | Operator onboarding flow |
| Reports & Observability | `/reports` | Platform metrics + Chart.js dashboards |

### P5 (4 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Tenant Registry | `/tenants` | Multi-tenant management |
| AI Assist | `/ai-assist` | Governed AI orchestration assist |
| API Key Management | `/api-keys` | Public API key issuance |
| Public API Gateway | `/api/v1` | External API access |

### P6 (1 surface)
| Surface | Path | Role |
|---------|------|------|
| Tenant Path Routing | `/t/:slug/*` | Per-tenant surface access |

### P7 — NEW (2 surfaces)
| Surface | Path | Role |
|---------|------|------|
| SSO / OAuth2 | `/auth/sso` | Per-tenant SSO (Auth0/Clerk, PKCE) |
| Tenant Branding | `/branding` | White-label CSS/brand per tenant |

### P8 — NEW (3 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Federation Registry | `/federation` | Cross-tenant intent sharing + approval chains |
| Connector Marketplace | `/marketplace` | Governed connector template publishing |
| Immutable Audit Trail | `/audit` | SHA-256 event hashing + on-read verification |

### P9 — (4 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Notifications | `/notifications` | SSE real-time stream + notification inbox (KV-backed) |
| Workflows | `/workflows` | Workflow automation engine (event → condition → action) |
| Health Dashboard | `/health-dashboard` | Unified platform health (33 surfaces, SLA, time-series) |
| Tenant Portal | `/portal/:slug` | Tenant self-service (profile, connectors, federation, marketplace) |

### P10 — NEW (4 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Enhanced Reports | `/reports` | CSV/JSON downloadable governance reports (6 types), report job history |
| API v2 | `/api/v2` | Structured REST layer — 9 resource groups, cursor pagination, rate limiting |
| ABAC Policies | `/policies` | Attribute-Based Access Control policy editor (subject/resource/action/effect) |
| Alert Rules | `/alert-rules` | Alert rules engine — condition→threshold→action, live metrics display |

### P11 — NEW (4 surfaces)
| Surface | Path | Role |
|---------|------|------|
| Auto-Remediation | `/remediation` | Playbooks for automated incident response — trigger, run, audit |
| Event Bus | `/events` | Unified platform event stream — filter, read, emit test events |
| Developer Docs | `/docs` | SDK documentation hub — quickstart, API v2, auth, webhooks, ABAC, workflows |
| ABAC Simulate | `/policies/simulate` | Dry-run ABAC decision endpoint (POST JSON) |

---

## P10 Feature Summary

### 1. Enhanced Governance Reporting ✅ LIVE
- 6 downloadable report types: approval_audit, federation_activity, marketplace_activity, anomaly_history, workflow_runs, platform_summary
- Formats: CSV (Excel-compatible) and JSON (API-compatible)
- Filters: date_from, date_to, status, limit (100/500/1000 rows)
- Report job history tracked in D1 report_jobs table
- POST /reports/download — streaming download
- GET /reports/jobs — job history

### 2. API v2 Structured REST Layer ✅ LIVE
- Base: /api/v2 — versioned REST endpoints for all core resources
- Resources: intents, approvals, workflows, notifications, health-snapshots, audit-events, metrics
- Cursor-based pagination (max 100 per page)
- Filtering: field-specific + full-text search (?q=)
- Sorting: ?sort=field&dir=asc|desc
- Rate limiting: 60 req/min via RATE_LIMITER_KV
- CORS enabled for all API v2 routes
- OpenAPI-style docs at /api/v2/docs

### 3. ABAC Policy Engine ✅ LIVE
- Policy model: subject_type × subject_value × resource_type × action × effect × priority
- Wildcard (*) support for resource_type and action
- DENY beats ALLOW at same priority; lowest number = highest precedence
- 5 default policies: admin full, viewer read-only, viewer deny-delete, analyst reports, operator workflows
- API: checkAccess(db, ctx) for programmatic enforcement
- POST /policies/create, toggle, delete via UI

### 4. Alert Rules Engine ✅ LIVE
- Metrics monitored: pending_approvals, blocked_executions, unread_alerts, anomaly_score, workflow_failures, active_sessions, total_connectors, pending_connectors
- Operators: gt, gte, lt, lte, eq, neq
- Actions: create_notification, log_audit, send_email, trigger_webhook
- Cooldown: configurable window prevents duplicate alerts
- Live metric display: current value vs threshold shown in UI
- 3 default rules: high pending approvals, blocked executions, unread alerts
- Manual evaluation: POST /alert-rules/evaluate

---

## P11 Feature Summary

### 1. Auto-Remediation ✅ LIVE
- Playbooks: name, trigger_event, multi-step action_steps_json
- Action types: create_notification | log_audit | trigger_webhook | send_email | update_status
- Manual trigger + event-driven trigger (triggerPlaybooksByEvent)
- Run history: steps_total, steps_completed, result_json, error_message
- All runs logged to audit_log_v2 (SHA-256)
- 3 default playbooks seeded: stale alert, blocked execution, high approval queue

### 2. Unified Event Bus ✅ LIVE
- platform_events table: event_type, source_surface, actor, severity (info/warning/error/critical)
- Filter: severity, surface, event_type, unread_only, pagination
- JSON API: GET /events/api
- Emit test events from UI
- 41 documented known event types
- Mark read / mark all read

### 3. Developer Documentation ✅ LIVE
- Hub at /docs with navigation
- /docs/quickstart — 5-minute getting started guide
- /docs/api-v2 — complete API v2 endpoint reference
- /docs/authentication — API key + session auth guide
- /docs/webhooks — webhook delivery + P11 retry queue
- /docs/abac — ABAC policy model + simulate guide
- /docs/workflows — multi-step workflows + action types

### 4. ABAC Policy Simulation ✅ LIVE
- POST /policies/simulate — dry-run ABAC decision (no auth required)
- Returns: decision, allowed, reason, policies_evaluated, matched_policies, context
- viewer:delete → DENY (pol-003 Deny Viewer Delete)
- admin:approve → ALLOW (pol-001 Admin Full Access)

### 5. Workflow v2 Enhancements ✅ LIVE
- Multi-step workflows via steps_json (sequential action chain)
- New action types: send_email (graceful degradation), create_approval, trigger_webhook
- Workflow run retry: POST /workflows/:run_id/retry
- Step-level result tracking: step_results_json per run
- last_error field on workflow for failed run tracking

---

## P9 Feature Summary

### 1. Real-time Governance Notifications ✅ LIVE
- SSE stream at /notifications/stream (graceful fallback to polling)
- Notification inbox: approval_pending, anomaly_detected, federation_request, marketplace_submitted, workflow_triggered, system_alert
- KV-backed state persistence (notif:latest:{tenant_id})
- Mark read / mark all read
- D1 table: notifications

### 2. Advanced Workflow Automation ✅ LIVE
- Trigger chains: trigger_event → condition → action
- 3 built-in templates (approval notify, anomaly escalation, federation notify)
- Lifecycle: draft → pending_approval → active
- Full execution history logged to audit_log_v2
- Manual trigger + event-driven trigger API
- D1 tables: workflows, workflow_runs

### 3. Platform Health Dashboard ✅ LIVE
- Unified health view: all 33 surfaces grouped by phase
- SLA tracking: uptime %, avg response ms, health grade (A+/A/B/C)
- 24h lookback health time-series
- One-click health check snapshot for 10 core surfaces
- D1 table: health_snapshots

### 4. Tenant Self-Service Portal ✅ LIVE
- Per-tenant portal: /portal/:slug
- Self-service profile update, connector management, metrics view
- Federation request flow directly from portal
- Marketplace connector submission from portal
- API key scope enforcement (X-API-Key header)

---

### 1. Federated Governance ✅ LIVE
- Cross-tenant intent sharing with approval gate
- Tenant federation registry (who can share with whom)
- Federated approval chains — multi-tenant approval routing
- All federation events cryptographically hashed in audit_log_v2
- D1 tables: `tenant_federation`, `federated_intents`

### 2. ML/AI Anomaly Detection ✅ LIVE
- `POST /api/v1/anomaly-detect` (readwrite API key required)
- Statistical rolling baseline (last 5 snapshots), 30% deviation threshold
- 6 metrics monitored: sessions, approvals, executions, connectors, alerts
- OPENAI_API_KEY: graceful degradation — statistical mode without key, AI summaries with key
- All anomalies → platform alert + audit_log_v2 event

### 3. Connector Marketplace ✅ LIVE
- Governed connector template publishing
- Tier 2 approval required before listing
- Download counter, version tracking, tag system
- Connector must be `approved` + `marketplace_eligible` before submit
- D1 table: `marketplace_connectors`

### 4. Immutable Audit Trail (SHA-256) ✅ LIVE
- `GET /audit` — Full audit log v2 with live hash verification
- `GET /audit/verify/:id` — Single event hash verification (JSON API)
- `GET /api/v1/audit-events` — Sanitized audit events (readwrite key)
- Hash: `SHA-256(event_type|object_id|actor|created_at)` — Web Crypto API
- No UPDATE ever on `audit_log_v2` (append-only enforcement)
- Hash re-verified on every page load — TAMPERED flag if mismatch
- D1 table: `audit_log_v2`

---

## P7 Feature Summary

### 1. White-Label Branding per Tenant ✅
- Per-tenant CSS variables stored in D1 (`tenant_branding` table)
- Brand editor: color picker, logo URL, fonts, custom footer
- `/branding/css/:slug` — CSS delivery endpoint (public, cacheable)
- Applied on `/t/:slug/*` surfaces automatically
- Live preview in brand editor

### 2. SSO / OAuth2 Integration ✅
- Auth0 and Clerk providers supported per tenant
- PKCE flow (code_verifier + SHA-256 challenge) — enforced for all
- `/auth/sso/config/:tid` — Configure SSO per tenant
- `/auth/sso/init/:tid` — Initiate OAuth2 flow
- `/auth/sso/callback` — Callback handler
- **Security:** `client_secret` NEVER stored in D1 — Cloudflare Secrets only
- To activate: set `AUTH0_CLIENT_SECRET` or `CLERK_SECRET_KEY` via wrangler secrets

### 3. Email Delivery from Alerts ✅ (graceful degradation)
- Alert creation → email dispatch (fire-and-log, never blocks)
- Providers: Resend (preferred) or SendGrid (fallback)
- Delivery status logged in D1 (`alert_deliveries` table)
- `GET /alerts/api/deliveries` — delivery log
- `POST /alerts/api/emit` — create alert + dispatch email
- **To activate:** `npx wrangler pages secret put RESEND_API_KEY --project-name sovereign-os-platform`

### 4. Metrics History Time-Series ✅
- `metrics_snapshots` table extended with `snapshot_data` JSON
- `/api/v1/metrics-history` — time-series endpoint (API key required)
- `/api/v1/metrics-snapshot` — manual snapshot trigger
- `/reports` auto-triggers daily snapshot on load
- Timeline chart uses real `metrics_snapshots` data (not synthetic)

### 5. ABAC/RBAC Expansion ✅
- `public_api_keys.scopes` column (JSON array: `["read:tenants","write:executions"]`)
- `tenants.branding_id`, `tenants.sso_config_id` extension columns
- Scope enforcement on `/api/v1/metrics-snapshot` (readwrite required)

---

## Data Architecture

### Storage Services
| Service | Binding | Purpose |
|---------|---------|---------|
| Cloudflare D1 | `DB` | Primary relational database (SQLite) |
| Cloudflare KV | `RATE_LIMITER_KV` | Distributed rate limiting (P6) |

### D1 Migrations
| Migration | Content |
|-----------|---------|
| `0001_initial_schema.sql` | Core P0 tables |
| `0002_seed_data.sql` | Initial seed data |
| `0003_p2_schema.sql` | P2 continuity + governance tables |
| `0004_p3_schema.sql` | P3 execution + connector tables |
| `0005_p4_schema.sql` | P4 alerts + canon + lanes + product tables |
| `0006_p5_schema.sql` | P5 multi-tenant + AI + API key tables |
| `0007_p7_schema.sql` | P7 alert_deliveries, tenant_branding, sso_configs + ALTER extensions |

### Key Tables (P7 additions)
- `alert_deliveries` — Email dispatch log per alert (status: pending|sent|failed|skipped)
- `tenant_branding` — Per-tenant CSS variables and brand identity
- `sso_configs` — Per-tenant SSO/OAuth2 provider configuration

---

## Governance Model

### 5 Platform Roles
| Role | Layer | Description |
|------|-------|-------------|
| Founder | L0 | Strategic intent + final approval authority |
| Master Architect | L1 | Session architecture + governance design |
| Orchestrator | L2 | Session coordination + sequencing |
| Executor | L3 | Work execution + code delivery |
| Reviewer | L4 | Verification + proof assessment |

### 12 Immutable Platform Laws
1. No role collapse
2. No self-approval
3. No false verification
4. No secret exposure
5. No undocumented meaningful activity
6. Live state over guesswork
7. Additive-only evolution
8. No AI auto-canonization
9. Production claims require proof
10. Status honesty over ambition
11. Proof before promotion
12. No scope creep

---

## Local Development

```bash
# Install dependencies
npm install

# Apply local D1 migrations (all 7)
npm run db:migrate:local

# Build
npm run build

# Start local dev server (D1 + KV)
pm2 start ecosystem.config.cjs

# Test
curl http://localhost:3000/health
```

### Environment Secrets (`.dev.vars` for local)
```
PLATFORM_API_KEY=your-platform-key
RESEND_API_KEY=re_xxxxx  # optional: email delivery
AUTH0_CLIENT_SECRET=xxx  # optional: SSO Auth0
CLERK_SECRET_KEY=sk_xxx  # optional: SSO Clerk
OPENAI_API_KEY=sk-xxx    # optional: AI assist
```

---

## Production Deployment

```bash
# Setup Cloudflare auth
setup_cloudflare_api_key  # via Genspark Deploy tab

# Apply migrations to production D1
npx wrangler d1 migrations apply sovereign-os-production --remote

# Build + deploy
npm run build
WRANGLER_SEND_METRICS=false npx wrangler pages deploy dist --project-name sovereign-os-platform

# Verify
curl https://sovereign-os-platform.pages.dev/health
```

### Set Production Secrets
```bash
# Required
npx wrangler pages secret put PLATFORM_API_KEY --project-name sovereign-os-platform

# Optional — activate email delivery
npx wrangler pages secret put RESEND_API_KEY --project-name sovereign-os-platform

# Optional — activate SSO
npx wrangler pages secret put AUTH0_CLIENT_SECRET --project-name sovereign-os-platform
# OR
npx wrangler pages secret put CLERK_SECRET_KEY --project-name sovereign-os-platform
```

---

## Phase History

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| P0 | ✅ LIVE | Control core scaffold, 8 governance surfaces |
| P1 | ✅ LIVE | D1 persistence, API key auth, production hardening |
| P2 | ✅ LIVE | Continuity hub, governance boundaries, session snapshot |
| P2.5 | ✅ LIVE | Production verification, /health, /status |
| P3 | ✅ LIVE | Execution board, connector hub, role registry |
| P4 | ✅ LIVE | Role workspaces, alerts, canon promotion, lanes, reports |
| P5 | ✅ LIVE | Multi-tenant, AI assist, public API v1, webhook delivery |
| P6 | ✅ LIVE | KV rate limiter, /t/:slug/* routing, Chart.js observability |
| **P7** | ✅ **LIVE** | **White-label branding, SSO/OAuth2, email alerts, metrics history, ABAC** |
| P8 | 🔜 NEXT | Federated governance, ML anomaly detection, marketplace |

---

## Next Phase: P8 — Federated Governance

See `ops/P8-master-architect-session-prompt.md` for full P8 session initialization.

**P8 Target Surfaces:**
- `/marketplace` — Connector template marketplace (governed publishing)
- `/audit` — Immutable audit trail with cryptographic event hashing

**P8 Key Features:**
1. Cross-tenant federated intent sharing + approval chains
2. ML/AI anomaly detection on `metrics_snapshots` time-series
3. Connector marketplace with Tier 2 approval flow
4. Immutable audit trail with SHA-256 event hashing

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers (edge) |
| Framework | Hono v4 (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| KV Store | Cloudflare KV |
| Build | Vite + @hono/vite-cloudflare-pages |
| CSS | Inline styles + CSS variables (no external CSS framework) |
| Charts | Chart.js (CDN) |
| Auth | SHA-256 API key + cookie session |
| Email | Resend / SendGrid (optional) |
| SSO | Auth0 / Clerk OAuth2 PKCE (optional) |

---

*Last updated: 2026-04-18 — P7 LIVE-VERIFIED closeout*
