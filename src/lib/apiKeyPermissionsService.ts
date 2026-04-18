// ============================================================
// SOVEREIGN OS PLATFORM — API KEY SCOPED PERMISSIONS (P12)
// Purpose: Link API keys to ABAC policies (scoped permissions)
// Model: api_key_policies join table (api_key_id → policy_ids)
// Integration: abacService, apikeys route
// ============================================================

import { getAllPolicies, enforceAbac, type Policy } from './abacService'

export interface ApiKeyPolicy {
  id: string
  api_key_id: string
  policy_id: string
  assigned_by: string
  created_at: string
  // Joined fields (optional)
  policy_name?: string
  policy_effect?: string
  policy_resource_type?: string
  policy_action?: string
}

// ============================================================
// CRUD: getApiKeyPolicies — get all policies assigned to an API key
// ============================================================
export async function getApiKeyPolicies(db: D1Database, apiKeyId: string): Promise<ApiKeyPolicy[]> {
  try {
    const result = await db.prepare(`
      SELECT akp.*, p.name as policy_name, p.effect as policy_effect,
             p.resource_type as policy_resource_type, p.action as policy_action
      FROM api_key_policies akp
      LEFT JOIN policies p ON p.id = akp.policy_id
      WHERE akp.api_key_id = ?
      ORDER BY akp.created_at DESC
    `).bind(apiKeyId).all()
    return (result.results || []) as ApiKeyPolicy[]
  } catch { return [] }
}

// ============================================================
// CRUD: assignPolicyToApiKey
// ============================================================
export async function assignPolicyToApiKey(
  db: D1Database,
  apiKeyId: string,
  policyId: string,
  assignedBy = 'ui'
): Promise<void> {
  const id = 'akp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT OR IGNORE INTO api_key_policies (id, api_key_id, policy_id, assigned_by, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, apiKeyId, policyId, assignedBy, now).run()
}

// ============================================================
// CRUD: removePolicyFromApiKey
// ============================================================
export async function removePolicyFromApiKey(
  db: D1Database,
  apiKeyId: string,
  policyId: string
): Promise<void> {
  await db.prepare(`
    DELETE FROM api_key_policies WHERE api_key_id = ? AND policy_id = ?
  `).bind(apiKeyId, policyId).run()
}

// ============================================================
// CAPABILITIES: getApiKeyCapabilities — what can this API key do?
// Loads associated policies and returns a capability summary
// ============================================================
export async function getApiKeyCapabilities(
  db: D1Database,
  apiKeyId: string
): Promise<{
  api_key_id: string
  policy_count: number
  capabilities: Array<{
    resource_type: string
    action: string
    effect: 'allow' | 'deny'
    policy_name: string
  }>
  effective_summary: string
}> {
  try {
    const assigned = await getApiKeyPolicies(db, apiKeyId)

    if (assigned.length === 0) {
      return {
        api_key_id: apiKeyId,
        policy_count: 0,
        capabilities: [],
        effective_summary: 'No policies assigned — default platform access (role-based only)'
      }
    }

    const capabilities = assigned.map(akp => ({
      resource_type: akp.policy_resource_type || '*',
      action: akp.policy_action || '*',
      effect: (akp.policy_effect || 'allow') as 'allow' | 'deny',
      policy_name: akp.policy_name || akp.policy_id,
    }))

    const allowCount = capabilities.filter(c => c.effect === 'allow').length
    const denyCount = capabilities.filter(c => c.effect === 'deny').length

    return {
      api_key_id: apiKeyId,
      policy_count: assigned.length,
      capabilities,
      effective_summary: `${allowCount} allow rules, ${denyCount} deny rules across ${assigned.length} policies`
    }
  } catch {
    return {
      api_key_id: apiKeyId,
      policy_count: 0,
      capabilities: [],
      effective_summary: 'Error loading capabilities'
    }
  }
}

// ============================================================
// ABAC CHECK: checkApiKeyAccess — evaluate ABAC for an API key
// Loads assigned policies for this key + evaluates decision
// ============================================================
export async function checkApiKeyAccess(
  db: D1Database,
  apiKeyId: string,
  resourceType: string,
  action: string,
  tenantId?: string
): Promise<{ allowed: boolean; decision: string; reason: string }> {
  try {
    const assigned = await getApiKeyPolicies(db, apiKeyId)
    if (assigned.length === 0) {
      return { allowed: true, decision: 'not-applicable', reason: 'No policies assigned to this API key — default allow' }
    }

    // Load the full policy objects for the assigned policy IDs
    const allPolicies = await getAllPolicies(db, tenantId)
    const assignedIds = new Set(assigned.map(akp => akp.policy_id))
    const keyPolicies = allPolicies.filter((p: Policy) => assignedIds.has(p.id))

    const decision = enforceAbac(keyPolicies, {
      subject_type: 'user',
      subject_value: apiKeyId,
      resource_type: resourceType,
      action,
      tenant_id: tenantId || 'tenant-default'
    })

    return {
      allowed: decision === 'allow' || decision === 'not-applicable',
      decision,
      reason: decision === 'not-applicable'
        ? 'No matching policy for this API key — default allow'
        : `API key policy: ${decision} for ${resourceType}:${action}`
    }
  } catch {
    return { allowed: true, decision: 'error', reason: 'Policy check failed — fail-open' }
  }
}
