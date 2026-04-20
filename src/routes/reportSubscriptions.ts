// ============================================================
// SOVEREIGN OS PLATFORM — REPORT SUBSCRIPTIONS SURFACE (P12+P15)
// Purpose: Scheduled report subscription management
// Surface: /reports/subscriptions
// P15: Delivery status column, manual trigger with log, /reports/subscriptions/:id/trigger
// Integration: reportSubscriptionService, reportingService
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'
import {
  getAllSubscriptions, createSubscription, toggleSubscription,
  deleteSubscription, getSubscriptionRuns, processSubscriptions,
  type ReportSubscription
} from '../lib/reportSubscriptionService'
import { REPORT_TYPES } from '../lib/reportingService'
import { emailWeeklyReport } from '../lib/emailService'

const SCHEDULE_OPTIONS = [
  { value: 'hourly',  label: 'Hourly' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
]

const DELIVERY_OPTIONS = [
  { value: 'store',   label: 'Store in D1 (report_jobs)' },
  { value: 'email',   label: 'Email (graceful degradation)' },
  { value: 'webhook', label: 'Webhook (POST to URL)' },
]

function statusBadge(active: number): string {
  return active === 1
    ? `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.2);font-weight:600">Active</span>`
    : `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:rgba(107,114,128,0.08);color:#6b7280;border:1px solid rgba(107,114,128,0.2);font-weight:600">Inactive</span>`
}

function deliveryBadge(type: string): string {
  const map: Record<string, string> = {
    store: '#4f8ef7', email: '#f59e0b', webhook: '#8b5cf6'
  }
  const c = map[type] || '#6b7280'
  return `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:${c}18;color:${c};border:1px solid ${c}30">${type}</span>`
}

function deliveryStatusBadge(status?: string | null): string {
  if (!status) return `<span style="color:var(--text3);font-size:10px">—</span>`
  const map: Record<string, string> = {
    success: 'rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.2)',
    failed:  'rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.2)',
    partial: 'rgba(251,191,36,0.08);color:#fbbf24;border:1px solid rgba(251,191,36,0.2)',
  }
  const style = map[status] || 'rgba(107,114,128,0.08);color:#6b7280;border:1px solid rgba(107,114,128,0.2)'
  return `<span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:${style}">${status}</span>`
}

function timeFrom(iso?: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = d.getTime() - now.getTime()
    if (Math.abs(diff) < 60000) return 'now'
    const mins = Math.round(Math.abs(diff) / 60000)
    if (mins < 60) return diff > 0 ? `in ${mins}m` : `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return diff > 0 ? `in ${hrs}h` : `${hrs}h ago`
    const days = Math.round(hrs / 24)
    return diff > 0 ? `in ${days}d` : `${days}d ago`
  } catch { return iso }
}

export function createReportSubscriptionsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /reports/subscriptions
  route.get('/', async (c) => {
    if (!c.env.DB) return c.html(layout('Report Subscriptions', '<div class="card"><p class="text-muted">Database not available.</p></div>', '/reports'))

    // Lazy process due subscriptions (KV TTL polling)
    const processed = await processSubscriptions(c.env.DB, c.env.RATE_LIMITER_KV)

    const subs = await getAllSubscriptions(c.env.DB)
    const active = subs.filter(s => s.active === 1)

    const rows = subs.map(s => `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:var(--text)">${s.report_type}</td>
        <td style="padding:10px 12px">${statusBadge(s.active)}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3);text-transform:capitalize">${s.schedule}</td>
        <td style="padding:10px 12px">${deliveryBadge(s.delivery_type)}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${s.recipient || '—'}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${timeFrom(s.last_run_at)}</td>
        <td style="padding:10px 12px;font-size:11px;color:${new Date(s.next_run_at||'') <= new Date() ? '#f59e0b' : 'var(--text3)'}">${timeFrom(s.next_run_at)}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${s.run_count}</td>
        <td style="padding:10px 12px">${deliveryStatusBadge((s as any).last_delivery_status)}</td>
        <td style="padding:10px 12px;font-size:10px;color:var(--text3)">${(s as any).last_delivery_at ? new Date((s as any).last_delivery_at).toLocaleString() : '—'}</td>
        <td style="padding:10px 12px">
          <div style="display:flex;gap:6px;align-items:center">
            <form action="/reports/subscriptions/${s.id}/toggle" method="POST" style="display:inline">
              <button type="submit" style="background:${s.active===1?'rgba(107,114,128,0.15)':'rgba(34,197,94,0.15)'};color:${s.active===1?'#9aa3b2':'#22c55e'};border:none;border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;font-weight:600">
                ${s.active === 1 ? 'Pause' : 'Resume'}
              </button>
            </form>
            <form action="/reports/subscriptions/${s.id}/trigger" method="POST" style="display:inline">
              <button type="submit" style="background:rgba(79,142,247,0.12);color:#4f8ef7;border:none;border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;font-weight:600">▶ Trigger</button>
            </form>
            <form action="/reports/subscriptions/${s.id}/delete" method="POST" style="display:inline" onsubmit="return confirm('Delete subscription?')">
              <button type="submit" style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;border-radius:4px;padding:3px 8px;font-size:10px;cursor:pointer;font-weight:600">Delete</button>
            </form>
          </div>
        </td>
      </tr>
    `).join('')

    const content = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Report Subscriptions</h1>
          <div style="font-size:12px;color:var(--text2)">P12 — Scheduled Report Snapshots · ${subs.length} subscriptions · <span style="color:#22c55e">${active.length} active</span>
            ${processed.processed > 0 ? `<span style="margin-left:8px;padding:2px 8px;border-radius:4px;font-size:10px;background:rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.2)">↻ ${processed.processed} auto-ran</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <a href="/reports" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:11px;text-decoration:none">← Reports</a>
          <a href="/reports/jobs" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:11px;text-decoration:none">Job History →</a>
        </div>
      </div>

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
        ${[
          { label: 'Total Subscriptions', val: subs.length, color: '#4f8ef7' },
          { label: 'Active', val: active.length, color: '#22c55e' },
          { label: 'Total Runs', val: subs.reduce((a, s) => a + (s.run_count || 0), 0), color: '#22d3ee' },
          { label: 'Auto-ran Today', val: processed.processed, color: '#f59e0b' },
        ].map(s => `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${s.label}</div>
            <div style="font-size:26px;font-weight:700;color:${s.color}">${s.val}</div>
          </div>
        `).join('')}
      </div>

      <!-- Subscription Table -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:auto;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse;min-width:700px">
          <thead>
            <tr style="background:var(--bg3)">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Report Type</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Status</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Schedule</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Delivery</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Recipient</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Last Run</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Next Run</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Runs</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Last Delivery</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Delivered At</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text3);font-weight:600">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="11" style="padding:24px;text-align:center;color:var(--text3);font-size:12px">No subscriptions yet. Create one below.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Create Subscription Form -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px">
        <h2 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:16px">Create New Subscription</h2>
        <form action="/reports/subscriptions/create" method="POST">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Report Type *</label>
              <select name="report_type" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${REPORT_TYPES.map(r => `<option value="${r.type}">${r.icon} ${r.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Schedule *</label>
              <select name="schedule" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${SCHEDULE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Delivery Type *</label>
              <select name="delivery_type" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${DELIVERY_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 160px;gap:16px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Recipient (email / webhook URL)</label>
              <input name="recipient" placeholder="user@example.com or https://hook.example.com/..." style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
            <div style="display:flex;align-items:flex-end">
              <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;width:100%">Create</button>
            </div>
          </div>
        </form>
      </div>

      <!-- P23: Weekly Report Email CTA -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Weekly Report Email Delivery</h2>
            <div style="font-size:12px;color:var(--text2)">P23 — Send weekly governance summary to an email address</div>
            ${c.env.RESEND_API_KEY
              ? `<div style="margin-top:4px;font-size:11px;color:#22c55e">● RESEND_API_KEY configured — email delivery active</div>`
              : `<div style="margin-top:4px;font-size:11px;color:#f59e0b">⚠ RESEND_API_KEY not set — email will not be sent (graceful degradation)</div>`
            }
          </div>
          <form action="/reports/subscriptions/send-weekly" method="POST" style="display:flex;gap:8px;align-items:center">
            <input name="recipient" type="email" placeholder="admin@example.com" required
              style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:7px 12px;font-size:12px;width:220px">
            <button type="submit" style="background:#4f8ef7;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
              ✉ Send Weekly Report
            </button>
          </form>
        </div>
      </div>

      <div style="padding:12px 16px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:8px;font-size:11px;color:var(--text3)">
        <span style="color:#8b5cf6;font-weight:600">P12 Scheduled Snapshots:</span>
        Subscriptions are checked on each page load (KV TTL polling — lazy trigger).
        Reports are stored in <code>report_jobs</code> table. Email/webhook delivery gracefully degrades when secrets not configured.
        <a href="/reports/jobs" style="color:#8b5cf6;margin-left:4px">View generated report jobs →</a>
        <span style="color:#4f8ef7;margin-left:8px">● P23: Weekly email delivery via Resend API (RESEND_API_KEY required)</span>
      </div>
    `
    return c.html(layout('Report Subscriptions', content, '/reports'))
  })

  // POST /reports/subscriptions/send-weekly — P23: Send weekly report email
  route.post('/send-weekly', async (c) => {
    const body = await c.req.parseBody()
    const recipient = String(body['recipient'] || '').trim()
    const db = c.env.DB

    if (!recipient || !recipient.includes('@')) {
      return c.html(layout('Report Subscriptions', `
        <div style="padding:20px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#ef4444;margin-bottom:16px">
          Invalid email address. <a href="/reports/subscriptions" style="color:#4f8ef7">← Back</a>
        </div>
      `, '/reports'))
    }

    // Gather summary metrics from D1 (graceful fallback to zeros)
    let intentCount = 0, executionCount = 0, anomalyCount = 0, approvalPending = 0
    let topEvents: { event_type: string; count: number }[] = []

    if (db) {
      try {
        const [ic, ec, ac, ap] = await Promise.allSettled([
          db.prepare(`SELECT COUNT(*) as cnt FROM governance_sessions`).first<{ cnt: number }>(),
          db.prepare(`SELECT COUNT(*) as cnt FROM execution_items`).first<{ cnt: number }>(),
          db.prepare(`SELECT COUNT(*) as cnt FROM audit_log_v2 WHERE event_type = 'anomaly.detected' AND created_at >= datetime('now', '-7 days')`).first<{ cnt: number }>(),
          db.prepare(`SELECT COUNT(*) as cnt FROM approval_requests WHERE status = 'pending'`).first<{ cnt: number }>(),
        ])
        intentCount = ic.status === 'fulfilled' ? (ic.value?.cnt ?? 0) : 0
        executionCount = ec.status === 'fulfilled' ? (ec.value?.cnt ?? 0) : 0
        anomalyCount = ac.status === 'fulfilled' ? (ac.value?.cnt ?? 0) : 0
        approvalPending = ap.status === 'fulfilled' ? (ap.value?.cnt ?? 0) : 0

        const topEvRows = await db.prepare(
          `SELECT event_type, COUNT(*) as cnt FROM audit_log_v2 WHERE created_at >= datetime('now', '-7 days')
           GROUP BY event_type ORDER BY cnt DESC LIMIT 5`
        ).all<{ event_type: string; cnt: number }>()
        topEvents = (topEvRows.results || []).map(r => ({ event_type: r.event_type, count: r.cnt }))
      } catch (_e) { /* graceful */ }
    }

    // Send weekly report email (fire-and-catch — non-blocking)
    const emailSent = { status: 'unknown' }
    try {
      await emailWeeklyReport({ RESEND_API_KEY: c.env.RESEND_API_KEY, DB: db }, {
        tenantName: 'Sovereign OS Platform',
        recipient,
        intentCount,
        executionCount,
        anomalyCount,
        approvalPending,
        topEvents,
        reportUrl: 'https://sovereign-os-platform.pages.dev/reports',
      })
      emailSent.status = c.env.RESEND_API_KEY ? 'sent' : 'skipped-no-key'
    } catch (_e) {
      emailSent.status = 'error'
    }

    const isNoKey = !c.env.RESEND_API_KEY
    const statusColor = isNoKey ? '#f59e0b' : '#22c55e'
    const statusMsg = isNoKey
      ? '⚠ RESEND_API_KEY not configured — email was not delivered (graceful degradation).'
      : `✅ Weekly report email queued for delivery to <strong>${recipient}</strong>.`

    return c.html(layout('Report Subscriptions', `
      <div style="padding:20px;background:${isNoKey ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'};border:1px solid ${isNoKey ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'};border-radius:8px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;color:${statusColor};margin-bottom:6px">Weekly Report Email</div>
        <div style="font-size:13px;color:var(--text2)">${statusMsg}</div>
        ${isNoKey ? `<div style="margin-top:8px;font-size:11px;color:var(--text3)">
          Set via: <code>npx wrangler pages secret put RESEND_API_KEY --project-name sovereign-os-platform</code>
        </div>` : ''}
        <div style="margin-top:12px;display:flex;gap:8px">
          <a href="/reports/subscriptions" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 16px;font-size:12px;font-weight:600;text-decoration:none">← Back to Subscriptions</a>
          <a href="/reports" style="background:var(--accent);color:#fff;border-radius:6px;padding:7px 16px;font-size:12px;font-weight:600;text-decoration:none">View Reports</a>
        </div>
      </div>
    `, '/reports'))
  })

  // POST /reports/subscriptions/create
  route.post('/create', async (c) => {
    if (!c.env.DB) return c.redirect('/reports/subscriptions')
    const body = await c.req.parseBody()
    await createSubscription(c.env.DB, {
      report_type: String(body['report_type'] || 'platform_summary'),
      schedule: String(body['schedule'] || 'daily'),
      delivery_type: String(body['delivery_type'] || 'store'),
      recipient: String(body['recipient'] || '') || undefined,
      created_by: 'ui',
    })
    return c.redirect('/reports/subscriptions')
  })

  // POST /reports/subscriptions/:id/toggle
  route.post('/:id/toggle', async (c) => {
    if (!c.env.DB) return c.redirect('/reports/subscriptions')
    await toggleSubscription(c.env.DB, c.req.param('id'))
    return c.redirect('/reports/subscriptions')
  })

  // POST /reports/subscriptions/:id/run-now — legacy alias (keep for backward compat)
  route.post('/:id/run-now', async (c) => {
    if (!c.env.DB) return c.redirect('/reports/subscriptions')
    const id = c.req.param('id')
    await c.env.DB.prepare(`
      UPDATE report_subscriptions SET next_run_at = ?, updated_at = ? WHERE id = ?
    `).bind(new Date(0).toISOString(), new Date().toISOString(), id).run()
    await processSubscriptions(c.env.DB, c.env.RATE_LIMITER_KV)
    // P15: Update delivery status
    await c.env.DB.prepare(`
      UPDATE report_subscriptions SET last_delivery_status = 'success', last_delivery_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(id).run().catch(() => {})
    return c.redirect('/reports/subscriptions')
  })

  // POST /reports/subscriptions/:id/trigger — P15: Manual delivery trigger with status log
  route.post('/:id/trigger', async (c) => {
    if (!c.env.DB) return c.redirect('/reports/subscriptions')
    const id = c.req.param('id')
    const db = c.env.DB
    let deliveryStatus = 'success'
    let deliveryError: string | undefined

    try {
      // Force next_run_at to past so processSubscriptions picks it up
      await db.prepare(`
        UPDATE report_subscriptions SET next_run_at = ?, updated_at = ? WHERE id = ?
      `).bind(new Date(0).toISOString(), new Date().toISOString(), id).run()

      const result = await processSubscriptions(db, c.env.RATE_LIMITER_KV)
      if (result.errors && result.errors.length > 0) {
        deliveryStatus = 'partial'
        deliveryError = result.errors[0]
      }
    } catch (err: any) {
      deliveryStatus = 'failed'
      deliveryError = String(err?.message || err)
    }

    // P15: Log delivery to report_delivery_log
    try {
      const logId = 'rdl-' + Date.now().toString(36)
      await db.prepare(`
        INSERT INTO report_delivery_log (id, subscription_id, status, delivered_at, error_message, format)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'csv')
      `).bind(logId, id, deliveryStatus, deliveryError || null).run()
    } catch { /* non-blocking */ }

    // P15: Update delivery status on subscription
    await db.prepare(`
      UPDATE report_subscriptions
      SET last_delivery_status = ?, last_delivery_at = CURRENT_TIMESTAMP, last_delivery_error = ?
      WHERE id = ?
    `).bind(deliveryStatus, deliveryError || null, id).run().catch(() => {})

    return c.redirect('/reports/subscriptions')
  })

  // POST /reports/subscriptions/:id/delete
  route.post('/:id/delete', async (c) => {
    if (!c.env.DB) return c.redirect('/reports/subscriptions')
    await deleteSubscription(c.env.DB, c.req.param('id'))
    return c.redirect('/reports/subscriptions')
  })

  // GET /reports/subscriptions/:id/runs — run history for a subscription
  route.get('/:id/runs', async (c) => {
    if (!c.env.DB) return c.json({ error: 'no db' }, 503)
    const runs = await getSubscriptionRuns(c.env.DB, c.req.param('id'))
    return c.json({ subscription_id: c.req.param('id'), runs, count: runs.length })
  })

  return route
}
