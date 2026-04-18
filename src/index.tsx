// ============================================================
// SOVEREIGN OS PLATFORM — MAIN ENTRY (P6 — ADVANCED INTEGRATION & OBSERVABILITY)
// Version: 0.6.0-P6
// Platform: Cloudflare Pages + Workers
// Hono Framework — Edge-first
// ============================================================
import { Hono } from 'hono'
import { createRepo } from './lib/repo'
import {
  requireAuth, requireApiAuth,
  handleAuthLogin, handleAuthLogout, authStatusBadge, isAuthenticated
} from './lib/auth'

// Route imports — P0-P3 surfaces (preserved, no regression)
import { createDashboardRoute } from './routes/dashboard'
import { createIntentRoute } from './routes/intent'
import { createIntakeRoute } from './routes/intake'
import { createArchitectRoute } from './routes/architect'
import { createApprovalsRoute } from './routes/approvals'
import { createProofRoute } from './routes/proof'
import { createLiveRoute } from './routes/live'
import { createRecordsRoute } from './routes/records'
import { createApiRoute } from './routes/api'
import { createContinuityRoute } from './routes/continuity'
import { createExecutionRoute } from './routes/execution'
import { createConnectorsRoute } from './routes/connectors'

// Route imports — P4 new surfaces
import { createWorkspaceRoute } from './routes/workspace'
import { createAlertsRoute } from './routes/alerts'
import { createCanonRoute } from './routes/canon'
import { createLanesRoute } from './routes/lanes'
import { createOnboardingRoute } from './routes/onboarding'
import { createReportsRoute } from './routes/reports'

// Route imports — P5 new surfaces
import { createTenantsRoute } from './routes/tenants'
import { createAiAssistRoute } from './routes/aiassist'
import { createApiKeysRoute } from './routes/apikeys'
import { createApiV1Route } from './routes/apiv1'

// Route import — P3 Roles Registry
import { createRolesRoute } from './routes/roles'

export type Env = {
  DB?: D1Database
  RATE_LIMITER_KV?: KVNamespace   // P6: KV-backed distributed rate limiter (optional — falls back to in-memory)
  PLATFORM_API_KEY?: string
  OPENAI_API_KEY?: string         // P5: optional — graceful degradation if missing
}

const app = new Hono<{ Bindings: Env }>()

// ============================================================
// AUTH ROUTES (before any middleware)
// ============================================================
app.post('/auth/login', async (c) => {
  return handleAuthLogin(c.env)(c)
})
app.post('/auth/logout', handleAuthLogout())

// ============================================================
// ROUTES — inject repo + auth context into each sub-app
// ============================================================

// Middleware: attach repo to all routes
app.use('*', async (c, next) => {
  // Repo is created per-request with D1 binding (or fallback to mem)
  ;(c as unknown as Record<string, unknown>)['repo'] = createRepo(c.env.DB)
  return next()
})

// Page routes — GET always open for read, POST gated by requireAuth
app.route('/dashboard', createDashboardRoute())
app.route('/intent', createIntentRoute())
app.route('/intake', createIntakeRoute())
app.route('/architect', createArchitectRoute())
app.route('/approvals', createApprovalsRoute())
app.route('/proof', createProofRoute())
app.route('/live', createLiveRoute())
app.route('/records', createRecordsRoute())

// P2: Continuity surface
app.route('/continuity', createContinuityRoute())

// P3: Execution Board + Connector Hub
app.route('/execution', createExecutionRoute())
app.route('/connectors', createConnectorsRoute())

// P3: Role Registry
app.route('/roles', createRolesRoute())

// P4: Role Workspaces
app.route('/workspace', createWorkspaceRoute())
app.route('/w', createWorkspaceRoute())

// P4: Alerts
app.route('/alerts', createAlertsRoute())

// P4: Canon Promotion
app.route('/canon', createCanonRoute())

// P4: Lane Directory
app.route('/lanes', createLanesRoute())

// P4: Onboarding
app.route('/onboarding', createOnboardingRoute())

// P4: Reports
app.route('/reports', createReportsRoute())

// P5: Multi-Tenant Registry
app.route('/tenants', createTenantsRoute())

// P5: AI Orchestration Assist
app.route('/ai-assist', createAiAssistRoute())

// P5: Public API Key Management
app.route('/api-keys', createApiKeysRoute())

// P5: Public API Gateway v1 (no auth middleware needed — handled internally)
app.route('/api/v1', createApiV1Route())

