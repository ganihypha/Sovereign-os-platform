// ============================================================
// SOVEREIGN OS PLATFORM — ALERT RULES SURFACE (P10)
// Purpose: Define, test, and activate alert rules
// Surface: /alert-rules
// Integration: alertRulesService, anomalyService, health-dashboard
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'
import {
  getAllAlertRules, getAlertRuleTriggers, createAlertRule,
  updateAlertRuleStatus, deleteAlertRule, evaluateAlertRules,
  collectPlatformMetrics, METRIC_OPTIONS, OPERATOR_OPTIONS, ACTION_OPTIONS,
  type AlertRule
} from '../lib/alertRulesService'

function statusBadge(status: string): string {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    active:   { bg: 'rgba(34,197,94,0.08)',  color: '#22c55e', border: 'rgba(34,197,94,0.2)' },
    inactive: { bg: 'rgba(107,114,128,0.08)', color: '#6b7280', border: 'rgba(107,114,128,0.2)' },
    draft:    { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
  }
  const s = map[status] || map['inactive']
  return `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:${s.bg};color:${s.color};border:1px solid ${s.border}">${status}</span>`
}

function metricLabel(metric: string): string {
  return METRIC_OPTIONS.find(m => m.value === metric)?.label || metric
}

function operatorLabel(op: string): string {
  return OPERATOR_OPTIONS.find(o => o.value === op)?.label || op
}

