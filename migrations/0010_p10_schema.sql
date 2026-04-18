-- ============================================================
-- SOVEREIGN OS PLATFORM — P10 SCHEMA MIGRATION
-- Migration: 0010_p10_schema.sql
-- Phase: P10 — Enhanced Governance, API v2, ABAC, Alert Rules
-- Date: 2026-04-18
-- Rules: CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN only
-- Never: DROP TABLE, DROP COLUMN, CHANGE COLUMN TYPE
-- ============================================================

-- ============================================================
-- TABLE: report_jobs
-- Purpose: Track scheduled/on-demand governance report generation
-- ============================================================
CREATE TABLE IF NOT EXISTS report_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  report_type TEXT NOT NULL,  -- 'approval_audit' | 'federation_activity' | 'marketplace_activity' | 'anomaly_history' | 'workflow_runs' | 'platform_summary'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
  format TEXT NOT NULL DEFAULT 'json',  -- 'json' | 'csv'
  filters_json TEXT,  -- JSON: { date_from, date_to, tenant_id, event_type }
  result_data TEXT,   -- JSON or CSV string (stored inline for edge compat)
  row_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_tenant ON report_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_jobs_type ON report_jobs(report_type);
CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON report_jobs(status);
CREATE INDEX IF NOT EXISTS idx_report_jobs_created ON report_jobs(created_at);

-- ============================================================
-- TABLE: alert_rules
-- Purpose: Configurable alert rules engine (condition → threshold → action)
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  name TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL,  -- e.g. 'pending_approvals' | 'blocked_executions' | 'unread_alerts' | 'anomaly_score' | 'workflow_failures'
  operator TEXT NOT NULL DEFAULT 'gt',  -- 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq'
  threshold REAL NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL DEFAULT 'create_notification',  -- 'create_notification' | 'send_email' | 'log_audit' | 'trigger_webhook'
  action_json TEXT,  -- JSON payload for action (e.g. {email, subject, webhook_url})
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'draft'
  cooldown_minutes INTEGER DEFAULT 60,  -- min minutes between triggers
  last_triggered_at DATETIME,
  trigger_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_status ON alert_rules(status);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);

-- ============================================================
-- TABLE: alert_rule_triggers
-- Purpose: History log of rule trigger events
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rule_triggers (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  metric_value REAL,
  threshold_value REAL,
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  notification_id TEXT,  -- link to notifications table if action created notification
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_rule ON alert_rule_triggers(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_tenant ON alert_rule_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_at ON alert_rule_triggers(triggered_at);

-- ============================================================
-- TABLE: policies
-- Purpose: ABAC (Attribute-Based Access Control) policy definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  name TEXT NOT NULL,
  description TEXT,
  subject_type TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'role' | 'tenant'
  subject_value TEXT NOT NULL,  -- e.g. 'admin' | 'viewer' | 'tenant-a'
  resource_type TEXT NOT NULL,  -- e.g. 'approvals' | 'reports' | 'connectors' | 'workflows' | '*'
  resource_filter TEXT,  -- optional JSON filter {tenant_id, status, etc}
  action TEXT NOT NULL DEFAULT 'read',  -- 'read' | 'write' | 'delete' | 'approve' | '*'
  effect TEXT NOT NULL DEFAULT 'allow',  -- 'allow' | 'deny'
  priority INTEGER DEFAULT 100,  -- lower = higher priority; deny beats allow at same priority
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive'
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policies_tenant ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_subject ON policies(subject_type, subject_value);
CREATE INDEX IF NOT EXISTS idx_policies_resource ON policies(resource_type);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);

-- ============================================================
-- SEED DATA — P10 Default Alert Rules
-- ============================================================
INSERT OR IGNORE INTO alert_rules (id, tenant_id, name, description, metric, operator, threshold, action_type, action_json, status, cooldown_minutes, created_by) VALUES
  ('rule-001', 'tenant-default', 'High Pending Approvals', 'Alert when pending approvals exceed 10', 'pending_approvals', 'gte', 10, 'create_notification', '{"title":"High Pending Approvals","message":"Pending approvals threshold exceeded"}', 'active', 60, 'system'),
  ('rule-002', 'tenant-default', 'Blocked Executions Alert', 'Alert when any execution is blocked', 'blocked_executions', 'gt', 0, 'create_notification', '{"title":"Blocked Executions Detected","message":"One or more executions are blocked and require attention"}', 'active', 30, 'system'),
  ('rule-003', 'tenant-default', 'Unread Alerts Accumulation', 'Alert when unread alerts exceed 20', 'unread_alerts', 'gte', 20, 'log_audit', '{"event":"alert_accumulation","severity":"warning"}', 'active', 120, 'system');

-- ============================================================
-- SEED DATA — P10 Default ABAC Policies
-- ============================================================
INSERT OR IGNORE INTO policies (id, tenant_id, name, description, subject_type, subject_value, resource_type, action, effect, priority, status, created_by) VALUES
  ('pol-001', 'tenant-default', 'Admin Full Access', 'Administrators have full access to all resources', 'role', 'admin', '*', '*', 'allow', 10, 'active', 'system'),
  ('pol-002', 'tenant-default', 'Viewer Read Only', 'Viewers can only read resources', 'role', 'viewer', '*', 'read', 'allow', 50, 'active', 'system'),
  ('pol-003', 'tenant-default', 'Deny Viewer Delete', 'Viewers cannot delete any resource', 'role', 'viewer', '*', 'delete', 'deny', 10, 'active', 'system'),
  ('pol-004', 'tenant-default', 'Analyst Reports Access', 'Analysts can read and generate reports', 'role', 'analyst', 'reports', '*', 'allow', 30, 'active', 'system'),
  ('pol-005', 'tenant-default', 'Operator Workflow Access', 'Operators can manage workflows', 'role', 'operator', 'workflows', '*', 'allow', 30, 'active', 'system');

-- ============================================================
-- END P10 MIGRATION
-- ============================================================
