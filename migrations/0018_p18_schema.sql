-- ============================================================
-- SOVEREIGN OS PLATFORM — MIGRATION 0018 (P18)
-- P18: Workflow Run History table (UI for existing workflow_run_history),
--      Platform Session Tracking (wire auth → platform_sessions),
--      UI Performance Index table, Navigation State table
-- Applied: additive-only, zero DROP
-- ============================================================

-- 1. workflow_run_history — P17 created schema, P18 adds indexes + triggers tracking
-- (table may already exist from 0017; IF NOT EXISTS guards it)
CREATE TABLE IF NOT EXISTS workflow_run_history (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT 'manual',  -- manual / scheduled / event
  trigger_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running',        -- running / completed / failed / cancelled
  input_summary TEXT NOT NULL DEFAULT '',
  output_summary TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  steps_total INTEGER NOT NULL DEFAULT 0,
  steps_completed INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wrh_workflow_id ON workflow_run_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wrh_status ON workflow_run_history(status);
CREATE INDEX IF NOT EXISTS idx_wrh_tenant ON workflow_run_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wrh_started ON workflow_run_history(started_at DESC);

-- 2. platform_sessions — P17 created table, P18 tries to add columns (may already exist)
-- Use conditional approach via a new tracking table instead of ALTER
CREATE TABLE IF NOT EXISTS platform_sessions_ext (
  session_id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL DEFAULT '',
  role_name TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. page_view_log — lightweight page analytics (P18)
CREATE TABLE IF NOT EXISTS page_view_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  role_name TEXT NOT NULL DEFAULT 'anonymous',
  tenant_id TEXT NOT NULL DEFAULT 'default',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER NOT NULL DEFAULT 200,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pvl_path ON page_view_log(path);
CREATE INDEX IF NOT EXISTS idx_pvl_viewed ON page_view_log(viewed_at DESC);

-- 4. platform_changelog — track what changed in each deploy (P18)
CREATE TABLE IF NOT EXISTS platform_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  phase TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'feature',  -- feature / fix / improvement / breaking
  description TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'system',
  deployed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed P18 changelog entry
INSERT OR IGNORE INTO platform_changelog (version, phase, change_type, description, author)
VALUES
  ('1.8.0-P18', 'P18', 'improvement', 'Nav reorganization: merged P16/P17 sections into contextual groups (8 groups vs 8 flat groups)', 'architect'),
  ('1.8.0-P18', 'P18', 'feature', 'Page transition loading bar (NProgress-style) for perceived performance improvement', 'architect'),
  ('1.8.0-P18', 'P18', 'feature', 'Nav filter input: live search within sidebar navigation items', 'architect'),
  ('1.8.0-P18', 'P18', 'feature', '/workflows/history — Workflow Run History surface (UI for workflow_run_history table)', 'architect'),
  ('1.8.0-P18', 'P18', 'fix', '/policies/simulate 500 — fixed dynamic import causing CF Worker error', 'architect'),
  ('1.8.0-P18', 'P18', 'fix', '/api/v1 root path 500 — added explicit root handler', 'architect'),
  ('1.8.0-P18', 'P18', 'improvement', 'Auth flow wires session to platform_sessions on login', 'architect'),
  ('1.8.0-P18', 'P18', 'improvement', 'Skip-to-content accessibility link added to all pages', 'architect');

-- 5. notification_preferences — ensure seeded (may already exist from 0016 seed)
INSERT OR IGNORE INTO notification_preferences (event_type, min_severity, enabled)
VALUES
  ('workflow.completed', 'info', 1),
  ('workflow.failed', 'error', 1),
  ('admin.setting_changed', 'warning', 1),
  ('session.force_logout', 'critical', 1);
