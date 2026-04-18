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
| **Version** | `0.7.0-P7` |
| **Phase** | P7 — Enterprise Governance Expansion |
| **Status** | ✅ LIVE-VERIFIED |
| **Production** | https://sovereign-os-platform.pages.dev |
| **GitHub** | https://github.com/ganihypha/Sovereign-os-platform |
| **Latest Commit** | `42fded7` |
| **D1 Database** | `sovereign-os-production` (f6067325-9ea4-44bc-a5fd-e3d19367e657) |
| **Migrations Applied** | 0001 → 0007 |
| **Active Surfaces** | 26 total |
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

---

## Active Surfaces (26 total — all LIVE-VERIFIED)

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
