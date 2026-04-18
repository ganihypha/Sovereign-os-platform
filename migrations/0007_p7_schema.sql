-- ============================================================
-- SOVEREIGN OS PLATFORM — P7 SCHEMA ADDITIONS
-- Migration: 0007_p7_schema
-- P7 adds:
--   alert_deliveries       — Email delivery log for alerts
--   tenant_branding        — Per-tenant white-label CSS/brand config
--   sso_configs            — Per-tenant SSO/OAuth2 provider config
-- EXTENDS (additive only, NO DROP):
--   public_api_keys        — add scopes column (ABAC/RBAC expansion)
--   tenants                — add branding_id, sso_config_id columns
-- PRESERVES all P0–P6 tables — zero destructive changes.
-- Additive-only evolution: CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN
-- ============================================================

-- ---- alert_deliveries: Email delivery log for alerts ----
-- Tracks every email dispatch attempt from alert creation.
-- SECURITY: recipient_email stored (governance requirement).
--           provider API keys NEVER stored here.
-- delivery_status: pending|sent|failed|skipped
CREATE TABLE IF NOT EXISTS alert_deliveries (
  id                TEXT PRIMARY KEY,
  alert_id          TEXT NOT NULL,         -- FK to platform_alerts.id
  tenant_id         TEXT NOT NULL DEFAULT 'default',
  recipient_email   TEXT NOT NULL DEFAULT '',
  delivery_status   TEXT NOT NULL DEFAULT 'pending',
  -- delivery_status: pending|sent|failed|skipped
  provider          TEXT NOT NULL DEFAULT '',
  -- provider: resend|sendgrid|mock|none
  provider_message_id TEXT NOT NULL DEFAULT '',  -- provider's message ID on success
  error_message     TEXT NOT NULL DEFAULT '',
  sent_at           TEXT,
  created_at        TEXT NOT NULL
);

-- ---- tenant_branding: Per-tenant white-label CSS/brand config ----
-- Stores brand identity per tenant: color scheme, logo, name.
-- css_vars is a JSON string of CSS custom property overrides.
-- No raw secrets stored — only display/visual config.
CREATE TABLE IF NOT EXISTS tenant_branding (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL UNIQUE,  -- one branding record per tenant
  brand_name        TEXT NOT NULL DEFAULT '',
  logo_url          TEXT NOT NULL DEFAULT '',
  primary_color     TEXT NOT NULL DEFAULT '#4f8ef7',
  secondary_color   TEXT NOT NULL DEFAULT '#1a1d27',
  accent_color      TEXT NOT NULL DEFAULT '#22c55e',
  text_color        TEXT NOT NULL DEFAULT '#e2e8f0',
  bg_color          TEXT NOT NULL DEFAULT '#0d0f14',
  font_family       TEXT NOT NULL DEFAULT 'system-ui, sans-serif',
  css_vars          TEXT NOT NULL DEFAULT '{}',  -- JSON: {key: value, ...}
  custom_footer     TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ---- sso_configs: Per-tenant SSO/OAuth2 provider config ----
-- Stores IdP config per tenant (Auth0 or Clerk).
-- SECURITY: client_secret is NEVER stored here.
--           Store via Cloudflare secret: AUTH0_CLIENT_SECRET / CLERK_SECRET_KEY
--           client_id and domain are non-secret (public-side OAuth params).
CREATE TABLE IF NOT EXISTS sso_configs (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL UNIQUE,  -- one SSO config per tenant
  provider          TEXT NOT NULL DEFAULT 'none',
  -- provider: auth0|clerk|none
  enabled           INTEGER NOT NULL DEFAULT 0,  -- 1=active, 0=disabled
  client_id         TEXT NOT NULL DEFAULT '',    -- OAuth2 client_id (non-secret)
  domain            TEXT NOT NULL DEFAULT '',    -- e.g. 'yourapp.auth0.com' or Clerk domain
  redirect_uri      TEXT NOT NULL DEFAULT '',    -- callback URL
  scopes            TEXT NOT NULL DEFAULT 'openid profile email',
  pkce_enabled      INTEGER NOT NULL DEFAULT 1,  -- PKCE flow (required for security)
  config_notes      TEXT NOT NULL DEFAULT '',
  created_by        TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- ---- EXTEND public_api_keys: add scopes column (ABAC/RBAC) ----
-- Additive only. Existing rows get scopes='[]' (no extra scopes beyond role_scope).
-- scopes is a JSON array of permission strings: ["read:tenants","write:executions",...]
ALTER TABLE public_api_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT '[]';

-- ---- EXTEND tenants: add branding_id, sso_config_id ----
-- Additive only. Existing rows get NULL (branding/SSO not yet configured).
ALTER TABLE tenants ADD COLUMN branding_id TEXT;
ALTER TABLE tenants ADD COLUMN sso_config_id TEXT;

-- ---- EXTEND metrics_snapshots: add snapshot_data column ----
-- Additive. JSON blob for extended time-series metrics per snapshot.
ALTER TABLE metrics_snapshots ADD COLUMN snapshot_data TEXT NOT NULL DEFAULT '{}';

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert ON alert_deliveries(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_tenant ON alert_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON alert_deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_created ON alert_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant ON tenant_branding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sso_configs_tenant ON sso_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sso_configs_provider ON sso_configs(provider);

-- ---- Seed default tenant branding ----
INSERT OR IGNORE INTO tenant_branding
  (id, tenant_id, brand_name, logo_url, primary_color, secondary_color,
   accent_color, text_color, bg_color, font_family, css_vars, custom_footer,
   created_at, updated_at)
VALUES
  ('brand-default',
   'tenant-default',
   'Sovereign OS Platform',
   '',
   '#4f8ef7',
   '#1a1d27',
   '#22c55e',
   '#e2e8f0',
   '#0d0f14',
   'system-ui, sans-serif',
   '{}',
   '',
   datetime('now'),
   datetime('now'));

-- ---- Seed barberkas tenant branding ----
INSERT OR IGNORE INTO tenant_branding
  (id, tenant_id, brand_name, logo_url, primary_color, secondary_color,
   accent_color, text_color, bg_color, font_family, css_vars, custom_footer,
   created_at, updated_at)
VALUES
  ('brand-barberkas',
   'tenant-barberkas',
   'BarberKas',
   '',
   '#f59e0b',
   '#1c1917',
   '#10b981',
   '#f5f5f4',
   '#0c0a09',
   'system-ui, sans-serif',
   '{"--brand-radius":"8px"}',
   'Powered by Sovereign OS Platform',
   datetime('now'),
   datetime('now'));

-- ---- Seed default SSO config (none / disabled) ----
INSERT OR IGNORE INTO sso_configs
  (id, tenant_id, provider, enabled, client_id, domain, redirect_uri, scopes,
   pkce_enabled, config_notes, created_by, created_at, updated_at)
VALUES
  ('sso-default',
   'tenant-default',
   'none',
   0,
   '',
   '',
   '/auth/sso/callback',
   'openid profile email',
   1,
   'SSO not configured for default tenant.',
   'Architect',
   datetime('now'),
   datetime('now'));
