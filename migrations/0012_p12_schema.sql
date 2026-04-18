-- ============================================================
-- SOVEREIGN OS PLATFORM — P12 SCHEMA
-- Migration: 0012_p12_schema
-- Phase: P12 — ABAC Middleware, Scheduled Reports, Webhook Queue, Event Bus Integration, API Key Permissions
-- ============================================================

-- API Key ↔ Policy join table (scoped permissions)
CREATE TABLE IF NOT EXISTS api_key_policies (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(api_key_id, policy_id)
);
CREATE INDEX IF NOT EXISTS idx_akp_api_key_id ON api_key_policies(api_key_id);
CREATE INDEX IF NOT EXISTS idx_akp_policy_id ON api_key_policies(policy_id);

-- Event archives (auto-archive events older than 30 days)
CREATE TABLE IF NOT EXISTS event_archives (
  id TEXT PRIMARY KEY,
  original_event_id TEXT NOT NULL,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ea_original_event_id ON event_archives(original_event_id);
CREATE INDEX IF NOT EXISTS idx_ea_archived_at ON event_archives(archived_at);

-- Report subscription execution log
CREATE TABLE IF NOT EXISTS report_subscription_runs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  job_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_rsr_subscription_id ON report_subscription_runs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_rsr_run_at ON report_subscription_runs(run_at);

-- Seed: default report subscriptions (if table exists from P11)
INSERT OR IGNORE INTO report_subscriptions (id, tenant_id, report_type, schedule, delivery_type, recipient, active, created_at)
VALUES
  ('rsub-001', 'system', 'platform_summary', 'daily', 'store', 'system', 1, CURRENT_TIMESTAMP),
  ('rsub-002', 'system', 'approval_audit', 'weekly', 'store', 'system', 1, CURRENT_TIMESTAMP);

-- ============================================================
-- END MIGRATION 0012
-- ============================================================
