// ============================================================
// SOVEREIGN OS PLATFORM — MAIN ENTRY (P16 — Platform UX Overhaul, Search Enhancements, Dashboard Live Stats, Audit Detail View, Metrics, Notification Bell)
// Version: 1.6.0-P16
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

// Route imports — P7 new surfaces
import { createSsoRoute } from './routes/sso'
import { createBrandingRoute } from './routes/branding'

// Route imports — P8 new surfaces
import { createFederationRoute } from './routes/federation'
import { createMarketplaceRoute } from './routes/marketplace'
import { createAuditRoute } from './routes/audit'

// Route imports — P9 new surfaces
import { notificationsRoute } from './routes/notifications'
import { workflowsRoute } from './routes/workflows'
import { healthDashboardRoute } from './routes/healthDashboard'
import { portalRoute } from './routes/portal'

// Route imports — P10 new surfaces
import { createApiV2Route } from './routes/apiv2'
import { createPoliciesRoute } from './routes/policies'
import { createAlertRulesRoute } from './routes/alertRules'

// Route imports — P11 new surfaces
import { createRemediationRoute } from './routes/remediation'
import { createEventsRoute } from './routes/events'
import { createDocsRoute } from './routes/docs'

// Route imports — P12 new surfaces
import { createReportSubscriptionsRoute } from './routes/reportSubscriptions'

// Route import — P15 new surfaces
import { createSearchRoute } from './routes/search'

// Route imports — P16 new surfaces
import { createMetricsRoute } from './routes/metrics'

// Route imports — P17 new surfaces
import { createAdminRoute } from './routes/admin'

