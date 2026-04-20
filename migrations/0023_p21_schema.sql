-- ============================================================
-- MIGRATION: 0023_p21_schema.sql
-- Phase: P21 — Multi-Tenant SSO, Tenant Plans, Billing Hooks, Operator Onboarding
-- Date: 2026-04-20
-- Additive only: CREATE IF NOT EXISTS. Never DROP.
-- ============================================================

-- ---- Tenant Plans (P21: plan enforcement) ----
CREATE TABLE IF NOT EXISTS tenant_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'standard',    -- 'free' | 'standard' | 'enterprise'
  max_users INTEGER NOT NULL DEFAULT 5,
  max_workflows INTEGER NOT NULL DEFAULT 10,
  max_api_calls_per_day INTEGER NOT NULL DEFAULT 1000,
  custom_domain_allowed INTEGER NOT NULL DEFAULT 0,  -- 0=false, 1=true
  sso_allowed INTEGER NOT NULL DEFAULT 0,
  ai_assist_allowed INTEGER NOT NULL DEFAULT 0,
  federation_allowed INTEGER NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly' | 'annual' | 'free'
  plan_starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  plan_expires_at TEXT,
  is_trial INTEGER NOT NULL DEFAULT 0,
  trial_ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_plans_tenant ON tenant_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_plans_type ON tenant_plans(plan_type);

-- ---- Billing Hooks (P21: Stripe/billing event scaffold) ----
CREATE TABLE IF NOT EXISTS billing_hooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  event_type TEXT NOT NULL,                     -- 'subscription.created' | 'payment.succeeded' | 'payment.failed' | etc.
  provider TEXT NOT NULL DEFAULT 'stripe',       -- 'stripe' | 'paddle' | 'manual'
  payload_hash TEXT NOT NULL DEFAULT '',         -- SHA-256 of payload (never store raw)
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'received',       -- 'received' | 'processed' | 'failed' | 'ignored'
  processed_at TEXT,
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_billing_hooks_tenant ON billing_hooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_hooks_type ON billing_hooks(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_hooks_status ON billing_hooks(status);

-- ---- Operator Onboarding (P21: guided setup tracking) ----
CREATE TABLE IF NOT EXISTS operator_onboarding (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operator_email TEXT NOT NULL DEFAULT '',
  step_completed TEXT NOT NULL DEFAULT 'none',   -- 'none' | 'account' | 'roles' | 'first_workflow' | 'first_connector' | 'complete'
  welcome_email_sent INTEGER NOT NULL DEFAULT 0,
  roles_configured INTEGER NOT NULL DEFAULT 0,
  first_workflow_created INTEGER NOT NULL DEFAULT 0,
  first_connector_registered INTEGER NOT NULL DEFAULT 0,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON operator_onboarding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_complete ON operator_onboarding(onboarding_complete);

-- ---- Tenant Rate Limit Config (P21: per-tenant rate limiting) ----
CREATE TABLE IF NOT EXISTS tenant_rate_limits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  api_calls_per_hour INTEGER NOT NULL DEFAULT 1000,
  api_calls_per_day INTEGER NOT NULL DEFAULT 10000,
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 10,
  webhook_calls_per_hour INTEGER NOT NULL DEFAULT 100,
  override_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_rate_limits_tenant ON tenant_rate_limits(tenant_id);

-- ---- Seed: Default tenant plan ----
INSERT OR IGNORE INTO tenant_plans (id, tenant_id, plan_type, max_users, max_workflows, max_api_calls_per_day, sso_allowed, ai_assist_allowed, federation_allowed, billing_cycle)
VALUES (
  'plan-default-001',
  'default',
  'enterprise',
  100,
  1000,
  50000,
  1,
  1,
  1,
  'annual'
);

-- ---- Seed: Default tenant rate limits ----
INSERT OR IGNORE INTO tenant_rate_limits (id, tenant_id, api_calls_per_hour, api_calls_per_day, max_concurrent_sessions, webhook_calls_per_hour)
VALUES ('rl-default-001', 'default', 5000, 100000, 50, 500);

-- ---- Seed: Default operator onboarding record ----
INSERT OR IGNORE INTO operator_onboarding (id, tenant_id, operator_email, step_completed, welcome_email_sent, roles_configured, first_workflow_created, first_connector_registered, onboarding_complete)
VALUES ('onb-default-001', 'default', 'platform-admin@sovereign-os.internal', 'complete', 1, 1, 1, 1, 1);

-- ---- Record P21 milestone in platform_versions ----
INSERT OR IGNORE INTO platform_versions (version, phase, deployed_at, deploy_note)
VALUES (
  '2.1.0-P21',
  'P21 — Multi-Tenant SSO, Tenant Plans, Billing Hooks, Operator Onboarding',
  datetime('now'),
  'Migration 0023: tenant_plans, billing_hooks, operator_onboarding, tenant_rate_limits tables. SSO PKCE KV state storage upgraded. Email wiring: emailCanonCandidateReady. API request logging. DB try/catch hardening across key routes.'
);
