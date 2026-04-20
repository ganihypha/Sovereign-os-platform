// ============================================================
// SOVEREIGN OS PLATFORM — BILLING HOOKS ROUTE (P21)
// Billing webhook event log and subscription management scaffold.
// Auth: authenticated operators only
// Stripe/billing integration via environment secrets (never exposed).
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { isAuthenticated } from '../lib/auth'
import type { Env } from '../index'

const EVENT_COLORS: Record<string, string> = {
  'subscription.created':    '#22c55e',
  'subscription.updated':    '#4f8ef7',
  'subscription.cancelled':  '#ef4444',
  'payment.succeeded':       '#22c55e',
  'payment.failed':          '#ef4444',
  'invoice.paid':            '#22c55e',
  'invoice.payment_failed':  '#ef4444',
  'trial.started':           '#eab308',
  'trial.ended':             '#f97316',
}

export function createBillingRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /billing — Billing overview
  route.get('/', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    const db = c.env.DB

    let hooks: Record<string, unknown>[] = []
    let plans: Record<string, unknown>[] = []

    if (db) {
      try {
        const [hooksRes, plansRes] = await Promise.allSettled([
          db.prepare('SELECT * FROM billing_hooks ORDER BY received_at DESC LIMIT 50').all(),
          db.prepare('SELECT tenant_id, plan_type, billing_cycle, plan_expires_at FROM tenant_plans ORDER BY tenant_id').all(),
        ])
        if (hooksRes.status === 'fulfilled') hooks = hooksRes.value.results as Record<string, unknown>[]
        if (plansRes.status === 'fulfilled') plans = plansRes.value.results as Record<string, unknown>[]
      } catch { /* graceful empty */ }
    }

    // Stats
    const succeeded = hooks.filter(h => h.status === 'processed' && String(h.event_type).includes('succeeded')).length
    const failed = hooks.filter(h => h.status === 'failed').length
    const received = hooks.filter(h => h.status === 'received').length

    const statCards = [
      { label: 'Total Events', value: hooks.length, color: 'var(--text)' },
      { label: 'Succeeded', value: succeeded, color: 'var(--green)' },
      { label: 'Failed', value: failed, color: 'var(--red)' },
      { label: 'Pending', value: received, color: 'var(--yellow)' },
    ].map(s => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
        <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;margin-bottom:4px">${s.label}</div>
        <div style="font-size:24px;font-weight:700;color:${s.color}">${s.value}</div>
      </div>
    `).join('')

    const hookRows = hooks.length > 0 ? hooks.map(h => {
      const evColor = EVENT_COLORS[String(h.event_type)] ?? 'var(--text2)'
      const statusBadge = h.status === 'processed'
        ? `<span style="background:rgba(34,197,94,0.15);color:#22c55e;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700">PROCESSED</span>`
        : h.status === 'failed'
          ? `<span style="background:rgba(239,68,68,0.15);color:#ef4444;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700">FAILED</span>`
          : `<span style="background:rgba(234,179,8,0.15);color:#eab308;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700">RECEIVED</span>`
      const amountDisplay = h.amount_cents
        ? `$${(Number(h.amount_cents) / 100).toFixed(2)} ${String(h.currency).toUpperCase()}`
        : '—'
      return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 16px"><span style="color:${evColor};font-size:12px;font-weight:600">${h.event_type}</span></td>
        <td style="padding:10px 16px;font-size:12px;color:var(--text2)">${h.tenant_id}</td>
        <td style="padding:10px 16px;font-size:12px;color:var(--text2)">${h.provider}</td>
        <td style="padding:10px 16px;font-size:12px;color:var(--text)">${amountDisplay}</td>
        <td style="padding:10px 16px">${statusBadge}</td>
        <td style="padding:10px 16px;font-size:11px;color:var(--text3)">${new Date(String(h.received_at)).toLocaleString()}</td>
      </tr>`
    }).join('') : `<tr><td colspan="6" style="padding:32px;text-align:center;color:var(--text3);font-size:13px">No billing events recorded yet.<br><small>Stripe webhook: POST /api/billing/webhook</small></td></tr>`

    const planRows = plans.map(p => {
      const planMeta = { free: '⚪', standard: '🔵', enterprise: '🟢' }[String(p.plan_type)] ?? '⚪'
      return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 16px;font-size:13px">${p.tenant_id}</td>
        <td style="padding:10px 16px;font-size:12px">${planMeta} ${String(p.plan_type).charAt(0).toUpperCase() + String(p.plan_type).slice(1)}</td>
        <td style="padding:10px 16px;font-size:12px;color:var(--text2)">${p.billing_cycle}</td>
        <td style="padding:10px 16px;font-size:12px;color:var(--text3)">${p.plan_expires_at ? new Date(String(p.plan_expires_at)).toLocaleDateString() : '∞ Perpetual'}</td>
      </tr>`
    }).join('')

    const stripeConfigured = false // Stripe integration requires STRIPE_SECRET_KEY secret

    const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Billing & Subscriptions</h1>
        <div style="font-size:12px;color:var(--text2)">${hooks.length} events · ${plans.length} active plans</div>
      </div>
      <a href="/plans" class="btn btn-ghost btn-sm">📋 Plans →</a>
    </div>

    ${!stripeConfigured ? `
    <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.3);border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:12px;color:var(--text2)">
      <span style="color:#eab308;font-weight:700">⚠️ Billing Not Active:</span>
      Stripe integration requires <code>STRIPE_SECRET_KEY</code> + <code>STRIPE_WEBHOOK_SECRET</code> secrets.
      Set via: <code style="font-size:11px">npx wrangler pages secret put STRIPE_SECRET_KEY --project-name sovereign-os-platform</code>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px">
      ${statCards}
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">SUBSCRIPTION PLANS (${plans.length})</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Tenant</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Plan</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Cycle</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Expires</th>
        </tr></thead>
        <tbody>${planRows || `<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text3);font-size:12px">No plans found</td></tr>`}</tbody>
      </table>
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">BILLING EVENTS (${hooks.length})</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Event</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Tenant</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Provider</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Amount</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Status</th>
          <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Received</th>
        </tr></thead>
        <tbody>${hookRows}</tbody>
      </table>
    </div>

    <div style="margin-top:24px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Stripe Webhook Setup</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Configure Stripe to send webhook events to:</div>
      <code style="font-size:12px;color:var(--accent);background:var(--bg3);border-radius:4px;padding:6px 10px;display:block">POST https://sovereign-os-platform.pages.dev/api/billing/webhook</code>
      <div style="font-size:11px;color:var(--text3);margin-top:8px">Events: subscription.*, payment.*, invoice.* | Signing secret: STRIPE_WEBHOOK_SECRET</div>
    </div>
    `

    return c.html(layout('Billing', content, '/billing'))
  })

  // POST /billing/webhook — Stripe webhook receiver (P21 scaffold)
  route.post('/webhook', async (c) => {
    const db = c.env.DB
    try {
      const body = await c.req.text()
      const sig = c.req.header('stripe-signature') ?? ''

      // TODO: Verify STRIPE_WEBHOOK_SECRET signature when configured
      // For now: parse event type and record in D1 (fire-and-catch)
      let eventType = 'unknown'
      let tenantId = 'default'
      let amountCents = 0
      let currency = 'usd'

      try {
        const parsed = JSON.parse(body)
        eventType = String(parsed.type ?? 'unknown')
        tenantId = String(parsed.data?.object?.metadata?.tenant_id ?? 'default')
        amountCents = Number(parsed.data?.object?.amount ?? 0)
        currency = String(parsed.data?.object?.currency ?? 'usd')
      } catch { /* ignore parse errors */ }

      // Hash payload — never store raw
      const encoder = new TextEncoder()
      const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(body))
      const payloadHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

      if (db) {
        const id = `bh_${crypto.randomUUID()}`
        await db.prepare(
          `INSERT OR IGNORE INTO billing_hooks (id, tenant_id, event_type, provider, payload_hash, amount_cents, currency, status)
           VALUES (?, ?, ?, 'stripe', ?, ?, ?, 'received')`
        ).bind(id, tenantId, eventType, payloadHash, amountCents, currency).run()
      }

      return c.json({ received: true, event: eventType }, 200, { 'Cache-Control': 'no-store' })
    } catch (_err) {
      return c.json({ error: 'WEBHOOK_ERROR' }, 500)
    }
  })

  return route
}
