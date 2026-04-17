# Sovereign OS Platform

**Phase: P2.5 — Production Hardened**
**Version: 0.2.1-P2.5**
**Classification: LIVE-VERIFIED**

---

## Platform Overview

Sovereign OS Platform adalah layered operating/control platform — bukan single app, bukan domain-specific clone.

**Operating Law:**
```
Founder Intent → Intake → Orchestration → Execution → Proof → Live State → Canon
```

Platform ini mengatur alur kerja governed: dari intent strategis sampai canon yang diverifikasi, dengan audit trail penuh, role separation, dan tidak ada false verification.

---

## Production URLs

| Endpoint | URL | Status |
|---|---|---|
| Production | https://sovereign-os-platform.pages.dev | ✅ LIVE |
| GitHub | https://github.com/ganihypha/Sovereign-os-platform | ✅ PUSHED |
| Health | https://sovereign-os-platform.pages.dev/health | ✅ VERIFIED |
| Status | https://sovereign-os-platform.pages.dev/status | ✅ VERIFIED |

---

## Active Surfaces (9)

| Path | Purpose | Auth |
|---|---|---|
| `/dashboard` | Platform overview, stats, live priority snapshot | Read: open, Mutations: auth |
| `/intent` | Founder intent desk — strategic intent creation | Read: open, Mutations: auth |
| `/intake` | Session intake, request logging | Read: open, Mutations: auth |
| `/architect` | Architect workbench — scope and design | Read: open, Mutations: auth |
| `/approvals` | Approval queue with tier-based gating | Read: open, Mutations: auth |
| `/proof` | Proof center — artifact submission and review | Read: open, Mutations: auth |
| `/live` | Live priority board (NOW/NEXT/LATER) | Read: open, Mutations: auth |
| `/records` | Decision records, handoffs, canon candidates | Read: open, Mutations: auth |
| `/continuity` | **P2** Session continuity, governance boundaries, operator notes | Read: open, Mutations: auth |

**API Routes** (`/api/*` — auth required for all mutations):
- `POST /api/intents`, `POST /api/sessions`, `POST /api/requests`, etc.
- `GET /api/status` — public platform status
- `POST /api/continuity` — create continuity snapshot
- `POST /api/notes` — add operator note
- `POST /api/notes/:id/resolve` — resolve note

**Health Routes** (`P2.5` — no auth):
- `GET /health` — lightweight health check
- `GET /status` — extended platform status with surface list

---

## Phase History

### P1 — Hardened Control Core
- D1-backed repository abstraction (all 10 domain objects)
- API key auth middleware (SHA-256 comparison, safe)
- 8 operational surfaces (dashboard through records)
- Migrations 0001 (schema) and 0002 (seed data)
- In-memory fallback for local dev without D1

### P2 — Maturity Layer
- Role-aware context (`src/lib/roles.ts`) — 6 platform roles with permission hierarchy
- Session continuity discipline (`src/lib/continuity.ts`) — snapshot, handoff, closeout types
- Governance boundaries (4 active boundaries seeded)
- Operator notes (lightweight structured annotations)
- `/continuity` surface (9th platform surface)
- Migration 0003 (P2 schema: role_assignments, session_continuity, governance_boundaries, operator_notes)
- Build version: 0.2.0-P2

### P2.5 — Production Hardened (this session)
- `/health` endpoint — unauthenticated lightweight health check
- `/status` endpoint — extended platform status
- Real production D1 database created (ENAM region)
- All 3 migrations applied to remote production D1
- `PLATFORM_API_KEY` secret configured on Cloudflare Pages
- `wrangler.jsonc` — real `database_id` replacing placeholder
- `.dev.vars.example` — documented secrets template
- `migrations/meta/_journal.json` — migration tracking
- Deployed to Cloudflare Pages: `sovereign-os-platform.pages.dev`
- Build version: 0.2.1-P2.5

---

## Data Architecture

### Storage
- **Production**: Cloudflare D1 SQLite (database: `sovereign-os-production`, region: ENAM)
- **Local Dev**: Wrangler local SQLite (`.wrangler/state/v3/d1/`) via `--local` flag
- **Fallback**: In-memory (when no D1 binding — data resets on restart)

### P1 Domain Objects (10)
`intents` · `sessions` · `requests` · `approval_requests` · `work_items` · `proof_artifacts` · `decision_records` · `handoff_records` · `priority_items` · `canon_candidates`

### P2 Domain Objects (+4)
`role_assignments` · `session_continuity` · `governance_boundaries` · `operator_notes`

### Migrations
| File | Status (Local) | Status (Remote) |
|---|---|---|
| `0001_initial_schema.sql` | ✅ Applied | ✅ Applied |
| `0002_seed_data.sql` | ✅ Applied | ✅ Applied |
| `0003_p2_schema.sql` | ✅ Applied | ✅ Applied |

