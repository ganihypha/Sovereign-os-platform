// ============================================================
// SOVEREIGN OS PLATFORM — MAIN ENTRY (P2 MATURITY / P2.5 HARDENED)
// Version: 0.2.1-P2.5
// Platform: Cloudflare Pages + Workers
// Hono Framework — Edge-first
// ============================================================
import { Hono } from 'hono'
import { createRepo } from './lib/repo'
import {
  requireAuth, requireApiAuth,
  handleAuthLogin, handleAuthLogout, authStatusBadge, isAuthenticated
} from './lib/auth'

// Route imports
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

export type Env = {
  DB?: D1Database
  PLATFORM_API_KEY?: string
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

// API routes — apply requireApiAuth middleware
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
    version: '0.3.0-P3',
    phase: 'P3 — Operational Expansion',
    persistence: repo.isPersistent ? 'd1' : 'in-memory',
    auth_configured: !!c.env.PLATFORM_API_KEY,
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
      version: '0.3.0-P3',
      phase: 'P3 — Operational Expansion',
      persistence: repo.isPersistent ? 'd1-persistent' : 'in-memory-ephemeral',
      auth_configured: !!c.env.PLATFORM_API_KEY,
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
        api: 'active',
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
      version: '0.2.1-P2.5',
      error: 'Could not read platform state',
      persistence: 'unknown',
      timestamp: new Date().toISOString(),
    }, 503)
  }
})

export default app
