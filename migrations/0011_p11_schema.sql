-- ============================================================
-- SOVEREIGN OS PLATFORM — P11 SCHEMA MIGRATION
-- Migration: 0011_p11_schema.sql
-- Phase: P11 — ABAC Enforcement, Workflow Advanced, Auto-Remediation, Event Bus
-- Date: 2026-04-18
-- Rules: CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN only
-- Never: DROP TABLE, DROP COLUMN, CHANGE COLUMN TYPE
-- ============================================================

-- ============================================================
-- TABLE: remediation_playbooks
-- Purpose: Auto-remediation playbooks (triggered by alert rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS remediation_playbooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  name TEXT NOT NULL,
  description TEXT,
  trigger_rule_id TEXT,              -- optional: alert_rule that triggers this playbook
  trigger_event TEXT,                -- optional: event type that triggers this playbook
  action_steps_json TEXT NOT NULL,   -- JSON array of action steps [{type, params}]
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'draft'
  run_count INTEGER DEFAULT 0,
  last_run_at DATETIME,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trigger_rule_id) REFERENCES alert_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_tenant ON remediation_playbooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_status ON remediation_playbooks(status);
CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_rule ON remediation_playbooks(trigger_rule_id);

-- ============================================================
-- TABLE: remediation_runs
-- Purpose: Execution history for remediation playbooks
-- ============================================================
CREATE TABLE IF NOT EXISTS remediation_runs (
  id TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  triggered_by TEXT NOT NULL DEFAULT 'system',  -- 'system' | 'alert_rule' | 'manual'
  trigger_context_json TEXT,   -- JSON: what triggered this run
  status TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'completed' | 'failed' | 'partial'
  steps_total INTEGER DEFAULT 0,
  steps_completed INTEGER DEFAULT 0,
  result_json TEXT,            -- JSON: per-step results
  error_message TEXT,
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (playbook_id) REFERENCES remediation_playbooks(id)
);

CREATE INDEX IF NOT EXISTS idx_remediation_runs_playbook ON remediation_runs(playbook_id);
CREATE INDEX IF NOT EXISTS idx_remediation_runs_tenant ON remediation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_runs_status ON remediation_runs(status);
CREATE INDEX IF NOT EXISTS idx_remediation_runs_triggered ON remediation_runs(triggered_at);

