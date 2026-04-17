# SOVEREIGN OS PLATFORM

## Platform Overview

**Name:** Sovereign OS Platform  
**Version:** 0.5.0-P5  
**Phase:** P5 — Multi-Tenant & AI-Augmented Operations  
**Phase Status:** ✅ P5 VERIFIED (locally) | ✅ P5 LIVE-VERIFIED (production)  
**Baseline:** P0–P4 LIVE-VERIFIED (preserved, zero regression)

**Positioning:** A sovereign-grounded, layered operating/control platform for governed execution, approval, proof, continuity, and multi-lane coordination.

---

## URLs

| Endpoint | Status |
|---|---|
| **Production:** https://sovereign-os-platform.pages.dev | ✅ LIVE |
| **GitHub:** https://github.com/ganihypha/Sovereign-os-platform | ✅ LIVE |
| **D1 Database:** sovereign-os-production (f6067325-9ea4-44bc-a5fd-e3d19367e657) | ✅ LIVE |

---

## Current Phase: P5 — Multi-Tenant & AI-Augmented Operations

### P5 New Surfaces (LIVE-VERIFIED)

| Surface | URL | Auth | Status |
|---|---|---|---|
| Tenant Provisioning | `/tenants` | GET: open, POST: auth | ✅ LIVE-VERIFIED |
| AI Orchestration Assist | `/ai-assist` | GET: open, POST: auth | ✅ LIVE-VERIFIED |
| API Key Management | `/api-keys` | auth required | ✅ LIVE-VERIFIED |
| Public API Gateway | `/api/v1/*` | key-based per endpoint | ✅ LIVE-VERIFIED |

### P5 Public API Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/v1/health` | None | API health check |
| `GET /api/v1/docs` | None | API documentation |
| `GET /api/v1/metrics` | Bearer API Key | Platform metrics |
| `GET /api/v1/tenants` | Bearer API Key | Tenant list (sanitized) |
| `GET /api/v1/sessions` | Bearer API Key | Active sessions (sanitized) |
| `GET /api/v1/status` | Bearer API Key | Detailed status |

### P5 New Libraries

| Module | Purpose |
|---|---|
| `src/lib/tenantContext.ts` | Tenant isolation middleware + assertTenantIsolation |
| `src/lib/webhookDelivery.ts` | Governance-safe webhook runtime (no raw payload stored) |
| `src/lib/aiAssist.ts` | AI assist with human confirmation gate + graceful degradation |
| `src/lib/rateLimiter.ts` | Pluggable rate limiter (in-memory → KV-upgradeable) |

---

## P0–P4 Surfaces (All Preserved — LIVE-VERIFIED)

| Phase | Surfaces |
|---|---|
| P0 | `/dashboard`, `/intent`, `/intake`, `/architect`, `/approvals`, `/proof`, `/live`, `/records` |
| P2 | `/continuity` |
| P3 | `/execution`, `/connectors` |
| P4 | `/workspace` (`/w/:role`), `/alerts`, `/canon`, `/lanes`, `/onboarding`, `/reports` |
| Internal API | `/api/*` (platform internal, bearer auth) |

---

## Data Architecture

### Storage: Cloudflare D1 — `sovereign-os-production`

**Migrations Applied (local + production):** 0001 → 0002 → 0003 → 0004 → 0005 → 0006

| Migration | Phase | Tables |
|---|---|---|
| 0001 | P0-P1 | intents, sessions, requests, approval_requests, work_items, proof_artifacts, decision_records, handoff_records, priority_items, canon_candidates, audit_log, api_keys |
| 0002 | P1 seed | Seed data |
| 0003 | P2 | session_continuity, governance_boundaries, operator_notes, role_assignments |
| 0004 | P3 | execution_entries, connectors |
| 0005 | P4 | product_lanes, platform_alerts, canon_promotions |
| **0006** | **P5** | **tenants, webhook_delivery_log, ai_assist_log, public_api_keys, metrics_snapshots** |

