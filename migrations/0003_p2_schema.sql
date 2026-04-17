-- ============================================================
-- SOVEREIGN OS PLATFORM — P2 SCHEMA ADDITIONS
-- Migration: 0003_p2_schema
-- P2 adds: role registry, session continuity artifacts,
--          governance boundary markers, operator notes
-- PRESERVES all P1 tables — no destructive changes.
-- ============================================================

-- ---- role_assignments: role-aware access registry ----
-- Stores named roles and their auth-hash association.
-- Roles: founder | architect | orchestrator | executor | reviewer
CREATE TABLE IF NOT EXISTS role_assignments (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL DEFAULT 'operator',    -- founder|architect|orchestrator|executor|reviewer
  label       TEXT NOT NULL DEFAULT '',            -- human-readable name e.g. "Main Founder"
  key_hash    TEXT NOT NULL UNIQUE,                -- SHA-256 of the platform key for this role
  active      INTEGER NOT NULL DEFAULT 1,
  permissions TEXT NOT NULL DEFAULT '[]',          -- JSON array of permitted action types
  created_at  TEXT NOT NULL,
  last_used_at TEXT
);

-- ---- session_continuity: structured continuity artifacts ----
-- Each session can have one or more continuity snapshots.
-- Used for handoff traceability and next-session restartability.
CREATE TABLE IF NOT EXISTS session_continuity (
  id                TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL,
  snapshot_type     TEXT NOT NULL DEFAULT 'handoff', -- handoff|checkpoint|closeout
  platform_state    TEXT NOT NULL DEFAULT '{}',       -- JSON snapshot of key counts
  open_items        TEXT NOT NULL DEFAULT '[]',       -- JSON array
  pending_approvals TEXT NOT NULL DEFAULT '[]',       -- JSON array of pending approval IDs
  pending_proofs    TEXT NOT NULL DEFAULT '[]',       -- JSON array of pending proof IDs
  next_locked_move  TEXT NOT NULL DEFAULT '',
  authored_by       TEXT NOT NULL DEFAULT 'Orchestrator',
  governance_notes  TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL
);

-- ---- governance_boundaries: explicit lane separation markers ----
-- Records where governance ends and product/runtime begins.
-- Prevents silent drift.
CREATE TABLE IF NOT EXISTS governance_boundaries (
  id            TEXT PRIMARY KEY,
  boundary_name TEXT NOT NULL UNIQUE,   -- e.g. "governance_vs_product", "approval_gate"
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active', -- active|suspended|under_review
  owner_role    TEXT NOT NULL DEFAULT 'architect',
  last_reviewed TEXT,
  created_at    TEXT NOT NULL
);

-- ---- operator_notes: lightweight structured notes ----
-- Operators can attach notes to any domain object.
-- Supports continuity without requiring full decision record.
CREATE TABLE IF NOT EXISTS operator_notes (
  id          TEXT PRIMARY KEY,
  object_type TEXT NOT NULL DEFAULT '',  -- intents|sessions|requests|work_items etc
  object_id   TEXT NOT NULL DEFAULT '',
  note_type   TEXT NOT NULL DEFAULT 'observation', -- observation|blocker|clarification|reminder
  content     TEXT NOT NULL DEFAULT '',
  authored_by TEXT NOT NULL DEFAULT 'Operator',
  resolved    INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at  TEXT NOT NULL
);

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_role_assignments_role ON role_assignments(role);
CREATE INDEX IF NOT EXISTS idx_session_continuity_session ON session_continuity(session_id);
CREATE INDEX IF NOT EXISTS idx_operator_notes_object ON operator_notes(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);

-- ---- Seed governance boundaries ----
INSERT OR IGNORE INTO governance_boundaries (id, boundary_name, description, status, owner_role, created_at) VALUES
  ('gb-001', 'governance_vs_product',
   'Governance lane (governance/, ops/, docs/) must not be mixed with product lane execution. Changes to canonical platform law require Founder approval.',
   'active', 'architect', datetime('now')),
  ('gb-002', 'approval_gate',
   'All Tier 2+ actions must pass through approval_requests before execution. Auto-approval only for Tier 0 reversible actions.',
   'active', 'orchestrator', datetime('now')),
  ('gb-003', 'proof_before_status',
   'No status may be promoted to VERIFIED or promoted to canon without documented proof artifact and reviewer signature.',
   'active', 'reviewer', datetime('now')),
  ('gb-004', 'role_separation',
   'Founder, Architect, Orchestrator, Executor, and Reviewer roles must not collapse. Each role has distinct write permissions defined in role_assignments.',
   'active', 'architect', datetime('now'));
