-- Migration: 0015_p15_schema.sql
-- Phase: P15 — Audit Export Jobs UI, batch_size UI, Notification Rules UI, Audit Event Writes, Report Delivery Status, /search surface
-- Date: 2026-04-19
-- Rules: CREATE TABLE IF NOT EXISTS only — NO DROP, NO ALTER COLUMN TYPE

-- 1. report_delivery_log — track report subscription delivery history
CREATE TABLE IF NOT EXISTS report_delivery_log (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivered_at DATETIME,
  error_message TEXT,
  row_count INTEGER DEFAULT 0,
  format TEXT DEFAULT 'csv',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_sub ON report_delivery_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_status ON report_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_report_delivery_log_created ON report_delivery_log(created_at);

-- 2. search_index_config — control which surfaces are searchable
CREATE TABLE IF NOT EXISTS search_index_config (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  search_fields TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seed: default search index config for 4 search surfaces
INSERT OR IGNORE INTO search_index_config (id, surface, enabled, search_fields) VALUES
  ('sic-001', 'intents', 1, 'title,body'),
  ('sic-002', 'audit', 1, 'event_type,actor'),
  ('sic-003', 'notifications', 1, 'title,message'),
  ('sic-004', 'tenants', 1, 'name,slug');

-- 4. Add last_delivery_status and last_delivery_at columns to report_subscriptions
--    Using additive-only: add new columns if not present (safe for SQLite)
ALTER TABLE report_subscriptions ADD COLUMN last_delivery_status TEXT DEFAULT NULL;
ALTER TABLE report_subscriptions ADD COLUMN last_delivery_at DATETIME DEFAULT NULL;
ALTER TABLE report_subscriptions ADD COLUMN last_delivery_error TEXT DEFAULT NULL;