### P5 Tenant Isolation Model

- Every resource can be tagged with `tenant_id`
- Default tenant (`slug: 'default'`) holds all P0–P4 backward-compatible data
- Cross-tenant reads return empty results (enforced at repo layer)
- `assertTenantIsolation(requestingTenantId, resourceTenantId)` guards all cross-tenant access

---

## P5 Governance Non-Negotiables

1. **Multi-Tenant Isolation:** `tenant_id` filtering enforced at repo layer. Default tenant backward-compatible.
2. **Webhook Delivery:** Fire-and-log pattern. `payload_hash` (SHA-256) only stored — raw payloads never stored.
3. **AI Assist:** Layer 2 only. Every output tagged `ai-generated`. Human confirmation gate mandatory. No auto-approval.
4. **Public API Keys:** SHA-256 hash stored only. Raw key shown once at issuance.
5. **Rate Limiting:** In-memory (PARTIAL). KV-backed is production target. `X-RateLimit-*` headers returned.
6. **Secret Exposure:** Zero — no secrets, key hashes, or governance internals in public API responses.

---

## Platform Secrets Required

| Secret | Purpose | Set Via |
|---|---|---|
| `PLATFORM_API_KEY` | Internal platform auth | `wrangler pages secret put PLATFORM_API_KEY --project-name sovereign-os-platform` |
| `OPENAI_API_KEY` | AI assist (optional — graceful degradation if missing) | `wrangler pages secret put OPENAI_API_KEY --project-name sovereign-os-platform` |

---

## Quick Start

```bash
# Local development
npm install
cp .dev.vars.example .dev.vars  # Set PLATFORM_API_KEY
npm run build
npm run db:migrate:local
pm2 start ecosystem.config.cjs

# Test
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/health
```

---

## P5 Honest Classification

| Feature | Classification | Notes |
|---|---|---|
| Multi-tenant core (/tenants) | ✅ LIVE-VERIFIED | Registration, approval, suspend. tenant_id isolation enforced at repo layer. |
| Webhook delivery runtime | ✅ VERIFIED | Fire-and-log pattern. payload_hash only. triggerConnectorWebhooks wired. |
| AI orchestration assist | ✅ LIVE-VERIFIED | Human gate mandatory. Degraded mode if OPENAI_API_KEY missing. Confirm/discard flow. |
| Public API gateway (/api/v1/*) | ✅ LIVE-VERIFIED | 6 endpoints. Key issuance/revoke. Rate limit headers. |
| Rate limiting | ⚠️ PARTIAL | In-memory (resets on deploy). KV-backed is production target. |
| Tenant namespace routing (/t/:slug/*) | ⏳ PENDING | Header-based (X-Tenant-Slug) works. Path-based routing deferred to P6. |
| P0–P4 regression | ✅ ZERO REGRESSION | All 18 P0–P4 surfaces pass verification. |
| **Overall P5** | **LIVE-VERIFIED** | Production deployed. D1 migration 0006 applied. All core P5 surfaces live. |

---

## P6 Scope (Explicitly Deferred — Do NOT Build in P5)

- White-label branding per tenant
- Federated governance (cross-tenant policy)
- Full AI autonomy (auto-approval)
- Advanced observability stack (Prometheus, time-series)
- Multi-region architecture
- ABAC/RBAC expansion
- Marketplace/ecosystem work
- Tenant namespace path routing (`/t/:slug/*`)
- KV-backed distributed rate limiting (upgrade from in-memory)
- SSO/OAuth2 provider integration
- Email/SMS external delivery

---

## Deployment

**Platform:** Cloudflare Pages  
**Last Deploy:** 2026-04-17  
**Git:** https://github.com/ganihypha/Sovereign-os-platform (commit: 116dbc8)  
**Tech Stack:** Hono 4.x + TypeScript + Cloudflare D1 + Cloudflare Workers
