-- ============================================================
-- SOVEREIGN OS PLATFORM — P14 SCHEMA MIGRATION
-- Phase: P14 — Alert Rules ABAC UI, Portal Policies Tab,
--         Tenant ABAC Middleware, Health Drill-down,
--         Audit Trail Improvements, Notification Integration
-- Additive only: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN
-- Never: DROP TABLE, DROP COLUMN
-- ============================================================

-- 1. portal_tenant_policies: portal-scoped policy delegation
--    Tracks which policies are available for tenants to self-assign in portal
CREATE TABLE IF NOT EXISTS portal_tenant_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT 'admin',
  portal_slug TEXT NOT NULL DEFAULT 'default',
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, policy_id, portal_slug)
);
CREATE INDEX IF NOT EXISTS idx_portal_tenant_policies_tenant ON portal_tenant_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_tenant_policies_slug ON portal_tenant_policies(portal_slug);

-- 2. abac_deny_details: extended deny context for drill-down
--    Links to abac_deny_log with full request context
CREATE TABLE IF NOT EXISTS abac_deny_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deny_log_id INTEGER,
  request_path TEXT,
  request_method TEXT,
  context_json TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_abac_deny_details_log_id ON abac_deny_details(deny_log_id);
CREATE INDEX IF NOT EXISTS idx_abac_deny_details_created ON abac_deny_details(created_at);

-- 3. audit_export_jobs: async audit export tracking
CREATE TABLE IF NOT EXISTS audit_export_jobs (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL DEFAULT 'csv',
  filter_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  row_count INTEGER,
  result_url TEXT,
  created_by TEXT DEFAULT 'ui',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_audit_export_jobs_status ON audit_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_export_jobs_created ON audit_export_jobs(created_at);

-- 4. Seed: add alert-rules to abac_ui_config if not present
--    (already seeded in 0013 but ensure it exists)
INSERT OR IGNORE INTO abac_ui_config (surface, resource_type, action, role_required, tooltip_deny)
VALUES ('alert-rules', 'alert-rules', 'write', 'admin', 'Creating alert rules requires admin or operator role');

-- 5. platform_notification_rules: wire events → notifications
--    Tracks which platform events should auto-create notifications
CREATE TABLE IF NOT EXISTS platform_notification_rules (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  notification_title TEXT NOT NULL,
  notification_body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platform_notif_rules_event ON platform_notification_rules(event_type);

-- 6. Seed: default notification rules for P14 events
INSERT OR IGNORE INTO platform_notification_rules (id, event_type, notification_title, notification_body, severity)
VALUES
  ('pnr-001', 'abac.access_denied', 'ABAC Access Denied', 'An access denial was recorded. Subject attempted restricted action.', 'warning'),
  ('pnr-002', 'event.archived', 'Events Archived', 'Platform event archive cycle completed.', 'info'),
  ('pnr-003', 'webhook.delivery_failed', 'Webhook Delivery Failed', 'All retry attempts exhausted for webhook delivery.', 'critical'),
  ('pnr-004', 'alert_rule.triggered', 'Alert Rule Triggered', 'An alert rule threshold was exceeded.', 'warning');
