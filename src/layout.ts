// ============================================================
// SOVEREIGN OS PLATFORM — SHARED HTML LAYOUT SHELL
// P16: Header search bar, notification bell badge, dark mode toggle,
//      collapsible sidebar sections, breadcrumbs, mobile-responsive
// P18: Page transition loader bar, nav reorganization (merged P16/P17
//      items into contextual groups), keyboard accessibility,
//      performance resource hints, skip-to-content, sidebar search filter
// P21: GPU-accelerated sidebar (will-change + contain), CSS max-height
//      collapsible nav (zero JS layout blocking), debounced event listeners
//      (120ms nav filter, 150ms resize), non-blocking font load,
//      scaleX page loader (pure GPU, no layout recalc), rAF DOM batching
// P22: Architecture refactor — CSS extracted to layout-styles.ts,
//      client JS extracted to layout-client.ts. Shell renderer is
//      now < 200 lines. Zero regression on any existing behaviour.
// ============================================================

import { getLayoutCSS } from './layout-styles'
import { getLayoutScript } from './layout-client'

// ---- Platform version constant (single source of truth) ----
export const PLATFORM_VERSION = '2.0.0-P22'
export const PLATFORM_PHASE   = 'P22 — Layout Refactor, Version Consistency, D1 Verification, Perf Observability'

export interface LayoutOptions {
  activePage?: string
  alertCount?: number
  notifCount?: number       // P16: notification bell badge count
  breadcrumbs?: Array<{ label: string; href?: string }>  // P16: breadcrumbs
  darkModeDefault?: boolean // P16: dark mode default
}

// ---- Navigation structure (single authoritative definition) ----
const NAV_SECTIONS = [
  {
    id: 'core', label: 'Core Platform', color: '#4f8ef7',
    items: [
      { path: '/dashboard',   label: 'Dashboard',   icon: '⬡' },
      { path: '/intent',      label: 'Intent',      icon: '◈' },
      { path: '/intake',      label: 'Intake',      icon: '⊕' },
      { path: '/architect',   label: 'Architect',   icon: '◉' },
      { path: '/approvals',   label: 'Approvals',   icon: '◎' },
      { path: '/proof',       label: 'Proof',       icon: '◇' },
      { path: '/live',        label: 'Live',        icon: '◆' },
      { path: '/records',     label: 'Records',     icon: '▣' },
      { path: '/continuity',  label: 'Continuity',  icon: '↻' },
      { path: '/execution',   label: 'Execution',   icon: '▶' },
      { path: '/connectors',  label: 'Connectors',  icon: '⊞' },
      { path: '/roles',       label: 'Roles',       icon: '◈' },
    ]
  },
  {
    id: 'governance', label: 'Governance', color: '#ef4444',
    items: [
      { path: '/workspace',    label: 'Workspace',     icon: '◈' },
      { path: '/alerts',       label: 'Alerts',        icon: '◉', countKey: 'alerts' },
      { path: '/canon',        label: 'Canon',         icon: '▣' },
      { path: '/lanes',        label: 'Lanes',         icon: '⊟' },
      { path: '/onboarding',   label: 'Onboarding',    icon: '⬠' },
      { path: '/policies',     label: 'ABAC Policies', icon: '🔐' },
      { path: '/alert-rules',  label: 'Alert Rules',   icon: '🔔' },
      { path: '/remediation',  label: 'Remediation',   icon: '🛠️' },
    ]
  },
  {
    id: 'tenants', label: 'Tenants & API', color: '#22c55e',
    items: [
      { path: '/tenants',    label: 'Tenants',  icon: '⊛' },
      { path: '/ai-assist',  label: 'AI Assist', icon: '◎' },
      { path: '/api-keys',   label: 'API Keys', icon: '⊕' },
      { path: '/branding',   label: 'Branding', icon: '◈' },
      { path: '/auth/sso',   label: 'SSO',      icon: '⊕' },
    ]
  },
  {
    id: 'observability', label: 'Observability', color: '#f59e0b',
    items: [
      { path: '/metrics',              label: 'Metrics',       icon: '📈' },
      { path: '/metrics/snapshots',    label: 'Metrics History', icon: '📷' },
      { path: '/audit',                label: 'Audit Trail',   icon: '🔏' },
      { path: '/audit/deny-log',       label: 'ABAC Deny Log', icon: '🔒' },
      { path: '/audit/export-jobs',    label: 'Export Jobs',   icon: '📥' },
      { path: '/health-dashboard',     label: 'Health',        icon: '🏥' },
      { path: '/events',               label: 'Event Bus',     icon: '📡' },
      { path: '/events/archive-stats', label: 'Event Archive', icon: '📦' },
    ]
  },
  {
    id: 'workflows', label: 'Workflows & Reports', color: '#06b6d4',
    items: [
      { path: '/workflows',               label: 'Workflows',        icon: '⚡' },
      { path: '/workflows/history',       label: 'Run History',      icon: '📋' },
      { path: '/reports',                 label: 'Reports',          icon: '📊' },
      { path: '/reports/subscriptions',   label: 'Scheduled Reports', icon: '🗓️' },
    ]
  },
  {
    id: 'notifications', label: 'Notifications', color: '#f97316',
    items: [
      { path: '/notifications',             label: 'Inbox',       icon: '🔔' },
      { path: '/notifications/preferences', label: 'Preferences', icon: '⚙️' },
      { path: '/notifications/rules',       label: 'Rules',       icon: '📋' },
    ]
  },
  {
    id: 'search', label: 'Search & Discovery', color: '#10b981',
    items: [
      { path: '/search',            label: 'Search',           icon: '🔍' },
      { path: '/search/analytics',  label: 'Search Analytics', icon: '📊' },
    ]
  },
  {
    id: 'platform', label: 'Platform Admin', color: '#8b5cf6',
    items: [
      { path: '/admin',                   label: 'Admin Panel',    icon: '🛡️' },
      { path: '/admin/settings',          label: 'Settings',       icon: '⚙️' },
      { path: '/admin/sessions',          label: 'Sessions',       icon: '👤' },
      { path: '/admin/api-keys',          label: 'Key Rotation',   icon: '🔑' },
      { path: '/plans',                   label: 'Tenant Plans',   icon: '📋' },
      { path: '/billing',                 label: 'Billing',        icon: '💳' },
      { path: '/changelog',               label: 'Changelog',      icon: '📝' },
      { path: '/federation',              label: 'Federation',     icon: '🔗' },
      { path: '/marketplace',             label: 'Marketplace',    icon: '🛒' },
      { path: '/portal',                  label: 'Portal',         icon: '🏠' },
      { path: '/portal/default/policies', label: 'Portal Policies', icon: '🛡️' },
      { path: '/docs',                    label: 'Dev Docs',       icon: '📖' },
      { path: '/api/v2/docs',             label: 'API v2',         icon: '⚙' },
    ]
  },
] as const

