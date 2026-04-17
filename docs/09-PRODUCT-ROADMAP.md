# 09 — PRODUCT ROADMAP

**Document:** Sovereign OS Platform — Current Roadmap and Next-Lane Clarity
**Version:** v5.0
**Status Relevance:** P0–P5 LIVE-VERIFIED. P6 NEXT. P7+ FUTURE.
**Generated:** 2026-04-17
**Last Updated:** 2026-04-17 (P5 closeout sync)
**Relation to doc pack:** This document defines where the platform is going,
what the sequencing rules are, and what is explicitly blocked from P6.

---

## 1. Current Position

**Platform:** https://sovereign-os-platform.pages.dev
**Live Phase:** P5 LIVE-VERIFIED
**Database:** Cloudflare D1 — sovereign-os-production (f6067325-9ea4-44bc-a5fd-e3d19367e657)
**Migrations Applied:** 0001 → 0006
**Active Surfaces:** 22 total (P0 through P5)

**Current Capabilities (P5 LIVE-VERIFIED):**
- D1-backed persistence (all data persists)
- API key auth + role isolation (5 roles)
- Execution Board with status progression
- Connector registry (governed, Tier 2 approval)
- Multi-key role registry (no raw key exposure)
- Role-differentiated workspaces (403 on cross-role mutation)
- Product lane directory
- Alert system (real governance events)
- Canon promotion workflow (founder/architect gate only)
- Cross-lane reporting (real D1 metrics)
- Onboarding wizard
- **Multi-tenant isolation** (tenant_id at repo layer, default tenant backward-compat)
- **AI Orchestration Assist** (Layer 2 only, human gate mandatory, graceful degradation)
- **Public API Gateway** (/api/v1/* — 6 endpoints, Bearer auth, rate-limited)
- **API Key Management** (SHA-256 hash only, raw key shown once)
- **Webhook Delivery Runtime** (fire-and-log, payload_hash only)

---

## 2. Now / Next / Later

```
NOW     P5 LIVE-VERIFIED — current production state
        Core P5 scope complete. Two items PARTIAL (rate limiting, path routing).
        All governance laws maintained.

NEXT    P6 — Advanced Integration + Observability + Governance Expansion
        PRECONDITION: P5 must be LIVE-VERIFIED ← MET ✅
        Mission: KV rate limiting + tenant path routing + observability + SSO

LATER   P7 — Platform Ecosystem
        PRECONDITION: P6 must be LIVE-VERIFIED
        Mission: Ecosystem, marketplace, full autonomous AI within policy bounds

HORIZON P8+ — Self-Sustaining Platform
        PRECONDITION: P7 must be LIVE-VERIFIED
        Mission: Federated sovereign instances, external developer ecosystem
```

---

## 3. P6 Scope (Next Phase)

**Mission:** Harden P5 partials + add observability layer + expand integration capabilities.

### P6 In Scope (Priority Order)

**1. KV-Backed Distributed Rate Limiting** — HIGH
- Add KV namespace binding to wrangler.jsonc
- Upgrade rateLimiter.ts: replace in-memory Map with KV.get/put
- X-RateLimit-Policy: kv-enforced (replaces in-memory-partial)
- 429 responses persist across Worker cold starts

**2. Tenant Namespace Path Routing** — HIGH
- `/t/:slug/*` path-based routing to tenant-scoped surfaces
- Complement existing X-Tenant-Slug header-based routing
- Preserve assertTenantIsolation() enforcement

**3. triggerConnectorWebhooks() Call Site Wiring** — MEDIUM
- Wire triggerConnectorWebhooks() at: approval events, execution blocked, canon events
- Full fire-and-log integration test with real webhook endpoints

**4. Advanced Observability** — MEDIUM
- Chart.js charts in /reports from metrics_snapshots D1 table
- Time range selector: 7d / 30d / 90d
- Automated snapshot creation (via API trigger or Worker cron)

**5. SSO/OAuth2 Provider** — MEDIUM (if time allows)
- OAuth2 token exchange endpoint
- SSO user still requires explicit role assignment
- Existing API key auth preserved as fallback

**6. Email Delivery from Alerts** — LOW (if time allows)
- Send real emails on critical governance events (Tier 3 approvals, blockers)
- Via third-party email API (Resend, SendGrid) — secret stored in Cloudflare

### P6 Out of Scope (Explicitly Deferred)

```
❌ White-label per-tenant branding → P7
❌ Full AI agent autonomy (auto-approval) → P7
❌ WebSocket / real-time streaming at scale → P7
❌ Mobile native apps → P7
❌ Federated governance → P7
❌ Blockchain immutable audit trail → P7
❌ Connector/template marketplace → P7
❌ Advanced RBAC / ABAC → P7
❌ Multi-region D1 deployment → P7
❌ Rebuilding any P0–P5 surface → Prohibited unless regression proven
❌ Product lane business logic in platform core → Prohibited
```

---

## 4. P6 Sequencing Rules

P6 implementation must follow this order:

```
1st: Run truth lock + verify all P5 surfaces
2nd: Set PLATFORM_API_KEY secret in production (if not done)
3rd: KV binding + rate limiter upgrade (highest hardening value)
4th: Tenant path routing /t/:slug/*
5th: triggerConnectorWebhooks() call site wiring
6th: Observability charts in /reports
7th: SSO/OAuth2 (if time allows)
8th: Build + comprehensive verification (ALL P0–P5 regression tested)
9th: Production deploy + verification
10th: Documentation + final classification + pre-P7 handoff
```

### P6 Failure Rule

If P6 cannot be completed in one session:
- KV rate limiting must be at minimum PARTIAL with evidence
- Do NOT claim P6 complete unless rate limiting and tenant routing verified
- Stop at repo-complete state with honest classification

---

## 5. P6 Acceptance Criteria

P6 is SUCCESSFUL only if:
- All P0–P5 surfaces return 200 OK (no regression)
- Rate limiting is KV-backed (X-RateLimit-Policy: kv-enforced)
- Tenant path routing `/t/:slug/*` is implemented and verified
- triggerConnectorWebhooks() is wired at minimum at one call site
- No governance law violations in new code
- No secrets in any API response
- README updated with P6 status
- Pre-P7 handoff document produced

---

## 6. P5 Classification (Closed)

**P5 is LIVE-VERIFIED as of 2026-04-17.**

| Component | Final Status |
|---|---|
| Multi-tenant core (/tenants) | ✅ LIVE-VERIFIED |
| Webhook delivery runtime | ✅ VERIFIED |
| AI assist with human gate | ✅ LIVE-VERIFIED |
| Public API gateway (/api/v1/*) | ✅ LIVE-VERIFIED |
| Rate limiting | ⚠️ PARTIAL (in-memory → P6) |
| Tenant path routing | ⏳ PENDING (header works → P6) |
| P0–P4 regression | ✅ ZERO REGRESSION |
| D1 migration 0006 | ✅ LIVE-VERIFIED |

---

## 7. P7 — Platform Ecosystem (Future)

**Precondition:** P6 must be LIVE-VERIFIED.
**Status:** 🔮 FUTURE — Do not start in P6.

**Planned P7 Scope:**
- White-label platform licensing (custom domain + branding per tenant)
- Full AI agent autonomy with policy-bound execution (not just assist)
- Real-time event streaming (WebSocket / SSE at scale)
- Mobile native apps (iOS/Android)
- Federated governance (multiple Sovereign OS instances syncing canon)
- Blockchain/immutable audit trail for canon records
- Marketplace for product lane templates and connectors
- Advanced RBAC with ABAC
- Full observability stack
- Multi-region D1 + data residency controls

---

## 8. Roadmap Timeline

```
SESSION  PHASE    STATUS              MILESTONE
─────────────────────────────────────────────────────────────────────
  1      P0       ✅ LIVE             8 surfaces + 10 data objects scaffolded
  2      P1       ✅ LIVE             D1 persistence + auth + migrations
  3      P2       ✅ LIVE             roles + continuity + governance boundaries
  4      P2.5     ✅ LIVE-VERIFIED    FIRST PRODUCTION LIVE ← KEY MILESTONE
  5      P3       ✅ LIVE-VERIFIED    Execution + Connectors + Role Registry
  6      P4       ✅ LIVE-VERIFIED    Workspaces + Alerts + Canon + Lanes + Onboarding
  7      P5       ✅ LIVE-VERIFIED    Multi-tenant + Webhooks + AI Assist + Public API
  8      P6       🎯 NEXT             KV Rate Limiting + Tenant Routing + Observability
  9      P7       🔮 FUTURE           White-label + Federated + Full AI autonomy
  10+    P8+      🌌 HORIZON          Ecosystem + Marketplace + Self-sustaining
```

---

## 9. What is Blocked

**Nothing is currently blocked** as of 2026-04-17.

P5 is LIVE-VERIFIED. P6 preconditions are met.
P6 may begin immediately after:
1. Reading `ops/handoffs/P5-pre-P6-handoff.md`
2. Setting `PLATFORM_API_KEY` production secret
3. Verifying all 22 P5 surfaces

The only sequencing constraint: P6 must not touch P7 territory.
The boundary is explicitly documented in Section 3 above.

---

## 10. Governance Decisions (Key Architectural Decisions, Immutable)

| Decision | Rationale | Phase | Immutable? |
|---------|-----------|-------|-----------|
| Governance core first before product lanes | Without control core, lanes become chaotic | P0 | Yes |
| Cloudflare D1 for persistence | Edge-native, zero-infra | P1 | Yes |
| Single platform/canon repo + separate product repos | Governance stays clean | P1 | Yes |
| API key auth before OAuth2 | Simplest honest auth for early platform | P1 | Evolves in P6 |
| Role separation as governance law | No platform without role clarity | P0 | Yes |
| No auto-canon-promotion ever | Canon must be earned | P0 | Yes |
| Smallest honest diff per phase | Prevents scope explosion | P0 | Yes |
| Status honesty over maturity inflation | PARTIAL means partial | P0 | Yes |
| AI as L2 assist only | Prevents governance collapse | P5 | Yes |
| Tenant isolation via tenant_id in repo layer | Correct pattern for D1 | P5 | Yes |
| In-memory rate limiting → KV upgrade | Pragmatic PARTIAL → full in P6 | P5 | Evolves in P6 |

---

*Document Status: Updated to reflect P5 LIVE-VERIFIED. P6 = NEXT.*
*Classification: Roadmap — Forward-looking planning document*
*Next review: After P6 LIVE-VERIFIED, update P6 → LIVE-VERIFIED and P7 → NEXT*