// P6: Tenant namespace path routing — /t/:slug/*
// createTenantMiddleware resolves tenant context from path slug
// All /t/:slug/* requests are routed to the standard surfaces with tenant context injected
app.use('/t/:slug/*', async (c, next) => {
  const { createRepo } = await import('./lib/repo')
  const { createTenantMiddleware } = await import('./lib/tenantContext')
  const repo = createRepo(c.env.DB)
  const middleware = createTenantMiddleware(() => repo)
  return middleware(c, next)
})
app.get('/t/:slug', (c) => {
  const slug = c.req.param('slug')
  return c.redirect(`/t/${slug}/dashboard`)
})
app.get('/t/:slug/dashboard', async (c) => {
  const slug = c.req.param('slug')
  const { createRepo } = await import('./lib/repo')
  const repo = createRepo(c.env.DB)
  const tenant = await repo.getTenantBySlug(slug)
  if (!tenant || tenant.status !== 'active' || tenant.approval_status !== 'approved') {
    return c.html(`<!DOCTYPE html><html><head><title>Tenant Not Found</title></head><body style="font-family:monospace;background:#0d0f14;color:#e2e8f0;padding:40px"><h2>Tenant Not Found</h2><p>Slug: <code>${slug}</code> — not found or not active.</p><a href="/tenants" style="color:#4f8ef7">← Tenant Registry</a></body></html>`, 404)
  }
  return c.redirect(`/dashboard?tenant=${slug}`)
})
app.get('/t/:slug/:surface', (c) => {
  const slug = c.req.param('slug')
  const surface = c.req.param('surface')
  const allowed = ['dashboard','intent','intake','architect','approvals','proof','live','records','continuity','execution','connectors','roles','workspace','alerts','canon','lanes','onboarding','reports']
  if (!allowed.includes(surface)) {
    return c.json({ error: 'Unknown surface', tenant: slug, surface }, 404)
  }
  return c.redirect(`/${surface}?tenant=${slug}`)
})

// Internal API routes — apply requireApiAuth middleware
app.use('/api/*', async (c, next) => {
  const authMiddleware = requireApiAuth(c.env)
  return authMiddleware(c, next)
})
app.route('/api', createApiRoute())

// ---- Root → Dashboard ----
app.get('/', (c) => c.redirect('/dashboard'))

// ============================================================
// HEALTH & STATUS ROUTES (P2.5 — Production Hardening)
// These are unauthenticated — provide platform status only,
// never expose secrets or key values.
// ============================================================

// /health — lightweight health check (suitable for uptime monitors)
app.get('/health', (c) => {
  const repo = createRepo(c.env.DB)
  return c.json({
    status: 'ok',
    platform: 'Sovereign OS Platform',
    version: '0.6.0-P6',
    phase: 'P6 — Advanced Integration & Observability',
    persistence: repo.isPersistent ? 'd1' : 'in-memory',
    auth_configured: !!c.env.PLATFORM_API_KEY,
    kv_rate_limiter: !!c.env.RATE_LIMITER_KV ? 'kv-enforced' : 'in-memory-partial',
    timestamp: new Date().toISOString(),
  })
})

// /status — extended platform status (mirrors P1 /api/status but unauthenticated read)
app.get('/status', async (c) => {
  const repo = createRepo(c.env.DB)
  try {
    const [sessions, approvals, priorities, proofs] = await Promise.all([
      repo.getSessions(),
      repo.getApprovalRequests(),
      repo.getPriorityItems(),
      repo.getProofArtifacts(),
    ])
    return c.json({
      status: 'operational',
      platform: 'Sovereign OS Platform',
      version: '0.6.0-P6',
      phase: 'P6 — Advanced Integration & Observability',
      persistence: repo.isPersistent ? 'd1-persistent' : 'in-memory-ephemeral',
      auth_configured: !!c.env.PLATFORM_API_KEY,
      kv_rate_limiter: !!c.env.RATE_LIMITER_KV ? 'kv-enforced' : 'in-memory-partial',
      surfaces: {
        dashboard: 'active',
        intent: 'active',
        intake: 'active',
        architect: 'active',
        approvals: 'active',
        proof: 'active',
        live: 'active',
        records: 'active',
        continuity: 'active',
        execution: 'active',    // P3
        connectors: 'active',  // P3
        roles: 'active',       // P3
        workspace: 'active',   // P4
        alerts: 'active',      // P4
        canon: 'active',       // P4
        lanes: 'active',       // P4
        onboarding: 'active',  // P4
        reports: 'active',     // P4
        tenants: 'active',          // P5
        ai_assist: 'active',       // P5
        api_keys: 'active',        // P5
        api_v1: 'active',          // P5
        api: 'active',
        tenant_routing: 'active',  // P6 — /t/:slug/* path routing
      },
      counts: {
        sessions: sessions.length,
        active_sessions: sessions.filter(s => s.status === 'active').length,
        pending_approvals: approvals.filter(a => a.status === 'pending').length,
        active_blockers: priorities.filter(p => p.blocker && !p.resolved).length,
        proof_artifacts: proofs.length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (_e) {
    return c.json({
      status: 'degraded',
      platform: 'Sovereign OS Platform',
      version: '0.6.0-P6',
      error: 'Could not read platform state',
      persistence: 'unknown',
      timestamp: new Date().toISOString(),
    }, 503)
  }
})

export default app
