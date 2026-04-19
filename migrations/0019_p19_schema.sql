-- ============================================================
-- SOVEREIGN OS PLATFORM — MIGRATION 0019
-- Phase: P19 — Platform Hardening (Email Log, Error Log)
-- Date: 2026-04-19
-- ADDITIVE ONLY — no DROP, no ALTER (except ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- Email delivery log (P19: governance event emails)
CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'resend',
  error_message TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_event ON email_log(event_type);
CREATE INDEX IF NOT EXISTS idx_email_created ON email_log(created_at);

-- Error log (P19: 404/500 tracking)
CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  stack_hint TEXT NOT NULL DEFAULT '',
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_error_path ON error_log(path);
CREATE INDEX IF NOT EXISTS idx_error_code ON error_log(status_code);
CREATE INDEX IF NOT EXISTS idx_error_logged ON error_log(logged_at);

-- Seed P19 changelog entries
INSERT OR IGNORE INTO platform_changelog (version, phase, change_type, description, author, deployed_at)
VALUES
  ('1.9.0-P19', 'P19', 'feature', 'Session tracking: auth login now writes to platform_sessions table', 'architect', datetime('now')),
  ('1.9.0-P19', 'P19', 'feature', 'Email delivery service (emailService.ts) — Resend API wrapper for governance events', 'architect', datetime('now')),
  ('1.9.0-P19', 'P19', 'feature', 'Custom branded 404 page — replaces Cloudflare default', 'architect', datetime('now')),
  ('1.9.0-P19', 'P19', 'feature', 'Custom branded 500 error handler — replaces Cloudflare default', 'architect', datetime('now')),
  ('1.9.0-P19', 'P19', 'feature', '/changelog surface — platform version history from D1 platform_changelog table', 'architect', datetime('now')),
  ('1.9.0-P19', 'P19', 'migration', 'Migration 0019: email_log and error_log tables added', 'architect', datetime('now'));