-- ============================================================
-- TABLE: webhook_delivery_queue
-- Purpose: KV-backed retry queue for webhook deliveries
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_delivery_queue (
  id TEXT PRIMARY KEY,
  connector_id TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'delivered' | 'failed' | 'retrying'
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_attempt_at DATETIME,
  next_retry_at DATETIME,
  response_status INTEGER,
  response_body TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_tenant ON webhook_delivery_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status ON webhook_delivery_queue(status);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_next_retry ON webhook_delivery_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_connector ON webhook_delivery_queue(connector_id);

-- ============================================================
-- TABLE: report_subscriptions
-- Purpose: Auto-delivery report subscriptions (KV-triggered scheduled snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  report_type TEXT NOT NULL,       -- 'approval_audit' | 'federation_activity' | etc.
  format TEXT NOT NULL DEFAULT 'json',  -- 'json' | 'csv'
  schedule TEXT NOT NULL DEFAULT 'daily',  -- 'hourly' | 'daily' | 'weekly'
  filters_json TEXT,               -- JSON filters applied to report
  delivery_type TEXT NOT NULL DEFAULT 'store',  -- 'store' | 'email' | 'webhook'
  recipient TEXT,                  -- email or webhook URL for delivery
  active INTEGER NOT NULL DEFAULT 1,  -- 1=active, 0=inactive
  last_run_at DATETIME,
  next_run_at DATETIME,
  run_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_subs_tenant ON report_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_subs_active ON report_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_report_subs_next_run ON report_subscriptions(next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_subs_type ON report_subscriptions(report_type);

-- ============================================================
-- TABLE: platform_events
-- Purpose: Unified platform event bus (all significant events streamed here)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'tenant-default',
  event_type TEXT NOT NULL,        -- e.g. 'intent.created' | 'approval.approved' | 'workflow.triggered'
  source_surface TEXT NOT NULL,    -- e.g. 'approvals' | 'workflows' | 'connectors'
  actor TEXT,                      -- user or system that generated event
  resource_id TEXT,                -- ID of the affected resource
  resource_type TEXT,              -- type of affected resource
  payload_json TEXT,               -- full event payload (sanitized)
  severity TEXT NOT NULL DEFAULT 'info',  -- 'info' | 'warning' | 'error' | 'critical'
  read INTEGER NOT NULL DEFAULT 0, -- 0=unread, 1=read
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_events_tenant ON platform_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events(event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_surface ON platform_events(source_surface);
CREATE INDEX IF NOT EXISTS idx_platform_events_created ON platform_events(created_at);
CREATE INDEX IF NOT EXISTS idx_platform_events_severity ON platform_events(severity);

-- ============================================================
-- ALTER TABLE: workflows — add multi-step and enhanced fields (P11)
-- ============================================================
ALTER TABLE workflows ADD COLUMN steps_json TEXT;          -- JSON array of sequential action steps
ALTER TABLE workflows ADD COLUMN max_retries INTEGER DEFAULT 0;
ALTER TABLE workflows ADD COLUMN retry_delay_seconds INTEGER DEFAULT 60;
ALTER TABLE workflows ADD COLUMN last_error TEXT;

-- ============================================================
-- ALTER TABLE: workflow_runs — add retry tracking (P11)
-- ============================================================
ALTER TABLE workflow_runs ADD COLUMN retry_of TEXT;        -- ID of the run this is retrying
ALTER TABLE workflow_runs ADD COLUMN step_results_json TEXT; -- per-step execution results

-- ============================================================
-- SEED DATA — P11 Default Remediation Playbooks
-- ============================================================
INSERT OR IGNORE INTO remediation_playbooks (id, tenant_id, name, description, trigger_event, action_steps_json, status, created_by) VALUES
  ('pb-001', 'tenant-default', 'Auto-Acknowledge Stale Alerts', 'Automatically acknowledge alerts older than 24h with no action', 'alert.stale', '[{"type":"log_audit","params":{"event":"auto_acknowledge","severity":"info"}},{"type":"create_notification","params":{"title":"Stale Alert Auto-Acknowledged","event_type":"system_alert"}}]', 'active', 'system'),
  ('pb-002', 'tenant-default', 'Blocked Execution Recovery', 'Notify team when execution is blocked more than 1 hour', 'execution.blocked', '[{"type":"create_notification","params":{"title":"Blocked Execution Requires Attention","event_type":"system_alert","message":"An execution has been blocked for over 1 hour"}},{"type":"log_audit","params":{"event":"execution_block_escalated","severity":"warning"}}]', 'active', 'system'),
  ('pb-003', 'tenant-default', 'High Approval Queue Escalation', 'Escalate when approval queue exceeds threshold', 'approval.queue_high', '[{"type":"create_notification","params":{"title":"Approval Queue Escalation","event_type":"approval_pending","message":"Approval queue has exceeded threshold — escalation required"}},{"type":"log_audit","params":{"event":"approval_queue_escalated","severity":"warning"}}]', 'active', 'system');

-- ============================================================
-- SEED DATA — P11 Default Platform Events (bootstrap)
-- ============================================================
INSERT OR IGNORE INTO platform_events (id, tenant_id, event_type, source_surface, actor, resource_type, payload_json, severity) VALUES
  ('evt-boot-001', 'tenant-default', 'platform.initialized', 'system', 'system', 'platform', '{"message":"Platform P11 initialized","version":"1.1.0-P11"}', 'info'),
  ('evt-boot-002', 'tenant-default', 'remediation.seeded', 'remediation', 'system', 'playbook', '{"count":3,"message":"Default remediation playbooks seeded"}', 'info');

-- ============================================================
-- END P11 MIGRATION
-- ============================================================
