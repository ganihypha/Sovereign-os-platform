-- ============================================================
-- SOVEREIGN OS PLATFORM — P5 SCHEMA ADDITIONS
-- Migration: 0006_p5_schema
-- P5 adds:
--   tenants                — Multi-tenant isolation registry
--   webhook_delivery_log   — Outbound webhook delivery runtime log
--   ai_assist_log          — AI orchestration assist audit log
--   public_api_keys        — External public API key management
--   metrics_snapshots      — Platform analytics snapshots
-- EXTENDS (additive only, NO DROP):
--   connectors             — add tenant_id, webhook_url columns
--   platform_alerts        — add tenant_id column
--   product_lanes          — add tenant_id column
--   execution_entries      — add tenant_id column
-- PRESERVES all P0–P4 tables — zero destructive changes.
-- ============================================================

-- ---- tenants: Multi-tenant registry ----
-- Every tenant must be explicitly registered and approved.
-- Default tenant 'default' always exists (backward compat for P0–P4 data).
-- Tenant isolation: tenant_id filters all resource reads.
CREATE TABLE IF NOT EXISTS tenants (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,      -- URL-safe identifier: letters/numbers/hyphens
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'active',
  -- status: active|suspended|archived
  approval_status   TEXT NOT NULL DEFAULT 'pending',
  -- approval_status: pending|approved|rejected
  approved_by       TEXT,
  approval_tier     INTEGER NOT NULL DEFAULT 2,
  plan              TEXT NOT NULL DEFAULT 'standard',
  -- plan: standard|enterprise
  owner_email       TEXT NOT NULL DEFAULT '',
  owner_name        TEXT NOT NULL DEFAULT '',
  isolation_mode    TEXT NOT NULL DEFAULT 'shared',
  -- isolation_mode: shared|isolated
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ---- webhook_delivery_log: Outbound webhook delivery runtime ----
-- Records every delivery attempt — never stores raw payloads or secrets.
-- payload_hash = HMAC-SHA256 of payload (not the payload itself).
-- target_url_hint = sanitized hint of the URL (no query secrets).
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id               TEXT PRIMARY KEY,
  connector_id     TEXT NOT NULL,       -- FK to connectors.id
  tenant_id        TEXT NOT NULL DEFAULT 'default',
  event_type       TEXT NOT NULL,       -- e.g. 'approval_approved', 'execution_blocked'
  payload_hash     TEXT NOT NULL,       -- HMAC-SHA256 — no raw payload stored
  target_url_hint  TEXT NOT NULL DEFAULT '',  -- sanitized (no secrets)
  attempt          INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'pending',
  -- status: pending|delivered|failed|retrying
  http_status      INTEGER,             -- HTTP status code received
  response_hint    TEXT NOT NULL DEFAULT '',  -- first 100 chars of response (sanitized)
  error_message    TEXT NOT NULL DEFAULT '',
  delivered_at     TEXT,
  created_at       TEXT NOT NULL
);

-- ---- ai_assist_log: AI orchestration assist audit trail ----
-- Every AI invocation is logged for governance accountability.
-- CRITICAL: prompt_hash only — never raw prompt stored.
-- confidence_tag is ALWAYS 'ai-generated' until human confirmed.
-- No auto-canon-promotion. No auto-approval.
CREATE TABLE IF NOT EXISTS ai_assist_log (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL DEFAULT 'default',
  session_id       TEXT,                -- nullable FK to sessions.id
  assist_type      TEXT NOT NULL,
  -- assist_type: session_brief|scope_suggestion|risk_assessment|review_summary|general
  prompt_hash      TEXT NOT NULL,       -- SHA-256 of prompt — never raw prompt stored
  model_hint       TEXT NOT NULL DEFAULT '',  -- e.g. 'gpt-4o-mini' (no API key)
  confidence_tag   TEXT NOT NULL DEFAULT 'ai-generated',
  -- ALWAYS 'ai-generated' — only human can change to 'reviewed'
  output_summary   TEXT NOT NULL DEFAULT '',  -- first 200 chars for audit
  confirmed_by     TEXT,               -- null until human confirms
  confirmed_at     TEXT,
  discarded        INTEGER NOT NULL DEFAULT 0,  -- 1 = human discarded
  created_by       TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL
);

