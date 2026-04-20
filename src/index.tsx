// ============================================================
// SOVEREIGN OS PLATFORM — MAIN ENTRY (P22 — Layout Refactor, Version Consistency, D1 Verification, Perf Observability)
// Version: 2.0.0-P22
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

// Route imports — P19 new surfaces
import { createChangelogRoute } from './routes/changelog'

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
  return handleAuthLogin({ PLATFORM_API_KEY: c.env.PLATFORM_API_KEY, DB: c.env.DB })(c)
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

// P19: Platform changelog
app.route('/changelog', createChangelogRoute())

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

// ============================================================
// P22: LIGHTWEIGHT PERF METRICS ENDPOINT — registered BEFORE /api/* auth middleware
// POST /api/perf — receives client navigation timing, stores to D1 perf_metrics.
// No auth required: fire-and-forget beacon from layout-client.ts (sendBeacon).
// Non-critical: silently discards if D1 unavailable (in-memory mode).
// ============================================================
app.post('/api/perf', async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body.page !== 'string') return c.json({ ok: false }, 400)
    const db = c.env?.DB
    // Silently succeed when no D1 binding (in-memory mode / local without --d1 flag)
    if (db) {
      try {
        const id = crypto.randomUUID()
        const { page, ttfb, dom_ready, load } = body
        await Promise.allSettled([
          db.prepare(`INSERT OR IGNORE INTO perf_metrics (id, metric_name, value, page_path) VALUES (?,?,?,?)`)
            .bind(id + '-ttfb', 'ttfb', Number(ttfb) || 0, page).run(),
          db.prepare(`INSERT OR IGNORE INTO perf_metrics (id, metric_name, value, page_path) VALUES (?,?,?,?)`)
            .bind(id + '-dom', 'dom_ready', Number(dom_ready) || 0, page).run(),
          db.prepare(`INSERT OR IGNORE INTO perf_metrics (id, metric_name, value, page_path) VALUES (?,?,?,?)`)
            .bind(id + '-load', 'load', Number(load) || 0, page).run(),
        ])
      } catch (_dbErr) { /* D1 write failed — non-critical, discard */ }
    }
    return c.json({ ok: true })
  } catch (_e) {
    // Always return 200 for perf beacon — client doesn't care about errors
    return c.json({ ok: false })
  }
})

// Internal API routes — apply requireApiAuth middleware (registered AFTER /api/perf to exempt it)
app.use('/api/*', async (c, next) => {
  const authMiddleware = requireApiAuth(c.env)
  return authMiddleware(c, next)
})
app.route('/api', createApiRoute())

// ---- Root → Dashboard ----
app.get('/', (c) => c.redirect('/dashboard'))
// These are unauthenticated — provide platform status only,
// never expose secrets or key values.
// ============================================================

// /health — lightweight health check (suitable for uptime monitors)
app.get('/health', (c) => {
  const repo = createRepo(c.env.DB)
  return c.json({
    status: 'ok',
    platform: 'Sovereign OS Platform',
    version: '2.0.0-P22',
    phase: 'P22 — Layout Refactor, Version Consistency, D1 Verification, Perf Observability',
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
      version: '2.0.0-P22',
      phase: 'P22 — Layout Refactor, Version Consistency, D1 Verification, Perf Observability',
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
        // P19 new surfaces
        changelog: 'active',                // P19 — /changelog
        custom_404: 'active',               // P19 — branded 404 page
        custom_500: 'active',               // P19 — branded 500 error handler
        session_tracking: 'active',         // P19 — platform_sessions write on login
        email_service: 'active',            // P19 — emailService.ts Resend wrapper
        email_log: 'active',                // P19 — email_log D1 table
        error_log: 'active',                // P19 — error_log D1 table
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
      version: '2.0.0-P22',
      error: 'Could not read platform state',
      persistence: 'unknown',
      timestamp: new Date().toISOString(),
    }, 503)
  }
})

// ============================================================
// P19: CUSTOM 404 / 500 ERROR PAGES (branded)
// ============================================================

