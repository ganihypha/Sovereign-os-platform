// ============================================================
// SOVEREIGN OS PLATFORM — ROLE-AWARE CONTEXT (P2)
//
// Provides role-based access context derived from the current
// auth key. Works with the P1 single-key auth fallback:
//   - If role_assignments table has entries, use role from there
//   - If no role_assignments (single-key P1 mode), default to 'operator'
//
// Platform Law: No role collapse.
// Roles: founder > architect > orchestrator > executor > reviewer > operator
//
// WHAT THIS MODULE DOES:
//   - Derives current role from request key
//   - Provides permission-checking helpers
//   - Provides role-aware UI badges
//   - Does NOT expose key values
// ============================================================

import type { PlatformRole } from '../types'

// ---- Role hierarchy (higher index = more authority) ----
export const ROLE_HIERARCHY: PlatformRole[] = [
  'operator', 'reviewer', 'executor', 'orchestrator', 'architect', 'founder'
]

// ---- Default permissions per role ----
export const ROLE_DEFAULT_PERMISSIONS: Record<PlatformRole, string[]> = {
  founder: [
    'create_intent', 'update_intent',
    'approve_tier0', 'approve_tier1', 'approve_tier2', 'approve_tier3',
    'promote_canon', 'create_session', 'close_session',
    'create_decision', 'create_handoff',
    'create_boundary', 'update_boundary',
    'create_proof', 'review_proof',
    'create_priority', 'resolve_priority',
    'create_note', 'resolve_note',
    'view_audit', 'view_all'
  ],
  architect: [
    'create_intent',
    'approve_tier0', 'approve_tier1', 'approve_tier2',
    'create_session', 'close_session',
    'create_decision', 'create_handoff',
    'create_proof', 'review_proof',
    'create_priority', 'resolve_priority',
    'create_note', 'resolve_note',
    'view_audit', 'view_all'
  ],
  orchestrator: [
    'approve_tier0', 'approve_tier1',
    'create_session',
    'create_decision', 'create_handoff',
    'create_proof',
    'create_priority', 'resolve_priority',
    'create_note', 'resolve_note',
    'view_audit', 'view_all'
  ],
  executor: [
    'create_proof',
    'create_priority',
    'create_note',
    'view_all'
  ],
  reviewer: [
    'review_proof',
    'create_note',
    'view_audit', 'view_all'
  ],
  operator: [
    'view_all'
  ]
}

// ---- Role display metadata ----
export const ROLE_META: Record<PlatformRole, { label: string; color: string; layer: string }> = {
  founder:      { label: 'Founder',      color: '#f59e0b', layer: 'L0 — Strategic Intent' },
  architect:    { label: 'Architect',    color: '#4f8ef7', layer: 'L1 — Intent & Structure' },
  orchestrator: { label: 'Orchestrator', color: '#a78bfa', layer: 'L2 — Operational Decision' },
  executor:     { label: 'Executor',     color: '#34d399', layer: 'L3 — Implementation & Proof' },
  reviewer:     { label: 'Reviewer',     color: '#22d3ee', layer: 'L4 — Proof Review' },
  operator:     { label: 'Operator',     color: '#9aa3b2', layer: 'General Access' }
}

// ---- Current role context ----
export interface RoleContext {
  role: PlatformRole
  label: string
  permissions: string[]
  isAuthenticated: boolean
}

// Derive role context from current auth state
// In P1/P2 single-key mode: authenticated = 'operator' (can do all base ops)
// With role_assignments table: derive specific role from key_hash
export function buildRoleContext(isAuth: boolean, roleFromDb?: PlatformRole): RoleContext {
  if (!isAuth) {
    return {
      role: 'operator',
      label: 'Guest',
      permissions: [],
      isAuthenticated: false
    }
  }

  // If a specific role was found from role_assignments DB
  const role: PlatformRole = roleFromDb ?? 'operator'
  const meta = ROLE_META[role]
  const permissions = ROLE_DEFAULT_PERMISSIONS[role]

  return {
    role,
    label: meta.label,
    permissions,
    isAuthenticated: true
  }
}

// Check if a role context has a specific permission
export function can(ctx: RoleContext, permission: string): boolean {
  return ctx.isAuthenticated && ctx.permissions.includes(permission)
}

// Check if role meets minimum hierarchy level
export function atLeast(ctx: RoleContext, minimumRole: PlatformRole): boolean {
  const ctxIdx = ROLE_HIERARCHY.indexOf(ctx.role)
  const minIdx = ROLE_HIERARCHY.indexOf(minimumRole)
  return ctx.isAuthenticated && ctxIdx >= minIdx
}

// ---- UI badge for role display (never exposes key) ----
export function roleBadge(ctx: RoleContext): string {
  if (!ctx.isAuthenticated) {
    return '<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">GUEST</span>'
  }
  const meta = ROLE_META[ctx.role]
  const colorAlpha = meta.color + '26'
  return `<span style="background:${colorAlpha};color:${meta.color};border:1px solid ${meta.color}40;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${meta.label.toUpperCase()}</span>`
}

// ---- Role permission summary (for status display) ----
export function rolePermissionSummary(role: PlatformRole): string {
  const perms = ROLE_DEFAULT_PERMISSIONS[role]
  const meta = ROLE_META[role]
  const restricted = perms.length <= 2
  return `${meta.layer}${restricted ? ' · Read-only' : ''} · ${perms.length} permissions`
}
