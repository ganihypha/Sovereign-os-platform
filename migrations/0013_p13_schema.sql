-- P13 Migration: ABAC UI Config, Tenant Policies, Event Retention Config
-- Additive-only: CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN only
-- Never: DROP TABLE, DROP COLUMN, CHANGE COLUMN TYPE

-- 1. ABAC UI config: maps surface/resource/action to minimum role required for button visibility
CREATE TABLE IF NOT EXISTS abac_ui_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surface TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  action TEXT NOT NULL,
  role_required TEXT NOT NULL DEFAULT 'admin',
  tooltip_deny TEXT NOT NULL DEFAULT 'Your role is not permitted to perform this action',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(surface, resource_type, action)
);

-- Seed ABAC UI config for P13 sensitive surfaces
INSERT OR IGNORE INTO abac_ui_config (surface, resource_type, action, role_required, tooltip_deny) VALUES
  ('approvals', 'approvals', 'approve', 'admin', 'Your role is not permitted to approve items'),
  ('canon', 'approvals', 'approve', 'admin', 'Your role is not permitted to promote/reject canon items'),
  ('policies', 'policies', 'write', 'admin', 'Your role is not permitted to create policies'),
  ('alert-rules', 'alert-rules', 'write', 'admin', 'Your role is not permitted to create alert rules');

-- 2. Tenant-scoped policy delegation table
CREATE TABLE IF NOT EXISTS tenant_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  delegated_by TEXT NOT NULL DEFAULT 'system',
  delegated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, policy_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_policies_tenant ON tenant_policies(tenant_id);

-- 3. Event retention config (KV-backed fallback with D1 source of truth)
CREATE TABLE IF NOT EXISTS event_retention_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default retention: 30 days
INSERT OR IGNORE INTO event_retention_config (key, value) VALUES
  ('retention_days', '30'),
  ('auto_archive_enabled', 'true'),
  ('archive_batch_size', '100');

-- 4. ABAC deny log (P13 analytics: track how many denials per route per role)
CREATE TABLE IF NOT EXISTS abac_deny_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surface TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  action TEXT NOT NULL,
  subject_role TEXT NOT NULL DEFAULT 'viewer',
  tenant_id TEXT,
  denied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abac_deny_log_surface ON abac_deny_log(surface);
CREATE INDEX IF NOT EXISTS idx_abac_deny_log_denied_at ON abac_deny_log(denied_at);

-- 5. Webhook queue health snapshot (for /health-dashboard P12 stats)
CREATE TABLE IF NOT EXISTS webhook_queue_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  retrying INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Ensure event_archives has proper index (table created in 0012, adding index)
CREATE INDEX IF NOT EXISTS idx_event_archives_archived_at ON event_archives(archived_at);
CREATE INDEX IF NOT EXISTS idx_event_archives_original_id ON event_archives(original_event_id);
