-- ============================================================
-- SOVEREIGN OS PLATFORM — P23 SCHEMA MIGRATION
-- Phase: P23 — Reports, Analytics, Export, Cron Metrics
-- Migration: 0025_p23_schema.sql
-- ADDITIVE ONLY — no DROP, no ALTER with data loss
-- ============================================================

-- ============================================================
-- AUGMENT: audit_export_jobs (already exists from 0014_p14_schema.sql)
-- Add new columns for P23: tenant_id, csv_content, error_message, download_url
-- Use separate INSERT trigger pattern (ALTER ADD COLUMN per SQLite)
-- ============================================================

-- Add tenant_id column (P23 — multi-tenant export support)
ALTER TABLE audit_export_jobs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- Add csv_content column (P23 — inline CSV storage for last 500 records)
ALTER TABLE audit_export_jobs ADD COLUMN csv_content TEXT;

-- Add download_url column if not exists (P14 has result_url, P23 adds download_url alias)
ALTER TABLE audit_export_jobs ADD COLUMN download_url TEXT;

-- Add error_message column for job failure tracking
ALTER TABLE audit_export_jobs ADD COLUMN error_message TEXT;

-- Add index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_audit_export_jobs_tenant ON audit_export_jobs(tenant_id, created_at);

-- ============================================================
-- TABLE: metrics_cron_log
-- Stores hourly automated metrics snapshots from cron trigger
-- (also written via /api/v1/metrics/snapshot manual trigger)
-- ============================================================
CREATE TABLE IF NOT EXISTS metrics_cron_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_type TEXT NOT NULL DEFAULT 'hourly',   -- hourly / manual
  intent_count INTEGER NOT NULL DEFAULT 0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  anomaly_count INTEGER NOT NULL DEFAULT 0,
  approval_count INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_cron_log_tenant ON metrics_cron_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_cron_log_type ON metrics_cron_log(snapshot_type, created_at);

-- ============================================================
-- TABLE: report_subscriptions_v2
-- Upgraded from stub — tracks weekly report email subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS report_subscriptions_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',    -- weekly / daily
  report_type TEXT NOT NULL DEFAULT 'summary', -- summary / full / anomaly
  is_active INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_report_subs_v2_tenant ON report_subscriptions_v2(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_report_subs_v2_email ON report_subscriptions_v2(email);
