-- ============================================================
-- MIGRATION: 0024_p22_schema.sql
-- Phase: P22 — AI Integration, Branding/White-label, Plan Enforcement, Operator Onboarding Wizard
-- Rules: ADDITIVE ONLY — no DROP, no ALTER COLUMN, no destructive changes.
--        CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / INSERT OR IGNORE only.
-- ============================================================

-- ---- onboarding_wizard_state: 5-step operator onboarding tracker ----
-- Tracks per-tenant onboarding wizard progress.
-- current_step: 1-5 (1=Account Setup, 2=Configure Roles, 3=First Workflow, 4=First Connector, 5=Complete)
-- Each stepN_done: 0=pending, 1=completed
CREATE TABLE IF NOT EXISTS onboarding_wizard_state (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL UNIQUE,
  current_step      INTEGER NOT NULL DEFAULT 1,
  step1_done        INTEGER NOT NULL DEFAULT 0,   -- account setup
  step2_done        INTEGER NOT NULL DEFAULT 0,   -- roles configured
  step3_done        INTEGER NOT NULL DEFAULT 0,   -- first workflow created
  step4_done        INTEGER NOT NULL DEFAULT 0,   -- first connector registered
  step5_done        INTEGER NOT NULL DEFAULT 0,   -- onboarding complete
  welcome_email_sent INTEGER NOT NULL DEFAULT 0,  -- 0=not sent, 1=sent
  last_activity_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_onboarding_wizard_tenant ON onboarding_wizard_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_wizard_step ON onboarding_wizard_state(current_step);

-- ---- tenant_branding_ext: Extended branding (P22 — company name, support email, custom CSS) ----
-- Extends the base tenant_branding table (P7) with P22 white-label fields.
-- custom_css: max 4000 chars of safe CSS overrides (no <script>)
-- portal_theme: dark|light
CREATE TABLE IF NOT EXISTS tenant_branding_ext (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL UNIQUE,
  company_name      TEXT NOT NULL DEFAULT 'Sovereign OS',
  logo_url          TEXT NOT NULL DEFAULT '',
  primary_color     TEXT NOT NULL DEFAULT '#4f8ef7',
  secondary_color   TEXT NOT NULL DEFAULT '#8b5cf6',
  favicon_url       TEXT NOT NULL DEFAULT '',
  support_email     TEXT NOT NULL DEFAULT '',
  custom_css        TEXT NOT NULL DEFAULT '',      -- max 4000 chars, no <script>
  portal_theme      TEXT NOT NULL DEFAULT 'dark',  -- dark|light
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_ext_tenant ON tenant_branding_ext(tenant_id);

-- ---- ai_session_brief: AI-generated governance session briefs ----
-- Stores AI-generated session briefs (non-blocking, fire-and-catch).
-- output tagged 'ai-generated'. Human gate mandatory before any action.
-- SECURITY: prompt content NOT stored — only prompt_hash (SHA-256) for audit.
CREATE TABLE IF NOT EXISTS ai_session_brief (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  session_id        TEXT,
  model_hint        TEXT NOT NULL DEFAULT 'none',  -- gpt-4o-mini|llama-3.3-70b-versatile|none
  provider          TEXT NOT NULL DEFAULT 'none',   -- openai|groq|none
  brief_summary     TEXT NOT NULL DEFAULT '',       -- max 500 chars, first portion of AI output
  prompt_hash       TEXT NOT NULL DEFAULT '',       -- SHA-256 of input prompt (never raw prompt)
  confidence_tag    TEXT NOT NULL DEFAULT 'ai-generated',
  confirmed_by      TEXT,
  confirmed_at      TEXT,
  discarded         INTEGER NOT NULL DEFAULT 0,
  created_by        TEXT NOT NULL DEFAULT 'system',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_session_brief_tenant ON ai_session_brief(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_session_brief_session ON ai_session_brief(session_id);

-- ---- plan_access_log: Log of plan gate check results ----
-- Records every planGuard check (allow or deny) for audit trail.
-- feature: sso|ai_assist|federation|etc.
-- result: allowed|denied_upgrade_required|denied_not_found
CREATE TABLE IF NOT EXISTS plan_access_log (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  feature           TEXT NOT NULL,    -- sso|ai_assist|federation|...
  plan_type         TEXT NOT NULL,    -- free|standard|enterprise|custom
  result            TEXT NOT NULL,    -- allowed|denied_upgrade_required
  path              TEXT NOT NULL DEFAULT '',
  method            TEXT NOT NULL DEFAULT 'GET',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plan_access_log_tenant ON plan_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plan_access_log_feature ON plan_access_log(feature);
CREATE INDEX IF NOT EXISTS idx_plan_access_log_result ON plan_access_log(result);

-- ---- Seed default onboarding state for existing tenants ----
INSERT OR IGNORE INTO onboarding_wizard_state
  (id, tenant_id, current_step, step1_done, step2_done, step3_done, step4_done, step5_done,
   welcome_email_sent, last_activity_at, created_at)
VALUES
  ('onb-default', 'tenant-default', 1, 0, 0, 0, 0, 0, 0, datetime('now'), datetime('now')),
  ('onb-barberkas', 'tenant-barberkas', 1, 0, 0, 0, 0, 0, 0, datetime('now'), datetime('now'));

-- ---- Seed default extended branding ----
INSERT OR IGNORE INTO tenant_branding_ext
  (id, tenant_id, company_name, logo_url, primary_color, secondary_color,
   favicon_url, support_email, custom_css, portal_theme, updated_at, created_at)
VALUES
  ('bext-default', 'tenant-default', 'Sovereign OS Platform', '', '#4f8ef7', '#8b5cf6',
   '', '', '', 'dark', datetime('now'), datetime('now')),
  ('bext-barberkas', 'tenant-barberkas', 'BarberKas', '', '#f59e0b', '#10b981',
   '', '', '', 'dark', datetime('now'), datetime('now'));

-- ---- Phase changelog entry (only if table exists) ----
CREATE TABLE IF NOT EXISTS phase_changelog (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  label TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO phase_changelog
  (id, phase, label, applied_at, notes)
VALUES
  ('phase-0024',
   'P22',
   'P22 — AI Integration, Branding/White-label, Plan Enforcement, Operator Onboarding',
   datetime('now'),
   'Migration 0024: onboarding_wizard_state, tenant_branding_ext, ai_session_brief, plan_access_log tables. GROQ_API_KEY fallback support added.');
