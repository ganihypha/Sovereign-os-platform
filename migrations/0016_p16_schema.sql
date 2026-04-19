-- ============================================================
-- SOVEREIGN OS PLATFORM — MIGRATION 0016 (P16)
-- Phase: P16 — Platform UX Overhaul, Metrics, Search History,
--              Audit Event Detail, Notification Bell, Dark Mode
-- Applied: 2026-04-19
-- Additive-only: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN
-- Never: DROP TABLE, DROP COLUMN, CHANGE COLUMN TYPE
-- ============================================================

-- 1. platform_metrics_snapshots: time-series KPI snapshots for /metrics surface
CREATE TABLE IF NOT EXISTS platform_metrics_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  events_total INTEGER DEFAULT 0,
  events_7d INTEGER DEFAULT 0,
  audit_total INTEGER DEFAULT 0,
  audit_7d INTEGER DEFAULT 0,
  tenants_active INTEGER DEFAULT 0,
  alert_rules_fired_7d INTEGER DEFAULT 0,
  abac_denies_7d INTEGER DEFAULT 0,
  webhook_failed_7d INTEGER DEFAULT 0,
  notifications_7d INTEGER DEFAULT 0,
  approvals_pending INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_at ON platform_metrics_snapshots(snapshot_at DESC);

-- 2. search_history: track user search queries for recent searches API
CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  query TEXT NOT NULL,
  scope TEXT DEFAULT 'all',
  result_count INTEGER DEFAULT 0,
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query);

-- 3. notification_preferences: per-event-type notification severity filter (P16)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  event_type TEXT NOT NULL,
  min_severity TEXT DEFAULT 'low',
  enabled INTEGER DEFAULT 1,
  user_id TEXT DEFAULT 'platform',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_prefs_event ON notification_preferences(event_type, user_id);

-- 4. Seed: default notification preferences for P16 notification center
INSERT OR IGNORE INTO notification_preferences (id, event_type, min_severity, enabled, user_id) VALUES
  ('npref-abac-001', 'abac.access_denied', 'medium', 1, 'platform'),
  ('npref-wh-001', 'webhook.delivery_failed', 'high', 1, 'platform'),
  ('npref-arc-001', 'event.archived', 'low', 1, 'platform'),
  ('npref-alert-001', 'alert_rule.triggered', 'medium', 1, 'platform');

-- 5. Seed: initial platform metrics snapshot (bootstrap)
INSERT OR IGNORE INTO platform_metrics_snapshots (id, events_total, events_7d, audit_total, audit_7d, tenants_active)
  VALUES ('msnap-bootstrap-p16', 0, 0, 0, 0, 0);
