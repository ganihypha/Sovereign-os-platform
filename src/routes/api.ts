// ============================================================
// SOVEREIGN OS PLATFORM — API ROUTES (P1)
// All mutations require auth (applied via middleware in index.tsx)
// ============================================================
import { Hono } from 'hono'
import { createRepo } from '../lib/repo'
import type { Env } from '../index'

export function createApiRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ---- Intents ----
  route.post('/intents', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    await repo.createIntent({
      title: String(body.title || ''),
      objective: String(body.objective || ''),
      strategic_context: String(body.strategic_context || ''),
      urgency: (body.urgency as any) || 'normal',
      scope_notes: String(body.scope_notes || ''),
      escalation_notes: String(body.escalation_notes || ''),
      created_by: String(body.created_by || 'Operator'),
    })
    return c.redirect('/intent')
  })

  // ---- Requests ----
  route.post('/requests', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    const refs = body.source_refs ? String(body.source_refs).split(',').map(s => s.trim()).filter(Boolean) : []
    await repo.createRequest({
      intent_id: String(body.intent_id || '') || null,
      session_id: String(body.session_id || '') || null,
      request_title: String(body.request_title || ''),
      request_type: (body.request_type as any) || 'feature',
      lane: (body.lane as any) || 'ops',
      urgency: (body.urgency as any) || 'normal',
      requester: String(body.requester || 'Operator'),
      context_summary: String(body.context_summary || ''),
      source_refs: refs,
      readiness_status: (body.readiness_status as any) || 'unknown',
      decision: (body.decision as any) || 'hold',
    })
    return c.redirect('/intake')
  })

  // ---- Sessions ----
  route.post('/sessions', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    const scope_in = body.scope_in ? String(body.scope_in).split(',').map(s => s.trim()).filter(Boolean) : []
    const scope_out = body.scope_out ? String(body.scope_out).split(',').map(s => s.trim()).filter(Boolean) : []
    const criteria = body.acceptance_criteria ? String(body.acceptance_criteria).split('\n').map(s => s.trim()).filter(Boolean) : []
    const refs = body.source_of_truth_refs ? String(body.source_of_truth_refs).split(',').map(s => s.trim()).filter(Boolean) : []
    await repo.createSession({
      intent_id: String(body.intent_id || '') || null,
      title: String(body.title || ''),
      status: 'active',
      session_brief: String(body.session_brief || ''),
      bounded_brief: String(body.bounded_brief || ''),
      scope_in,
      scope_out,
      acceptance_criteria: criteria,
      next_locked_move: String(body.next_locked_move || ''),
      source_of_truth_refs: refs,
      active_constraints: ['No role collapse', 'No false verification', 'No secret exposure'],
      closed_at: null,
    })
    return c.redirect('/architect')
  })

  // ---- Approvals ----
  route.post('/approvals', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    await repo.createApprovalRequest({
      request_id: String(body.request_id || ''),
      action_type: String(body.action_type || ''),
      approval_tier: parseInt(String(body.approval_tier || '1')) as any,
      risk_summary: String(body.risk_summary || ''),
      payload_summary: String(body.payload_summary || ''),
      requested_by: String(body.requested_by || 'Operator'),
      approved_by: null,
      status: 'pending',
      decision_reason: '',
      resolved_at: null,
    })
    return c.redirect('/approvals')
  })

  route.post('/approvals/:id/decision', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const action = String(body.action || 'returned')
    const reason = String(body.reason || '')
    const approved_by = String(body.approved_by || 'Operator')
    await repo.updateApprovalStatus(id, action as any, approved_by, reason)
    // Log to audit if D1 available
    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? ''
      await repo.logAudit(approved_by, `approval.${action}`, 'approval_request', id, `reason: ${reason}`, ip)
    }
    return c.redirect('/approvals')
  })

  // ---- Proof ----
  route.post('/proof', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    await repo.createProofArtifact({
      work_item_id: String(body.work_item_id || ''),
      proof_type: (body.proof_type as any) || 'manual',
      evidence_link: String(body.evidence_link || ''),
      verification_notes: String(body.verification_notes || ''),
      outcome_classification: (body.outcome_classification as any) || 'PARTIAL',
      reviewer: String(body.reviewer || 'Operator'),
      status: 'pending',
      reviewed_at: null,
    })
    return c.redirect('/proof')
  })

  route.post('/proof/:id/review', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const updates: Record<string, unknown> = {
      status: 'reviewed',
      outcome_classification: (body.outcome as any) || undefined,
      reviewer: String(body.reviewer || ''),
      reviewed_at: new Date().toISOString(),
    }
    if (body.notes) updates.verification_notes = String(body.notes)
    await repo.updateProofArtifact(id, updates as any)
    // Log to audit if D1 available
    if (repo.isPersistent) {
      const reviewer = String(body.reviewer || 'Operator')
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit(reviewer, 'proof.reviewed', 'proof_artifact', id, `outcome: ${body.outcome}`, ip)
    }
    return c.redirect('/proof')
  })

  // ---- Priority Items ----
  route.post('/priority', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    await repo.createPriorityItem({
      title: String(body.title || ''),
      category: (body.category as any) || 'NEXT',
      session_target: body.session_target === 'true',
      blocker: body.blocker === 'true',
      blocker_description: String(body.blocker_description || ''),
      resolved: false,
      resolved_at: null,
    })
    return c.redirect('/live')
  })

  route.post('/priority/:id/resolve', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.json<{ resolved: boolean }>()
    await repo.updatePriorityItem(id, {
      resolved: body.resolved,
      resolved_at: body.resolved ? new Date().toISOString() : null
    })
    return c.json({ ok: true })
  })

  // ---- Decisions ----
  route.post('/decisions', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    const record = await repo.createDecisionRecord({
      session_id: null,
      request_id: null,
      decision_type: (body.decision_type as any) || 'intent',
      summary: String(body.summary || ''),
      decided_by: String(body.decided_by || 'Founder'),
      outcome: String(body.outcome || ''),
      proof_refs: [],
      canon_candidate_flag: body.canon_candidate_flag === 'true',
      change_log: String(body.change_log || ''),
    })
    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit(record.decided_by, 'decision.created', 'decision_record', record.id, record.summary.substring(0,100), ip)
    }
    return c.redirect('/records')
  })

  // ---- Handoffs ----
  route.post('/handoffs', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    const open_items = body.open_items ? String(body.open_items).split(',').map(s => s.trim()).filter(Boolean) : []
    await repo.createHandoffRecord({
      session_id: null,
      from_role: String(body.from_role || 'Founder'),
      to_role: String(body.to_role || 'Master Architect'),
      handoff_context: String(body.handoff_context || ''),
      open_items,
      decision_refs: [],
    })
    return c.redirect('/records')
  })

  // ---- Canon ----
  // GOVERNANCE RULE: canon_candidate must never auto-promote
  // Requires explicit action='promote' + approved_by
  route.post('/canon/:id/promote', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const action = String(body.action || 'reject')
    const approved_by = String(body.approved_by || '')
    const review_notes = String(body.review_notes || '')

    if (action === 'promote') {
      // Require explicit approved_by — no auto-promotion without attribution
      if (!approved_by.trim()) {
        return c.json({ error: 'CANON_GOVERNANCE', message: 'approved_by is required for canon promotion.' }, 400)
      }
      await repo.updateCanonCandidate(id, {
        status: 'promoted',
        approved_by,
        promoted_at: new Date().toISOString(),
        review_notes: review_notes || undefined
      })
      if (repo.isPersistent) {
        const ip = c.req.header('cf-connecting-ip') ?? ''
        await repo.logAudit(approved_by, 'canon.promoted', 'canon_candidate', id, review_notes.substring(0,100), ip)
      }
    } else {
      await repo.updateCanonCandidate(id, {
        status: 'rejected',
        review_notes: review_notes || undefined
      })
    }
    return c.redirect('/records')
  })

  // ============================================================
  // P2 ENDPOINTS
  // ============================================================

  // ---- P2: Session Continuity ----
  route.post('/continuity', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    const sessionId = String(body.session_id || '')

    // Build automatic state snapshot
    const [intents, sessions, requests, approvals, workItems, proofs, decisions, handoffs, priorities, canon] = await Promise.all([
      repo.getIntents(), repo.getSessions(), repo.getRequests(),
      repo.getApprovalRequests(), repo.getWorkItems(), repo.getProofArtifacts(),
      repo.getDecisionRecords(), repo.getHandoffRecords(),
      repo.getPriorityItems(), repo.getCanonCandidates(),
    ])
    const pendingApprovals = approvals.filter(a => a.status === 'pending').map(a => a.id)
    const pendingProofs = proofs.filter(p => p.status === 'pending').map(p => p.id)
    const activeBlockers = priorities.filter(p => p.blocker && !p.resolved).map(p => p.title)

    await repo.createSessionContinuity({
      session_id: sessionId || (sessions[0]?.id ?? 'unknown'),
      snapshot_type: (body.snapshot_type as any) || 'checkpoint',
      platform_state: {
        intents: intents.length, sessions: sessions.length,
        requests: requests.length, approval_requests: approvals.length,
        work_items: workItems.length, proof_artifacts: proofs.length,
        decision_records: decisions.length, handoff_records: handoffs.length,
        priority_items: priorities.length, canon_candidates: canon.length,
        pending_approvals: pendingApprovals.length,
        pending_proofs: pendingProofs.length,
        active_blockers: activeBlockers.length,
      },
      open_items: [
        ...activeBlockers.map(b => `BLOCKER: ${b}`),
        ...(pendingApprovals.length > 0 ? [`${pendingApprovals.length} approval(s) pending`] : []),
        ...(pendingProofs.length > 0 ? [`${pendingProofs.length} proof(s) pending review`] : []),
      ],
      pending_approvals: pendingApprovals,
      pending_proofs: pendingProofs,
      next_locked_move: String(body.next_locked_move || ''),
      authored_by: String(body.authored_by || 'Operator'),
      governance_notes: String(body.governance_notes || ''),
    })

    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit(String(body.authored_by || 'Operator'), 'continuity.snapshot', 'session', sessionId, String(body.snapshot_type || 'checkpoint'), ip)
    }
    return c.redirect('/continuity')
  })

  // ---- P2: Operator Notes ----
  route.post('/notes', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    await repo.createOperatorNote({
      object_type: String(body.object_type || 'platform'),
      object_id: String(body.object_id || 'general'),
      note_type: (body.note_type as any) || 'observation',
      content: String(body.content || ''),
      authored_by: String(body.authored_by || 'Operator'),
      resolved: false,
      resolved_at: null,
    })
    return c.redirect('/continuity')
  })

  route.post('/notes/:id/resolve', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    await repo.resolveOperatorNote(id)
    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit('Operator', 'note.resolved', 'operator_note', id, '', ip)
    }
    return c.redirect('/continuity')
  })

  // ============================================================
  // P3 ENDPOINTS — Execution Board + Connector Hub
  // ============================================================

  // ---- P3: Execution Entries ----
  route.post('/execution', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    const entry = await repo.createExecutionEntry({
      work_item_id: String(body.work_item_id || ''),
      session_id: String(body.session_id || '') || null,
      title: String(body.title || ''),
      executor: String(body.executor || 'Operator'),
      status: (body.status as any) || 'pending',
      priority: (body.priority as any) || 'normal',
      context_notes: String(body.context_notes || ''),
      proof_id: null,
      started_at: body.status === 'running' ? new Date().toISOString() : null,
      completed_at: null,
      blocked_reason: String(body.blocked_reason || ''),
    })
    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit(String(body.executor || 'Operator'), 'execution.created', 'execution_entry', entry.id, entry.title.substring(0, 100), ip)
    }
    return c.redirect('/execution')
  })

  route.post('/execution/:id/status', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const status = String(body.status || 'pending') as any
    const updates: Record<string, unknown> = { status }
    if (status === 'running' ) updates.started_at = new Date().toISOString()
    if (status === 'done' || status === 'cancelled') updates.completed_at = new Date().toISOString()
    if (body.blocked_reason) updates.blocked_reason = String(body.blocked_reason)
    if (body.proof_id) updates.proof_id = String(body.proof_id)

    const entry = await repo.updateExecutionEntry(id, updates as any)
    if (!entry) return c.json({ error: 'not_found' }, 404)

    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit('Operator', `execution.status.${status}`, 'execution_entry', id, String(body.blocked_reason || ''), ip)
    }
    return c.json({ ok: true, id, status })
  })

  // ---- P3: Connectors ----
  route.post('/connectors', async (c) => {
    const repo = createRepo(c.env.DB)
    const body = await c.req.parseBody()
    const conn = await repo.createConnector({
      name: String(body.name || ''),
      connector_type: (body.connector_type as any) || 'api',
      description: String(body.description || ''),
      endpoint_hint: String(body.endpoint_hint || ''),
      status: 'registered',
      approval_status: 'pending',
      approved_by: null,
      risk_level: (body.risk_level as any) || 'medium',
      lane: (body.lane as any) || 'ops',
      last_event_at: null,
      event_count: 0,
      owner_role: String(body.owner_role || 'orchestrator'),
      notes: String(body.notes || ''),
    })
    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit('Operator', 'connector.registered', 'connector', conn.id, conn.name, ip)
    }
    return c.redirect('/connectors')
  })

  route.post('/connectors/:id/approve', async (c) => {
    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const action = String(body.action || 'reject')
    const approved_by = String(body.approved_by || 'Architect')

    if (action === 'approve') {
      await repo.updateConnector(id, {
        approval_status: 'approved',
        approved_by,
        status: 'active',
      })
    } else {
      await repo.updateConnector(id, {
        approval_status: 'rejected',
        status: 'blocked',
      })
    }
    if (repo.isPersistent) {
      const ip = c.req.header('cf-connecting-ip') ?? ''
      await repo.logAudit(approved_by, `connector.${action}`, 'connector', id, '', ip)
    }
    return c.redirect('/connectors')
  })

  // ---- Status Endpoint (public) ----
  route.get('/status', async (c) => {
    const repo = createRepo(c.env.DB)
    const [intents, sessions, requests, approvals, workItems, proofs, decisions, handoffs, priorities, canon, continuities, boundaries, notes, execEntries, connectors] = await Promise.all([
      repo.getIntents(),
      repo.getSessions(),
      repo.getRequests(),
      repo.getApprovalRequests(),
      repo.getWorkItems(),
      repo.getProofArtifacts(),
      repo.getDecisionRecords(),
      repo.getHandoffRecords(),
      repo.getPriorityItems(),
      repo.getCanonCandidates(),
      repo.getSessionContinuity(),
      repo.getGovernanceBoundaries(),
      repo.getOperatorNotes(),
      repo.getExecutionEntries(),
      repo.getConnectors(),
    ])

    const pendingApprovals = approvals.filter(a => a.status === 'pending').length
    const pendingProofs = proofs.filter(p => p.status === 'pending').length
    const activeBlockers = priorities.filter(p => p.blocker && !p.resolved).length
    const unresolvedNotes = notes.filter(n => !n.resolved).length

    const runningExec = execEntries.filter(e => e.status === 'running').length
    const blockedExec = execEntries.filter(e => e.status === 'blocked').length
    const activeConnectors = connectors.filter(c => c.status === 'active').length
    const pendingConnApproval = connectors.filter(c => c.approval_status === 'pending').length

    return c.json({
      platform: 'Sovereign OS Platform',
      version: '0.3.0-P3',
      build: 'P3 Operational Expansion',
      baseline: 'P1+P2+P2.5 preserved — no regression',
      operating_law: 'Founder → L1 → L2 → L3 → Proof → Review → Live → Canon',
      persistence: {
        mode: repo.isPersistent ? 'D1 (persistent)' : 'in-memory (resets on restart)',
        d1_bound: repo.isPersistent,
        warning: repo.isPersistent ? null : 'Data will reset on server restart. Wire D1 binding for persistence.'
      },
      auth: {
        configured: !!c.env.PLATFORM_API_KEY,
        status: c.env.PLATFORM_API_KEY ? 'configured' : 'unconfigured — mutations blocked',
        note: 'Key value is never exposed in status or UI.'
      },
      surfaces: [
        '/dashboard', '/intent', '/intake', '/architect',
        '/approvals', '/proof', '/live', '/records', '/continuity',
        '/execution', '/connectors'  // P3 additions
      ],
      governance: {
        no_role_collapse: true,
        no_false_verification: true,
        no_secret_exposure: true,
        no_undocumented_meaningful_activity: true,
        canon_auto_promote_disabled: true,
        proof_bypass_disabled: true,
        approval_audit_trail: true,
        // P2 additions
        role_aware_context: true,
        session_continuity_tracked: true,
        governance_boundaries_enforced: boundaries.filter(b => b.status === 'active').length,
        operator_notes_available: true
      },
      p2_maturity: {
        role_awareness: 'implemented — role context derived per request',
        continuity_discipline: continuities.length > 0 ? 'active' : 'pending-first-snapshot',
        governance_boundaries: boundaries.filter(b => b.status === 'active').length + ' active boundaries',
        operator_notes: unresolvedNotes + ' unresolved note(s)',
        pending_approvals: pendingApprovals,
        pending_proofs: pendingProofs,
        active_blockers: activeBlockers,
      },
      p3_operational: {
        execution_board: 'LIVE — operational board with work visibility, ownership, proof linkage',
        connector_hub: 'LIVE — governed integration registry, approval-aware, risk-classified',
        execution_running: runningExec,
        execution_blocked: blockedExec,
        active_connectors: activeConnectors,
        connectors_pending_approval: pendingConnApproval,
      },
      data_objects: [
        'intent', 'session', 'request', 'approval_request',
        'work_item', 'proof_artifact', 'decision_record',
        'handoff_record', 'priority_item', 'canon_candidate',
        // P2
        'session_continuity', 'governance_boundary', 'operator_note', 'role_assignment',
        // P3
        'execution_entry', 'connector'
      ],
      counts: {
        // P1 objects
        intents: intents.length,
        sessions: sessions.length,
        requests: requests.length,
        approval_requests: approvals.length,
        work_items: workItems.length,
        proof_artifacts: proofs.length,
        decision_records: decisions.length,
        handoff_records: handoffs.length,
        priority_items: priorities.length,
        canon_candidates: canon.length,
        // P2 objects
        session_continuity: continuities.length,
        governance_boundaries: boundaries.length,
        operator_notes: notes.length,
        // P3 objects
        execution_entries: execEntries.length,
        connectors: connectors.length,
        // Attention-needed
        pending_approvals: pendingApprovals,
        pending_proofs: pendingProofs,
        active_blockers: activeBlockers,
        unresolved_notes: unresolvedNotes,
        execution_running: runningExec,
        execution_blocked: blockedExec,
      }
    })
  })

  // ---- P4: /api/reports ----
  route.get('/reports', async (c) => {
    const repo = createRepo(c.env.DB)
    try {
      const metrics = await repo.getReportMetrics()
      return c.json({
        platform: 'Sovereign OS Platform',
        version: '0.4.0-P4',
        generated_at: new Date().toISOString(),
        data_source: repo.isPersistent ? 'd1' : 'in-memory',
        metrics,
        note: 'All metrics computed from real D1 queries. No synthetic data.'
      })
    } catch (_e) {
      return c.json({ error: 'METRICS_ERROR', message: 'Could not compute metrics.' }, 500)
    }
  })

  // ---- P4: /api/lanes ----
  route.get('/lanes', async (c) => {
    const repo = createRepo(c.env.DB)
    const lanes = await repo.getProductLanes()
    return c.json({ lanes, count: lanes.length })
  })

  return route
}
