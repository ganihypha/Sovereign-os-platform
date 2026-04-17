// ============================================================
// SOVEREIGN OS PLATFORM — ROLE WORKSPACES (P4)
// Role-differentiated operator workspace views.
// Each role sees only their relevant controls and surfaces.
// Cross-role mutations are blocked (403).
// Role derived from API key via role_assignments (P3 baseline).
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import { buildRoleContext, ROLE_META, ROLE_DEFAULT_PERMISSIONS, roleBadge, atLeast } from '../lib/roles'
import type { Env } from '../index'
import type { PlatformRole } from '../types'

const ROLE_COLORS: Record<PlatformRole, string> = {
  founder: '#f59e0b',
  architect: '#4f8ef7',
  orchestrator: '#a78bfa',
  executor: '#34d399',
  reviewer: '#22d3ee',
  operator: '#9aa3b2',
}

function workspaceCard(
  title: string,
  desc: string,
  link: string,
  color: string,
  badge?: string
): string {
  return `
  <a href="${link}" style="display:block;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;text-decoration:none;color:inherit;transition:border-color 0.15s;" onmouseover="this.style.borderColor='${color}'" onmouseout="this.style.borderColor='var(--border)'">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div style="font-size:14px;font-weight:600;color:var(--text)">${title}</div>
      ${badge ? `<span style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700">${badge}</span>` : ''}
    </div>
    <div style="font-size:12px;color:var(--text2);line-height:1.5">${desc}</div>
  </a>`
}

function founderWorkspace(ctx: ReturnType<typeof buildRoleContext>, counts: Record<string, number>): string {
  return `
  <div style="margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">FOUNDER WORKSPACE — Strategic Command</div>
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;color:#f59e0b;margin-bottom:4px">⬡ Layer 0 — Strategic Intent</div>
      <div style="font-size:12px;color:var(--text2)">You have ultimate authority. Tier 3 approvals, canon promotion, and lane activation require your action.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${workspaceCard('Intent Desk', 'Define and manage founder strategic intents. All work flows from intent.', '/intent', '#f59e0b', counts.intents + ' intents')}
      ${workspaceCard('Approval Authority', 'Review and resolve Tier 2–3 approval requests. Founder approval required for Tier 3.', '/approvals', '#ef4444', counts.pending_approvals + ' pending')}
      ${workspaceCard('Canon Promotion', 'Review canon candidates and promote to stable platform canon.', '/canon', '#a855f7', counts.canon_candidates + ' candidates')}
      ${workspaceCard('Lane Governance', 'Oversee product lane directory. Activate or deactivate lanes.', '/lanes', '#f59e0b')}
      ${workspaceCard('Platform Dashboard', 'Full platform operational view with governance health.', '/dashboard', '#4f8ef7')}
      ${workspaceCard('Records & Decisions', 'Review all decision records, handoffs, and audit trail.', '/records', '#9aa3b2')}
    </div>
  </div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">FOUNDER-EXCLUSIVE ACTIONS</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;font-size:12px;color:var(--text2)">
      <div>✓ Tier 3 approvals</div>
      <div>✓ Canon promotion final gate</div>
      <div>✓ Lane activation / deactivation</div>
      <div>✓ Platform law override (requires justification)</div>
      <div>✓ All surface read access</div>
    </div>
  </div>`
}

function architectWorkspace(ctx: ReturnType<typeof buildRoleContext>, counts: Record<string, number>): string {
  return `
  <div style="margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">ARCHITECT WORKSPACE — Intent & Structure</div>
    <div style="background:rgba(79,142,247,0.08);border:1px solid rgba(79,142,247,0.2);border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;color:#4f8ef7;margin-bottom:4px">◉ Layer 1 — Master Architect</div>
      <div style="font-size:12px;color:var(--text2)">Capture intent, define session scope, manage handoffs, design architecture delta, approve Tier 0–2 actions.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${workspaceCard('Architect Workbench', 'Define session scope, bounded briefs, architecture decisions.', '/architect', '#4f8ef7')}
      ${workspaceCard('Session Intake', 'Review and classify incoming requests. Set readiness and decision.', '/intake', '#4f8ef7', counts.requests + ' requests')}
      ${workspaceCard('Approval Queue', 'Review and resolve Tier 0–2 approval requests.', '/approvals', '#f59e0b', counts.pending_approvals + ' pending')}
      ${workspaceCard('Canon Review', 'Review canon candidates and co-promote (with founder) to canon.', '/canon', '#a855f7')}
      ${workspaceCard('Session Continuity', 'Manage session continuity snapshots, handoffs, governance boundaries.', '/continuity', '#22d3ee')}
      ${workspaceCard('Lane Directory', 'Manage product lane registration and governance.', '/lanes', '#4f8ef7')}
      ${workspaceCard('Connector Hub', 'Review and approve connector registrations.', '/connectors', '#4f8ef7')}
      ${workspaceCard('Records', 'Decision records, handoffs, and canon history.', '/records', '#9aa3b2')}
    </div>
  </div>`
}

function orchestratorWorkspace(ctx: ReturnType<typeof buildRoleContext>, counts: Record<string, number>): string {
  return `
  <div style="margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">ORCHESTRATOR WORKSPACE — Operational Decision</div>
    <div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;color:#a78bfa;margin-bottom:4px">⊛ Layer 2 — Orchestrator</div>
      <div style="font-size:12px;color:var(--text2)">Gate execution readiness, route approvals, manage orchestration queue. Approve Tier 0–1 actions.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${workspaceCard('Approval Queue', 'Route and resolve Tier 0–1 approval requests.', '/approvals', '#a78bfa', counts.pending_approvals + ' pending')}
      ${workspaceCard('Live Priority Board', 'Manage NOW/NEXT/LATER/HOLD priority board.', '/live', '#a78bfa', counts.now_items + ' NOW')}
      ${workspaceCard('Execution Board', 'Gate execution readiness, assign work items.', '/execution', '#a78bfa')}
      ${workspaceCard('Session Continuity', 'Create handoffs and session checkpoints.', '/continuity', '#22d3ee')}
      ${workspaceCard('Dashboard', 'Platform-wide operational overview.', '/dashboard', '#a78bfa')}
    </div>
  </div>`
}

function executorWorkspace(ctx: ReturnType<typeof buildRoleContext>, counts: Record<string, number>): string {
  return `
  <div style="margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">EXECUTOR WORKSPACE — Bounded Work Inbox</div>
    <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;color:#34d399;margin-bottom:4px">▶ Layer 3 — Executor</div>
      <div style="font-size:12px;color:var(--text2)">Execute bounded work items. Submit proof artifacts. Log execution state. Cannot self-approve or review own proof.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${workspaceCard('Execution Board', 'Your work inbox. See running, pending, and blocked items.', '/execution', '#34d399', counts.running_exec + ' running')}
      ${workspaceCard('Proof Submission', 'Submit proof artifacts for completed work items.', '/proof', '#34d399')}
      ${workspaceCard('Live Board', 'View NOW/NEXT priority board (read-only for mutations).', '/live', '#34d399')}
      ${workspaceCard('Dashboard', 'Platform operational status overview.', '/dashboard', '#34d399')}
    </div>
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:var(--text2)">
      <span style="color:#ef4444;font-weight:700">⚠ Governance Rule:</span> Executors may NOT approve their own work, review their own proof, or promote to canon. These actions require a separate Reviewer role.
    </div>
  </div>`
}

function reviewerWorkspace(ctx: ReturnType<typeof buildRoleContext>, counts: Record<string, number>): string {
  return `
  <div style="margin-bottom:24px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">REVIEWER WORKSPACE — Proof Inbox & Verification</div>
    <div style="background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;color:#22d3ee;margin-bottom:4px">◇ Layer 4 — Reviewer</div>
      <div style="font-size:12px;color:var(--text2)">Review and classify proof artifacts. Cannot review proof they submitted. Verification is the final gate before live state promotion.</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${workspaceCard('Proof Inbox', 'Review pending proof artifacts. Classify as PASS/PARTIAL/FAIL/BLOCKED.', '/proof', '#22d3ee', counts.pending_proofs + ' pending')}
      ${workspaceCard('Records', 'Review decision records and audit trail.', '/records', '#22d3ee')}
      ${workspaceCard('Dashboard', 'Platform overview. Reviewer has read access to all surfaces.', '/dashboard', '#22d3ee')}
    </div>
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:var(--text2)">
      <span style="color:#ef4444;font-weight:700">⚠ Governance Rule:</span> Reviewers may NOT review proof they submitted. No self-review. This role separation is non-negotiable.
    </div>
  </div>`
}

export function createWorkspaceRoute() {
  const route = new Hono<{ Bindings: Env }>()

  async function renderWorkspace(role: PlatformRole, isAuth: boolean, counts: Record<string, number>): Promise<string> {
    const ctx = buildRoleContext(isAuth, role)
    const meta = ROLE_META[role]
    const color = ROLE_COLORS[role]
    const perms = ROLE_DEFAULT_PERMISSIONS[role]

    let workspaceContent = ''
    switch (role) {
      case 'founder': workspaceContent = founderWorkspace(ctx, counts); break
      case 'architect': workspaceContent = architectWorkspace(ctx, counts); break
      case 'orchestrator': workspaceContent = orchestratorWorkspace(ctx, counts); break
      case 'executor': workspaceContent = executorWorkspace(ctx, counts); break
      case 'reviewer': workspaceContent = reviewerWorkspace(ctx, counts); break
      default: workspaceContent = `<div style="color:var(--text2);font-size:13px">Workspace for role "${role}" — access to all read surfaces. No mutation authority beyond viewer level.</div>`
    }

    const content = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
          <h1 style="font-size:20px;font-weight:700;color:var(--text)">${meta.label} Workspace</h1>
          <span style="background:${color}20;color:${color};border:1px solid ${color}40;border-radius:4px;padding:3px 10px;font-size:11px;font-weight:700">${meta.label.toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:var(--text2)">${meta.layer} · ${perms.length} permissions active · Role Workspaces enforce platform Law 1 (No Role Collapse)</div>
      </div>
    </div>

    ${workspaceContent}

    <div style="margin-top:24px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">ACTIVE PERMISSIONS (${perms.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${perms.map(p => `<span style="background:${color}15;color:${color};border:1px solid ${color}30;border-radius:3px;padding:2px 8px;font-size:11px;font-family:'JetBrains Mono',monospace">${p}</span>`).join('')}
      </div>
    </div>

    <div style="margin-top:16px;padding:12px 16px;background:rgba(79,142,247,0.06);border:1px solid rgba(79,142,247,0.15);border-radius:8px">
      <div style="font-size:11px;color:var(--text3)">
        <span style="color:var(--accent);font-weight:600">Role Workspace Note:</span> This workspace is determined by your API key role assignment. 
        To switch roles, use a different role key. Cross-role mutations are blocked at the API level (403).
        All other workspaces: 
        ${(['founder','architect','orchestrator','executor','reviewer'] as PlatformRole[])
          .filter(r => r !== role)
          .map(r => `<a href="/w/${r}" style="color:${ROLE_COLORS[r]};text-decoration:none">${r}</a>`)
          .join(' · ')}
      </div>
    </div>`

    return layout(`${meta.label} Workspace`, content, `/w/${role}`)
  }

  // Generic workspace resolver
  async function handleWorkspace(role: PlatformRole, c: { env: Env, req: { raw: Request }, html: (s: string, status?: number) => Response, json: (s: unknown, status?: number) => Response }) {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c as unknown as Parameters<typeof isAuthenticated>[0], c.env)

    if (!isAuth) {
      return c.html(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Auth Required</title>
        <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0c10;color:#e8eaf0;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
        .box{background:#111318;border:1px solid #232830;border-radius:12px;padding:40px;max-width:400px;width:100%}
        h2{margin-bottom:12px}p{color:#9aa3b2;font-size:13px;margin-bottom:20px}a{color:#4f8ef7}</style></head>
        <body><div class="box"><h2>Authentication Required</h2><p>Role workspaces require a valid platform key. <a href="/dashboard">Go to Dashboard</a> to authenticate.</p></div></body></html>`, 401)
    }

    const [sessions, approvals, priorities, proofs, execEntries, canonItems] = await Promise.all([
      repo.getSessions(),
      repo.getApprovalRequests(),
      repo.getPriorityItems(),
      repo.getProofArtifacts(),
      repo.getExecutionEntries(),
      repo.getCanonCandidates(),
    ])

    const counts = {
      intents: (await repo.getIntents()).length,
      requests: (await repo.getRequests()).length,
      pending_approvals: approvals.filter(a => a.status === 'pending').length,
      canon_candidates: canonItems.filter(c => c.status === 'candidate').length,
      now_items: priorities.filter(p => p.category === 'NOW' && !p.resolved).length,
      running_exec: execEntries.filter(e => e.status === 'running').length,
      pending_proofs: proofs.filter(p => p.status === 'pending').length,
    }

    const html = await renderWorkspace(role, isAuth, counts)
    return (c as unknown as { html: (s: string) => Response }).html(html)
  }

  // Role-specific routes
  route.get('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    const repo = createRepo(c.env.DB)

    // Detect role from role_assignments if possible
    let detectedRole: PlatformRole = 'operator'
    if (isAuth) {
      const cookie = c.req.header('cookie') ?? ''
      const match = cookie.match(/platform_key=([^;]+)/)
      if (match) {
        const { hashKey } = await import('../lib/auth')
        const hash = await hashKey(match[1])
        const roleAssignment = await repo.getRoleByKeyHash(hash)
        if (roleAssignment) detectedRole = roleAssignment.role
        else detectedRole = 'architect' // default for single-key mode
      }
    }

    return c.redirect(`/w/${detectedRole}`)
  })

  route.get('/founder', async (c) => handleWorkspace('founder', c as unknown as Parameters<typeof handleWorkspace>[1]))
  route.get('/architect', async (c) => handleWorkspace('architect', c as unknown as Parameters<typeof handleWorkspace>[1]))
  route.get('/orchestrator', async (c) => handleWorkspace('orchestrator', c as unknown as Parameters<typeof handleWorkspace>[1]))
  route.get('/executor', async (c) => handleWorkspace('executor', c as unknown as Parameters<typeof handleWorkspace>[1]))
  route.get('/reviewer', async (c) => handleWorkspace('reviewer', c as unknown as Parameters<typeof handleWorkspace>[1]))
  route.get('/operator', async (c) => handleWorkspace('operator', c as unknown as Parameters<typeof handleWorkspace>[1]))

  return route
}
