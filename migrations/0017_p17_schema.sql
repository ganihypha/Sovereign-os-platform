-- ============================================================
-- SOVEREIGN OS PLATFORM — MIGRATION 0017 (P17)
-- Phase: P17 — Advanced Notification Center, Admin Panel,
--              Audit Pagination Deep Links, Metrics Snapshots,
--              Search Analytics, Workflow History
-- Rules: CREATE TABLE IF NOT EXISTS only — additive only
--        No DROP, no destructive changes
-- ============================================================

-- 1. Platform admin settings (key-value config store)
CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  setting_type TEXT NOT NULL DEFAULT 'string',  -- string, number, boolean, json
  category TEXT NOT NULL DEFAULT 'general',     -- general, retention, alerts, notifications
  description TEXT,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_platform_settings_category ON platform_settings(category);

-- 2. Active user sessions table (for admin session management)
CREATE TABLE IF NOT EXISTS platform_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'platform-admin',
  session_token_hash TEXT NOT NULL,  -- hashed, never plaintext
  ip_address TEXT,
  user_agent TEXT,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  force_logout INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_user ON platform_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_active ON platform_sessions(last_active_at);

-- 3. Search history analytics (extends P16 search_history — no changes to existing)
-- search_history already exists from 0016. Add search_analytics view/aggregation table.
CREATE TABLE IF NOT EXISTS search_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_term TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  result_count INTEGER NOT NULL DEFAULT 0,
  search_duration_ms INTEGER,
  searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_search_analytics_term ON search_analytics(query_term);
CREATE INDEX IF NOT EXISTS idx_search_analytics_scope ON search_analytics(scope);
CREATE INDEX IF NOT EXISTS idx_search_analytics_at ON search_analytics(searched_at);

-- 4. Workflow run history (visual trigger history per workflow)
CREATE TABLE IF NOT EXISTS workflow_run_history (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual',  -- manual, schedule, event
  status TEXT NOT NULL DEFAULT 'pending',        -- pending, running, completed, failed
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  duration_ms INTEGER,
  error_message TEXT,
  step_count INTEGER DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default'
);
CREATE INDEX IF NOT EXISTS idx_workflow_run_wf_id ON workflow_run_history(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_status ON workflow_run_history(status);
CREATE INDEX IF NOT EXISTS idx_workflow_run_started ON workflow_run_history(started_at);

-- 5. API key rotation log (track rotation events)
CREATE TABLE IF NOT EXISTS api_key_rotation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id TEXT NOT NULL,
  key_name TEXT,
  action TEXT NOT NULL,  -- rotated, expired, revoked, created
  performed_by TEXT NOT NULL DEFAULT 'admin',
  rotated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_key_rotation_key ON api_key_rotation_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_rotation_at ON api_key_rotation_log(rotated_at);

-- 6. Notification grouping (group notifications by event_type for inbox)
-- notification_preferences already exists from 0016. Add bulk_operations_log.
CREATE TABLE IF NOT EXISTS notification_bulk_ops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,  -- mark_read, delete
  notification_ids TEXT NOT NULL,  -- JSON array of IDs
  count INTEGER NOT NULL DEFAULT 0,
  performed_by TEXT NOT NULL DEFAULT 'user',
  performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tenant_id TEXT NOT NULL DEFAULT 'default'
);
CREATE INDEX IF NOT EXISTS idx_notif_bulk_ops_at ON notification_bulk_ops(performed_at);

-- ============================================================
-- SEED: Default platform settings
-- ============================================================
INSERT OR IGNORE INTO platform_settings (setting_key, setting_value, setting_type, category, description, updated_by) VALUES
  ('retention_days',         '90',     'number',  'retention',      'Default event retention period in days', 'system'),
  ('archive_batch_size',     '100',    'number',  'retention',      'Archive batch size per cycle', 'system'),
  ('alert_threshold_high',   '50',     'number',  'alerts',         'ABAC deny count threshold for high alert', 'system'),
  ('alert_threshold_critical','100',   'number',  'alerts',         'ABAC deny count threshold for critical alert', 'system'),
  ('notification_retention_days', '30','number',  'notifications',  'Days to keep notifications before auto-cleanup', 'system'),
  ('metrics_snapshot_interval','3600', 'number',  'general',        'Metrics snapshot interval in seconds', 'system'),
  ('search_max_results',     '20',     'number',  'general',        'Maximum search results per type', 'system'),
  ('platform_name',          'Sovereign OS Platform', 'string', 'general', 'Platform display name', 'system'),
  ('maintenance_mode',       'false',  'boolean', 'general',        'Enable maintenance mode', 'system'),
  ('audit_hash_verify_on_load','true', 'boolean', 'general',        'Verify audit hashes on every page load', 'system');