export type Env = {
  DB?: D1Database
  RATE_LIMITER_KV?: KVNamespace   // P6: KV-backed distributed rate limiter (optional — falls back to in-memory)
  PLATFORM_API_KEY?: string
  OPENAI_API_KEY?: string         // P5: optional — graceful degradation if missing
  RESEND_API_KEY?: string         // P7: optional — email delivery (graceful degradation)
  SENDGRID_API_KEY?: string       // P7: optional — email delivery fallback
  AUTH0_CLIENT_SECRET?: string    // P7: optional — SSO Auth0 (never logged/returned)
  CLERK_SECRET_KEY?: string       // P7: optional — SSO Clerk (never logged/returned)
  // P8: no new required secrets. OPENAI_API_KEY already handles anomaly detection.
  // P9: no new required secrets. SSE, workflows, portal, health-dashboard use existing bindings.
  // P10: no new required secrets. ABAC, alert rules, API v2, reports use existing D1 + KV.
  // P11: no new required secrets. Remediation, events, docs use existing D1 + KV.
  // P12: no new required secrets. ABAC middleware, report subscriptions, webhook queue, API key permissions use existing D1 + KV.
  // P15: no new required secrets. Search, notification rules, audit export jobs, delivery log use existing D1 + KV.
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

// P7: SSO / OAuth2 Integration
app.route('/auth/sso', createSsoRoute())

// P7: Tenant White-Label Branding
app.route('/branding', createBrandingRoute())

// P8: Federation Registry (cross-tenant governance)
app.route('/federation', createFederationRoute())

// P8: Connector Marketplace (governed publishing)
app.route('/marketplace', createMarketplaceRoute())

// P8: Immutable Audit Trail with SHA-256 event hashing
app.route('/audit', createAuditRoute())

// P9: Real-time Notifications (SSE + polling fallback)
app.route('/notifications', notificationsRoute)

// P9: Advanced Workflow Automation (trigger chains)
app.route('/workflows', workflowsRoute)

// P9: Platform Health Dashboard (all 33 surfaces + SLA)
app.route('/health-dashboard', healthDashboardRoute)

// P9: Tenant Self-Service Portal
app.route('/portal', portalRoute)

// P10: API v2 — structured REST layer
// IMPORTANT: mount BEFORE the /api/* auth middleware to allow public access with rate limiting
app.route('/api/v2', createApiV2Route())

// P10: ABAC Policy Editor
app.route('/policies', createPoliciesRoute())

// P10: Alert Rules Engine
app.route('/alert-rules', createAlertRulesRoute())

// P11: Auto-Remediation Playbooks
app.route('/remediation', createRemediationRoute())

// P11: Unified Platform Event Bus
app.route('/events', createEventsRoute())

// P11: Developer Documentation & SDK Guide
app.route('/docs', createDocsRoute())

// P12: Report Subscriptions (scheduled snapshots)
app.route('/reports/subscriptions', createReportSubscriptionsRoute())

// P15: Platform-wide unified search
app.route('/search', createSearchRoute())

// P16: Platform metrics surface
app.route('/metrics', createMetricsRoute())

// P17: Platform admin panel
app.route('/admin', createAdminRoute())

// P6: Tenant namespace path routing — /t/:slug/*
// P7: Injects tenant branding CSS into routing context
// P14: Tenant ABAC enforcement for mutation paths
app.use('/t/:slug/*', async (c, next) => {
  const { createRepo } = await import('./lib/repo')
  const { createTenantMiddleware } = await import('./lib/tenantContext')
  const repo = createRepo(c.env.DB)
  const middleware = createTenantMiddleware(() => repo)
  return middleware(c, next)
})
// P14: Inject tenant ABAC middleware for POST/DELETE/PATCH mutations on /t/:slug/*
app.use('/t/:slug/*', async (c, next) => {
  const { createTenantAbacMiddleware } = await import('./lib/abacMiddleware')
  const tenantAbac = createTenantAbacMiddleware()
  return tenantAbac(c, next)
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
  const allowed = ['dashboard','intent','intake','architect','approvals','proof','live','records','continuity','execution','connectors','roles','workspace','alerts','canon','lanes','onboarding','reports','branding','sso']
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
    version: '1.8.0-P18',
    phase: 'P18 — UI/UX Upgrade, Nav Reorganization, Workflow History, Performance, Bug Fixes',
    persistence: repo.isPersistent ? 'd1' : 'in-memory',
    auth_configured: !!c.env.PLATFORM_API_KEY,
    kv_rate_limiter: !!c.env.RATE_LIMITER_KV ? 'kv-enforced' : 'in-memory-partial',
    email_delivery: !!(c.env.RESEND_API_KEY || c.env.SENDGRID_API_KEY) ? 'configured' : 'not-configured',
    sso: !!(c.env.AUTH0_CLIENT_SECRET || c.env.CLERK_SECRET_KEY) ? 'configured' : 'not-configured',
    ai_assist: !!c.env.OPENAI_API_KEY ? 'configured' : 'not-configured',
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
      version: '1.8.0-P18',
      phase: 'P18 — UI/UX Upgrade, Nav Reorganization, Workflow History, Performance, Bug Fixes',
      persistence: repo.isPersistent ? 'd1-persistent' : 'in-memory-ephemeral',
      auth_configured: !!c.env.PLATFORM_API_KEY,
      kv_rate_limiter: !!c.env.RATE_LIMITER_KV ? 'kv-enforced' : 'in-memory-partial',
      email_delivery: !!(c.env.RESEND_API_KEY || c.env.SENDGRID_API_KEY) ? 'configured' : 'not-configured',
      sso: !!(c.env.AUTH0_CLIENT_SECRET || c.env.CLERK_SECRET_KEY) ? 'configured' : 'not-configured',
      ai_assist: !!c.env.OPENAI_API_KEY ? 'configured' : 'not-configured',
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
        sso: 'active',             // P7 — /auth/sso
        branding: 'active',        // P7 — /branding
        federation: 'active',      // P8 — /federation
        marketplace: 'active',     // P8 — /marketplace
        audit: 'active',           // P8 — /audit
        notifications: 'active',   // P9 — /notifications
        workflows: 'active',       // P9 — /workflows
        health_dashboard: 'active',// P9 — /health-dashboard
        portal: 'active',          // P9 — /portal/:slug
        api_v2: 'active',          // P10 — /api/v2
        policies: 'active',        // P10 — /policies
        alert_rules: 'active',     // P10 — /alert-rules
        remediation: 'active',     // P11 — /remediation
        events: 'active',          // P11 — /events
        docs: 'active',            // P11 — /docs
        policies_simulate: 'active', // P11 — /policies/simulate
        report_subscriptions: 'active', // P12 — /reports/subscriptions
        search: 'active',          // P15 — /search
        metrics: 'active',         // P16 — /metrics
        audit_detail: 'active',    // P16 — /audit/:id
        audit_search: 'active',    // P16 — /audit/search
        notification_bell: 'active', // P16 — bell badge in header
        dark_mode: 'active',       // P16 — localStorage dark mode toggle
        collapsible_sidebar: 'active', // P16 — collapsible nav groups
        abac_middleware: 'active',       // P12 — ABAC HTTP enforcement
        webhook_queue: 'active',         // P12 — webhook delivery queue
        api_key_permissions: 'active',   // P12 — API key scoped permissions
        event_bus_integration: 'active', // P12 — event emission from surfaces
        abac_aware_ui: 'active',         // P13 — ABAC-aware UI (disabled buttons)
        event_archive: 'active',         // P13 — event auto-archive + retention
        api_key_policy_ui: 'active',     // P13 — API key policy assignment UI
        health_dashboard_p13: 'active',  // P13 — ABAC/webhook/subscription stats
        tenant_abac: 'active',           // P13 — tenant-scoped ABAC policies
        policies_simulate_ui: 'active',  // P13 — /policies#simulate interactive form
        // P17 new surfaces
        notification_preferences: 'active', // P17 — /notifications/preferences
        notification_bulk_ops: 'active',    // P17 — /notifications/bulk
        audit_pagination_deeplinks: 'active', // P17 — /audit?page=N deep links
        metrics_snapshots: 'active',        // P17 — /metrics/snapshots
        metrics_autorefresh: 'active',      // P17 — auto-refresh toggle
        admin_panel: 'active',              // P17 — /admin
        admin_settings: 'active',           // P17 — /admin/settings
        admin_sessions: 'active',           // P17 — /admin/sessions
        admin_api_key_rotation: 'active',   // P17 — /admin/api-keys
        search_analytics: 'active',         // P17 — /search/analytics
        search_bookmarks: 'active',         // P17 — localStorage bookmarks
        audit_search_daterange: 'active',   // P17 — /audit/search date+sort filters
        // P18 new surfaces
        workflow_run_history: 'active',     // P18 — /workflows/history
        nav_reorganization: 'active',       // P18 — merged nav groups (8 contextual)
        page_transition_loader: 'active',   // P18 — NProgress-style loading bar
        nav_filter_search: 'active',        // P18 — live filter in sidebar nav
        policies_simulate_fix: 'active',    // P18 — fixed CF dynamic import error
        apiv1_root_fix: 'active',           // P18 — fixed /api/v1 root 500
        skip_to_content: 'active',          // P18 — accessibility skip link
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
      version: '1.6.0-P16',
      error: 'Could not read platform state',
      persistence: 'unknown',
      timestamp: new Date().toISOString(),
    }, 503)
  }
})

export default app
