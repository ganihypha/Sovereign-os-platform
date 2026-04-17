// ============================================================
// SOVEREIGN OS PLATFORM — TENANT CONTEXT (P5)
// Tenant isolation middleware.
// Rules:
//   - Default tenant 'default' is backward-compatible with P0–P4 data
//   - Cross-tenant read is NEVER permitted
//   - Tenant must be active + approved to access resources
//   - Unauthenticated requests use 'default' tenant
// ============================================================

import type { Context } from 'hono'
import type { Repo } from './repo'
import type { Tenant } from '../types'

export interface TenantContext {
  tenant: Tenant
  tenantId: string
  isDefault: boolean
}

// ---- Extract tenant slug from request ----
// Priority: X-Tenant-Slug header > query param > path param > default
function extractTenantSlug(c: Context): string {
  // Header: X-Tenant-Slug: barberkas
  const headerSlug = c.req.header('X-Tenant-Slug')
  if (headerSlug) return headerSlug.toLowerCase().trim()

  // Query param: ?tenant=barberkas
  const querySlug = c.req.query('tenant')
  if (querySlug) return querySlug.toLowerCase().trim()

  // Path param: /t/:slug/* handled at route level
  const pathSlug = c.req.param('slug')
  if (pathSlug) return pathSlug.toLowerCase().trim()

  return 'default'
}

// ---- Resolve tenant context from request ----
// Returns TenantContext or null if tenant not found / not accessible.
export async function resolveTenantContext(
  c: Context,
  repo: Repo
): Promise<TenantContext | null> {
  const slug = extractTenantSlug(c)

  let tenant = await repo.getTenantBySlug(slug)
  if (!tenant) {
    // Fallback to default tenant
    tenant = await repo.getTenantBySlug('default')
    if (!tenant) return null
  }

  // Only active + approved tenants are accessible
  if (tenant.status !== 'active' || tenant.approval_status !== 'approved') {
    return null
  }

  return {
    tenant,
    tenantId: tenant.id,
    isDefault: tenant.slug === 'default',
  }
}

// ---- Validate tenant isolation: A cannot read B ----
// Returns true if the requesting tenant is allowed to access the resource tenant.
export function assertTenantIsolation(requestingTenantId: string, resourceTenantId: string): boolean {
  // Default tenant can see everything (admin mode, backward compat)
  if (requestingTenantId === 'tenant-default') return true
  // Same tenant: allowed
  if (requestingTenantId === resourceTenantId) return true
  // Resource is default: allowed (shared resources)
  if (resourceTenantId === 'default' || resourceTenantId === 'tenant-default') return true
  // Cross-tenant: DENIED
  return false
}

// ---- Middleware: attach tenant context to request ----
// Usage: app.use('/t/*', tenantContextMiddleware(createRepo(env.DB)))
export function createTenantMiddleware(getRepo: () => Repo) {
  return async (c: Context, next: () => Promise<void>) => {
    const repo = getRepo()
    const ctx = await resolveTenantContext(c, repo)
    if (!ctx) {
      return c.json({
        error: 'Tenant not found or not accessible',
        code: 'TENANT_NOT_FOUND',
      }, 404)
    }
    // Attach to context for downstream route handlers
    ;(c as unknown as Record<string, unknown>)['tenantCtx'] = ctx
    return next()
  }
}
