// ============================================================
// SOVEREIGN OS PLATFORM — NOTIFICATIONS SURFACE (P9+P15+P17)
// Real-time governance notifications via SSE + polling inbox
//
// GET /notifications              — Notification inbox view (HTML)
// GET /notifications/rules        — P15: Platform notification rules management
// POST /notifications/rules/:id/toggle — P15: Enable/disable a rule
// GET /notifications/preferences  — P17: Per-event-type notification preferences
// POST /notifications/preferences — P17: Update notification preference
// POST /notifications/bulk        — P17: Bulk mark-read / delete
// GET /notifications/stream       — SSE live stream endpoint
// GET /notifications/poll         — Polling fallback (JSON)
// POST /notifications/read/:id    — Mark notification as read
// POST /notifications/read-all    — Mark all as read
// GET /api/v1/notifications       — API: get notifications (auth required)
//
// AUTH: SSE/inbox visible to all; mutations require auth
// KV: Latest event stored in RATE_LIMITER_KV for SSE
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { isAuthenticated } from '../lib/auth'
import { layout } from '../layout'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  getLatestFromKV
} from '../lib/notificationService'

export const notificationsRoute = new Hono<{ Bindings: Env }>()

// GET /notifications — Notification inbox
notificationsRoute.get('/', async (c) => {
  const db = c.env.DB
  const tenant_id = 'default'

  let notifications = []
  let unreadCount = 0
  let error = ''

  try {
    notifications = await getNotifications(db, tenant_id, 50)
    unreadCount = await getUnreadCount(db, tenant_id)
  } catch (err: any) {
    error = err.message || 'Failed to load notifications'
  }

  const notifRows = notifications.map((n: any) => {
    const typeColors: Record<string, string> = {
      approval_pending: '#f59e0b',
      anomaly_detected: '#ef4444',
      federation_request: '#06b6d4',
      marketplace_submitted: '#a855f7',
      workflow_triggered: '#22c55e',
      system_alert: '#9aa3b2'
    }
    const color = typeColors[n.event_type] || '#4f8ef7'
    const readStyle = n.read ? 'opacity:0.5' : ''
    const readBadge = n.read
      ? `<span style="color:var(--text3);font-size:11px">read</span>`
      : `<span style="background:${color};color:#000;border-radius:10px;padding:0 6px;font-size:10px;font-weight:700">NEW</span>`

    return `
    <div class="notif-row${n.read ? ' read' : ''}" data-id="${n.id}" style="${readStyle}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
        <span style="background:${color}22;color:${color};border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">${n.event_type}</span>
        ${readBadge}
        <span style="color:var(--text3);font-size:11px;margin-left:auto">${n.created_at}</span>
      </div>
      <div style="font-weight:600;color:var(--text);margin-bottom:2px">${n.title}</div>
      <div style="color:var(--text2);font-size:13px">${n.message}</div>
      <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
        <span style="color:var(--text3);font-size:11px">actor: ${n.actor}</span>
        ${n.reference_type ? `<span style="color:var(--text3);font-size:11px">ref: ${n.reference_type}:${n.reference_id || ''}</span>` : ''}
        ${!n.read ? `<button onclick="markRead('${n.id}')" style="margin-left:auto;background:var(--bg3);border:1px solid var(--border);color:var(--text2);border-radius:5px;padding:2px 10px;cursor:pointer;font-size:12px">Mark Read</button>` : ''}
      </div>
    </div>`
  }).join('')

  const eventTypeLegend = [
    { type: 'approval_pending', color: '#f59e0b', label: 'Approval' },
    { type: 'anomaly_detected', color: '#ef4444', label: 'Anomaly' },
    { type: 'federation_request', color: '#06b6d4', label: 'Federation' },
    { type: 'marketplace_submitted', color: '#a855f7', label: 'Marketplace' },
    { type: 'workflow_triggered', color: '#22c55e', label: 'Workflow' },
    { type: 'system_alert', color: '#9aa3b2', label: 'System' },
  ].map(e => `<span style="background:${e.color}22;color:${e.color};border-radius:10px;padding:2px 8px;font-size:11px">${e.label}</span>`).join(' ')

  const content = `
  <div class="page-header">
    <div>
      <h1>🔔 Notifications</h1>
      <p style="color:var(--text2)">Real-time governance notifications — P9 SSE Stream + Inbox</p>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <span id="sse-status" style="font-size:12px;color:var(--text3)">⚪ Connecting...</span>
      ${unreadCount > 0 ? `<span style="background:#ef4444;color:#fff;border-radius:10px;padding:2px 10px;font-size:12px;font-weight:700">${unreadCount} unread</span>` : ''}
      <button onclick="markAllRead()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text2);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px">Mark All Read</button>
    </div>
  </div>

  ${error ? `<div style="background:#ef444422;border:1px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#ef4444">${error}</div>` : ''}

  <!-- SSE live feed banner -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
    <span style="font-size:12px;color:var(--text2)">Live Feed:</span>
    <div id="live-feed" style="flex:1;font-size:13px;color:var(--accent);font-family:'JetBrains Mono',monospace">Waiting for events...</div>
    <div style="display:flex;gap:6px">${eventTypeLegend}</div>
  </div>

  <!-- Notifications list with P17 bulk ops -->
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-weight:600">Inbox</span>
      <span style="color:var(--text3);font-size:12px">${notifications.length} notifications</span>
      <div style="display:flex;gap:6px">
        <button onclick="filterNotifs('all')" id="filter-all" class="filter-btn active-filter">All</button>
        <button onclick="filterNotifs('unread')" id="filter-unread" class="filter-btn">Unread</button>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
        <button onclick="toggleSelectMode()" id="select-mode-btn" class="filter-btn">☑ Select</button>
        <button onclick="bulkMarkRead()" id="bulk-read-btn" style="display:none" class="filter-btn" style="color:#22c55e">✓ Mark Read</button>
        <button onclick="bulkDelete()" id="bulk-delete-btn" style="display:none" class="filter-btn" style="color:#ef4444">🗑 Delete</button>
        <button onclick="bulkCancel()" id="bulk-cancel-btn" style="display:none" class="filter-btn">✕ Cancel</button>
        <a href="/notifications/preferences" style="background:rgba(139,92,246,0.1);color:#8b5cf6;border:1px solid rgba(139,92,246,0.2);border-radius:5px;padding:4px 10px;font-size:12px;text-decoration:none">⚙ Prefs</a>
      </div>
    </div>
    <div id="bulk-status" style="display:none;padding:8px 18px;background:rgba(79,142,247,0.08);border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">
      <span id="bulk-selected-count">0</span> selected —
      <button onclick="selectAllVisible()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;padding:0">Select All</button>
      <span style="color:var(--text3)"> / </span>
      <button onclick="clearSelection()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:0">Clear</button>
    </div>
    <div id="notif-list" style="max-height:600px;overflow-y:auto">
      ${notifications.length === 0
        ? `<div style="padding:40px;text-align:center;color:var(--text3)">No notifications yet. Events will appear here in real-time.</div>`
        : notifRows}
    </div>
  </div>

  <style>
    .notif-row { padding:14px 18px; border-bottom:1px solid var(--border); transition:background 0.2s; }
    .notif-row:hover { background:var(--bg3); }
    .notif-row.read { background:transparent; }
    .filter-btn { background:var(--bg3);border:1px solid var(--border);color:var(--text2);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:12px; }
    .active-filter { background:var(--accent);color:#fff;border-color:var(--accent); }
  </style>

  <script>
    // SSE stream connection
    let evtSource = null;
    let pollInterval = null;

    function connectSSE() {
      if (typeof EventSource === 'undefined') {
        startPolling();
        return;
      }
      try {
        evtSource = new EventSource('/notifications/stream');
        document.getElementById('sse-status').textContent = '🟡 Connecting...';

        evtSource.onopen = () => {
          document.getElementById('sse-status').textContent = '🟢 Live (SSE)';
          clearInterval(pollInterval);
        };

        evtSource.addEventListener('notification', (e) => {
          try {
            const data = JSON.parse(e.data);
            showLiveFeed(data);
          } catch(_) {}
        });

        evtSource.addEventListener('ping', () => {
          document.getElementById('sse-status').textContent = '🟢 Live (SSE)';
        });

        evtSource.onerror = () => {
          document.getElementById('sse-status').textContent = '🟡 Polling fallback';
          evtSource && evtSource.close();
          startPolling();
        };
      } catch(e) {
        startPolling();
      }
    }

    function startPolling() {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/notifications/poll');
          if (res.ok) {
            const data = await res.json();
            if (data.notification) showLiveFeed(data.notification);
          }
        } catch(_) {}
      }, 10000);
    }

    function showLiveFeed(notif) {
      const el = document.getElementById('live-feed');
      if (el) {
        el.textContent = '[' + new Date().toLocaleTimeString() + '] ' + notif.event_type + ' — ' + notif.title;
        el.style.color = '#22c55e';
        setTimeout(() => { if(el) el.style.color = 'var(--accent)'; }, 3000);
      }
    }

    async function markRead(id) {
      await fetch('/notifications/read/' + id, { method: 'POST' });
      location.reload();
    }

    async function markAllRead() {
      await fetch('/notifications/read-all', { method: 'POST' });
      location.reload();
    }

    let currentFilter = 'all';
    function filterNotifs(filter) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
      document.getElementById('filter-' + filter).classList.add('active-filter');
      document.querySelectorAll('.notif-row').forEach(row => {
        if (filter === 'unread') {
          row.style.display = row.classList.contains('read') ? 'none' : '';
        } else {
          row.style.display = '';
        }
      });
    }

    // P17: Bulk select mode
    let selectMode = false;
    const selectedIds = new Set();

    function toggleSelectMode() {
      selectMode = !selectMode;
      document.getElementById('select-mode-btn').textContent = selectMode ? '☑ Selecting' : '☑ Select';
      document.getElementById('bulk-status').style.display = selectMode ? 'block' : 'none';
      document.getElementById('bulk-read-btn').style.display = selectMode ? '' : 'none';
      document.getElementById('bulk-delete-btn').style.display = selectMode ? '' : 'none';
      document.getElementById('bulk-cancel-btn').style.display = selectMode ? '' : 'none';
      if (!selectMode) clearSelection();
      document.querySelectorAll('.notif-row').forEach(row => {
        row.style.cursor = selectMode ? 'pointer' : '';
        let cb = row.querySelector('.bulk-cb');
        if (selectMode && !cb) {
          cb = document.createElement('input');
          cb.type = 'checkbox'; cb.className = 'bulk-cb';
          cb.style.cssText = 'margin-right:10px;cursor:pointer;width:14px;height:14px;flex-shrink:0';
          cb.dataset.id = row.getAttribute('data-id');
          cb.addEventListener('change', () => updateBulkSelection(cb));
          row.style.display = 'flex'; row.style.alignItems = 'flex-start';
          row.insertBefore(cb, row.firstChild);
        } else if (!selectMode && cb) {
          cb.remove();
          row.style.display = '';
        }
      });
    }

    function updateBulkSelection(cb) {
      if (cb.checked) selectedIds.add(cb.dataset.id);
      else selectedIds.delete(cb.dataset.id);
      document.getElementById('bulk-selected-count').textContent = selectedIds.size;
    }

    function selectAllVisible() {
      document.querySelectorAll('.notif-row').forEach(row => {
        if (row.style.display !== 'none') {
          const cb = row.querySelector('.bulk-cb');
          if (cb) { cb.checked = true; selectedIds.add(cb.dataset.id); }
        }
      });
      document.getElementById('bulk-selected-count').textContent = selectedIds.size;
    }

    function clearSelection() {
      selectedIds.clear();
      document.querySelectorAll('.bulk-cb').forEach(cb => { cb.checked = false; });
      document.getElementById('bulk-selected-count').textContent = '0';
    }

    function bulkCancel() {
      if (selectMode) toggleSelectMode();
    }

    async function bulkMarkRead() {
      if (!selectedIds.size) { alert('Select at least one notification'); return; }
      const ids = JSON.stringify([...selectedIds]);
      const body = new URLSearchParams({ action: 'mark_read', ids });
      const res = await fetch('/notifications/bulk', { method: 'POST', body });
      const data = await res.json();
      if (data.success) {
        if (typeof showToast === 'function') showToast('Bulk Read', data.count + ' notifications marked read', 'success');
        setTimeout(() => location.reload(), 800);
      } else {
        alert('Bulk operation failed: ' + (data.error || 'unknown'));
      }
    }

    async function bulkDelete() {
      if (!selectedIds.size) { alert('Select at least one notification'); return; }
      if (!confirm('Delete ' + selectedIds.size + ' notification(s)? This cannot be undone.')) return;
      const ids = JSON.stringify([...selectedIds]);
      const body = new URLSearchParams({ action: 'delete', ids });
      const res = await fetch('/notifications/bulk', { method: 'POST', body });
      const data = await res.json();
      if (data.success) {
        if (typeof showToast === 'function') showToast('Bulk Delete', data.count + ' notifications deleted', 'success');
        setTimeout(() => location.reload(), 800);
      } else {
        alert('Bulk delete failed: ' + (data.error || 'unknown'));
      }
    }

    connectSSE();
  </script>
  `

  return c.html(layout('Notifications', content, '/notifications'))
})

