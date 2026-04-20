// ============================================================
// SOVEREIGN OS PLATFORM — PLAN GUARD MIDDLEWARE (P22)
// Feature-gate middleware based on tenant plan type.
//
// RULES (LAW 5 + LAW 7):
//   - AI CANNOT auto-approve or bypass plan gates
//   - PARTIAL means partial — no feature inflation
//   - 403 + upgrade CTA on denied access
//   - Every gate check logged to plan_access_log (fire-and-catch)
//   - Never expose raw plan data or secrets
//
// Usage:
//   import { planGuard } from '../lib/planGuard'
//   app.use('/ai-assist/generate', planGuard('ai_assist'))
//   app.use('/auth/sso/init/:tid', planGuard('sso'))
// ============================================================

import type { Context, MiddlewareHandler } from 'hono'
import type { Env } from '../index'
import { createRepo } from './repo'

// ---- Feature map per plan type ----
export type PlanFeature = 'sso' | 'ai_assist' | 'federation' | 'api_v2' | 'webhooks' | 'custom_branding'

interface PlanFeatureSet {
  sso: boolean
  ai_assist: boolean
  federation: boolean
  api_v2: boolean
  webhooks: boolean
  custom_branding: boolean
}

const PLAN_FEATURES: Record<string, PlanFeatureSet> = {
  free: {
    sso: false,
    ai_assist: false,
    federation: false,
    api_v2: true,
    webhooks: false,
    custom_branding: false,
  },
  standard: {
    sso: false,
    ai_assist: false,
    federation: false,
    api_v2: true,
    webhooks: true,
    custom_branding: true,
  },
  enterprise: {
    sso: true,
    ai_assist: true,
    federation: true,
    api_v2: true,
    webhooks: true,
    custom_branding: true,
  },
  custom: {
    sso: true,
    ai_assist: true,
    federation: true,
    api_v2: true,
    webhooks: true,
    custom_branding: true,
  },
}

// ---- Upgrade CTA messages per feature ----
const UPGRADE_MESSAGES: Record<PlanFeature, string> = {
  sso: 'Upgrade to Enterprise to enable SSO / OAuth2 PKCE for your tenant.',
  ai_assist: 'Upgrade to Enterprise to enable AI Assist (GPT-4o / Groq) for your tenant.',
  federation: 'Upgrade to Enterprise to enable Connector Federation.',
  api_v2: 'Upgrade to access the full API v2 suite.',
  webhooks: 'Upgrade to Standard or higher to enable Webhooks.',
  custom_branding: 'Upgrade to Standard or higher to enable Custom Branding.',
}

// ---- Feature check helper ----
export function isPlanFeatureAllowed(planType: string, feature: PlanFeature): boolean {
  const planFeatures = PLAN_FEATURES[planType] ?? PLAN_FEATURES['standard']
  return planFeatures[feature] ?? false
}

// ---- Plan guard middleware factory ----
// Returns a Hono middleware that checks if the current tenant's plan allows the feature.
// - Extracts tenant_id from query param or path param ':tid'
// - Falls back to 'tenant-default' if not found
// - On deny: returns 403 JSON for API paths, HTML CTA for browser paths
// - Fire-and-catch: logs to plan_access_log non-blocking
export function planGuard(feature: PlanFeature): MiddlewareHandler {
  return async (c: Context, next) => {
    const env = c.env as Env
    // Skip gate if DB not configured (shouldn't happen in prod)
    if (!env.DB) {
      await next()
      return
    }

    try {
      const repo = createRepo(env.DB)

      // Resolve tenant_id: from param, query, or default
      const tenantId: string =
        c.req.param('tid') ??
        (c.req.query('tenant_id') as string | undefined) ??
        'tenant-default'

      // Get tenant's plan
      const tenant = await repo.getTenant(tenantId).catch(() => undefined)
      const planType: string = tenant?.plan ?? 'standard'

      const allowed = isPlanFeatureAllowed(planType, feature)

      // Fire-and-catch: log the check
      const logId = `pal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      env.DB.prepare(
        `INSERT INTO plan_access_log (id, tenant_id, feature, plan_type, result, path, method, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        logId,
        tenantId,
        feature,
        planType,
        allowed ? 'allowed' : 'denied_upgrade_required',
        c.req.path,
        c.req.method
      ).run().catch(() => { /* non-blocking */ })

      if (allowed) {
        await next()
        return
      }

      // Denied — return 403 with upgrade CTA
      const upgradeMsg = UPGRADE_MESSAGES[feature] ?? `Upgrade required to access ${feature}.`
      const isApiPath = c.req.path.startsWith('/api/')

      if (isApiPath) {
        return c.json({
          error: 'plan_gate_denied',
          message: upgradeMsg,
          feature,
          current_plan: planType,
          upgrade_url: '/plans',
        }, 403)
      }

      // HTML response for browser paths
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upgrade Required — Sovereign OS Platform</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d0f14;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#13151f;border:1px solid #1e2130;border-radius:12px;padding:40px;max-width:480px;width:100%;text-align:center}
  .icon{font-size:48px;margin-bottom:16px}
  h1{font-size:22px;font-weight:700;color:#fff;margin-bottom:12px}
  p{color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:24px}
  .badge{display:inline-block;background:#1e2130;color:#94a3b8;font-size:11px;padding:4px 10px;border-radius:20px;margin-bottom:20px}
  .btn{display:inline-block;background:#4f8ef7;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;margin-right:8px}
  .btn-secondary{background:#1e2130;color:#94a3b8}
  a{color:#4f8ef7}
</style>
</head>
<body>
<div class="card">
  <div class="icon">🔒</div>
  <div class="badge">Plan: ${planType.toUpperCase()}</div>
  <h1>Upgrade Required</h1>
  <p>${upgradeMsg}</p>
  <a href="/plans" class="btn">View Plans →</a>
  <a href="javascript:history.back()" class="btn btn-secondary">Go Back</a>
</div>
</body>
</html>`
      return c.html(html, 403)
    } catch (_err) {
      // On any unexpected error — fail open (allow) to prevent outage
      await next()
    }
  }
}
