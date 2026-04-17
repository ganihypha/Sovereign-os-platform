-- ============================================================
-- SOVEREIGN OS PLATFORM — P1 INITIAL SCHEMA
-- Migration: 0001_initial_schema
-- All 10 domain objects persisted to D1 SQLite
-- ============================================================

-- ---- intents ----
CREATE TABLE IF NOT EXISTS intents (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  objective   TEXT NOT NULL DEFAULT '',
  strategic_context TEXT NOT NULL DEFAULT '',
  urgency     TEXT NOT NULL DEFAULT 'normal',
  scope_notes TEXT NOT NULL DEFAULT '',
  escalation_notes TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT 'Operator',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ---- sessions ----
CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  intent_id           TEXT,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',
  session_brief       TEXT NOT NULL DEFAULT '',
  bounded_brief       TEXT NOT NULL DEFAULT '',
  scope_in            TEXT NOT NULL DEFAULT '[]',  -- JSON array
  scope_out           TEXT NOT NULL DEFAULT '[]',  -- JSON array
  acceptance_criteria TEXT NOT NULL DEFAULT '[]',  -- JSON array
  next_locked_move    TEXT NOT NULL DEFAULT '',
  source_of_truth_refs TEXT NOT NULL DEFAULT '[]', -- JSON array
  active_constraints  TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at          TEXT NOT NULL,
  closed_at           TEXT
);

-- ---- requests ----
CREATE TABLE IF NOT EXISTS requests (
  id              TEXT PRIMARY KEY,
  intent_id       TEXT,
  session_id      TEXT,
  request_title   TEXT NOT NULL,
  request_type    TEXT NOT NULL DEFAULT 'feature',
  lane            TEXT NOT NULL DEFAULT 'ops',
  urgency         TEXT NOT NULL DEFAULT 'normal',
  requester       TEXT NOT NULL DEFAULT 'Operator',
  context_summary TEXT NOT NULL DEFAULT '',
  source_refs     TEXT NOT NULL DEFAULT '[]',  -- JSON array
  readiness_status TEXT NOT NULL DEFAULT 'unknown',
  decision        TEXT NOT NULL DEFAULT 'hold',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- ---- approval_requests ----
CREATE TABLE IF NOT EXISTS approval_requests (
  id             TEXT PRIMARY KEY,
  request_id     TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  approval_tier  INTEGER NOT NULL DEFAULT 1,
  risk_summary   TEXT NOT NULL DEFAULT '',
  payload_summary TEXT NOT NULL DEFAULT '',
  requested_by   TEXT NOT NULL DEFAULT 'Operator',
  approved_by    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  decision_reason TEXT NOT NULL DEFAULT '',
  timestamp      TEXT NOT NULL,
  resolved_at    TEXT
);

-- ---- work_items ----
CREATE TABLE IF NOT EXISTS work_items (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL,
  session_id    TEXT,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  assigned_to   TEXT NOT NULL DEFAULT 'Operator',
  status        TEXT NOT NULL DEFAULT 'pending',
  bounded_scope TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- ---- proof_artifacts ----
CREATE TABLE IF NOT EXISTS proof_artifacts (
  id                    TEXT PRIMARY KEY,
  work_item_id          TEXT NOT NULL,
  proof_type            TEXT NOT NULL DEFAULT 'manual',
  evidence_link         TEXT NOT NULL DEFAULT '',
  verification_notes    TEXT NOT NULL DEFAULT '',
  outcome_classification TEXT NOT NULL DEFAULT 'PARTIAL',
  reviewer              TEXT NOT NULL DEFAULT 'Operator',
  status                TEXT NOT NULL DEFAULT 'pending',
  created_at            TEXT NOT NULL,
  reviewed_at           TEXT
);

-- ---- decision_records ----
CREATE TABLE IF NOT EXISTS decision_records (
  id                   TEXT PRIMARY KEY,
  session_id           TEXT,
  request_id           TEXT,
  decision_type        TEXT NOT NULL DEFAULT 'intent',
  summary              TEXT NOT NULL DEFAULT '',
  decided_by           TEXT NOT NULL DEFAULT 'Founder',
  outcome              TEXT NOT NULL DEFAULT '',
  proof_refs           TEXT NOT NULL DEFAULT '[]', -- JSON array
  canon_candidate_flag INTEGER NOT NULL DEFAULT 0, -- boolean as int
  change_log           TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL
);

-- ---- handoff_records ----
CREATE TABLE IF NOT EXISTS handoff_records (
  id               TEXT PRIMARY KEY,
  session_id       TEXT,
  from_role        TEXT NOT NULL DEFAULT 'Founder',
  to_role          TEXT NOT NULL DEFAULT 'Operator',
  handoff_context  TEXT NOT NULL DEFAULT '',
  open_items       TEXT NOT NULL DEFAULT '[]', -- JSON array
  decision_refs    TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at       TEXT NOT NULL
);

-- ---- priority_items ----
CREATE TABLE IF NOT EXISTS priority_items (
  id                   TEXT PRIMARY KEY,
  title                TEXT NOT NULL,
  category             TEXT NOT NULL DEFAULT 'NEXT',
  session_target       INTEGER NOT NULL DEFAULT 0, -- boolean as int
  blocker              INTEGER NOT NULL DEFAULT 0, -- boolean as int
  blocker_description  TEXT NOT NULL DEFAULT '',
  resolved             INTEGER NOT NULL DEFAULT 0, -- boolean as int
  resolved_at          TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- ---- canon_candidates ----
CREATE TABLE IF NOT EXISTS canon_candidates (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  content_ref  TEXT NOT NULL DEFAULT '',
  proposed_by  TEXT NOT NULL DEFAULT 'Operator',
  status       TEXT NOT NULL DEFAULT 'candidate',
  review_notes TEXT NOT NULL DEFAULT '',
  approved_by  TEXT,
  promoted_at  TEXT,
  created_at   TEXT NOT NULL
);

-- ---- api_keys (for P1 auth) ----
CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY,
  key_hash    TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'operator',  -- 'founder' | 'operator' | 'reviewer'
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  last_used_at TEXT
);

-- ---- audit_log ----
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  actor       TEXT NOT NULL DEFAULT 'system',
  action      TEXT NOT NULL,
  object_type TEXT NOT NULL DEFAULT '',
  object_id   TEXT NOT NULL DEFAULT '',
  detail      TEXT NOT NULL DEFAULT '',
  ip          TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_sessions_intent ON sessions(intent_id);
CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(session_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_proof_artifacts_wi ON proof_artifacts(work_item_id);
CREATE INDEX IF NOT EXISTS idx_priority_items_cat ON priority_items(category);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
