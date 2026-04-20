-- Migration: 0020_p20_schema.sql
-- Phase: P20 — Performance Overhaul, Search Analytics D1 Persistence, Dashboard Live Stats
-- Date: 2026-04-20
-- Rules: CREATE TABLE IF NOT EXISTS only — NO DROP, NO ALTER COLUMN TYPE

-- 1. search_log — persistent search term tracking for analytics
CREATE TABLE IF NOT EXISTS search_log (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  result_count INTEGER NOT NULL DEFAULT 0,
  user_session TEXT,
  tenant_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_search_log_query ON search_log(query);
CREATE INDEX IF NOT EXISTS idx_search_log_created ON search_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_log_scope ON search_log(scope);

-- 2. platform_perf_log — track page render and response time
CREATE TABLE IF NOT EXISTS platform_perf_log (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  render_ms INTEGER NOT NULL DEFAULT 0,
  db_queries INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_perf_log_route ON platform_perf_log(route);
CREATE INDEX IF NOT EXISTS idx_perf_log_created ON platform_perf_log(created_at DESC);

-- 3. dashboard_pins — allow users to pin KPI items on dashboard
CREATE TABLE IF NOT EXISTS dashboard_pins (
  id TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL UNIQUE,
  pinned INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Add search_count column to search_index_config if it doesn't exist
--    (tracks how many times each scope has been searched)
ALTER TABLE search_index_config ADD COLUMN search_count INTEGER DEFAULT 0;
ALTER TABLE search_index_config ADD COLUMN last_searched_at DATETIME DEFAULT NULL;
