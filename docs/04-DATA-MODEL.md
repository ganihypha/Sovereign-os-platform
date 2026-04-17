# 04 — DATA MODEL

**Document:** Sovereign OS Platform — Data Model Reference
**Version:** v5.0
**Status Relevance:** P0–P4 schema is LIVE-VERIFIED. P5 schema is TARGET.
**Generated:** 2026-04-17
**Relation to doc pack:** This document describes the canonical data structure
of the platform. All repo.ts implementations must comply with this model.

---

## 1. Additive-Only Migration Principle

**Rule:** No migration may DROP a column, DROP a table, or change a column type
in a way that loses existing data.

Every migration must use:
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN` (additive only)
- New indexes are acceptable
- New tables are acceptable
- Existing column constraints may NOT be changed

This principle ensures:
- No phase destroys prior verified data
- D1 schema can be applied incrementally without data loss
- Local and production schemas remain structurally equivalent

---

## 2. Core Entities (P0 — LIVE-VERIFIED)

### `intents` table

```sql
CREATE TABLE IF NOT EXISTS intents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  strategic_context TEXT,
  urgency TEXT DEFAULT 'Medium',       -- Critical / High / Medium / Low
  scope_notes TEXT,
  constraints TEXT,
  escalation_notes TEXT,
  status TEXT DEFAULT 'active',        -- active / archived
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Stores founder objectives. Every work session should link to an intent.
**Lifecycle:** created → active → archived (when no longer operationally driving work)

---

### `sessions` table

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  intent_id TEXT REFERENCES intents(id),
  status TEXT DEFAULT 'active',        -- active / completed / abandoned
  session_brief TEXT,
  scope_in TEXT,
  scope_out TEXT,
  acceptance_criteria TEXT,
  next_locked_move TEXT,
  onboarding_completed BOOLEAN DEFAULT 0,   -- added P4
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

**Purpose:** Active work session. One session = one bounded unit of platform work.
**Lifecycle:** created → active → completed / abandoned

---

### `requests` table

```sql
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  request_type TEXT NOT NULL,          -- bug / feature / hardening / docs / ops / governance / product-lane-request
  lane TEXT NOT NULL,                  -- governance / ops / docs / product-lane / execution
  urgency TEXT DEFAULT 'Medium',
  requester TEXT,
  context_summary TEXT,
  source_refs TEXT,
  readiness_status TEXT DEFAULT 'ready',   -- ready / pending-access / pending-info / blocked
  decision TEXT DEFAULT 'proceed',         -- proceed / hold / blocked / approval-needed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Incoming request intake record. Classification anchor for session work.

---

### `approval_requests` table

```sql
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  approval_tier INTEGER NOT NULL,      -- 0 / 1 / 2 / 3
  payload_summary TEXT,
  risk_summary TEXT,
  status TEXT DEFAULT 'pending',       -- pending / approved / rejected / returned
  approved_by TEXT,
  reason TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);
```

**Purpose:** All approval-gated actions route through this table.
Tier 0 items are auto-resolved. Tier 1–3 require human action.
**Law:** No self-approval. No AI approval. Tier 3 = founder only.

---

### `work_items` table

```sql
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  session_id TEXT REFERENCES sessions(id),
  request_id TEXT REFERENCES requests(id),
  assigned_role TEXT,                  -- executor / reviewer
  status TEXT DEFAULT 'pending',       -- pending / in_progress / proof_submitted / reviewed
  approval_gated BOOLEAN DEFAULT 0,
  proof_link TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

**Purpose:** Executable bounded work unit. Executor works on these.
Reviewer classifies their proof artifacts.

---

### `proof_artifacts` table

```sql
CREATE TABLE IF NOT EXISTS proof_artifacts (
  id TEXT PRIMARY KEY,
  work_item_id TEXT REFERENCES work_items(id),
  proof_type TEXT,                     -- code / test / deploy / docs / other
  evidence_link TEXT,
  verification_notes TEXT,
  outcome_classification TEXT,         -- PASS / PARTIAL / FAIL / BLOCKED
  reviewed_by TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME
);
```

**Purpose:** Evidence artifacts from execution. Reviewed by Reviewer role before
any status promotion. Unclassified artifacts carry no status weight.

---

### `decision_records` table

```sql
CREATE TABLE IF NOT EXISTS decision_records (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  decision_type TEXT,                  -- governance / technical / scope / escalation
  status TEXT DEFAULT 'active',
  session_ref TEXT,
  rationale TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Official governance decisions. These feed the canon pipeline.

---

### `handoff_records` table

```sql
CREATE TABLE IF NOT EXISTS handoff_records (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  current_truth TEXT NOT NULL,
  scope_in TEXT,
  scope_out TEXT,
  finished_work TEXT,
  partial_work TEXT,
  blockers TEXT,
  next_locked_move TEXT NOT NULL,
  proof_links TEXT,
  classification TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Session continuity anchor. Every session close produces a handoff_record.
The next session reads this first before any work begins.

---

### `priority_items` table

```sql
CREATE TABLE IF NOT EXISTS priority_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,              -- NOW / NEXT / LATER / HOLD / NOT_NOW
  lane TEXT,
  urgency TEXT DEFAULT 'Medium',
  linked_session TEXT,
  blocked BOOLEAN DEFAULT 0,
  blocker_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

**Purpose:** Live board items. The NOW/NEXT/LATER/HOLD/NOT NOW operational state.

---

### `canon_candidates` table

```sql
CREATE TABLE IF NOT EXISTS canon_candidates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  candidate_type TEXT,                 -- technical-decision / governance-rule / operating-model / process
  source_ref TEXT,
  status TEXT DEFAULT 'pending_review', -- pending_review / under_review / promoted / rejected
  review_status TEXT DEFAULT 'pending',   -- added P4
  reviewed_by TEXT,                        -- added P4
  reviewed_at DATETIME,                    -- added P4
  review_reason TEXT,                      -- added P4
  promoted_at DATETIME,                    -- added P4
  rejected_at DATETIME,                    -- added P4
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Candidate pool for canon promotion. Not yet final canon.
Must go through explicit review and promotion gate.

---

## 3. P2 Maturity Tables (LIVE-VERIFIED)

### `role_assignments` table

```sql
CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,             -- founder / architect / orchestrator / executor / reviewer
  key_hash TEXT NOT NULL,              -- bcrypt/hash of role key, never plaintext
  active BOOLEAN DEFAULT 1,
  issued_by TEXT,                      -- added P3
  last_used DATETIME,                  -- added P3
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Maps role keys to platform roles. All auth flows through here.
Raw keys NEVER stored. Hash only.

---

### `session_continuity` table

```sql
CREATE TABLE IF NOT EXISTS session_continuity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id),
  last_active_session_title TEXT,
  last_handoff_id TEXT,
  next_locked_move TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### `governance_boundaries` table

