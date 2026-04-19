// ============================================================
// SOVEREIGN OS PLATFORM — PLATFORM SEARCH SURFACE (P15+P16)
// P15: Unified search (intents, audit, notifications, tenants)
// P16: Scope selector, term highlighting, recent searches,
//      search history (localStorage), add workflows/policies/connectors
//
// GET /search?q=...&scope=...  — HTML search page + results
// GET /search/api?q=...        — JSON API for search results
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'

const RESULT_LIMIT = 20

// ---- Type metadata ----
const TYPE_META: Record<string, { icon: string; color: string; badge: string; scope: string }> = {
  intent:       { icon: '◈', color: '#4f8ef7', badge: 'Intent',       scope: 'intents' },
  audit:        { icon: '🔏', color: '#f59e0b', badge: 'Audit',        scope: 'audit' },
  notification: { icon: '🔔', color: '#22c55e', badge: 'Notification', scope: 'notifications' },
  tenant:       { icon: '⊛', color: '#a855f7', badge: 'Tenant',       scope: 'tenants' },
  workflow:     { icon: '⚡', color: '#06b6d4', badge: 'Workflow',      scope: 'workflows' },
  policy:       { icon: '🔐', color: '#f97316', badge: 'Policy',       scope: 'policies' },
  connector:    { icon: '⊞', color: '#10b981', badge: 'Connector',     scope: 'connectors' },
}

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'intents', label: '◈ Intents' },
  { value: 'audit', label: '🔏 Audit' },
  { value: 'notifications', label: '🔔 Notifications' },
  { value: 'tenants', label: '⊛ Tenants' },
  { value: 'workflows', label: '⚡ Workflows' },
  { value: 'policies', label: '🔐 Policies' },
  { value: 'connectors', label: '⊞ Connectors' },
]

// ---- Searchers ----
async function searchIntents(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, title, status, created_at FROM intents
       WHERE (title LIKE ? OR body LIKE ?) AND title IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'intent', _url: '/intent', _label: r.title }))
  } catch { return [] }
}

async function searchAuditEvents(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, event_type, actor, tenant_id, created_at FROM audit_log_v2
       WHERE (event_type LIKE ? OR actor LIKE ?) AND event_type IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'audit', _url: `/audit/${r.id}`, _label: r.event_type }))
  } catch { return [] }
}

async function searchNotifications(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, title, message, event_type, created_at FROM notifications
       WHERE (title LIKE ? OR message LIKE ?) AND title IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'notification', _url: '/notifications', _label: r.title }))
  } catch { return [] }
}

async function searchTenants(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, name, slug, status, created_at FROM tenants
       WHERE (name LIKE ? OR slug LIKE ?) AND name IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'tenant', _url: `/tenants`, _label: r.name }))
  } catch { return [] }
}

async function searchWorkflows(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, name, description, status, created_at FROM workflow_definitions
       WHERE (name LIKE ? OR description LIKE ?) AND name IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'workflow', _url: '/workflows', _label: r.name || r.id }))
  } catch { return [] }
}

async function searchPolicies(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, name, description, effect, status, created_at FROM abac_policies
       WHERE (name LIKE ? OR description LIKE ?) AND name IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'policy', _url: '/policies', _label: r.name || r.id }))
  } catch { return [] }
}

async function searchConnectors(db: D1Database, q: string): Promise<any[]> {
  try {
    const rows = await db.prepare(
      `SELECT id, name, type, status, created_at FROM connectors
       WHERE (name LIKE ? OR type LIKE ?) AND name IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`
    ).bind(`%${q}%`, `%${q}%`, RESULT_LIMIT).all<any>()
    return (rows.results || []).map(r => ({ ...r, _type: 'connector', _url: '/connectors', _label: r.name || r.id }))
  } catch { return [] }
}

// Highlight matching term in text
function hlText(text: string, q: string): string {
  if (!q || !text) return text || ''
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(
    new RegExp(`(${escaped})`, 'gi'),
    `<mark style="background:rgba(245,158,11,0.28);color:#f59e0b;border-radius:2px;padding:0 2px">$1</mark>`
  )
}