// GET /notifications/stream — SSE endpoint
notificationsRoute.get('/stream', async (c) => {
  const db = c.env.DB
  const kv = c.env.RATE_LIMITER_KV
  const tenant_id = 'default'

  // Create SSE stream using TransformStream
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const write = async (data: string) => {
    try {
      await writer.write(encoder.encode(data))
    } catch (_) { }
  }

  // Send initial ping + recent notifications
  ;(async () => {
    try {
      await write(`: ping\n\n`)
      await write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`)

      // Send last 5 unread notifications on connect
      const recent = await getNotifications(db, tenant_id, 5, true)
      for (const n of recent) {
        await write(`event: notification\ndata: ${JSON.stringify(n)}\n\n`)
      }

      // Keep-alive pings every 25s (CF Pages 30s limit)
      let ticks = 0
      const pingTimer = setInterval(async () => {
        ticks++
        try {
          await write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now(), tick: ticks })}\n\n`)

          // Poll KV for latest notification
          if (kv) {
            const latest = await getLatestFromKV(kv, tenant_id)
            if (latest) {
              await write(`event: notification\ndata: ${JSON.stringify(latest)}\n\n`)
            }
          }
        } catch (_) {
          clearInterval(pingTimer)
        }

        if (ticks >= 10) { // Max 250s then close (CF Pages limit)
          clearInterval(pingTimer)
          try { await writer.close() } catch (_) { }
        }
      }, 25000)
    } catch (_) {
      try { await writer.close() } catch (_) { }
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
})