```sql
CREATE TABLE IF NOT EXISTS governance_boundaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boundary_name TEXT NOT NULL,
  allowed_roles TEXT NOT NULL,         -- JSON array of allowed role names
  action_type TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### `operator_notes` table

```sql
CREATE TABLE IF NOT EXISTS operator_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  role TEXT,
  note_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. P3 Operational Tables (LIVE-VERIFIED)

### `execution_items` table

```sql
CREATE TABLE IF NOT EXISTS execution_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  context_summary TEXT,
  owner_role TEXT DEFAULT 'executor',
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'pending',       -- pending / in_progress / proof_submitted / reviewed
  approval_gated BOOLEAN DEFAULT 0,
  proof_link TEXT,
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

---

### `connectors` table

```sql
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL,        -- repo / api / webhook / messaging / deploy
  status TEXT DEFAULT 'pending',       -- connected / error / pending / inactive
  auth_configured BOOLEAN DEFAULT 0,
  last_verified DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. P4 Product Tables (LIVE-VERIFIED)

### `product_lanes` table

```sql
CREATE TABLE IF NOT EXISTS product_lanes (
  id TEXT PRIMARY KEY,
  lane_name TEXT NOT NULL,
  lane_type TEXT NOT NULL,             -- governance-core / product-vertical / runtime-service / experiment
  description TEXT,
  status TEXT DEFAULT 'inactive',      -- active / inactive / suspended
  repo_url TEXT,
  owner_role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
```

---

### `platform_alerts` table

```sql
CREATE TABLE IF NOT EXISTS platform_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL,            -- approval_pending / proof_submitted / connector_error / session_stale / execution_blocked / canon_candidate_ready
  message TEXT NOT NULL,
  ref_id TEXT,
  acknowledged BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME
);
```

---

### `canon_promotions` table

```sql
CREATE TABLE IF NOT EXISTS canon_promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT REFERENCES canon_candidates(id),
  promoted_by TEXT NOT NULL,
  promotion_reason TEXT NOT NULL,      -- min 20 chars enforced in application layer
  promoted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. P5 Target Tables (NOT YET IN PRODUCTION)

These tables are part of migration 0006 (P5 TARGET).
Status: PLANNED — not yet applied to production.

### `tenants` table

```sql
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_key_hash TEXT NOT NULL,
  tier TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'pending',       -- pending / active / suspended
  config_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### `webhook_delivery_log` table

```sql
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT DEFAULT 'default',
  event_type TEXT NOT NULL,
  connector_id INTEGER,
  target_url_hash TEXT NOT NULL,       -- NEVER raw URL stored
  payload_hash TEXT NOT NULL,          -- NEVER raw payload stored
  status TEXT DEFAULT 'pending',       -- pending / delivered / failed / dead_letter
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  response_code INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### `api_keys` table

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT DEFAULT 'default',
  key_hash TEXT UNIQUE NOT NULL,       -- NEVER raw key stored after issuance
  label TEXT,
  scopes TEXT,
  rate_limit INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used DATETIME
);
```

---

### `ai_assist_log` table

```sql
CREATE TABLE IF NOT EXISTS ai_assist_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT DEFAULT 'default',
  assist_type TEXT NOT NULL,           -- brief / scope-suggest / review-summary / risk-assess
  input_hash TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  model TEXT,
  tokens_used INTEGER,
  confirmed_by TEXT,
  confirmed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### Additive tenant_id columns (P5 migration)

The following existing tables will receive an additive `tenant_id` column
with `DEFAULT 'default'` to ensure backward compatibility:

- sessions, intents, requests, approval_requests
- execution_items, connectors, product_lanes, platform_alerts
- role_assignments, canon_promotions

---

## 7. Entity Relationships Summary

```
intents ──< sessions
sessions ──< work_items
sessions ──< handoff_records
sessions ──< session_continuity
requests ──< work_items
work_items ──< proof_artifacts
approval_requests ──> approval_tier (0-3)
canon_candidates ──< canon_promotions
connectors ──< webhook_delivery_log  [P5]
tenants ──< sessions (via tenant_id) [P5]
tenants ──< role_assignments         [P5]
api_keys ──< rate_limit_counters     [via KV, P5]
```

---

*Document Status: P0–P4 LIVE-VERIFIED. P5 section marked TARGET/PLANNED.*
*Classification: Foundation — Data model reference*
*Next review: After each migration application*