---

## Authentication

- **Method**: HTTP Bearer token (`Authorization: Bearer <key>`)
- **Algorithm**: SHA-256 key comparison (constant-time safe)
- **Key storage**: `PLATFORM_API_KEY` environment variable
- **Local dev**: Set in `.dev.vars` (gitignored)
- **Production**: Set as Cloudflare Pages secret via `wrangler pages secret put`
- **Key value**: Never exposed in UI, logs, or status endpoints

---

## Non-Negotiable Platform Laws

1. No role collapse — each role has distinct write permissions
2. Intent first — no work without documented intent
3. No false verification — no VERIFIED status without proof artifact
4. Canon is earned, never assumed — requires reviewer + founder approval
5. Governance lane must remain distinct from product lane
6. No secret exposure — key values never appear in outputs
7. No undocumented meaningful activity
8. No silent canonization
9. No green-field rebuild — always continue from current baseline
10. No status inflation — classification must match evidence

---

## Local Development

```bash
# 1. Copy secrets template
cp .dev.vars.example .dev.vars
# Edit .dev.vars: set PLATFORM_API_KEY=your-local-key

# 2. Install dependencies
npm install

# 3. Apply D1 migrations locally
npm run db:migrate:local

# 4. Build
npm run build

# 5. Start with PM2 (D1 local)
pm2 start ecosystem.config.cjs

# 6. Test
curl http://localhost:3000/health
```

---

## Production Deployment

```bash
# 1. Verify Cloudflare auth
npx wrangler whoami

# 2. Apply migrations to production D1 (if new migrations)
npm run db:migrate:prod

# 3. Build + deploy
npm run deploy:prod

# 4. Set/update secrets (if needed)
npx wrangler pages secret put PLATFORM_API_KEY --project-name sovereign-os-platform

# 5. Verify
curl https://sovereign-os-platform.pages.dev/health
curl https://sovereign-os-platform.pages.dev/status
```

---

## Deployment Status

| Item | Status |
|---|---|
| Platform | Sovereign OS Platform |
| Phase | P2.5 — Production Hardened |
| Version | 0.2.1-P2.5 |
| Build | ✅ PASS (41 modules, 150.25 kB) |
| Git commit | ✅ 2 commits on `main` |
| GitHub push | ✅ `main` branch pushed |
| D1 database | ✅ Created (f6067325-9ea4-44bc-a5fd-e3d19367e657) |
| D1 migrations | ✅ All 3 applied (local + remote) |
| Secret (PLATFORM_API_KEY) | ✅ Set on Cloudflare Pages |
| Pages deploy | ✅ sovereign-os-platform.pages.dev |
| /health live | ✅ VERIFIED |
| /status live | ✅ VERIFIED |
| Final classification | **LIVE-VERIFIED** |

---

## Pre-P3 Handoff

### What is now safe to treat as complete
- P1 Hardened Control Core — stable, do not regress
- P2 Maturity Layer (role-awareness, continuity, governance boundaries, operator notes) — stable
- P2.5 Production Hardening (health/status endpoints, real D1, real secrets, live deploy) — complete
- Platform identity: Sovereign OS Platform — locked

### What remains pending (must not be treated as done)
- Production API key not documented for founder (stored only on Cloudflare, not in any accessible place for this handoff — founder must regenerate if needed via `wrangler pages secret put`)
- D1 binding in Cloudflare Pages UI may need manual verification if data shows in-memory mode on production
- Production data in D1 = seed data only (real operational data requires platform operator entry)

### What belongs to P3 (DO NOT expand in P2.5)
- Execution Board surface
- Connector Hub / external integrations
- Role-specific workspaces (multi-key role registry)
- Real-time updates / WebSocket
- Product lane surfaces
- Advanced analytics / reporting
- OAuth / SSO integration
- Notification system
- External proof integrations

### What must NOT be altered without new authority
- `wrangler.jsonc` database_id — changing this disconnects production data
- Migration files (0001–0003) — never modify applied migrations
- Platform law (Non-Negotiable rules above) — requires Founder authority
- Route architecture — changes require bounded scope + Architect sign-off

---

## Tech Stack

- **Framework**: Hono (edge-first, Cloudflare Workers compatible)
- **Platform**: Cloudflare Pages + Workers
- **Database**: Cloudflare D1 (SQLite, globally distributed)
- **Auth**: API key bearer token (SHA-256, constant-time)
- **Build**: Vite + @hono/vite-cloudflare-pages
- **Language**: TypeScript

---

*Last updated: 2026-04-16 — P2.5 Production Hardening session*
*Classification: LIVE-VERIFIED*
