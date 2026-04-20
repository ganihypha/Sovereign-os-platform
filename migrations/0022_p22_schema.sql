-- Migration: 0022_p22_schema.sql
-- Phase: P22 — Layout Refactor, Version Consistency, D1 Verification, Perf Observability
-- Date: 2026-04-20
-- Changes: record P22 version milestone; no new tables needed (tables from 0021 already exist)

-- Record P22 deploy milestone in platform_versions
INSERT OR IGNORE INTO platform_versions (version, phase, deployed_at, deploy_note)
VALUES (
  '2.0.0-P22',
  'P22 — Layout Refactor, Version Consistency, D1 Verification, Perf Observability',
  datetime('now'),
  'layout.ts refactored into shell+styles+client modules (333/676/244 lines). Version drift fixed across package.json, apiv1, index.tsx, dashboard. /api/perf endpoint wired to perf_metrics D1 table. All 22 migrations verified local+remote.'
);