export function createAlertRulesRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /alert-rules
  route.get('/', async (c) => {
    const rules = c.env.DB ? await getAllAlertRules(c.env.DB) : []
    const triggers = c.env.DB ? await getAlertRuleTriggers(c.env.DB, undefined, undefined, 20) : []

    // Collect current metrics for "live test" display
    let currentMetrics: Record<string, number> = {}
    if (c.env.DB) {
      try {
        currentMetrics = await collectPlatformMetrics(c.env.DB) as Record<string, number>
      } catch { /* graceful */ }
    }

    const ruleRows = rules.map(r => {
      const currentVal = currentMetrics[r.metric] ?? 0
      const wouldTrigger = (() => {
        switch (r.operator) {
          case 'gt':  return currentVal > r.threshold
          case 'gte': return currentVal >= r.threshold
          case 'lt':  return currentVal < r.threshold
          case 'lte': return currentVal <= r.threshold
          case 'eq':  return currentVal === r.threshold
          case 'neq': return currentVal !== r.threshold
          default: return false
        }
      })()

      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 12px">
            <div style="font-size:12px;font-weight:600;color:var(--text)">${r.name}</div>
            ${r.description ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${r.description}</div>` : ''}
          </td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text2)">${metricLabel(r.metric)}</td>
          <td style="padding:10px 12px;font-size:11px;font-family:monospace">
            <span style="color:#4f8ef7">${operatorLabel(r.operator).split(' ')[0]}</span>
            <span style="color:var(--text)"> ${r.threshold}</span>
          </td>
          <td style="padding:10px 12px;font-size:11px">
            <span style="font-weight:600;color:${wouldTrigger ? '#f59e0b' : '#22c55e'}">${currentVal}</span>
            <span style="color:var(--text3);font-size:10px;margin-left:4px">${wouldTrigger ? '⚠ TRIGGER' : '✓ OK'}</span>
          </td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${ACTION_OPTIONS.find(a => a.value === r.action_type)?.label.split('(')[0] || r.action_type}</td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${r.cooldown_minutes}m</td>
          <td style="padding:10px 12px">${statusBadge(r.status)}</td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${r.trigger_count}</td>
          <td style="padding:10px 12px;font-size:11px;color:var(--text3)">${r.last_triggered_at ? new Date(r.last_triggered_at).toLocaleString() : 'Never'}</td>
          <td style="padding:10px 12px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <form action="/alert-rules/${r.id}/toggle" method="POST" style="display:inline">
                <button type="submit" style="background:${r.status === 'active' ? 'rgba(107,114,128,0.15)' : 'rgba(34,197,94,0.15)'};color:${r.status === 'active' ? '#9aa3b2' : '#22c55e'};border:none;border-radius:4px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:600">
                  ${r.status === 'active' ? 'Pause' : 'Activate'}
                </button>
              </form>
              <form action="/alert-rules/${r.id}/delete" method="POST" style="display:inline" onsubmit="return confirm('Delete rule: ${r.name}?')">
                <button type="submit" style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;border-radius:4px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:600">Delete</button>
              </form>
            </div>
          </td>
        </tr>
      `
    }).join('')

    const triggerRows = triggers.map(t => {
      const rule = rules.find(r => r.id === t.rule_id)
      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${rule?.name || t.rule_id}</td>
          <td style="padding:8px 12px;font-size:11px;font-weight:600;color:#f59e0b">${t.metric_value}</td>
          <td style="padding:8px 12px;font-size:11px;color:var(--text3)">≥ ${t.threshold_value}</td>
          <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${new Date(t.triggered_at).toLocaleString()}</td>
          <td style="padding:8px 12px;font-size:10px;font-family:monospace;color:var(--text3)">${t.notification_id || '—'}</td>
        </tr>
      `
    }).join('')

    // Current metrics display
    const metricsDisplay = METRIC_OPTIONS.map(m => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:11px;color:var(--text2)">${m.label}</span>
        <span style="font-size:14px;font-weight:700;color:#4f8ef7">${currentMetrics[m.value] ?? 0}</span>
      </div>
    `).join('')

    const content = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Alert Rules Engine</h1>
          <div style="font-size:12px;color:var(--text2)">P10 — Condition → Threshold → Action · ${rules.length} rules · <span style="color:#22c55e">${rules.filter(r => r.status === 'active').length} active</span></div>
        </div>
        <form action="/alert-rules/evaluate" method="POST">
          <button type="submit" style="background:#f97316;color:#fff;border:none;border-radius:6px;padding:9px 20px;font-size:12px;font-weight:600;cursor:pointer">▷ Run Evaluation Now</button>
        </form>
      </div>

      <div style="display:grid;grid-template-columns:1fr 280px;gap:20px;margin-bottom:24px">
        <!-- Rules Table -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
            <div style="font-size:13px;font-weight:600;color:var(--text)">Active Rules</div>
            <div style="font-size:11px;color:var(--text3)">Current value shown live for each rule metric</div>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg3)">
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Rule Name</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Metric</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Condition</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Current</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Action</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Cooldown</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Status</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Triggers</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Last Triggered</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Manage</th>
              </tr>
            </thead>
            <tbody>
              ${ruleRows || '<tr><td colspan="10" style="padding:24px;text-align:center;color:var(--text3);font-size:12px">No alert rules yet.</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Live Metrics Sidebar -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Live Platform Metrics</div>
          <div style="font-size:10px;color:var(--text3);margin-bottom:12px">Current values at rule evaluation time</div>
          ${metricsDisplay}
        </div>
      </div>

      <!-- Trigger History -->
      ${triggers.length > 0 ? `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:24px">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
          <div style="font-size:13px;font-weight:600;color:var(--text)">Recent Trigger History</div>
          <div style="font-size:11px;color:var(--text3)">Last ${triggers.length} trigger events</div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--bg3)">
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Rule</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Value</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Threshold</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Triggered At</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:600">Notification ID</th>
            </tr>
          </thead>
          <tbody>${triggerRows}</tbody>
        </table>
      </div>
      ` : ''}

      <!-- Create Rule Form -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:24px">
        <h2 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:16px">Create New Alert Rule</h2>
        <form action="/alert-rules/create" method="POST">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Rule Name *</label>
              <input name="name" required placeholder="e.g. High Pending Approvals" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Description</label>
              <input name="description" placeholder="What does this rule detect?" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr 2fr 1fr;gap:12px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Metric *</label>
              <select name="metric" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${METRIC_OPTIONS.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Operator *</label>
              <select name="operator" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${OPERATOR_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Threshold *</label>
              <input name="threshold" type="number" step="any" required value="5" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Action *</label>
              <select name="action_type" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px">
                ${ACTION_OPTIONS.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px">Cooldown (min)</label>
              <input name="cooldown_minutes" type="number" value="60" min="5" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:12px;box-sizing:border-box">
            </div>
          </div>
          <button type="submit" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer">Create Alert Rule</button>
        </form>
      </div>

      <div style="margin-top:16px;padding:12px 16px;background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
        <span style="color:#f97316;font-weight:600">P10 Alert Rules:</span>
        Rules are evaluated on-demand (Run Evaluation) or can be triggered automatically via platform events.
        Notifications created by rules are tagged <code>[ai-generated: rule engine auto-notification]</code>.
        Cooldown prevents duplicate alerts for the same rule within the configured window.
      </div>
    `
    return c.html(layout('Alert Rules', content, '/alert-rules'))
  })

  // POST /alert-rules/create
  route.post('/create', async (c) => {
    if (!c.env.DB) return c.redirect('/alert-rules')
    const body = await c.req.parseBody()
    await createAlertRule(c.env.DB, {
      name: body['name'] as string,
      description: body['description'] as string || undefined,
      metric: body['metric'] as string,
      operator: (body['operator'] as AlertRule['operator']) || 'gte',
      threshold: parseFloat(body['threshold'] as string || '0'),
      action_type: (body['action_type'] as AlertRule['action_type']) || 'create_notification',
      cooldown_minutes: parseInt(body['cooldown_minutes'] as string || '60', 10),
      created_by: 'ui',
    })
    return c.redirect('/alert-rules')
  })

  // POST /alert-rules/evaluate — run evaluation now
  route.post('/evaluate', async (c) => {
    if (!c.env.DB) return c.redirect('/alert-rules')
    const result = await evaluateAlertRules(c.env.DB, 'tenant-default')
    const msg = encodeURIComponent(`Evaluation complete: ${result.triggered} rules triggered out of ${result.rules_checked} checked.`)
    return c.redirect(`/alert-rules?eval=${msg}`)
  })

  // GET /alert-rules with eval message
  // (handled by the main GET / handler above via query params)

  // POST /alert-rules/:id/toggle
  route.post('/:id/toggle', async (c) => {
    if (!c.env.DB) return c.redirect('/alert-rules')
    const existing = await c.env.DB.prepare(`SELECT status FROM alert_rules WHERE id = ?`).bind(c.req.param('id')).first() as { status: string } | null
    const newStatus = existing?.status === 'active' ? 'inactive' : 'active'
    await updateAlertRuleStatus(c.env.DB, c.req.param('id'), newStatus)
    return c.redirect('/alert-rules')
  })

  // POST /alert-rules/:id/delete
  route.post('/:id/delete', async (c) => {
    if (!c.env.DB) return c.redirect('/alert-rules')
    await deleteAlertRule(c.env.DB, c.req.param('id'))
    return c.redirect('/alert-rules')
  })

  return route
}
