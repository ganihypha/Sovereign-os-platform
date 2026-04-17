# 06 — REPO AND LANE STRATEGY

**Document:** Sovereign OS Platform — Repository Structure and Product Lane Logic
**Version:** v5.0
**Status Relevance:** This strategy applies to P0–P4 (LIVE-VERIFIED) and carries forward.
**Generated:** 2026-04-17
**Relation to doc pack:** This document defines the canonical boundary between
what belongs in the platform core repo and what belongs outside it.

---

## 1. Two-Tier Repository Model

The platform operates with a two-tier repo structure:

### Tier 1 — Platform / Canon Repo (Primary)

**Name:** `sovereign-os-platform` (or equivalent)
**Role:** Single source of governance truth for the entire platform.
**Contains:**
- All platform governance surfaces (`/src`)
- D1 migrations (`/migrations`)
- Docs (`/docs`)
- Governance material (`/governance`)
- Operations logs and handoffs (`/ops`)

**What this repo governs:** Platform law, role definitions, approval flow,
proof discipline, canon promotion — everything that is platform-wide.

**What this repo does NOT contain:** Product lane business logic, product-specific
data models, or vertical app UIs not tied to governance functions.

---

### Tier 2 — Product Lane Repos (Separate)

**Pattern:** `sovereign-os-lane-[name]` or `[product-name]`
**Role:** Each product lane runs its own repo and runtime.
**Governed by:** Registered in platform `/lanes` directory.
**Subject to:** Platform governance law applies but lane-specific logic stays isolated.

---

## 2. Platform / Canon Repo Structure

```
sovereign-os-platform/
├── src/
│   ├── index.tsx              ← Main Hono app entry point
│   ├── lib/
│   │   ├── repo.ts            ← D1 database abstraction layer
│   │   ├── auth.ts            ← Auth middleware
│   │   ├── roles.ts           ← Role context module (P2+)
│   │   ├── continuity.ts      ← Session continuity (P2+)
│   │   ├── roleContext.ts     ← Role derivation from API key (P4+)
│   │   ├── alertSystem.ts     ← Real alert generation (P4+)
│   │   ├── tenantContext.ts   ← Tenant resolution (P5 TARGET)
│   │   ├── webhookDelivery.ts ← Webhook outbound delivery (P5 TARGET)
│   │   ├── aiAssist.ts        ← AI API client (P5 TARGET)
│   │   ├── rateLimiter.ts     ← KV-backed rate limiting (P5 TARGET)
│   │   └── layout.ts          ← Shared HTML layout template
│   ├── routes/
│   │   ├── workspace.ts       ← /w/:role workspace routing (P4+)
│   │   ├── canon.ts           ← /canon promotion workflow (P4+)
│   │   ├── lanes.ts           ← /lanes directory (P4+)
│   │   ├── alerts.ts          ← /alerts center (P4+)
│   │   ├── reports.ts         ← /reports dashboard (P4+)
│   │   ├── execution.ts       ← /execution board (P3+)
│   │   ├── connectors.ts      ← /connectors hub (P3+)
│   │   ├── roles.ts           ← /roles registry (P3+)
│   │   ├── tenants.ts         ← /tenants directory (P5 TARGET)
│   │   ├── aiAssist.ts        ← /ai-assist surface (P5 TARGET)
│   │   ├── apiV1.ts           ← /api/v1/* public API (P5 TARGET)
│   │   └── apiKeys.ts         ← /api-keys management (P5 TARGET)
│   └── types.ts               ← All TypeScript type definitions
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_seed_data.sql
│   ├── 0003_p2_schema.sql
│   ├── 0004_p3_schema.sql
│   ├── 0005_p4_schema.sql
│   └── 0006_p5_schema.sql     ← P5 TARGET
├── docs/
│   ├── 00-overview/
│   ├── 01-foundation/
│   ├── 02-operations/
│   └── 03-roadmap/
├── public/static/
│   └── style.css
├── .dev.vars                  ← Local secrets (never commit)
├── .gitignore                 ← Includes .dev.vars, node_modules, .wrangler
├── wrangler.jsonc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── ecosystem.config.cjs       ← PM2 config for sandbox dev
└── README.md
```

---

## 3. Governance Lane vs. Product Lane Separation

### What Belongs in Core Platform

```
✅ Platform governance surfaces: /dashboard through /canon
✅ Role registry, approval flow, proof review
✅ D1 schema migrations for platform entities
✅ Auth middleware
✅ Alert system for governance events
✅ Canon promotion workflow
✅ Handoff and continuity logic
✅ Lane directory (the registry, NOT lane content)
✅ Platform documentation (/docs)
✅ Public API gateway with governance-safe sanitization (P5)
✅ Multi-tenant isolation infrastructure (P5)
```

### What Belongs Outside Core Platform (Product Lane Repos)

```
❌ Business vertical logic (CRM features, booking flows, billing)
❌ Product-specific UI that is not a governance surface
❌ Product lane's own database tables
❌ Product lane's runtime workers or API services
❌ Product lane's own CI/CD pipelines
❌ Any code that serves exactly one product and no governance function
```

### Why This Separation is a Law (Not a Preference)

If product lane logic enters the platform core:
1. The platform becomes a vertical app — it loses governance neutrality
2. Platform migrations become entangled with product-specific schema
3. Role boundaries blur (product-lane executor becomes platform executor)
4. Canon becomes polluted with product-specific decisions
5. The platform can no longer govern multiple lanes fairly

---

## 4. Product Lane Registration Process

To register a product lane under platform governance:

1. Lane operator submits registration request in `/intake` (type: product-lane-request)
2. Request routed for Tier 2 approval (Founder or Architect)
3. Upon approval: lane record created in `product_lanes` D1 table
4. Lane appears in `/lanes` directory
5. Lane operates under platform governance rules (role separation, approval tiers, proof discipline)
6. Lane maintains own repo and runtime

---

## 5. Hybrid Repo Recommendation (Early Phase)

For early phases (P0–P4), a single repo structure is acceptable
where governance code and all supporting material coexist in one repo.
This is the current P4 LIVE-VERIFIED structure.

**When to split to multi-repo:**
- When a product lane grows to the point where it has its own deployment pipeline
- When product lane's D1 schema starts to diverge from platform schema
- When lane-specific PRD/docs are large enough to warrant their own repo
- When team size makes a single repo a coordination bottleneck

**How to split:**
1. Create new product lane repo
2. Move lane-specific code, routes, and migrations to new repo
3. Register lane in platform `/lanes` directory
4. Remove lane-specific code from platform core repo
5. Commit and deploy platform without lane code — verify no regression

---

## 6. Governance Lane in Core Repo

The `governance-core` lane is the platform itself.
It does NOT have a separate repo.
It IS the platform/canon repo.

All governance decisions that apply to all lanes are made in governance-core.
Governance-core lane is not registerable — it is built-in.

---

## 7. Handoff Boundaries Between Repos

When work crosses from platform to a product lane repo (or vice versa):

1. **In platform repo:** Create a handoff_record that explicitly documents
   the cross-repo dependency
2. **In lane repo:** Reference the platform handoff_record ID in lane session notes
3. **Approval:** Cross-repo work that mutates platform schema requires Tier 2 approval
4. **Proof:** Cross-repo proof must reference both the lane execution evidence
   AND the platform integration test result

---

*Document Status: LIVE-VERIFIED for P0–P4 structure. P5 additions marked TARGET.*
*Classification: Operations — Repository and lane governance*
*Next review: When the first product lane is split into its own repo*