// GET /notifications/poll — Polling fallback (returns latest from KV)
notificationsRoute.get('/poll', async (c) => {
  const kv = c.env.RATE_LIMITER_KV
  const tenant_id = 'default'

  let notification = null
  try {
    notification = await getLatestFromKV(kv, tenant_id)
  } catch (_) { }

  return c.json({ notification, ts: Date.now() })
})

// POST /notifications/read/:id — Mark as read
notificationsRoute.post('/read/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const changed = await markNotificationRead(db, id)
  return c.json({ success: changed, id })
})

// POST /notifications/read-all — Mark all as read
notificationsRoute.post('/read-all', async (c) => {
  const db = c.env.DB
  const count = await markAllRead(db, 'default')
  return c.json({ success: true, marked: count })
})

// ============================================================
// GET /notifications/rules — P15: Platform notification rules management
// ============================================================
notificationsRoute.get('/rules', async (c) => {
  const db = c.env.DB
  let rules: any[] = []
  let totalRules = 0
  let enabledRules = 0

  if (db) {
    try {
      const rows = await db.prepare(
        `SELECT id, event_type, notification_title, notification_body, severity, enabled, created_at
         FROM platform_notification_rules ORDER BY created_at ASC`
      ).all<any>()
      rules = rows.results || []
      totalRules = rules.length
      enabledRules = rules.filter(r => r.enabled === 1).length
    } catch { /* non-blocking */ }
  }

  const severityColor: Record<string, string> = {
    info: '#4f8ef7', warning: '#fbbf24', critical: '#ef4444', error: '#f97316'
  }

  const ruleRows = rules.map(r => {
    const sColor = severityColor[r.severity] || '#9aa3b2'
    const isEnabled = r.enabled === 1
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px;font-size:10px;font-family:monospace;color:var(--text3)">${r.id}</td>
        <td style="padding:10px 12px;font-size:11px;font-family:monospace;color:var(--accent)">${r.event_type}</td>
        <td style="padding:10px 12px;font-size:12px;color:var(--text);font-weight:600">${r.notification_title}</td>
        <td style="padding:10px 12px;font-size:11px;color:var(--text2);max-width:250px">${r.notification_body}</td>
        <td style="padding:10px 12px">
          <span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:${sColor}18;color:${sColor};border:1px solid ${sColor}30">${r.severity}</span>
        </td>
        <td style="padding:10px 12px">
          ${isEnabled
            ? `<span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:rgba(34,197,94,0.08);color:#22c55e;border:1px solid rgba(34,197,94,0.2)">Enabled</span>`
            : `<span style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:rgba(107,114,128,0.08);color:#6b7280;border:1px solid rgba(107,114,128,0.2)">Disabled</span>`
          }
        </td>
        <td style="padding:10px 12px">
          <form action="/notifications/rules/${r.id}/toggle" method="POST" style="display:inline">
            <button type="submit" style="background:${isEnabled ? 'rgba(107,114,128,0.15)' : 'rgba(34,197,94,0.15)'};color:${isEnabled ? '#9aa3b2' : '#22c55e'};border:none;border-radius:4px;padding:4px 10px;font-size:10px;cursor:pointer;font-weight:600">
              ${isEnabled ? 'Disable' : 'Enable'}
            </button>
          </form>
        </td>
      </tr>
    `
  }).join('')

  const content = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">🔔 Notification Rules</h1>
        <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P15 — Platform notification rule management · enable/disable per event type</p>
      </div>
      <a href="/notifications" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Notification Inbox</a>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
      ${[
        { label: 'Total Rules', val: totalRules, color: '#4f8ef7' },
        { label: 'Enabled', val: enabledRules, color: '#22c55e' },
        { label: 'Disabled', val: totalRules - enabledRules, color: '#6b7280' },
      ].map(s => `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${s.label}</div>
          <div style="font-size:22px;font-weight:700;color:${s.color}">${s.val}</div>
        </div>
      `).join('')}
    </div>

    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:auto;margin-bottom:16px">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
        <span style="font-weight:600;color:var(--text);font-size:13px">Platform Notification Rules</span>
        <span style="color:var(--text3);font-size:11px">${totalRules} rules configured</span>
      </div>
      <table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead><tr style="background:var(--bg3)">
          ${['Rule ID','Event Type','Title','Body','Severity','Status','Action'].map(h =>
            `<th style="padding:10px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody>
          ${rules.length === 0
            ? `<tr><td colspan="7" style="padding:32px;text-align:center;color:var(--text3);font-size:12px">No notification rules configured. Add rules via migration or seed.</td></tr>`
            : ruleRows
          }
        </tbody>
      </table>
    </div>

    <div style="padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
      <span style="color:#8b5cf6;font-weight:600">P15 Notification Rules:</span>
      These rules control which platform events auto-create notifications.
      Disabling a rule suppresses notifications for that event type without deleting it.
      Rules are checked at: ABAC denial, event archive, webhook failure, alert rule trigger.
    </div>
  `
  return c.html(layout('Notification Rules — P15', content, '/notifications'))
})

// POST /notifications/rules/:id/toggle — P15: Toggle rule enabled/disabled
notificationsRoute.post('/rules/:id/toggle', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  if (!db) return c.redirect('/notifications/rules')
  try {
    await db.prepare(
      `UPDATE platform_notification_rules SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?`
    ).bind(id).run()
  } catch { /* non-blocking */ }
  return c.redirect('/notifications/rules')
})

// ============================================================
// GET /notifications/preferences — P17: Notification Preferences Management
// ============================================================
notificationsRoute.get('/preferences', async (c) => {
  const db = c.env.DB
  let prefs: any[] = []
  const ALL_EVENT_TYPES = [
    { type: 'abac.access_denied',      label: 'ABAC Access Denied',        color: '#ef4444' },
    { type: 'webhook.delivery_failed', label: 'Webhook Delivery Failed',   color: '#f97316' },
    { type: 'event.archived',          label: 'Event Archived',            color: '#a855f7' },
    { type: 'alert_rule.triggered',    label: 'Alert Rule Triggered',      color: '#fbbf24' },
    { type: 'approval.approved',       label: 'Approval Approved',         color: '#22c55e' },
    { type: 'approval.rejected',       label: 'Approval Rejected',         color: '#ef4444' },
    { type: 'intent.created',          label: 'Intent Created',            color: '#4f8ef7' },
    { type: 'federation.created',      label: 'Federation Created',        color: '#06b6d4' },
    { type: 'anomaly.detected',        label: 'Anomaly Detected',          color: '#ef4444' },
    { type: 'marketplace.submitted',   label: 'Marketplace Submitted',     color: '#a855f7' },
    { type: 'workflow_triggered',      label: 'Workflow Triggered',        color: '#22c55e' },
    { type: 'system_alert',            label: 'System Alert',              color: '#9aa3b2' },
  ]

  if (db) {
    try {
      const rows = await db.prepare(
        `SELECT event_type, enabled, min_severity, delivery_channel, created_at, updated_at
         FROM notification_preferences ORDER BY event_type ASC`
      ).all<any>()
      prefs = rows.results || []
    } catch { /* non-blocking */ }
  }

  // Build preference map for quick lookup
  const prefMap: Record<string, any> = {}
  prefs.forEach(p => { prefMap[p.event_type] = p })

  const toast = c.req.query('toast_ok') || c.req.query('toast_err') || ''

  const rows = ALL_EVENT_TYPES.map(et => {
    const pref = prefMap[et.type]
    const enabled = pref ? pref.enabled === 1 : true
    const minSev = pref?.min_severity || 'info'
    const channel = pref?.delivery_channel || 'inbox'
    return `
      <tr style="border-bottom:1px solid var(--border)" data-event-type="${et.type}">
        <td style="padding:12px 14px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${et.color};flex-shrink:0;display:inline-block"></span>
            <div>
              <div style="font-size:12px;font-family:monospace;color:${et.color};font-weight:600">${et.type}</div>
              <div style="font-size:11px;color:var(--text3)">${et.label}</div>
            </div>
          </div>
        </td>
        <td style="padding:12px 14px">
          <label class="toggle-switch">
            <input type="checkbox" ${enabled ? 'checked' : ''} onchange="savePref('${et.type}','enabled',this.checked?'1':'0')">
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td style="padding:12px 14px">
          <select onchange="savePref('${et.type}','min_severity',this.value)"
            style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:4px 8px;color:var(--text);font-size:11px;cursor:pointer;outline:none">
            ${['info','warning','error','critical'].map(s =>
              `<option value="${s}" ${minSev === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td style="padding:12px 14px">
          <select onchange="savePref('${et.type}','delivery_channel',this.value)"
            style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:4px 8px;color:var(--text);font-size:11px;cursor:pointer;outline:none">
            ${['inbox','inbox+toast','none'].map(ch =>
              `<option value="${ch}" ${channel === ch ? 'selected' : ''}>${ch}</option>`
            ).join('')}
          </select>
        </td>
        <td style="padding:12px 14px">
          <span style="font-size:10px;color:var(--text3)">${pref?.updated_at ? pref.updated_at.slice(0,16) : '(default)'}</span>
        </td>
      </tr>
    `
  }).join('')

  const enabledCount = ALL_EVENT_TYPES.filter(et => {
    const p = prefMap[et.type]
    return p ? p.enabled === 1 : true
  }).length

  const content = `
    <div class="page-header" style="margin-bottom:24px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">⚙️ Notification Preferences</h1>
        <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P17 — Per-event-type severity filter, delivery channel, enable/disable</p>
      </div>
      <div style="display:flex;gap:8px">
        <a href="/notifications" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Inbox</a>
        <a href="/notifications/rules" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">Rules →</a>
      </div>
    </div>

    <div id="pref-toast" style="display:none;padding:10px 16px;border-radius:8px;margin-bottom:16px;font-size:12px;font-weight:600"></div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
      ${[
        { label: 'Total Types', val: ALL_EVENT_TYPES.length, color: '#4f8ef7' },
        { label: 'Enabled', val: enabledCount, color: '#22c55e' },
        { label: 'Disabled', val: ALL_EVENT_TYPES.length - enabledCount, color: '#6b7280' },
        { label: 'Customized', val: prefs.length, color: '#f59e0b' },
      ].map(s => `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${s.label}</div>
          <div style="font-size:22px;font-weight:700;color:${s.color}">${s.val}</div>
        </div>
      `).join('')}
    </div>

    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:auto;margin-bottom:16px">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
        <span style="font-weight:600;color:var(--text);font-size:13px">Per-Event Preferences</span>
        <span style="color:var(--text3);font-size:11px">${ALL_EVENT_TYPES.length} event types</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button onclick="enableAll()" style="background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.2);border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer">Enable All</button>
          <button onclick="disableAll()" style="background:rgba(107,114,128,0.1);color:#6b7280;border:1px solid rgba(107,114,128,0.2);border-radius:5px;padding:4px 12px;font-size:11px;cursor:pointer">Disable All</button>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;min-width:650px">
        <thead><tr style="background:var(--bg3)">
          ${['Event Type','Enabled','Min Severity','Channel','Last Updated'].map(h =>
            `<th style="padding:10px 14px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`
          ).join('')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);border-radius:8px;font-size:11px;color:var(--text3)">
      <span style="color:#8b5cf6;font-weight:600">P17 Preferences:</span>
      Changes save instantly. <strong>Min Severity</strong> filters out events below that level.
      <strong>Channel: none</strong> suppresses delivery entirely. <strong>inbox+toast</strong> shows a toast on arrival.
      Defaults apply when no preference is explicitly set.
    </div>

    <style>
      .toggle-switch { position:relative;display:inline-block;width:38px;height:20px;cursor:pointer }
      .toggle-switch input { opacity:0;width:0;height:0 }
      .toggle-slider { position:absolute;inset:0;background:var(--bg3);border:1px solid var(--border);border-radius:20px;transition:0.2s }
      .toggle-slider:before { position:absolute;content:"";height:14px;width:14px;left:2px;bottom:2px;background:var(--text3);border-radius:50%;transition:0.2s }
      .toggle-switch input:checked + .toggle-slider { background:rgba(34,197,94,0.3);border-color:#22c55e }
      .toggle-switch input:checked + .toggle-slider:before { transform:translateX(18px);background:#22c55e }
    </style>

    <script>
      async function savePref(eventType, field, value) {
        try {
          const body = new URLSearchParams({ event_type: eventType });
          body.append(field, value);
          const res = await fetch('/notifications/preferences', { method:'POST', body });
          const data = await res.json();
          showPrefToast(data.success ? 'Preference saved: ' + eventType : 'Save failed', data.success);
        } catch(e) {
          showPrefToast('Error: ' + e.message, false);
        }
      }

      function showPrefToast(msg, ok) {
        const el = document.getElementById('pref-toast');
        el.textContent = (ok ? '✓ ' : '✗ ') + msg;
        el.style.display = 'block';
        el.style.background = ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
        el.style.color = ok ? '#22c55e' : '#ef4444';
        el.style.border = '1px solid ' + (ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)');
        setTimeout(() => { el.style.display = 'none'; }, 3000);
      }

      async function enableAll() {
        const rows = document.querySelectorAll('tr[data-event-type]');
        for (const row of rows) {
          const et = row.getAttribute('data-event-type');
          const cb = row.querySelector('input[type=checkbox]');
          if (cb && !cb.checked) { cb.checked = true; await savePref(et, 'enabled', '1'); }
        }
        showPrefToast('All event types enabled', true);
      }

      async function disableAll() {
        const rows = document.querySelectorAll('tr[data-event-type]');
        for (const row of rows) {
          const et = row.getAttribute('data-event-type');
          const cb = row.querySelector('input[type=checkbox]');
          if (cb && cb.checked) { cb.checked = false; await savePref(et, 'enabled', '0'); }
        }
        showPrefToast('All event types disabled', true);
      }
    </script>
  `
  return c.html(layout('Notification Preferences — P17', content, '/notifications'))
})

// POST /notifications/preferences — P17: Update a single notification preference
notificationsRoute.post('/preferences', async (c) => {
  const db = c.env.DB
  if (!db) return c.json({ success: false, error: 'no-db' }, 503)

  try {
    const body = await c.req.parseBody()
    const event_type = String(body.event_type || '').trim()
    if (!event_type) return c.json({ success: false, error: 'missing event_type' }, 400)

    const updates: string[] = []
    const params: any[] = []

    if (body.enabled !== undefined) {
      updates.push('enabled = ?')
      params.push(body.enabled === '1' ? 1 : 0)
    }
    if (body.min_severity !== undefined) {
      updates.push('min_severity = ?')
      params.push(String(body.min_severity))
    }
    if (body.delivery_channel !== undefined) {
      updates.push('delivery_channel = ?')
      params.push(String(body.delivery_channel))
    }

    if (updates.length === 0) return c.json({ success: false, error: 'no fields to update' }, 400)

    updates.push("updated_at = CURRENT_TIMESTAMP")

    // Upsert: insert if not exists, update if exists
    const existing = await db.prepare(
      `SELECT id FROM notification_preferences WHERE event_type = ?`
    ).bind(event_type).first<{ id: number }>()

    if (existing) {
      await db.prepare(
        `UPDATE notification_preferences SET ${updates.join(', ')} WHERE event_type = ?`
      ).bind(...params, event_type).run()
    } else {
      // Build insert fields dynamically
      const insertFields = ['event_type']
      const insertVals: any[] = [event_type]
      if (body.enabled !== undefined) { insertFields.push('enabled'); insertVals.push(body.enabled === '1' ? 1 : 0) }
      if (body.min_severity !== undefined) { insertFields.push('min_severity'); insertVals.push(String(body.min_severity)) }
      if (body.delivery_channel !== undefined) { insertFields.push('delivery_channel'); insertVals.push(String(body.delivery_channel)) }
      await db.prepare(
        `INSERT INTO notification_preferences (${insertFields.join(',')}) VALUES (${insertFields.map(() => '?').join(',')})`
      ).bind(...insertVals).run()
    }

    return c.json({ success: true, event_type })
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'unknown error' }, 500)
  }
})

// ============================================================
// POST /notifications/bulk — P17: Bulk operations on notifications
// body: action=mark_read|delete, ids=JSON array OR all=true
// ============================================================
notificationsRoute.post('/bulk', async (c) => {
  const db = c.env.DB
  if (!db) return c.json({ success: false, error: 'no-db' }, 503)

  try {
    const body = await c.req.parseBody()
    const action = String(body.action || '').trim()
    const allFlag = body.all === 'true' || body.all === '1'
    const idsRaw = String(body.ids || '[]')

    if (!['mark_read', 'delete'].includes(action)) {
      return c.json({ success: false, error: 'invalid action' }, 400)
    }

    let ids: string[] = []
    let count = 0

    if (allFlag) {
      // Operate on all notifications for default tenant
      if (action === 'mark_read') {
        const res = await db.prepare(
          `UPDATE notifications SET read = 1 WHERE tenant_id = 'default' AND read = 0`
        ).run()
        count = res.meta?.changes || 0
      } else if (action === 'delete') {
        const res = await db.prepare(
          `DELETE FROM notifications WHERE tenant_id = 'default'`
        ).run()
        count = res.meta?.changes || 0
      }
    } else {
      try { ids = JSON.parse(idsRaw) } catch { ids = [] }
      if (!ids.length) return c.json({ success: false, error: 'no ids provided' }, 400)

      // Process in batches of 10 for D1 safety
      const batches: string[][] = []
      for (let i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10))

      for (const batch of batches) {
        const placeholders = batch.map(() => '?').join(',')
        if (action === 'mark_read') {
          const res = await db.prepare(
            `UPDATE notifications SET read = 1 WHERE id IN (${placeholders})`
          ).bind(...batch).run()
          count += res.meta?.changes || 0
        } else if (action === 'delete') {
          const res = await db.prepare(
            `DELETE FROM notifications WHERE id IN (${placeholders})`
          ).bind(...batch).run()
          count += res.meta?.changes || 0
        }
      }
    }

    // Log bulk operation (non-blocking)
    if (db) {
      db.prepare(
        `INSERT INTO notification_bulk_ops (operation, notification_ids, count, performed_by, tenant_id)
         VALUES (?, ?, ?, 'user', 'default')`
      ).bind(action, allFlag ? '["all"]' : idsRaw, count).run().catch(() => {})
    }

    return c.json({ success: true, action, count })
  } catch (e: any) {
    return c.json({ success: false, error: e.message || 'unknown error' }, 500)
  }
})