export function createSearchRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /search — HTML search page
  route.get('/', async (c) => {
    const q = (c.req.query('q') || '').trim()
    const scope = (c.req.query('scope') || 'all').toLowerCase()
    let totalResults = 0
    let searchTime = 0

    const groups: Record<string, any[]> = {
      intent: [], audit: [], notification: [], tenant: [],
      workflow: [], policy: [], connector: [],
    }

    if (q.length >= 2 && c.env.DB) {
      const t0 = Date.now()

      const runSearch = (type: string) => {
        if (scope !== 'all' && TYPE_META[type]?.scope !== scope) return Promise.resolve([])
        switch (type) {
          case 'intent': return searchIntents(c.env.DB!, q)
          case 'audit': return searchAuditEvents(c.env.DB!, q)
          case 'notification': return searchNotifications(c.env.DB!, q)
          case 'tenant': return searchTenants(c.env.DB!, q)
          case 'workflow': return searchWorkflows(c.env.DB!, q)
          case 'policy': return searchPolicies(c.env.DB!, q)
          case 'connector': return searchConnectors(c.env.DB!, q)
          default: return Promise.resolve([])
        }
      }

      const [intents, auditEvents, notifications, tenants, workflows, policies, connectors] = await Promise.all([
        runSearch('intent'), runSearch('audit'), runSearch('notification'), runSearch('tenant'),
        runSearch('workflow'), runSearch('policy'), runSearch('connector'),
      ])
      searchTime = Date.now() - t0
      groups.intent = intents
      groups.audit = auditEvents
      groups.notification = notifications
      groups.tenant = tenants
      groups.workflow = workflows
      groups.policy = policies
      groups.connector = connectors
      totalResults = Object.values(groups).reduce((s, a) => s + a.length, 0)
    }

    function renderItem(item: any, type: string): string {
      const meta = TYPE_META[type]
      const label = hlText(item._label || item.title || item.event_type || item.name || item.id || '', q)
      let detail = ''
      switch (type) {
        case 'intent': detail = `Status: ${item.status || '—'}`; break
        case 'audit': detail = `Actor: ${hlText(item.actor || '—', q)} · Tenant: ${item.tenant_id || '—'}`; break
        case 'notification': detail = hlText((item.message || '').slice(0, 100), q) + ((item.message || '').length > 100 ? '…' : ''); break
        case 'tenant': detail = `Slug: ${item.slug || '—'} · Status: ${item.status || '—'}`; break
        case 'workflow': detail = `Status: ${item.status || '—'} · ${hlText((item.description || '').slice(0, 60), q)}`; break
        case 'policy': detail = `Effect: ${item.effect || '—'} · Status: ${item.status || '—'}`; break
        case 'connector': detail = `Type: ${item.type || '—'} · Status: ${item.status || '—'}`; break
      }
      return `
        <div style="padding:11px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start">
          <div style="flex-shrink:0;width:30px;height:30px;border-radius:6px;background:${meta.color}18;display:flex;align-items:center;justify-content:center;font-size:13px">${meta.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
              <a href="${item._url}" style="font-size:13px;font-weight:600;color:var(--text);text-decoration:none">${label}</a>
              <span style="padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:${meta.color}18;color:${meta.color}">${meta.badge}</span>
            </div>
            <div style="font-size:11px;color:var(--text3)">${detail}</div>
          </div>
          <div style="flex-shrink:0;font-size:10px;color:var(--text3)">${(item.created_at || '').slice(0, 10)}</div>
        </div>`
    }

    function renderGroup(type: string, items: any[]): string {
      if (items.length === 0) return ''
      const meta = TYPE_META[type]
      return `
        <div style="margin-bottom:0">
          <div style="padding:7px 16px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;font-weight:600;color:${meta.color}">${meta.icon} ${meta.badge}</span>
            <span style="font-size:10px;color:var(--text3)">${items.length} result${items.length !== 1 ? 's' : ''}</span>
          </div>
          ${items.map(item => renderItem(item, type)).join('')}
        </div>`
    }

    const resultsHtml = q.length < 2
      ? `<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">Enter at least 2 characters to search.</div>`
      : totalResults === 0
      ? `<div style="padding:40px;text-align:center;color:var(--text3);font-size:13px">No results for "<strong style="color:var(--text)">${q}</strong>".</div>`
      : Object.entries(groups).map(([type, items]) => renderGroup(type, items)).join('')

    // Scope selector buttons
    const scopeButtons = SCOPE_OPTIONS.map(opt => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (opt.value !== 'all') params.set('scope', opt.value)
      const isActive = (scope === opt.value) || (opt.value === 'all' && scope === 'all')
      return `<a href="/search?${params.toString()}" style="padding:5px 10px;border-radius:5px;font-size:11px;text-decoration:none;border:1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};background:${isActive ? 'rgba(79,142,247,0.12)' : 'var(--bg2)'};color:${isActive ? 'var(--accent)' : 'var(--text2)'};white-space:nowrap">${opt.label}</a>`
    }).join('')

    const content = `
      <div style="max-width:860px;margin:0 auto">
        <!-- Header -->
        <div style="margin-bottom:20px">
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0 0 4px">🔍 Platform Search</h1>
          <p style="color:var(--text3);font-size:12px;margin:0">P15+P16 — Unified search: intents, audit, notifications, tenants, workflows, policies, connectors</p>
        </div>

        <!-- Search form -->
        <form method="GET" action="/search" id="search-form-main" style="margin-bottom:12px">
          ${scope !== 'all' ? `<input type="hidden" name="scope" value="${scope}">` : ''}
          <div style="display:flex;gap:8px">
            <div style="flex:1;position:relative">
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;pointer-events:none">🔍</span>
              <input
                name="q"
                id="search-main-input"
                value="${q.replace(/"/g, '&quot;')}"
                placeholder="Search across all platform surfaces..."
                autofocus
                autocomplete="off"
                style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 16px 10px 36px;color:var(--text);font-size:13px;outline:none"
                oninput="updateRecentSuggestions(this.value)"
              >
            </div>
            <button type="submit" class="btn btn-primary">Search</button>
            ${q ? `<a href="/search${scope !== 'all' ? '?scope='+scope : ''}" class="btn btn-ghost">✕</a>` : ''}
          </div>
        </form>

        <!-- Scope selector (P16) -->
        <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
          <span style="font-size:10px;color:var(--text3);margin-right:2px">Scope:</span>
          ${scopeButtons}
        </div>

        <!-- Recent searches (P16 — rendered client-side from localStorage) -->
        <div id="recent-searches-bar" style="display:none;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:10px;color:var(--text3)">Recent:</span>
            <div id="recent-searches-list" style="display:flex;gap:6px;flex-wrap:wrap"></div>
            <button onclick="clearRecentSearches()" style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer;padding:2px 6px">clear</button>
          </div>
        </div>

        ${q.length >= 2 ? `
          <!-- Results summary -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
            <span style="font-size:12px;color:var(--text2)">${totalResults} result${totalResults !== 1 ? 's' : ''} for "<strong style="color:var(--text)">${q}</strong>"</span>
            <span style="font-size:10px;color:var(--text3)">(${searchTime}ms)</span>
            ${Object.entries(groups).filter(([,v]) => v.length > 0).map(([type, items]) => {
              const m = TYPE_META[type]
              return `<span style="padding:2px 8px;border-radius:4px;font-size:10px;background:${m.color}18;color:${m.color};border:1px solid ${m.color}30">${m.badge}: ${items.length}</span>`
            }).join('')}
          </div>
        ` : ''}

        <!-- Results -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
          ${resultsHtml}
        </div>

        ${!q ? `
          <!-- Search hints -->
          <div style="margin-top:16px;padding:12px 16px;background:rgba(79,142,247,0.04);border:1px solid rgba(79,142,247,0.12);border-radius:8px">
            <div style="font-size:11px;color:var(--text3);margin-bottom:8px"><span style="color:#4f8ef7;font-weight:600">P16 Searchable surfaces:</span> 7 surface types + full-text highlighting</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
              ${Object.entries(TYPE_META).map(([type, m]) => `
                <div style="display:flex;align-items:center;gap:6px">
                  <span>${m.icon}</span>
                  <span style="font-size:11px;color:${m.color};font-weight:600">${m.badge}</span>
                </div>
              `).join('')}
            </div>
            <div style="margin-top:10px;font-size:10px;color:var(--text3)">
              💡 Tip: Press <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-family:monospace">/</kbd> anywhere to focus the search bar
            </div>
          </div>
        ` : ''}
      </div>

      <script>
        // P16: Recent searches (localStorage)
        const RECENT_KEY = 'sovereign-recent-searches'
        const MAX_RECENT = 8
        const currentQ = ${JSON.stringify(q)}

        function getRecent() {
          try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
        }
        function saveRecent(q) {
          if (!q || q.length < 2) return
          let arr = getRecent().filter(s => s !== q)
          arr.unshift(q)
          arr = arr.slice(0, MAX_RECENT)
          try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr)) } catch {}
        }
        function clearRecentSearches() {
          try { localStorage.removeItem(RECENT_KEY) } catch {}
          document.getElementById('recent-searches-bar').style.display = 'none'
        }
        function renderRecentSearches() {
          const bar = document.getElementById('recent-searches-bar')
          const list = document.getElementById('recent-searches-list')
          const arr = getRecent().filter(s => s !== currentQ)
          if (!arr.length || !list || !bar) return
          bar.style.display = ''
          list.innerHTML = arr.map(s => {
            const href = '/search?q=' + encodeURIComponent(s) + ${JSON.stringify(scope !== 'all' ? '&scope='+scope : '')}
            return '<a href="' + href + '" style="padding:3px 9px;border-radius:4px;font-size:11px;text-decoration:none;background:var(--bg3);border:1px solid var(--border);color:var(--text2)">' + s + '</a>'
          }).join('')
        }
        function updateRecentSuggestions() { /* placeholder */ }

        // Save current search to recent + P17: log analytics
        if (currentQ && currentQ.length >= 2) {
          saveRecent(currentQ)
          // Bookmark feature
          const BOOKMARKS_KEY = 'sovereign-search-bookmarks'
          function getBookmarks() { try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]') } catch { return [] } }
          window._searchBookmarks = getBookmarks()
        }
        renderRecentSearches()

        // P17: Bookmark current search
        function bookmarkSearch() {
          if (!currentQ || currentQ.length < 2) return;
          const BOOKMARKS_KEY = 'sovereign-search-bookmarks'
          let bm = [];
          try { bm = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]') } catch { bm = [] }
          const entry = { q: currentQ, scope: ${JSON.stringify(scope)}, savedAt: new Date().toISOString() };
          if (!bm.find(b => b.q === currentQ)) {
            bm.unshift(entry); bm = bm.slice(0, 20);
            try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bm)) } catch {}
            if (typeof showToast === 'function') showToast('Search Saved', '"' + currentQ + '" added to bookmarks', 'success');
          } else {
            if (typeof showToast === 'function') showToast('Already Saved', '"' + currentQ + '" is already bookmarked', 'info');
          }
        }

        // Keyboard shortcut: Esc clears search
        document.getElementById('search-main-input')?.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') { this.value = ''; this.blur(); }
        })
      </script>
    `

    return c.html(layout('Platform Search — P15+P16+P17', content, '/search', 0, {
      breadcrumbs: [{ label: 'Search' }]
    }))
  })

  // GET /search/api — JSON API
  route.get('/api', async (c) => {
    const q = (c.req.query('q') || '').trim()
    if (q.length < 2) return c.json({ q, error: 'Query must be at least 2 characters', results: {} })
    if (!c.env.DB) return c.json({ q, error: 'DB not available', results: {} })

    const [intents, auditEvents, notifications, tenants, workflows, policies, connectors] = await Promise.all([
      searchIntents(c.env.DB, q),
      searchAuditEvents(c.env.DB, q),
      searchNotifications(c.env.DB, q),
      searchTenants(c.env.DB, q),
      searchWorkflows(c.env.DB, q),
      searchPolicies(c.env.DB, q),
      searchConnectors(c.env.DB, q),
    ])

      // P17: Save analytics to D1 (non-blocking)
      if (c.env.DB && q.length >= 2) {
        const t0 = Date.now()
        const total = intents.length + auditEvents.length + notifications.length + tenants.length + workflows.length + policies.length + connectors.length
        const duration = Date.now() - t0
        c.env.DB.prepare(
          `INSERT INTO search_analytics (query_term, scope, result_count, search_duration_ms)
           VALUES (?, ?, ?, ?)`
        ).bind(q, 'all', total, duration).run().catch(() => {})
      }

    return c.json({
      q,
      total: intents.length + auditEvents.length + notifications.length + tenants.length + workflows.length + policies.length + connectors.length,
      results: {
        intents:       intents.map(({ _type, _url, _label, ...r }) => r),
        audit:         auditEvents.map(({ _type, _url, _label, ...r }) => r),
        notifications: notifications.map(({ _type, _url, _label, ...r }) => r),
        tenants:       tenants.map(({ _type, _url, _label, ...r }) => r),
        workflows:     workflows.map(({ _type, _url, _label, ...r }) => r),
        policies:      policies.map(({ _type, _url, _label, ...r }) => r),
        connectors:    connectors.map(({ _type, _url, _label, ...r }) => r),
      }
    })
  })

  // GET /search/analytics — P17: Search analytics (most searched terms)
  route.get('/analytics', async (c) => {
    const db = c.env.DB
    let topTerms: any[] = []
    let recentSearches: any[] = []
    let totalSearches = 0

    if (db) {
      try {
        const cnt = await db.prepare(`SELECT COUNT(*) as n FROM search_analytics`).first<{ n: number }>()
        totalSearches = cnt?.n || 0

        const top = await db.prepare(
          `SELECT query_term, COUNT(*) as count, AVG(result_count) as avg_results
           FROM search_analytics
           GROUP BY query_term ORDER BY count DESC LIMIT 20`
        ).all<any>()
        topTerms = top.results || []

        const recent = await db.prepare(
          `SELECT query_term, scope, result_count, searched_at
           FROM search_analytics ORDER BY searched_at DESC LIMIT 30`
        ).all<any>()
        recentSearches = recent.results || []
      } catch { /* non-blocking */ }
    }

    const content = `
      <div class="page-header" style="margin-bottom:24px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">📊 Search Analytics</h1>
          <p style="color:var(--text2);font-size:12px;margin:4px 0 0">P17 — Most searched terms and search activity log</p>
        </div>
        <a href="/search" style="background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:7px 14px;font-size:11px;text-decoration:none">← Search</a>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${[
          { label: 'Total Searches', val: totalSearches, color: '#4f8ef7' },
          { label: 'Unique Terms', val: topTerms.length, color: '#a855f7' },
          { label: 'Recent (last 30)', val: recentSearches.length, color: '#22c55e' },
        ].map(s => `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:4px">${s.label}</div>
            <div style="font-size:22px;font-weight:700;color:${s.color}">${s.val}</div>
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px">Top Searched Terms</div>
          ${topTerms.length === 0
            ? `<div style="padding:30px;text-align:center;color:var(--text3);font-size:12px">No search data yet. Searches are logged as users search the platform.</div>`
            : `<table style="width:100%;border-collapse:collapse">
                <thead><tr style="background:var(--bg3)">
                  ${['Term','Searches','Avg Results'].map(h => `<th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`).join('')}
                </tr></thead>
                <tbody>
                  ${topTerms.map(t => `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 12px"><a href="/search?q=${encodeURIComponent(t.query_term)}" style="color:var(--accent);font-size:12px;text-decoration:none">${t.query_term}</a></td>
                    <td style="padding:8px 12px;font-size:12px;font-weight:600;color:var(--text)">${t.count}</td>
                    <td style="padding:8px 12px;font-size:11px;color:var(--text3)">${Math.round(t.avg_results || 0)}</td>
                  </tr>`).join('')}
                </tbody>
               </table>`
          }
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px">Recent Searches</div>
          ${recentSearches.length === 0
            ? `<div style="padding:30px;text-align:center;color:var(--text3);font-size:12px">No searches logged yet.</div>`
            : `<table style="width:100%;border-collapse:collapse">
                <thead><tr style="background:var(--bg3)">
                  ${['Term','Scope','Results','At'].map(h => `<th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--text3);font-weight:500">${h}</th>`).join('')}
                </tr></thead>
                <tbody>
                  ${recentSearches.map(s => `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 12px"><a href="/search?q=${encodeURIComponent(s.query_term)}" style="color:var(--accent);font-size:11px;text-decoration:none">${s.query_term}</a></td>
                    <td style="padding:8px 12px;font-size:10px;color:var(--text3)">${s.scope}</td>
                    <td style="padding:8px 12px;font-size:11px;color:var(--text2)">${s.result_count}</td>
                    <td style="padding:8px 12px;font-size:10px;color:var(--text3)">${(s.searched_at || '').slice(0,16)}</td>
                  </tr>`).join('')}
                </tbody>
               </table>`
          }
        </div>
      </div>
    `
    return c.html(layout('Search Analytics — P17', content, '/search', 0, {
      breadcrumbs: [{ label: 'Search', href: '/search' }, { label: 'Analytics' }]
    }))
  })

  return route
}
