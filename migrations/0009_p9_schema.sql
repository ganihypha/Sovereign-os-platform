-- ============================================================
-- Migration 0009: P9 — Real-time Notifications, Workflow Automation,
--                      Health Dashboard, Tenant Portal
-- Additive-only. No DROP. No destructive schema change.
-- ============================================================

-- Notifications table (SSE + inbox, KV-backed state)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  event_type TEXT NOT NULL, -- approval_pending | anomaly_detected | federation_request | marketplace_submitted | workflow_triggered | system_alert
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0, -- 0=unread, 1=read
  actor TEXT NOT NULL DEFAULT 'system',
  reference_id TEXT, -- optional: linked object id (e.g. approval id, workflow id)
  reference_type TEXT, -- optional: approval | workflow | federation | marketplace
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Workflows table (trigger chains: event → condition → action)
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL, -- approval_submitted | anomaly_detected | federation_request | connector_submitted | manual
  condition_json TEXT NOT NULL DEFAULT '{}', -- JSON condition object
  action_json TEXT NOT NULL DEFAULT '{}',    -- JSON action object
  template_id TEXT, -- built-in template reference: tpl-001 | tpl-002 | tpl-003
  status TEXT NOT NULL DEFAULT 'draft', -- draft | pending_approval | active | inactive | archived
  created_by TEXT NOT NULL DEFAULT 'system',
  approved_by TEXT,
  activated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_event);

-- Workflow runs (execution history, all runs logged to audit_log_v2 also)
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'system', -- actor or event source
  input_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running', -- running | success | failed | skipped
  output_summary TEXT,
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at);

-- Health snapshots (time-series for /health-dashboard, SLA tracking)
CREATE TABLE IF NOT EXISTS health_snapshots (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL, -- surface name e.g. dashboard, federation, audit
  http_status INTEGER NOT NULL DEFAULT 200,
  response_ms INTEGER NOT NULL DEFAULT 0,
  is_healthy INTEGER NOT NULL DEFAULT 1, -- 1=healthy, 0=degraded
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_surface ON health_snapshots(surface);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_checked ON health_snapshots(checked_at);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_healthy ON health_snapshots(is_healthy);

-- Seed: 3 built-in workflow templates (seed data)
INSERT OR IGNORE INTO workflows (id, tenant_id, name, description, trigger_event, condition_json, action_json, template_id, status, created_by) VALUES
(
  'tpl-wf-001',
  'default',
  'Auto-Notify on Approval Pending',
  'When a new approval is submitted, automatically create a notification for admins',
  'approval_submitted',
  '{"always": true}',
  '{"type": "create_notification", "event_type": "approval_pending", "title": "New Approval Pending", "message": "A new approval request requires your attention", "target": "admin"}',
  'tpl-001',
  'active',
  'system'
),
(
  'tpl-wf-002',
  'default',
  'Anomaly Alert Escalation',
  'When an anomaly is detected, create high-priority notification and log to audit',
  'anomaly_detected',
  '{"severity": "any"}',
  '{"type": "create_notification", "event_type": "anomaly_detected", "title": "Platform Anomaly Detected", "message": "Anomaly detection pipeline flagged unusual activity", "target": "admin"}',
  'tpl-002',
  'active',
  'system'
),
(
  'tpl-wf-003',
  'default',
  'Federation Request Notification',
  'When a federation request is created, notify relevant tenant admins',
  'federation_request',
  '{"always": true}',
  '{"type": "create_notification", "event_type": "federation_request", "title": "Federation Request Received", "message": "A new federation request requires review and approval", "target": "admin"}',
  'tpl-003',
  'active',
  'system'
);

-- Seed: initial health snapshots for core surfaces
INSERT OR IGNORE INTO health_snapshots (id, surface, http_status, response_ms, is_healthy, checked_at) VALUES
('hs-init-001', 'dashboard', 200, 45, 1, CURRENT_TIMESTAMP),
('hs-init-002', 'api/v1', 200, 32, 1, CURRENT_TIMESTAMP),
('hs-init-003', 'federation', 200, 58, 1, CURRENT_TIMESTAMP),
('hs-init-004', 'marketplace', 200, 51, 1, CURRENT_TIMESTAMP),
('hs-init-005', 'audit', 200, 48, 1, CURRENT_TIMESTAMP),
('hs-init-006', 'tenants', 200, 40, 1, CURRENT_TIMESTAMP),
('hs-init-007', 'workflows', 200, 35, 1, CURRENT_TIMESTAMP),
('hs-init-008', 'notifications', 200, 30, 1, CURRENT_TIMESTAMP);

-- ============================================================
-- END Migration 0009
-- ============================================================
