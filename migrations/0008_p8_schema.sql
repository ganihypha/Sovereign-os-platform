-- ============================================================
-- SOVEREIGN OS PLATFORM — P8 SCHEMA ADDITIONS
-- Migration: 0008_p8_schema
-- Phase: P8 — Federated Governance & Advanced Platform Capabilities
--
-- P8 adds:
--   tenant_federation      — Federation registry (who can share with whom)
--   federated_intents      — Cross-tenant intent sharing log
--   marketplace_connectors — Connector marketplace submissions
--   audit_log_v2           — Immutable audit trail with SHA-256 event hashing
--
-- EXTENDS (additive only, NO DROP, NO CHANGE):
--   connectors             — add marketplace_eligible flag
--   audit_log              — audit_log_v2 is additive new table, does not alter audit_log
--
-- PRESERVES all P0–P7 tables — zero destructive changes.
-- Additive-only law: CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN only
-- Never: DROP TABLE, DROP COLUMN, CHANGE COLUMN TYPE
-- ============================================================

-- ---- tenant_federation: Federation registry ----
-- Governs which tenants are allowed to share with which.
-- APPROVAL GATE: requires human approval (Tier 2) before federation is active.
-- scope: JSON array of allowed sharing scopes, e.g. ["intents","approvals"]
CREATE TABLE IF NOT EXISTS tenant_federation (
  id                  TEXT PRIMARY KEY,
  source_tenant_id    TEXT NOT NULL,            -- requesting tenant
  target_tenant_id    TEXT NOT NULL,            -- receiving tenant
  scope               TEXT NOT NULL DEFAULT '[]', -- JSON: ["intents","approvals",...]
  status              TEXT NOT NULL DEFAULT 'pending',
  -- status: pending|approved|rejected|revoked
  approved_by         TEXT,
  approved_at         TEXT,
  revoked_by          TEXT,
  revoked_at          TEXT,
  federation_notes    TEXT NOT NULL DEFAULT '',
  created_by          TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL
);

-- Unique federation pair constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_federation_pair
  ON tenant_federation(source_tenant_id, target_tenant_id);