// ---- Main layout function ----
export function layout(
  title: string,
  content: string,
  activePage: string = '',
  alertCount: number = 0,
  opts: LayoutOptions = {}
): string {
  const { notifCount = 0, breadcrumbs = [] } = opts

  // Build nav HTML
  const navHtml = NAV_SECTIONS.map(section => {
    const isActiveSection = section.items.some(item =>
      activePage === item.path || activePage.startsWith(item.path.split('?')[0].split('#')[0] + '/')
    )
    const chevron = `<span class="nav-chevron${isActiveSection ? ' open' : ' closed'}" id="chevron-${section.id}">${isActiveSection ? '▾' : '▸'}</span>`
    const items = section.items.map(item => {
      const isActive = activePage === item.path ||
        (item.path.length > 1 && activePage.startsWith(item.path.split('?')[0].split('#')[0]))
      const count = (item as any).countKey === 'alerts' ? alertCount : 0
      const countBadge = count > 0
        ? `<span style="background:var(--red);color:#fff;border-radius:10px;padding:0 5px;font-size:10px;font-weight:700;margin-left:auto">${count}</span>`
        : ''
      return `<a href="${item.path}" class="nav-item${isActive ? ' active' : ''}" data-nav-label="${item.label.toLowerCase()}">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
        ${countBadge}
      </a>`
    }).join('')

    return `
      <div class="nav-group" id="group-${section.id}">
        <div class="nav-group-header" onclick="toggleNavGroup('${section.id}')" role="button" tabindex="0" aria-expanded="${isActiveSection ? 'true' : 'false'}" aria-controls="items-${section.id}" onkeydown="if(event.key==='Enter'||event.key===' ')toggleNavGroup('${section.id}')">
          <span class="nav-dot" style="background:${section.color}"></span>
          <span class="nav-group-label" style="color:${section.color}">${section.label}</span>
          ${chevron}
        </div>
        <div class="nav-group-items${isActiveSection ? '' : ' collapsed'}" id="items-${section.id}">
          ${items}
        </div>
      </div>`
  }).join('')

  // Breadcrumbs
  const breadcrumbsHtml = breadcrumbs.length > 0 ? `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/dashboard" class="bc-item bc-home">⬡ Home</a>
      ${breadcrumbs.map((bc, i) =>
        bc.href && i < breadcrumbs.length - 1
          ? `<span class="bc-sep">›</span><a href="${bc.href}" class="bc-item">${bc.label}</a>`
          : `<span class="bc-sep">›</span><span class="bc-item bc-current">${bc.label}</span>`
      ).join('')}
    </nav>
  ` : ''

  const bellBadgeHtml = notifCount > 0
    ? `<span class="notif-bell-badge">${notifCount > 99 ? '99+' : notifCount}</span>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark" id="html-root">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Sovereign OS Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
  <!-- P21: Non-blocking font load — preload trick eliminates render-blocking -->
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"></noscript>
  <style>${getLayoutCSS()}</style>
</head>
<body>
  <!-- P18: Skip to main content (accessibility) -->
  <a href="#main-content" id="skip-to-content">Skip to content</a>

  <!-- P18: Page transition loader bar -->
  <div id="page-loader" aria-hidden="true"></div>

  <!-- Mobile overlay -->
  <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>

  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <div class="brand-name">Sovereign OS</div>
      <div class="brand-sub">Platform v${PLATFORM_VERSION}</div>
    </div>
    <div class="nav-filter-wrap">
      <input
        type="text"
        class="nav-filter-input"
        id="nav-filter"
        placeholder="Filter nav..."
        autocomplete="off"
        aria-label="Filter navigation"
      >
    </div>
    <nav class="nav-section" id="nav-section" role="navigation" aria-label="Platform navigation">
      ${navHtml}
    </nav>
    <div class="sidebar-footer">
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span>Live · P22</span>
      </div>
      <div style="margin-top:3px;font-size:9px">P22 · Refactored · 60fps</div>
    </div>
  </aside>

  <!-- Main -->
  <div class="main">
    <!-- Topbar -->
    <header class="topbar">
      <button class="topbar-menu-btn" onclick="toggleSidebar()" aria-label="Toggle sidebar">☰</button>
      <span class="topbar-title">${title}</span>

      <!-- Header Search Bar (P16) -->
      <form class="header-search-wrap" action="/search" method="GET" id="header-search-form">
        <span class="header-search-icon">🔍</span>
        <input
          type="text"
          name="q"
          id="header-search-input"
          class="header-search-input"
          placeholder="Search platform... (/ to focus)"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        >
        <span class="header-search-shortcut">/</span>
      </form>

      <!-- Topbar right: notif bell + dark mode -->
      <div class="topbar-right">
        <div class="notif-bell-wrap">
          <a href="/notifications" class="notif-bell-btn" title="Notifications">🔔${bellBadgeHtml}</a>
        </div>
        <button class="dark-mode-btn" id="dark-mode-btn" onclick="toggleDarkMode()" title="Toggle dark/light mode">🌙</button>
        <a href="/search" class="btn btn-ghost btn-sm" style="display:none" id="search-icon-btn" title="Search">🔍</a>
      </div>
    </header>

    <!-- Breadcrumbs (P16) -->
    ${breadcrumbsHtml}

    <!-- Toast container (P16) -->
    <div id="toast-container"></div>

    <!-- Page content -->
    <main class="page-content" id="main-content" tabindex="-1">
      ${content}
    </main>
  </div>

  <script>${getLayoutScript()}</script>
</body>
</html>`
}

