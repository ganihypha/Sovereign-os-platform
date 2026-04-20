-- Migration: 0021_p21_schema.sql
-- Phase: P21 — Performance Overhaul Real Implementation
-- Date: 2026-04-20
-- Changes: platform_versions tracking table, perf_metrics table for real timing data

-- 1. platform_versions: track deploy history
CREATE TABLE IF NOT EXISTS platform_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  phase TEXT NOT NULL,
  deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deploy_note TEXT DEFAULT NULL
);

-- Insert current version milestone
INSERT OR IGNORE INTO platform_versions (version, phase, deployed_at, deploy_note)
VALUES ('2.0.0-P21', 'P21 — GPU-Accelerated UI, Debounced Events, Non-blocking Fonts, scaleX Loader', datetime('now'), 'Real performance fixes: CSS max-height nav, will-change sidebar, scaleX loader, 120ms/150ms debounce, non-blocking fonts');

-- 2. perf_metrics: optional client-side perf logging endpoint storage
CREATE TABLE IF NOT EXISTS perf_metrics (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  page_path TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_name ON perf_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_page ON perf_metrics(page_path);
