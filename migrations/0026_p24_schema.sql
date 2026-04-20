-- ============================================================
-- SOVEREIGN OS PLATFORM — MIGRATION 0026
-- Phase: P24 — Marketplace Templates, Federation Sync, Webhook Inbound, Ecosystem
-- Date: 2026-04-20
-- Additive only: CREATE IF NOT EXISTS / ALTER ADD COLUMN only
-- ============================================================

-- connector_templates: Real template library for Marketplace
CREATE TABLE IF NOT EXISTS connector_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'generic',   -- github / slack / jira / webhook / generic
  description TEXT,
  icon_url TEXT,
  config_schema TEXT NOT NULL DEFAULT '{}',      -- JSON schema for config fields
  default_config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'published',      -- draft / published / deprecated
  install_count INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- federation_sync_log: Per-tenant read-only sync events
CREATE TABLE IF NOT EXISTS federation_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  federation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  sync_type TEXT NOT NULL DEFAULT 'read-only',
  records_synced INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',        -- success / failed / partial
  error_message TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- webhook_inbound_log: Inbound webhook events from external systems
CREATE TABLE IF NOT EXISTS webhook_inbound_log (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'unknown',        -- github / slack / jira / unknown
  tenant_id TEXT NOT NULL DEFAULT 'default',
  payload_hash TEXT,                             -- HMAC-SHA256 of payload
  signature_valid INTEGER NOT NULL DEFAULT 0,
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'received',       -- received / processed / failed
  workflow_triggered TEXT,
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- connector_ratings: Marketplace rating/stars system (SHOULD DO)
CREATE TABLE IF NOT EXISTS connector_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connector_template_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  rated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connector_templates_source ON connector_templates(source_type, status);
CREATE INDEX IF NOT EXISTS idx_connector_templates_tenant ON connector_templates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_federation_sync_log_id ON federation_sync_log(federation_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_federation_sync_log_tenant ON federation_sync_log(tenant_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_webhook_inbound_log_source ON webhook_inbound_log(source, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_inbound_log_tenant ON webhook_inbound_log(tenant_id, received_at);
CREATE INDEX IF NOT EXISTS idx_connector_ratings_template ON connector_ratings(connector_template_id);

-- Seed: Built-in connector templates for Marketplace
INSERT OR IGNORE INTO connector_templates (id, name, source_type, description, icon_url, config_schema, default_config, status, install_count, tenant_id) VALUES
(
  'tpl-github-01',
  'GitHub Webhook',
  'github',
  'Connect GitHub repositories to receive push, PR, and issue events. Triggers governance workflows on code changes.',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/svgs/brands/github.svg',
  '{"fields":[{"key":"repo_url","label":"Repository URL","type":"text","required":true,"placeholder":"https://github.com/org/repo"},{"key":"webhook_secret","label":"Webhook Secret","type":"password","required":false,"placeholder":"Optional HMAC secret"},{"key":"events","label":"Events","type":"multiselect","options":["push","pull_request","issues","release"],"default":["push","pull_request"]}]}',
  '{"events":["push","pull_request"]}',
  'published',
  142,
  'default'
),
(
  'tpl-slack-01',
  'Slack Notifications',
  'slack',
  'Send governance alerts, approval requests, and intent updates directly to Slack channels.',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/svgs/brands/slack.svg',
  '{"fields":[{"key":"webhook_url","label":"Slack Webhook URL","type":"text","required":true,"placeholder":"https://hooks.slack.com/services/..."},{"key":"channel","label":"Channel","type":"text","required":false,"placeholder":"#governance-alerts"},{"key":"notify_on","label":"Notify On","type":"multiselect","options":["intent_created","approval_required","execution_complete","anomaly_detected"],"default":["approval_required","anomaly_detected"]}]}',
  '{"notify_on":["approval_required","anomaly_detected"]}',
  'published',
  98,
  'default'
),
(
  'tpl-jira-01',
  'Jira Issue Sync',
  'jira',
  'Sync governance intents and execution tasks with Jira. Auto-create issues from approved governance actions.',
  NULL,
  '{"fields":[{"key":"jira_url","label":"Jira Base URL","type":"text","required":true,"placeholder":"https://yourorg.atlassian.net"},{"key":"project_key","label":"Project Key","type":"text","required":true,"placeholder":"GOV"},{"key":"api_token","label":"API Token","type":"password","required":true,"placeholder":"Jira API token"},{"key":"email","label":"Account Email","type":"email","required":true,"placeholder":"admin@yourorg.com"}]}',
  '{}',
  'published',
  67,
  'default'
),
(
  'tpl-webhook-01',
  'Generic Webhook',
  'webhook',
  'Send governance events to any HTTP endpoint. Supports custom headers, HMAC signing, and retry logic.',
  NULL,
  '{"fields":[{"key":"endpoint_url","label":"Endpoint URL","type":"text","required":true,"placeholder":"https://api.yourapp.com/hooks/governance"},{"key":"secret","label":"Signing Secret","type":"password","required":false,"placeholder":"Optional HMAC-SHA256 secret"},{"key":"headers","label":"Custom Headers","type":"textarea","required":false,"placeholder":"Authorization: Bearer token\\nX-Custom-Header: value"},{"key":"retry_on_fail","label":"Retry on Failure","type":"boolean","default":true}]}',
  '{"retry_on_fail":true}',
  'published',
  201,
  'default'
);
