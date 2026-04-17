-- ============================================================
-- SOVEREIGN OS PLATFORM — P4 SCHEMA ADDITIONS
-- Migration: 0005_p4_schema
-- P4 adds:
--   product_lanes     — Lane Directory
--   platform_alerts   — Alert & Notification Layer
--   canon_promotions  — Canon Promotion Audit Log
-- EXTENDS:
--   sessions          — add onboarding_completed
--   canon_candidates  — add review_status, reviewed_by, reviewed_at,
--                       review_reason, promoted_at, rejected_at
-- PRESERVES all P0–P3 tables — no destructive changes.
-- ============================================================

-- ---- product_lanes: Product Lane Directory ----
-- Governs all product lanes operating under platform governance.
-- No lane may exist without being formally registered here.
-- Lane registration requires Tier 2 approval.
CREATE TABLE IF NOT EXISTS product_lanes (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  lane_type       TEXT NOT NULL DEFAULT 'product-vertical',
  -- Types: governance-core|product-vertical|runtime-service|experiment
  description     TEXT NOT NULL DEFAULT '',
  repo_link       TEXT NOT NULL DEFAULT '',
  owner           TEXT NOT NULL DEFAULT '',
  owner_role      TEXT NOT NULL DEFAULT 'architect',
  governance_tier INTEGER NOT NULL DEFAULT 2,
  status          TEXT NOT NULL DEFAULT 'active',
  -- Status: active|inactive|archived
  approval_status TEXT NOT NULL DEFAULT 'pending',
  -- approval_status: pending|approved|rejected
  approved_by     TEXT,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- ---- platform_alerts: Alert & Notification Storage ----
-- Stores governance-critical alert events.
-- Alerts must come from real state changes, never synthetic.
CREATE TABLE IF NOT EXISTS platform_alerts (
  id           TEXT PRIMARY KEY,
  alert_type   TEXT NOT NULL,
  -- Types: approval_pending|proof_submitted|connector_error|
  --        session_stale|execution_blocked|canon_candidate_ready|
  --        lane_registered|role_assigned
  title        TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL DEFAULT '',
  severity     TEXT NOT NULL DEFAULT 'info',
  -- Severity: info|warning|critical
  object_type  TEXT NOT NULL DEFAULT '',
  -- The type of object that triggered this alert
  object_id    TEXT NOT NULL DEFAULT '',
  -- The ID of the triggering object
  acknowledged INTEGER NOT NULL DEFAULT 0,
  -- 0 = unread, 1 = acknowledged
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  created_at   TEXT NOT NULL
);

-- ---- canon_promotions: Canon Promotion Audit Log ----
-- Records every promote/reject action with full audit trail.
-- No auto-promotion path exists — every entry requires human action.
CREATE TABLE IF NOT EXISTS canon_promotions (
  id                TEXT PRIMARY KEY,
  canon_candidate_id TEXT NOT NULL,  -- FK to canon_candidates.id
  action            TEXT NOT NULL,   -- 'promote' | 'reject'
  acted_by          TEXT NOT NULL,   -- role label of who acted
  acted_by_role     TEXT NOT NULL,   -- PlatformRole: founder|architect
  reason            TEXT NOT NULL DEFAULT '',
  acted_at          TEXT NOT NULL
);

-- ---- EXTEND sessions: add onboarding_completed ----
-- Tracks whether a session/operator has completed the onboarding wizard.
-- Additive only — existing rows default to 0 (not completed).
ALTER TABLE sessions ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;

-- ---- EXTEND canon_candidates: add review workflow columns ----
-- Adds promotion workflow state to canon_candidates.
-- Additive only.
ALTER TABLE canon_candidates ADD COLUMN review_status TEXT NOT NULL DEFAULT 'candidate';
-- review_status: candidate|under_review|promoted|rejected
ALTER TABLE canon_candidates ADD COLUMN reviewed_by TEXT;
ALTER TABLE canon_candidates ADD COLUMN reviewed_at TEXT;
ALTER TABLE canon_candidates ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_product_lanes_status ON product_lanes(status);
CREATE INDEX IF NOT EXISTS idx_product_lanes_type ON product_lanes(lane_type);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_acknowledged ON platform_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_type ON platform_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_created ON platform_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_canon_promotions_candidate ON canon_promotions(canon_candidate_id);

-- ---- Seed P4 baseline data ----

-- Seed platform core lane (governance-core — always present)
INSERT OR IGNORE INTO product_lanes
  (id, name, lane_type, description, repo_link, owner, owner_role,
   governance_tier, status, approval_status, approved_by, notes, created_at, updated_at)
VALUES
  ('lane-001',
   'Sovereign OS Platform Core',
   'governance-core',
   'The platform governance core. Controls all other lanes. Source of platform law.',
   'https://github.com/ganihypha/Sovereign-os-platform',
   'Founder',
   'founder',
   3,
   'active',
   'approved',
   'Founder',
   'This is the root governance lane. Cannot be deactivated.',
   datetime('now'),
   datetime('now')),
  ('lane-002',
   'BarberKas',
   'product-vertical',
   'Barber shop management product lane — governed under Sovereign OS Platform.',
   '',
   'Architect',
   'architect',
   2,
   'active',
   'approved',
   'Architect',
   'Example product vertical. Governed by platform approval gates.',
   datetime('now'),
   datetime('now')),
  ('lane-003',
   'Platform Runtime Services',
   'runtime-service',
   'Infrastructure and runtime services supporting platform operation.',
   '',
   'Architect',
   'architect',
   2,
   'active',
   'approved',
   'Architect',
   'Includes D1, Pages deploy, GitHub push connectors.',
   datetime('now'),
   datetime('now'));

-- Seed initial platform alerts
INSERT OR IGNORE INTO platform_alerts
  (id, alert_type, title, message, severity, object_type, object_id, acknowledged, created_at)
VALUES
  ('alert-001',
   'canon_candidate_ready',
   'Canon Candidate Awaiting Review',
   'Canon candidate "Sovereign OS Platform — Operating Law" (can-001) is awaiting founder review and promotion.',
   'info',
   'canon_candidates',
   'can-001',
   0,
   datetime('now')),
  ('alert-002',
   'approval_pending',
   'Pending Approval: P1 Hardening Promotion',
   'Approval request apr-001 (Tier 2) has been pending. Requires architect or founder action.',
   'warning',
   'approval_requests',
   'apr-001',
   0,
   datetime('now'));
