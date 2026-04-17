-- ============================================================
-- SOVEREIGN OS PLATFORM — SEED DATA (P0 → P1)
-- Migration: 0002_seed_data
-- Preserves P0 operating context records
-- ============================================================

-- Seed: Initial platform intent
INSERT OR IGNORE INTO intents (id, title, objective, strategic_context, urgency, scope_notes, escalation_notes, created_by, created_at, updated_at)
VALUES (
  'int-001',
  'Build P0 Control Core',
  'Establish the governed operating platform control core: intake, architect workbench, approvals, proof, live board, and records.',
  'Platform must support intent → intake → orchestration → approval → execution → proof → live state → canon.',
  'high',
  'P0 only. No product lanes, no connector hub, no execution board yet.',
  'Founder approval required for any canon promotion.',
  'Founder',
  datetime('now'),
  datetime('now')
);

-- Seed: Active session
INSERT OR IGNORE INTO sessions (id, intent_id, title, status, session_brief, bounded_brief, scope_in, scope_out, acceptance_criteria, next_locked_move, source_of_truth_refs, active_constraints, created_at, closed_at)
VALUES (
  'ses-001',
  'int-001',
  'P1 Hardening — Session 1',
  'active',
  'Harden P0 Control Core into durable, access-protected operating core.',
  'Scope: persistence hardening, minimal auth, route integrity. No new surfaces.',
  '["Dashboard","Intent desk","Session intake","Architect workbench","Approval queue","Proof center","Live priority board","Records & decision log"]',
  '["Execution board","Connector hub","Product lane surfaces","External integrations"]',
  '["Existing P0 routes still work","Persistent storage operational","Auth gate functional","Approval flow intact","Proof review flow intact","Records continuity preserved","No secrets exposed"]',
  'Deploy P1 to Cloudflare Pages, apply D1 migrations, verify all routes',
  '["Platform Definition Pack v1.1","svereign.os.pltfr.1.1.1","svereign.os.hub.1.1.w.wp"]',
  '["No role collapse","No false verification","No secret exposure","No undocumented meaningful activity"]',
  datetime('now'),
  NULL
);

-- Seed: Initial request
INSERT OR IGNORE INTO requests (id, intent_id, session_id, request_title, request_type, lane, urgency, requester, context_summary, source_refs, readiness_status, decision, created_at, updated_at)
VALUES (
  'req-001',
  'int-001',
  'ses-001',
  'P1 Hardening: persistence + auth',
  'hardening',
  'governance',
  'high',
  'Master Architect',
  'Replace in-memory store with D1 persistence. Add API key auth gate. Preserve all P0 surfaces.',
  '["svereign.os.hub.1.1.w.wp.0.1.1"]',
  'ready',
  'proceed',
  datetime('now'),
  datetime('now')
);

-- Seed: P0 → P1 transition approval
INSERT OR IGNORE INTO approval_requests (id, request_id, action_type, approval_tier, risk_summary, payload_summary, requested_by, approved_by, status, decision_reason, timestamp, resolved_at)
VALUES (
  'apr-001',
  'req-001',
  'Promote P0 → P1 Hardened Build',
  2,
  'Medium risk: schema migration, auth introduction. No external integrations. Rollback possible.',
  'Deploy P1 hardened Sovereign OS Platform with D1 persistence and API key auth gate.',
  'Master Architect',
  NULL,
  'pending',
  '',
  datetime('now'),
  NULL
);

-- Seed: Work item
INSERT OR IGNORE INTO work_items (id, request_id, session_id, title, description, assigned_to, status, bounded_scope, created_at, updated_at)
VALUES (
  'wi-001',
  'req-001',
  'ses-001',
  'P1 Hardening Implementation',
  'Implement D1 persistence layer, API key auth middleware, route integrity verification.',
  'AI Developer',
  'in-progress',
  'P1 hardening only. No new surfaces. No product lane expansion.',
  datetime('now'),
  datetime('now')
);

-- Seed: Founding decision record
INSERT OR IGNORE INTO decision_records (id, session_id, request_id, decision_type, summary, decided_by, outcome, proof_refs, canon_candidate_flag, change_log, created_at)
VALUES (
  'dec-001',
  'ses-001',
  NULL,
  'intent',
  'Platform direction locked as Sovereign OS Platform — governed operating platform.',
  'Founder',
  'ACCEPTED — Build P0 Control Core first, then P1 hardening.',
  '["svereign.os.pltfr.1.1.1"]',
  1,
  'Initial platform definition finalized. P1 hardening initiated.',
  datetime('now')
);

-- Seed: P0→P1 handoff
INSERT OR IGNORE INTO handoff_records (id, session_id, from_role, to_role, handoff_context, open_items, decision_refs, created_at)
VALUES (
  'hof-001',
  'ses-001',
  'Founder',
  'Master Architect',
  'P0 Control Core complete. Proceed to P1 hardening: D1 persistence + auth gate. No architecture debate. No scope expansion.',
  '["Wire D1 persistence for all 10 data objects","Add API key auth middleware","Verify all 8 P0 routes post-hardening","Update README with honest P1 state"]',
  '["dec-001"]',
  datetime('now')
);

-- Seed: Priority items for P1
INSERT OR IGNORE INTO priority_items (id, title, category, session_target, blocker, blocker_description, resolved, resolved_at, created_at, updated_at)
VALUES
  ('pri-001', 'Wire D1 persistence for all 10 data objects', 'NOW', 1, 0, '', 0, NULL, datetime('now'), datetime('now')),
  ('pri-002', 'Add API key auth middleware', 'NOW', 1, 0, '', 0, NULL, datetime('now'), datetime('now')),
  ('pri-003', 'Verify all P0 routes after hardening', 'NOW', 1, 0, '', 0, NULL, datetime('now'), datetime('now')),
  ('pri-004', 'Deploy to Cloudflare Pages', 'NEXT', 0, 0, '', 0, NULL, datetime('now'), datetime('now')),
  ('pri-005', 'Execution Board (P2 scope)', 'LATER', 0, 0, '', 0, NULL, datetime('now'), datetime('now')),
  ('pri-006', 'Connector Hub (P2 scope)', 'LATER', 0, 0, '', 0, NULL, datetime('now'), datetime('now')),
  ('pri-007', 'Real-time updates / WebSocket (P2 scope)', 'NOT_NOW', 0, 0, '', 0, NULL, datetime('now'), datetime('now')),
  ('pri-008', 'Role-specific workspaces (P2 scope)', 'NOT_NOW', 0, 0, '', 0, NULL, datetime('now'), datetime('now'));

-- Seed: Canon candidate
INSERT OR IGNORE INTO canon_candidates (id, title, content_ref, proposed_by, status, review_notes, approved_by, promoted_at, created_at)
VALUES (
  'can-001',
  'Sovereign OS Platform — Operating Law',
  'Founder → L1 Master Architect → L2 Orchestrator → L3 Executor → Proof → Review → Live State → Canon',
  'Founder',
  'candidate',
  'Awaiting Founder ratification. Must not auto-promote. Manual promotion only.',
  NULL,
  NULL,
  datetime('now')
);