// ---- Badge / utility helpers (unchanged, kept here for compatibility) ----
export function badgeApprovalTier(tier: number): string {
  const labels = ['T0 AUTO', 'T1 ASYNC', 'T2 SYNC', 'T3 FOUNDER']
  return `<span class="tier-${tier}">${labels[tier] ?? tier}</span>`
}

export function badgeStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
    returned: 'badge-orange',
    active: 'badge-green',
    paused: 'badge-yellow',
    closed: 'badge-grey',
    ready: 'badge-green',
    blocked: 'badge-red',
    partial: 'badge-yellow',
    unknown: 'badge-grey',
    proceed: 'badge-green',
    hold: 'badge-yellow',
    'approval-needed': 'badge-purple',
    'in-progress': 'badge-cyan',
    done: 'badge-green',
    PASS: 'badge-green',
    PARTIAL: 'badge-yellow',
    FAIL: 'badge-red',
    BLOCKED: 'badge-orange',
    candidate: 'badge-cyan',
    'under-review': 'badge-yellow',
    promoted: 'badge-green',
    success: 'badge-green',
    failed: 'badge-red',
  }
  return `<span class="badge ${map[status] ?? 'badge-grey'}">${status.toUpperCase()}</span>`
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
  return Math.floor(diff / 86400000) + 'd ago'
}
