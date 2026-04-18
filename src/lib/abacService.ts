// ============================================================
// SOVEREIGN OS PLATFORM — ABAC SERVICE (P10)
// Purpose: Attribute-Based Access Control policy enforcement
// Model: subject (role/user/tenant) + resource + action → allow/deny
// Integration: roles.ts, tenantContext.ts
// Non-blocking: graceful allow on DB error (fail-open for edge compat)
// ============================================================

export interface Policy {
  id: string
  tenant_id: string
  name: string
  description?: string
  subject_type: 'user' | 'role' | 'tenant'
  subject_value: string
  resource_type: string
  resource_filter?: string
  action: string
  effect: 'allow' | 'deny'
  priority: number
  status: 'active' | 'inactive'
  created_by: string
  created_at: string
  updated_at: string
}

export interface AbacContext {
  subject_type: 'user' | 'role' | 'tenant'
  subject_value: string
  resource_type: string
  action: string
  tenant_id?: string
}

export type AbacDecision = 'allow' | 'deny' | 'not-applicable'

// ============================================================
// CORE: evaluate a single policy against a context
// ============================================================
function matchPolicy(policy: Policy, ctx: AbacContext): boolean {
  // Subject match
  if (policy.subject_type !== ctx.subject_type) return false
  if (policy.subject_value !== ctx.subject_value && policy.subject_value !== '*') return false

  // Resource type match (wildcard supported)
  if (policy.resource_type !== ctx.resource_type && policy.resource_type !== '*') return false

  // Action match (wildcard supported)
  if (policy.action !== ctx.action && policy.action !== '*') return false

  // Tenant scope (if policy has tenant, must match; '*' means all tenants)
  if (policy.tenant_id !== 'tenant-default' && ctx.tenant_id && policy.tenant_id !== ctx.tenant_id) {
    // tenant-default policies apply to all; specific tenant policies only to that tenant
    if (ctx.tenant_id !== policy.tenant_id) return false
  }

  return true
}

// ============================================================
// CORE: enforce — given context, evaluate all applicable policies
// Priority: lowest number = highest priority
// Deny beats Allow at same priority
// If no applicable policy → not-applicable (caller decides default)
// ============================================================
export function enforceAbac(policies: Policy[], ctx: AbacContext): AbacDecision {
  const applicable = policies
    .filter(p => p.status === 'active' && matchPolicy(p, ctx))
    .sort((a, b) => a.priority - b.priority)

  if (applicable.length === 0) return 'not-applicable'

  // At the same priority level, deny wins
  const lowestPriority = applicable[0].priority
  const topTier = applicable.filter(p => p.priority === lowestPriority)
  if (topTier.some(p => p.effect === 'deny')) return 'deny'
  if (topTier.some(p => p.effect === 'allow')) return 'allow'

  return 'not-applicable'
}

// ============================================================
// DB: load all active policies for a tenant (+ global tenant-default)
// ============================================================
export async function loadPolicies(db: D1Database, tenantId?: string): Promise<Policy[]> {
  try {
    let result
    if (tenantId && tenantId !== 'tenant-default') {
      result = await db.prepare(`
        SELECT * FROM policies 
        WHERE status = 'active' AND (tenant_id = ? OR tenant_id = 'tenant-default')
        ORDER BY priority ASC
      `).bind(tenantId).all()
    } else {
      result = await db.prepare(`
        SELECT * FROM policies WHERE status = 'active' ORDER BY priority ASC
      `).all()
    }
    return (result.results || []) as Policy[]
  } catch {
    return [] // fail-open
  }
}