CREATE INDEX IF NOT EXISTS idx_federation_source ON tenant_federation(source_tenant_id);
CREATE INDEX IF NOT EXISTS idx_federation_target ON tenant_federation(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_federation_status ON tenant_federation(status);

-- ---- federated_intents: Cross-tenant intent sharing log ----
-- Tracks every intent sharing event. Governed by tenant_federation approval.
-- Source tenant pushes an intent to target tenant — must pass approval gate.
CREATE TABLE IF NOT EXISTS federated_intents (
  id                  TEXT PRIMARY KEY,
  intent_id           TEXT NOT NULL,            -- FK to intents.id
  source_tenant_id    TEXT NOT NULL,
  target_tenant_id    TEXT NOT NULL,
  federation_id       TEXT NOT NULL,            -- FK to tenant_federation.id
  approval_status     TEXT NOT NULL DEFAULT 'pending',
  -- approval_status: pending|approved|rejected
  approved_by         TEXT,
  approved_at         TEXT,
  shared_scope        TEXT NOT NULL DEFAULT '',  -- what was shared ('intent_brief','full',...)
  share_notes         TEXT NOT NULL DEFAULT '',
  shared_by           TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fedint_intent ON federated_intents(intent_id);
CREATE INDEX IF NOT EXISTS idx_fedint_source ON federated_intents(source_tenant_id);
CREATE INDEX IF NOT EXISTS idx_fedint_target ON federated_intents(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_fedint_status ON federated_intents(approval_status);
CREATE INDEX IF NOT EXISTS idx_fedint_federation ON federated_intents(federation_id);

-- ---- marketplace_connectors: Connector marketplace submissions ----
-- Tenants can submit connectors as templates for the platform marketplace.
-- Requires Tier 2 approval before listing.
-- listing_status: submitted|under_review|listed|rejected|withdrawn
CREATE TABLE IF NOT EXISTS marketplace_connectors (
  id                  TEXT PRIMARY KEY,
  connector_id        TEXT NOT NULL,            -- FK to connectors.id
  submitted_by        TEXT NOT NULL,
  submitted_tenant_id TEXT NOT NULL DEFAULT '',
  listing_status      TEXT NOT NULL DEFAULT 'submitted',
  -- listing_status: submitted|under_review|listed|rejected|withdrawn
  approval_tier       INTEGER NOT NULL DEFAULT 2, -- always Tier 2 for marketplace
  approved_by         TEXT,
  approved_at         TEXT,
  rejected_reason     TEXT NOT NULL DEFAULT '',
  listing_notes       TEXT NOT NULL DEFAULT '',
  listing_title       TEXT NOT NULL DEFAULT '',
  listing_description TEXT NOT NULL DEFAULT '',
  listing_tags        TEXT NOT NULL DEFAULT '[]', -- JSON array
  version_tag         TEXT NOT NULL DEFAULT '1.0.0',
  downloads           INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_connector
  ON marketplace_connectors(connector_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_connectors(listing_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_tenant ON marketplace_connectors(submitted_tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_approved ON marketplace_connectors(approved_by);

-- ---- audit_log_v2: Immutable audit trail with cryptographic proof ----
-- Every state mutation generates an event hash: SHA-256(event_type+object_id+actor+timestamp)
-- This table runs ALONGSIDE (not replacing) the existing audit_log.
-- hash_algorithm: always 'sha256' for P8
-- verified: 0 (unverified) or 1 (hash re-verified on read)
CREATE TABLE IF NOT EXISTS audit_log_v2 (
  id                  TEXT PRIMARY KEY,
  event_type          TEXT NOT NULL,            -- e.g. 'intent.created', 'approval.approved', ...
  object_type         TEXT NOT NULL DEFAULT '', -- e.g. 'intent', 'approval', 'connector', ...
  object_id           TEXT NOT NULL,
  actor               TEXT NOT NULL,            -- user or system that triggered the event
  tenant_id           TEXT NOT NULL DEFAULT 'default',
  event_hash          TEXT NOT NULL,            -- SHA-256(event_type+object_id+actor+timestamp)
  hash_algorithm      TEXT NOT NULL DEFAULT 'sha256',
  payload_summary     TEXT NOT NULL DEFAULT '', -- first 200 chars of payload (no secrets)
  surface             TEXT NOT NULL DEFAULT '', -- which surface/route triggered this
  verified            INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL             -- ISO timestamp — part of hash input
);

-- CRITICAL: No UPDATE allowed on audit_log_v2 after insert (enforced at app layer)
-- No FK constraints (append-only audit, references may be soft-deleted)
CREATE INDEX IF NOT EXISTS idx_auditv2_event_type ON audit_log_v2(event_type);
CREATE INDEX IF NOT EXISTS idx_auditv2_object ON audit_log_v2(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_auditv2_actor ON audit_log_v2(actor);
CREATE INDEX IF NOT EXISTS idx_auditv2_tenant ON audit_log_v2(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditv2_hash ON audit_log_v2(event_hash);
CREATE INDEX IF NOT EXISTS idx_auditv2_created ON audit_log_v2(created_at);

-- ---- EXTEND connectors: add marketplace_eligible flag ----
-- Additive only. Owners can flag a connector as eligible for marketplace submission.
ALTER TABLE connectors ADD COLUMN marketplace_eligible INTEGER NOT NULL DEFAULT 0;

-- ---- Seed: default federation registry entry (platform-level) ----
-- Default tenant federation: default ↔ barberkas (as example — pending approval)
INSERT OR IGNORE INTO tenant_federation
  (id, source_tenant_id, target_tenant_id, scope, status, federation_notes, created_by, created_at)
VALUES
  ('fed-001',
   'tenant-default',
   'tenant-barberkas',
   '["intents"]',
   'pending',
   'P8 pilot federation: intent sharing only. Pending Tier 2 approval.',
   'Architect',
   datetime('now'));
