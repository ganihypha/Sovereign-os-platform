-- ============================================================
-- SOVEREIGN OS PLATFORM — P3 SCHEMA ADDITIONS
-- Migration: 0004_p3_schema
-- P3 adds: execution_entries (operational execution board),
--          connectors (connector hub registry)
-- PRESERVES all P1/P2 tables — no destructive changes.
-- ============================================================

-- ---- execution_entries: operational execution tracking ----
-- Extends work_items with execution-layer visibility:
--   ownership, execution status, proof linkage, state progression.
-- Governance: work item must exist before execution entry can reference it.
CREATE TABLE IF NOT EXISTS execution_entries (
  id            TEXT PRIMARY KEY,
  work_item_id  TEXT NOT NULL,             -- FK to work_items.id
  session_id    TEXT,                      -- FK to sessions.id (optional)
  title         TEXT NOT NULL DEFAULT '',
  executor      TEXT NOT NULL DEFAULT '',  -- who is executing
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|running|blocked|done|cancelled
  priority      TEXT NOT NULL DEFAULT 'normal',   -- critical|high|normal|low
  context_notes TEXT NOT NULL DEFAULT '',
  proof_id      TEXT,                      -- FK to proof_artifacts.id once submitted
  started_at    TEXT,
  completed_at  TEXT,
  blocked_reason TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- ---- connectors: formal connector hub registry ----
-- Governs external integrations as a formal, approval-aware surface.
-- No ad-hoc integrations — all connectors must be registered here.
CREATE TABLE IF NOT EXISTS connectors (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,     -- e.g. "github-webhook", "slack-notify"
  connector_type  TEXT NOT NULL DEFAULT 'webhook',  -- webhook|api|queue|event|custom
  description     TEXT NOT NULL DEFAULT '',
  endpoint_hint   TEXT NOT NULL DEFAULT '',  -- sanitized endpoint info (no secrets)
  status          TEXT NOT NULL DEFAULT 'registered',  -- registered|active|inactive|deprecated|blocked
  approval_status TEXT NOT NULL DEFAULT 'pending',     -- pending|approved|rejected
  approved_by     TEXT,
  risk_level      TEXT NOT NULL DEFAULT 'medium',      -- low|medium|high|critical
  lane            TEXT NOT NULL DEFAULT 'ops',         -- governance|ops|execution|product-lane
  last_event_at   TEXT,
  event_count     INTEGER NOT NULL DEFAULT 0,
  owner_role      TEXT NOT NULL DEFAULT 'orchestrator',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_execution_entries_work_item ON execution_entries(work_item_id);
CREATE INDEX IF NOT EXISTS idx_execution_entries_session ON execution_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_entries_status ON execution_entries(status);
CREATE INDEX IF NOT EXISTS idx_connectors_status ON connectors(status);
CREATE INDEX IF NOT EXISTS idx_connectors_type ON connectors(connector_type);

-- ---- Seed P3 baseline data ----

-- Seed initial execution entries (aligned with P1 seed work item wi-001)
INSERT OR IGNORE INTO execution_entries
  (id, work_item_id, session_id, title, executor, status, priority, context_notes, proof_id, started_at, completed_at, blocked_reason, created_at, updated_at)
VALUES
  ('exec-001', 'wi-001', 'ses-001',
   'P1-P2.5 Hardening Execution',
   'AI Developer',
   'done', 'critical',
   'Full platform hardening from P0 baseline through P2.5 production deploy. D1 persistence, auth, role-awareness, continuity, health endpoints all implemented.',
   NULL,
   datetime('now', '-7 days'),
   datetime('now', '-1 day'),
   '',
   datetime('now', '-7 days'),
   datetime('now', '-1 day'));

-- Seed P3 execution entry
INSERT OR IGNORE INTO execution_entries
  (id, work_item_id, session_id, title, executor, status, priority, context_notes, proof_id, started_at, completed_at, blocked_reason, created_at, updated_at)
VALUES
  ('exec-002', 'wi-001', 'ses-001',
   'P3 Operational Expansion — Execution Board + Connector Hub',
   'AI Developer',
   'running', 'high',
   'P3 scope: Execution Board surface, Connector Hub registry, role registry visibility, dashboard P3 update, migration 0004, deploy.',
   NULL,
   datetime('now'),
   NULL,
   '',
   datetime('now'),
   datetime('now'));

-- Seed platform connector registry
INSERT OR IGNORE INTO connectors
  (id, name, connector_type, description, endpoint_hint, status, approval_status, approved_by, risk_level, lane, last_event_at, event_count, owner_role, notes, created_at, updated_at)
VALUES
  ('conn-001', 'cloudflare-d1-persistence', 'api',
   'Cloudflare D1 SQLite database — primary persistence layer for all platform domain objects.',
   'Cloudflare Workers D1 binding (DB)', 'active', 'approved', 'Architect',
   'low', 'ops', datetime('now', '-1 day'), 1, 'architect',
   'Core infrastructure connector. Do not deprecate without full migration plan.',
   datetime('now', '-7 days'), datetime('now', '-7 days')),
  ('conn-002', 'cloudflare-pages-deploy', 'api',
   'Cloudflare Pages deployment pipeline — production deploy target for platform.',
   'wrangler pages deploy (sovereign-os-platform)', 'active', 'approved', 'Founder',
   'medium', 'ops', datetime('now', '-1 day'), 1, 'architect',
   'Deploy via wrangler. Requires PLATFORM_API_KEY secret configured on Pages.',
   datetime('now', '-7 days'), datetime('now', '-7 days')),
  ('conn-003', 'github-repo-push', 'api',
   'GitHub repository push — canonical source of truth for platform codebase.',
   'github.com/ganihypha/Sovereign-os-platform', 'active', 'approved', 'Founder',
   'medium', 'governance', datetime('now', '-1 day'), 1, 'founder',
   'Main branch is production source of truth. No force-push without Architect sign-off.',
   datetime('now', '-7 days'), datetime('now', '-7 days')),
  ('conn-004', 'platform-api-auth', 'api',
   'Platform API Key authentication layer — SHA-256 Bearer token gate for all mutation endpoints.',
   '/api/* requires Authorization: Bearer <key>', 'active', 'approved', 'Architect',
   'high', 'governance', datetime('now'), 0, 'architect',
   'Single-key P1/P2 mode. Role-registry expansion planned for post-P3.',
   datetime('now', '-7 days'), datetime('now', '-7 days'));
