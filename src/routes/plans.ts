// ============================================================
// SOVEREIGN OS PLATFORM — TENANT PLANS ROUTE (P21)
// Tenant plan management: plan type, limits, feature gates.
// Auth: authenticated operators only
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import type { Env } from '../index'

const PLAN_LABELS: Record<string, { label: string; color: string; badge: string }> = {
  free:       { label: 'Free',       color: 'var(--text3)',  badge: 'rgba(100,100,100,0.2)' },
  standard:   { label: 'Standard',   color: 'var(--accent)', badge: 'rgba(79,142,247,0.2)'  },
  enterprise: { label: 'Enterprise', color: 'var(--green)',  badge: 'rgba(34,197,94,0.2)'   },
}

export function createPlansRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /plans — Tenant plan overview
  route.get('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    const db = c.env.DB

    // Load plans, rate limits, onboarding state
    let plans: Record<string, unknown>[] = []
    let rateLimits: Record<string, unknown>[] = []
    let onboarding: Record<string, unknown>[] = []

    if (db) {
      try {
        const [plansRes, rlRes, onbRes] = await Promise.allSettled([
          db.prepare('SELECT * FROM tenant_plans ORDER BY created_at DESC LIMIT 50').all(),
          db.prepare('SELECT * FROM tenant_rate_limits ORDER BY tenant_id').all(),
          db.prepare('SELECT * FROM operator_onboarding ORDER BY created_at DESC LIMIT 20').all(),
        ])
        if (plansRes.status === 'fulfilled') plans = plansRes.value.results as Record<string, unknown>[]
        if (rlRes.status === 'fulfilled') rateLimits = rlRes.value.results as Record<string, unknown>[]
        if (onbRes.status === 'fulfilled') onboarding = onbRes.value.results as Record<string, unknown>[]
      } catch { /* graceful empty */ }
    }

    const planCards = plans.length > 0 ? plans.map(p => {
      const planType = String(p.plan_type ?? 'standard')
      const meta = PLAN_LABELS[planType] ?? PLAN_LABELS.standard
      const expiresAt = p.plan_expires_at ? new Date(String(p.plan_expires_at)).toLocaleDateString() : '∞'
      const isTrial = p.is_trial ? `<span style="background:rgba(234,179,8,0.15);color:#eab308;border:1px solid rgba(234,179,8,0.3);border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;margin-left:8px">TRIAL</span>` : ''
      return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text)">${p.tenant_id}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Plan from: ${new Date(String(p.plan_starts_at)).toLocaleDateString()} · Expires: ${expiresAt}</div>
          </div>
          <span style="background:${meta.badge};color:${meta.color};border:1px solid ${meta.color};border-radius:4px;padding:4px 12px;font-size:12px;font-weight:700">${meta.label}${isTrial}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
          ${[
            { label: 'Max Users',      value: p.max_users },
            { label: 'Max Workflows',  value: p.max_workflows },
            { label: 'API/Day',        value: p.max_api_calls_per_day },
            { label: 'Custom Domain',  value: p.custom_domain_allowed ? '✅' : '❌' },
            { label: 'SSO',            value: p.sso_allowed ? '✅' : '❌' },
            { label: 'AI Assist',      value: p.ai_assist_allowed ? '✅' : '❌' },
            { label: 'Federation',     value: p.federation_allowed ? '✅' : '❌' },
            { label: 'Billing Cycle',  value: p.billing_cycle },
          ].map(f => `
            <div style="background:var(--bg3);border-radius:6px;padding:8px 10px">
              <div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;margin-bottom:2px">${f.label}</div>
              <div style="font-size:13px;color:var(--text);font-weight:600">${f.value}</div>
            </div>
          `).join('')}
        </div>
      </div>`
    }).join('') : `<div style="background:rgba(79,142,247,0.06);border:1px solid rgba(79,142,247,0.2);border-radius:8px;padding:24px;text-align:center;color:var(--text2);font-size:13px">No tenant plans found. Apply migration 0023.</div>`

    const rlRows = rateLimits.map(rl => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 16px;font-size:13px">${rl.tenant_id}</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px">${rl.api_calls_per_hour?.toLocaleString()}</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px">${rl.api_calls_per_day?.toLocaleString()}</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px">${rl.max_concurrent_sessions}</td>
        <td style="padding:10px 16px;text-align:right;font-size:13px">${rl.webhook_calls_per_hour}</td>
      </tr>
    `).join('')

    const onbRows = onboarding.map(o => {
      const pct = [o.welcome_email_sent, o.roles_configured, o.first_workflow_created, o.first_connector_registered, o.onboarding_complete]
        .filter(Boolean).length * 20
      return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 16px;font-size:13px">${o.tenant_id}</td>
        <td style="padding:10px 16px;font-size:12px;color:var(--text2)">${o.operator_email || '—'}</td>
        <td style="padding:10px 16px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">
              <div style="width:${pct}%;background:${pct===100?'var(--green)':'var(--accent)'};height:6px;border-radius:4px;transition:width 0.3s"></div>
            </div>
            <span style="font-size:12px;font-weight:600;color:${pct===100?'var(--green)':'var(--text2)'}">${pct}%</span>
          </div>
        </td>
        <td style="padding:10px 16px">
          <span style="background:${o.onboarding_complete?'rgba(34,197,94,0.15)':'rgba(234,179,8,0.15)'};color:${o.onboarding_complete?'#22c55e':'#eab308'};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">
            ${o.onboarding_complete ? 'COMPLETE' : String(o.step_completed).toUpperCase()}
          </span>
        </td>
      </tr>`
    }).join('')

    const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Tenant Plans</h1>
        <div style="font-size:12px;color:var(--text2)">${plans.length} plan(s) · ${rateLimits.length} rate limit config(s) · ${onboarding.length} onboarding record(s)</div>
      </div>
      ${isAuth ? `<a href="/billing" class="btn btn-ghost btn-sm">💳 Billing →</a>` : ''}
    </div>

    <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:12px;color:var(--text2)">
      <span style="color:var(--green);font-weight:700">P21 — Plan Enforcement:</span>
      Tenant plans control feature access (SSO, AI Assist, Federation, Custom Domain).
      Plan limits are enforced at route + API level. Enterprise plan unlocks all features.
      <a href="/docs/plans" style="color:var(--accent)">View plan docs →</a>
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">ACTIVE PLANS (${plans.length})</div>
    ${planCards}

    ${rateLimits.length > 0 ? `
    <div style="margin-top:28px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">PER-TENANT RATE LIMITS (${rateLimits.length})</div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Tenant</th>
            <th style="padding:10px 16px;text-align:right;color:var(--text3);font-weight:600">API/Hour</th>
            <th style="padding:10px 16px;text-align:right;color:var(--text3);font-weight:600">API/Day</th>
            <th style="padding:10px 16px;text-align:right;color:var(--text3);font-weight:600">Sessions</th>
            <th style="padding:10px 16px;text-align:right;color:var(--text3);font-weight:600">Webhooks/Hour</th>
          </tr></thead>
          <tbody>${rlRows}</tbody>
        </table>
      </div>
    </div>` : ''}

    ${onboarding.length > 0 ? `
    <div style="margin-top:28px">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">OPERATOR ONBOARDING (${onboarding.length})</div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Tenant</th>
            <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Email</th>
            <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Progress</th>
            <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Status</th>
          </tr></thead>
          <tbody>${onbRows}</tbody>
        </table>
      </div>
    </div>` : ''}
    `

    return c.html(layout('Tenant Plans', content, '/plans'))
  })

  return route
}