// ---- Branded 404 page ----
function page404(path: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 — Page Not Found | Sovereign OS Platform</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0c10;color:#e8eaf0;font-family:'Inter',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .container{max-width:520px;width:100%;text-align:center}
    .code{font-size:96px;font-weight:800;line-height:1;
      background:linear-gradient(135deg,#4f8ef7,#8b5cf6);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .title{font-size:22px;font-weight:600;color:#e8eaf0;margin:12px 0 8px}
    .sub{font-size:14px;color:#6b7890;line-height:1.6;margin-bottom:8px}
    .path{font-family:'JetBrains Mono',monospace;font-size:12px;
      background:#111318;border:1px solid #232830;border-radius:4px;
      padding:6px 12px;display:inline-block;color:#94a3b8;margin-bottom:32px}
    .actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    .btn{padding:10px 22px;border-radius:6px;font-size:14px;font-weight:600;
      text-decoration:none;display:inline-block;transition:opacity 0.2s}
    .btn-primary{background:#4f8ef7;color:#fff}
    .btn-primary:hover{opacity:0.85}
    .btn-ghost{background:transparent;color:#4f8ef7;border:1px solid #4f8ef7}
    .btn-ghost:hover{background:rgba(79,142,247,0.1)}
    .logo{font-size:11px;font-weight:700;letter-spacing:2px;color:#4f8ef7;
      text-transform:uppercase;margin-bottom:32px;opacity:0.7}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⬡ Sovereign OS Platform</div>
    <div class="code">404</div>
    <h1 class="title">Page Not Found</h1>
    <p class="sub">The surface you're looking for doesn't exist or has been moved.</p>
    <div class="path">${path}</div>
    <div class="actions">
      <a href="/dashboard" class="btn btn-primary">⬡ Dashboard</a>
      <a href="/status" class="btn btn-ghost">Status</a>
    </div>
  </div>
</body>
</html>`
}

// ---- Branded 500 page ----
function page500(path: string, errMsg: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>500 — Internal Error | Sovereign OS Platform</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0c10;color:#e8eaf0;font-family:'Inter',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .container{max-width:520px;width:100%;text-align:center}
    .code{font-size:96px;font-weight:800;line-height:1;
      background:linear-gradient(135deg,#ef4444,#f59e0b);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .title{font-size:22px;font-weight:600;color:#e8eaf0;margin:12px 0 8px}
    .sub{font-size:14px;color:#6b7890;line-height:1.6;margin-bottom:8px}
    .err{font-family:'JetBrains Mono',monospace;font-size:12px;
      background:#111318;border:1px solid rgba(239,68,68,0.3);border-radius:4px;
      padding:8px 14px;display:inline-block;color:#ef4444;margin-bottom:32px;
      max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
    .btn{padding:10px 22px;border-radius:6px;font-size:14px;font-weight:600;
      text-decoration:none;display:inline-block;transition:opacity 0.2s}
    .btn-primary{background:#4f8ef7;color:#fff}
    .btn-primary:hover{opacity:0.85}
    .btn-ghost{background:transparent;color:#4f8ef7;border:1px solid #4f8ef7}
    .btn-ghost:hover{background:rgba(79,142,247,0.1)}
    .logo{font-size:11px;font-weight:700;letter-spacing:2px;color:#ef4444;
      text-transform:uppercase;margin-bottom:32px;opacity:0.7}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⬡ Sovereign OS Platform</div>
    <div class="code">500</div>
    <h1 class="title">Internal Server Error</h1>
    <p class="sub">Something went wrong processing your request. The platform team has been notified.</p>
    <div class="err">${errMsg ? errMsg.substring(0, 120) : 'Internal error'}</div>
    <div class="actions">
      <a href="/dashboard" class="btn btn-primary">⬡ Dashboard</a>
      <a href="/health" class="btn btn-ghost">Health Check</a>
    </div>
  </div>
</body>
</html>`
}

// P19: Custom 404 catch-all — MUST be last route
// Note: app.get('*') catches unmatched GET routes before notFound handler
app.all('*', (c) => {
  const path = c.req.path || '/'
  if (path.startsWith('/api/')) {
    return c.json({ error: 'NOT_FOUND', message: `No route found for ${c.req.method} ${path}` }, 404)
  }
  return c.html(page404(path), 404)
})

app.notFound((c) => {
  const path = c.req.path || '/'
  if (path.startsWith('/api/')) {
    return c.json({ error: 'NOT_FOUND', message: `No route found for ${c.req.method} ${path}` }, 404)
  }
  return c.html(page404(path), 404)
})

// P19: Custom 500 error handler
app.onError((err, c) => {
  const path = c.req.path || '/'
  const errMsg = err instanceof Error ? err.message : 'Unknown error'
  // Log to error_log D1 (fire-and-catch)
  try {
    if (c.env.DB) {
      c.env.DB.prepare(
        `INSERT INTO error_log (path, method, status_code, error_message, stack_hint) VALUES (?, ?, 500, ?, ?)`
      ).bind(path, c.req.method, errMsg, err instanceof Error ? (err.stack || '').substring(0, 200) : '').run().catch(() => {})
    }
  } catch (_e) { /* never throw */ }
  // JSON for API paths, HTML for page paths
  if (path.startsWith('/api/')) {
    return c.json({ error: 'INTERNAL_ERROR', message: 'An internal error occurred.' }, 500)
  }
  return c.html(page500(path, errMsg), 500)
})

export default app
