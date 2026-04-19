// ============================================================
// SOVEREIGN OS PLATFORM — ABAC HTTP MIDDLEWARE (P12+P13+P14)
// P13: Log deny events to abac_deny_log for analytics
// P14: Tenant-aware ABAC enforcement for /t/:slug/* paths
//      Wire ABAC deny → platform notification (P14)
// ============================================================

import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { checkAccess, type AbacContext } from './abacService'
import { logAbacDeny } from './abacUiService'
import { notifyAbacDeny } from './platformNotificationService'

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
        // P13: Log denial for analytics
        logAbacDeny(c.env.DB, {
          surface: resourceType,
          resource_type: resourceType,
          action,
          subject_role: subjectValue,
          tenant_id: tenantId
        }).catch(() => {})

        // P14: Emit platform notification for ABAC deny
        notifyAbacDeny(c.env.DB, {
          surface: resourceType,
          resource_type: resourceType,
          action,
          subject_role: subjectValue,
          tenant_id: tenantId
        }).catch(() => {})

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
// P14: createTenantAbacMiddleware — tenant-scoped ABAC enforcement
// For /t/:slug/* paths: load tenant policies + enforce alongside role policies
// ============================================================
export function createTenantAbacMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Fail-open if no DB
    if (!c.env.DB) return next()

    // Only enforce POST/DELETE/PATCH (mutations) — GETs are read-only, pass through
    const method = c.req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next()

    // Extract tenant slug from path /t/:slug/*
    const pathParts = new URL(c.req.url).pathname.split('/')
    const slug = pathParts[2] // /t/:slug/...

    if (!slug) return next()

    // Resolve tenant_id from slug
    let tenantId: string | null = null
    try {
      const tenant = await c.env.DB.prepare(
        `SELECT id FROM tenants WHERE slug = ?`
      ).bind(slug).first<{ id: string }>()
      tenantId = tenant?.id || null
    } catch { /* fail-open */ }

    if (!tenantId) return next()

    // Get role from header (default: viewer for unauthenticated)
    const role = c.req.header('X-Platform-Role') ?? 'viewer'

    // Determine surface from path
    const surface = pathParts[3] || 'dashboard'

    const ctx: AbacContext = {
      subject_type: 'role',
      subject_value: role,
      resource_type: surface,
      action: 'write',
      tenant_id: tenantId
    }

    try {
      const result = await checkAccess(c.env.DB, ctx, 'allow')

      if (!result.allowed) {
        // Log denial
        logAbacDeny(c.env.DB, {
          surface: `tenant:${slug}:${surface}`,
          resource_type: surface,
          action: 'write',
          subject_role: role,
          tenant_id: tenantId
        }).catch(() => {})

        return c.json(
          {
            error: 'Access denied',
            decision: result.decision,
            reason: result.reason,
            tenant_slug: slug,
            tenant_id: tenantId,
            resource: surface,
            action: 'write',
            subject: `role:${role}`,
            audit_tag: 'tenant.abac.write.denied'
          },
          403
        )
      }
    } catch {
      // Fail-open
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
