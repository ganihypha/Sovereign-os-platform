// ============================================================
// SOVEREIGN OS PLATFORM — ABAC HTTP MIDDLEWARE (P12)
// Purpose: Wire abacService.checkAccess() as Hono middleware
//          on sensitive POST routes.
// Returns 403 JSON when access denied:
//   { "error": "Access denied", "decision": "deny", "reason": "..." }
// Default: fail-open (allow) if no applicable policy found
// Non-blocking on DB error (edge-safe)
// ============================================================

import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { checkAccess, type AbacContext } from './abacService'

// ============================================================
// createAbacMiddleware — factory for route-specific ABAC guard
// Usage:
//   route.post('/approve', createAbacMiddleware('approvals', 'approve'), handler)
// ============================================================
export function createAbacMiddleware(
  resourceType: string,
  action: string,
  options: {
    subjectType?: 'role' | 'user' | 'tenant'
    defaultDecision?: 'allow' | 'deny'
    auditTag?: string
  } = {}
) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Skip enforcement if no DB (local dev without D1)
    if (!c.env.DB) return next()

    // Extract subject from request context
    // Try to resolve role from cookie/session header or fall back to 'anonymous'
    const roleHeader = c.req.header('X-Platform-Role')
    const userHeader = c.req.header('X-Platform-User')
    const tenantHeader = c.req.header('X-Platform-Tenant')

    // Determine subject type and value
    const subjectType = options.subjectType ?? 'role'
    let subjectValue = 'anonymous'
    if (subjectType === 'role') {
      subjectValue = roleHeader ?? 'viewer'
    } else if (subjectType === 'user') {
      subjectValue = userHeader ?? 'anonymous'
    } else if (subjectType === 'tenant') {
      subjectValue = tenantHeader ?? 'tenant-default'
    }

    const tenantId = tenantHeader ?? 'tenant-default'

    const ctx: AbacContext = {
      subject_type: subjectType,
      subject_value: subjectValue,
      resource_type: resourceType,
      action,
      tenant_id: tenantId
    }

    try {
      const result = await checkAccess(
        c.env.DB,
        ctx,
        options.defaultDecision ?? 'allow'
      )

      if (!result.allowed) {
        return c.json(
          {
            error: 'Access denied',
            decision: result.decision,
            reason: result.reason,
            resource: resourceType,
            action,
            subject: `${subjectType}:${subjectValue}`,
            ...(options.auditTag ? { audit_tag: options.auditTag } : {})
          },
          403
        )
      }
    } catch {
      // Fail-open on any error (edge-safe, non-blocking)
    }

    return next()
  }
}

// ============================================================
// Convenience pre-configured middlewares for P12 target routes
// ============================================================

/** Guard: POST /approvals/:id/approve — requires 'approve' on 'approvals' */
export const abacGuardApprove = createAbacMiddleware('approvals', 'approve', {
  auditTag: 'approvals.approve'
})

/** Guard: POST /canon — requires 'write' on 'approvals' (canon promotion) */
export const abacGuardCanonPromote = createAbacMiddleware('approvals', 'approve', {
  auditTag: 'canon.promote'
})

/** Guard: POST /policies — requires 'write' on 'policies' */
export const abacGuardPoliciesWrite = createAbacMiddleware('policies', 'write', {
  auditTag: 'policies.write'
})

/** Guard: POST /alert-rules — requires 'write' on 'alert-rules' */
export const abacGuardAlertRulesWrite = createAbacMiddleware('alert-rules', 'write', {
  auditTag: 'alert-rules.write'
})

/** Guard: POST /api/v2/* write operations — general write guard */
export const abacGuardApiV2Write = createAbacMiddleware('approvals', 'write', {
  auditTag: 'api.v2.write'
})