-- ---- public_api_keys: External API key management ----
-- Separate from internal role api_keys (different governance model).
-- Raw key is NEVER stored — only SHA-256 hash stored here.
-- Key is shown to issuer once at creation time only.
CREATE TABLE IF NOT EXISTS public_api_keys (
  id               TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  tenant_id        TEXT NOT NULL DEFAULT 'default',
  key_hash         TEXT NOT NULL UNIQUE,  -- SHA-256 — raw key never stored
  role_scope       TEXT NOT NULL DEFAULT 'readonly',
  -- role_scope: readonly|readwrite
  rate_limit       INTEGER NOT NULL DEFAULT 100,  -- requests per hour
  active           INTEGER NOT NULL DEFAULT 1,
  last_used_at     TEXT,
  request_count    INTEGER NOT NULL DEFAULT 0,
  issued_by        TEXT NOT NULL DEFAULT '',
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL
);

-- ---- metrics_snapshots: Platform analytics time-series ----
-- Read-only snapshots taken from real D1 queries. Never synthetic.
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL DEFAULT 'default',
  snapshot_type       TEXT NOT NULL DEFAULT 'daily',
  -- snapshot_type: hourly|daily|weekly
  period_label        TEXT NOT NULL,   -- e.g. '2026-04-17' for daily
  total_sessions      INTEGER NOT NULL DEFAULT 0,
  active_sessions     INTEGER NOT NULL DEFAULT 0,
  pending_approvals   INTEGER NOT NULL DEFAULT 0,
  running_executions  INTEGER NOT NULL DEFAULT 0,
  active_connectors   INTEGER NOT NULL DEFAULT 0,
  verified_proofs     INTEGER NOT NULL DEFAULT 0,
  active_lanes        INTEGER NOT NULL DEFAULT 0,
  unread_alerts       INTEGER NOT NULL DEFAULT 0,
  canon_candidates    INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL
);

-- ---- EXTEND connectors: add P5 columns ----
-- Additive only. Existing connector rows get tenant_id='default', webhook_url=''.
ALTER TABLE connectors ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE connectors ADD COLUMN webhook_url TEXT NOT NULL DEFAULT '';

-- ---- EXTEND platform_alerts: add P5 tenant_id ----
-- Additive only. Existing alerts get tenant_id='default'.
ALTER TABLE platform_alerts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- ---- EXTEND product_lanes: add P5 tenant_id ----
-- Additive only. Existing lanes get tenant_id='default'.
ALTER TABLE product_lanes ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- ---- EXTEND execution_entries: add P5 tenant_id ----
-- Additive only. Existing entries get tenant_id='default'.
ALTER TABLE execution_entries ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_connector ON webhook_delivery_log(connector_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_tenant ON webhook_delivery_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status ON webhook_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_created ON webhook_delivery_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_assist_log_tenant ON ai_assist_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_assist_log_type ON ai_assist_log(assist_type);
CREATE INDEX IF NOT EXISTS idx_public_api_keys_hash ON public_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_public_api_keys_tenant ON public_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_api_keys_active ON public_api_keys(active);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_tenant ON metrics_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_type ON metrics_snapshots(snapshot_type);

-- ---- Seed P5 baseline data ----

-- Seed 'default' tenant (always present — preserves P0–P4 backward compat)
INSERT OR IGNORE INTO tenants
  (id, slug, name, description, status, approval_status, approved_by,
   approval_tier, plan, owner_email, owner_name, isolation_mode, notes,
   created_at, updated_at)
VALUES
  ('tenant-default',
   'default',
   'Sovereign OS Platform (Default)',
   'Default tenant. Holds all P0–P4 existing data for backward compatibility.',
   'active',
   'approved',
   'Founder',
   3,
   'enterprise',
   'founder@sovereign.os',
   'Founder',
   'isolated',
   'Root/default tenant. Cannot be deleted or suspended.',
   datetime('now'),
   datetime('now'));

-- Seed example second tenant (shows isolation capability)
INSERT OR IGNORE INTO tenants
  (id, slug, name, description, status, approval_status, approved_by,
   approval_tier, plan, owner_email, owner_name, isolation_mode, notes,
   created_at, updated_at)
VALUES
  ('tenant-barberkas',
   'barberkas',
   'BarberKas Product Lane',
   'Tenant for BarberKas product vertical. Governed under Sovereign OS Platform.',
   'active',
   'approved',
   'Architect',
   2,
   'standard',
   'architect@barberkas.id',
   'Architect',
   'shared',
   'Example product vertical tenant.',
   datetime('now'),
   datetime('now'));