// ============================================================
// HIGH-LEVEL: checkAccess — load policies and evaluate
// Default: allow if no applicable policy (governance-first, not deny-all)
// ============================================================
export async function checkAccess(
  db: D1Database,
  ctx: AbacContext,
  defaultDecision: 'allow' | 'deny' = 'allow'
): Promise<{ allowed: boolean; decision: AbacDecision; reason: string }> {
  const policies = await loadPolicies(db, ctx.tenant_id)
  const decision = enforceAbac(policies, ctx)

  if (decision === 'not-applicable') {
    return {
      allowed: defaultDecision === 'allow',
      decision: 'not-applicable',
      reason: `No applicable policy found — default: ${defaultDecision}`
    }
  }

  return {
    allowed: decision === 'allow',
    decision,
    reason: `Policy evaluation: ${decision} for ${ctx.subject_type}:${ctx.subject_value} on ${ctx.resource_type}:${ctx.action}`
  }
}

// ============================================================
// CRUD: getAllPolicies
// ============================================================
export async function getAllPolicies(db: D1Database, tenantId?: string): Promise<Policy[]> {
  try {
    let query = `SELECT * FROM policies WHERE 1=1`
    const binds: unknown[] = []
    if (tenantId) { query += ` AND tenant_id = ?`; binds.push(tenantId) }
    query += ` ORDER BY priority ASC, created_at DESC`
    const result = await db.prepare(query).bind(...binds).all()
    return (result.results || []) as Policy[]
  } catch {
    return []
  }
}

export async function getPolicyById(db: D1Database, id: string): Promise<Policy | null> {
  try {
    const result = await db.prepare(`SELECT * FROM policies WHERE id = ?`).bind(id).first()
    return result as Policy | null
  } catch {
    return null
  }
}

export async function createPolicy(
  db: D1Database,
  data: {
    tenant_id?: string
    name: string
    description?: string
    subject_type: Policy['subject_type']
    subject_value: string
    resource_type: string
    resource_filter?: string
    action: string
    effect: 'allow' | 'deny'
    priority?: number
    created_by?: string
  }
): Promise<Policy> {
  const id = 'pol-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO policies
    (id, tenant_id, name, description, subject_type, subject_value, resource_type, resource_filter, action, effect, priority, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).bind(
    id,
    data.tenant_id || 'tenant-default',
    data.name,
    data.description || null,
    data.subject_type,
    data.subject_value,
    data.resource_type,
    data.resource_filter || null,
    data.action,
    data.effect,
    data.priority ?? 100,
    data.created_by || 'user',
    now, now
  ).run()
  return (await getPolicyById(db, id))!
}

export async function updatePolicyStatus(
  db: D1Database,
  id: string,
  status: 'active' | 'inactive'
): Promise<void> {
  await db.prepare(`UPDATE policies SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, new Date().toISOString(), id).run()
}

export async function deletePolicy(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM policies WHERE id = ?`).bind(id).run()
}

// ============================================================
// UI DISPLAY METADATA
// ============================================================
export const SUBJECT_TYPE_OPTIONS = [
  { value: 'role',   label: 'Role (e.g. admin, viewer, operator)' },
  { value: 'user',   label: 'User (specific username)' },
  { value: 'tenant', label: 'Tenant (specific tenant slug)' },
]

export const RESOURCE_TYPE_OPTIONS = [
  { value: '*',           label: '* All Resources' },
  { value: 'approvals',   label: 'Approvals' },
  { value: 'reports',     label: 'Reports' },
  { value: 'connectors',  label: 'Connectors' },
  { value: 'workflows',   label: 'Workflows' },
  { value: 'alerts',      label: 'Alerts' },
  { value: 'tenants',     label: 'Tenants' },
  { value: 'audit',       label: 'Audit Log' },
  { value: 'federation',  label: 'Federation' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'policies',    label: 'Policies' },
  { value: 'alert-rules', label: 'Alert Rules' },
]

export const ACTION_OPTIONS_ABAC = [
  { value: '*',       label: '* All Actions' },
  { value: 'read',    label: 'Read' },
  { value: 'write',   label: 'Write / Create' },
  { value: 'delete',  label: 'Delete' },
  { value: 'approve', label: 'Approve' },
  { value: 'export',  label: 'Export' },
]
