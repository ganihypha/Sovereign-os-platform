// ============================================================
// SOVEREIGN OS PLATFORM — SHARED HTML LAYOUT
// P16: Header search bar, notification bell badge, dark mode toggle,
//      collapsible sidebar sections, breadcrumbs, mobile-responsive
// P18: Page transition loader bar, nav reorganization (merged P16/P17
//      items into contextual groups), keyboard accessibility,
//      performance resource hints, skip-to-content, sidebar search filter
// P21: GPU-accelerated sidebar (will-change + contain), CSS max-height
//      collapsible nav (zero JS layout blocking), debounced event listeners
//      (120ms nav filter, 150ms resize), non-blocking font load,
//      scaleX page loader (pure GPU, no layout recalc), rAF DOM batching
// ============================================================

export interface LayoutOptions {
  activePage?: string
  alertCount?: number
  notifCount?: number       // P16: notification bell badge count
  breadcrumbs?: Array<{ label: string; href?: string }>  // P16: breadcrumbs
  darkModeDefault?: boolean // P16: dark mode default
}

export function layout(title: string, content: string, activePage: string = '', alertCount: number = 0, opts: LayoutOptions = {}): string {
  const { notifCount = 0, breadcrumbs = [] } = opts

  // ---- Nav groups (collapsible) — P18: reorganized, P16+P17 merged into context ----
  const navSections = [
    {
      id: 'core',
      label: 'Core Platform',
      color: '#4f8ef7',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '⬡' },
        { path: '/intent', label: 'Intent', icon: '◈' },
        { path: '/intake', label: 'Intake', icon: '⊕' },
        { path: '/architect', label: 'Architect', icon: '◉' },
        { path: '/approvals', label: 'Approvals', icon: '◎' },
        { path: '/proof', label: 'Proof', icon: '◇' },
        { path: '/live', label: 'Live', icon: '◆' },
        { path: '/records', label: 'Records', icon: '▣' },
        { path: '/continuity', label: 'Continuity', icon: '↻' },
        { path: '/execution', label: 'Execution', icon: '▶' },
        { path: '/connectors', label: 'Connectors', icon: '⊞' },
        { path: '/roles', label: 'Roles', icon: '◈' },
      ]
    },
    {
      id: 'governance',
      label: 'Governance',
      color: '#ef4444',
      items: [
        { path: '/workspace', label: 'Workspace', icon: '◈' },
        { path: '/alerts', label: 'Alerts', icon: '◉', count: alertCount },
        { path: '/canon', label: 'Canon', icon: '▣' },
        { path: '/lanes', label: 'Lanes', icon: '⊟' },
        { path: '/onboarding', label: 'Onboarding', icon: '⬠' },
        { path: '/policies', label: 'ABAC Policies', icon: '🔐' },
        { path: '/alert-rules', label: 'Alert Rules', icon: '🔔' },
        { path: '/remediation', label: 'Remediation', icon: '🛠️' },
      ]
    },
    {
      id: 'tenants',
      label: 'Tenants & API',
      color: '#22c55e',
      items: [
        { path: '/tenants', label: 'Tenants', icon: '⊛' },
        { path: '/ai-assist', label: 'AI Assist', icon: '◎' },
        { path: '/api-keys', label: 'API Keys', icon: '⊕' },
        { path: '/branding', label: 'Branding', icon: '◈' },
        { path: '/auth/sso', label: 'SSO', icon: '⊕' },
      ]
    },
    {
      id: 'observability',
      label: 'Observability',
      color: '#f59e0b',
      items: [
        { path: '/metrics', label: 'Metrics', icon: '📈' },
        { path: '/metrics/snapshots', label: 'Metrics History', icon: '📷' },
        { path: '/audit', label: 'Audit Trail', icon: '🔏' },
        { path: '/audit/deny-log', label: 'ABAC Deny Log', icon: '🔒' },
        { path: '/audit/export-jobs', label: 'Export Jobs', icon: '📥' },
        { path: '/health-dashboard', label: 'Health', icon: '🏥' },
        { path: '/events', label: 'Event Bus', icon: '📡' },
        { path: '/events/archive-stats', label: 'Event Archive', icon: '📦' },
      ]
    },
    {
      id: 'workflows',
      label: 'Workflows & Reports',
      color: '#06b6d4',
      items: [
        { path: '/workflows', label: 'Workflows', icon: '⚡' },
        { path: '/workflows/history', label: 'Run History', icon: '📋' },
        { path: '/reports', label: 'Reports', icon: '📊' },
        { path: '/reports/subscriptions', label: 'Scheduled Reports', icon: '🗓️' },
      ]
    },
    {
      id: 'notifications',
      label: 'Notifications',
      color: '#f97316',
      items: [
        { path: '/notifications', label: 'Inbox', icon: '🔔' },
        { path: '/notifications/preferences', label: 'Preferences', icon: '⚙️' },
        { path: '/notifications/rules', label: 'Rules', icon: '📋' },
      ]
    },
    {
      id: 'search',
      label: 'Search & Discovery',
      color: '#10b981',
      items: [
        { path: '/search', label: 'Search', icon: '🔍' },
        { path: '/search/analytics', label: 'Search Analytics', icon: '📊' },
      ]
    },
    {
      id: 'platform',
      label: 'Platform Admin',
      color: '#8b5cf6',
      items: [
        { path: '/admin', label: 'Admin Panel', icon: '🛡️' },
        { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
        { path: '/admin/sessions', label: 'Sessions', icon: '👤' },
        { path: '/admin/api-keys', label: 'Key Rotation', icon: '🔑' },
        { path: '/changelog', label: 'Changelog', icon: '📝' },
        { path: '/federation', label: 'Federation', icon: '🔗' },
        { path: '/marketplace', label: 'Marketplace', icon: '🛒' },
        { path: '/portal', label: 'Portal', icon: '🏠' },
        { path: '/portal/default/policies', label: 'Portal Policies', icon: '🛡️' },
        { path: '/docs', label: 'Dev Docs', icon: '📖' },
        { path: '/api/v2/docs', label: 'API v2', icon: '⚙' },
      ]
    },
  ]

  function renderSection(section: typeof navSections[0]): string {
    const isActiveSection = section.items.some(item =>
      activePage === item.path || activePage.startsWith(item.path.split('?')[0].split('#')[0] + '/')
    )
    const chevron = `<span class="nav-chevron" id="chevron-${section.id}">${isActiveSection ? '▾' : '▸'}</span>`
    const items = section.items.map(item => {
      const isActive = activePage === item.path ||
        (item.path.length > 1 && activePage.startsWith(item.path.split('?')[0].split('#')[0]))
      const countBadge = (item as any).count > 0
        ? `<span style="background:var(--red);color:#fff;border-radius:10px;padding:0 5px;font-size:10px;font-weight:700;margin-left:auto">${(item as any).count}</span>`
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
  }

  const navHtml = navSections.map(renderSection).join('')

  // Breadcrumbs HTML
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

  // Notification bell badge
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
  <style>
    /* ---- CSS Variables (dark/light theme) ---- */
    :root, [data-theme="dark"] {
      --bg: #0a0c10;
      --bg2: #111318;
      --bg3: #181c22;
      --border: #232830;
      --border2: #2d3440;
      --text: #e8eaf0;
      --text2: #9aa3b2;
      --text3: #5a6478;
      --accent: #4f8ef7;
      --accent2: #2563eb;
      --green: #22c55e;
      --yellow: #f59e0b;
      --red: #ef4444;
      --purple: #a855f7;
      --cyan: #06b6d4;
      --orange: #f97316;
      --emerald: #10b981;
      --sidebar-w: 220px;
      --radius: 8px;
      --topbar-h: 56px;
    }
    [data-theme="light"] {
      --bg: #f3f4f6;
      --bg2: #ffffff;
      --bg3: #f9fafb;
      --border: #e5e7eb;
      --border2: #d1d5db;
      --text: #111827;
      --text2: #374151;
      --text3: #9ca3af;
      --accent: #2563eb;
      --accent2: #1d4ed8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      display: flex;
      min-height: 100vh;
    }

    /* ---- Sidebar ---- */
    /* P21: will-change + contain promote sidebar to GPU layer — eliminates layout reflow on slide */
    .sidebar {
      width: var(--sidebar-w);
      min-height: 100vh;
      background: var(--bg2);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0; bottom: 0;
      z-index: 200;
      transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
      overflow-y: auto;
      overflow-x: hidden;
      will-change: transform;
      contain: layout style;
    }
    .sidebar-brand {
      padding: 16px 14px 12px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--accent);
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 10px;
      color: var(--text3);
      margin-top: 2px;
      font-family: 'JetBrains Mono', monospace;
    }
    .nav-section { padding: 6px 6px 80px; flex: 1; }

    /* Collapsible nav groups */
    /* P21: CSS max-height transition — GPU-accelerated, zero JS layout blocking */
    .nav-group { margin-bottom: 2px; }
    .nav-group-items {
      overflow: hidden;
      max-height: 600px;
      transition: max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease;
      opacity: 1;
    }
    .nav-group-items.collapsed {
      max-height: 0;
      opacity: 0;
    }
    .nav-group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 8px 5px;
      cursor: pointer;
      user-select: none;
      border-radius: 5px;
      transition: background 0.1s;
    }
    .nav-group-header:hover { background: var(--bg3); }
    .nav-group-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      flex: 1;
    }
    .nav-section-badge {
      font-size: 8px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 8px;
      letter-spacing: 0.04em;
    }
    .nav-chevron { font-size: 9px; color: var(--text3); transition: transform 0.2s ease; }
    .nav-chevron.open { transform: rotate(0deg); }
    .nav-chevron.closed { transform: rotate(-90deg); }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 9px;
      border-radius: 5px;
      text-decoration: none;
      color: var(--text2);
      font-size: 12px;
      font-weight: 500;
      transition: all 0.12s;
      margin-bottom: 1px;
    }
    .nav-item:hover { background: var(--bg3); color: var(--text); }
    .nav-item.active { background: rgba(79,142,247,0.12); color: var(--accent); }
    .nav-icon { font-size: 13px; width: 18px; text-align: center; flex-shrink: 0; }
    .nav-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .sidebar-footer {
      padding: 10px 14px;
      border-top: 1px solid var(--border);
      font-size: 10px;
      color: var(--text3);
      font-family: 'JetBrains Mono', monospace;
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      background: var(--bg2);
    }

    /* ---- Mobile sidebar overlay ---- */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 190;
    }
    .sidebar-overlay.active { display: block; }

    /* ---- Main Content ---- */
    .main {
      margin-left: var(--sidebar-w);
      flex: 1;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* ---- Topbar ---- */
    .topbar {
      background: var(--bg2);
      border-bottom: 1px solid var(--border);
      padding: 0 20px 0 16px;
      height: var(--topbar-h);
      display: flex;
      align-items: center;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .topbar-menu-btn {
      display: none;
      background: none;
      border: none;
      color: var(--text2);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 5px;
      flex-shrink: 0;
    }
    .topbar-menu-btn:hover { background: var(--bg3); color: var(--text); }

    /* Header search bar (P16) */
    .header-search-wrap {
      flex: 1;
      max-width: 440px;
      position: relative;
    }
    .header-search-input {
      width: 100%;
      background: var(--bg3);
      border: 1px solid var(--border2);
      border-radius: 7px;
      color: var(--text);
      padding: 7px 12px 7px 34px;
      font-size: 12px;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .header-search-input:focus {
      border-color: var(--accent);
      background: var(--bg2);
    }
    .header-search-input::placeholder { color: var(--text3); }
    .header-search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text3);
      font-size: 13px;
      pointer-events: none;
    }
    .header-search-shortcut {
      position: absolute;
      right: 9px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 9px;
      color: var(--text3);
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 1px 4px;
      font-family: 'JetBrains Mono', monospace;
      pointer-events: none;
    }

    /* Topbar right cluster */
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      margin-left: auto;
    }
    .topbar-title {
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }

    /* Dark mode toggle */
    .dark-mode-btn {
      background: none;
      border: 1px solid var(--border2);
      border-radius: 6px;
      color: var(--text2);
      font-size: 14px;
      cursor: pointer;
      padding: 5px 8px;
      transition: all 0.15s;
      line-height: 1;
    }
    .dark-mode-btn:hover { background: var(--bg3); color: var(--text); }

    /* Notification bell */
    .notif-bell-wrap {
      position: relative;
      display: inline-flex;
    }
    .notif-bell-btn {
      background: none;
      border: 1px solid var(--border2);
      border-radius: 6px;
      color: var(--text2);
      font-size: 14px;
      cursor: pointer;
      padding: 5px 8px;
      text-decoration: none;
      transition: all 0.15s;
      line-height: 1;
      display: inline-flex;
      align-items: center;
    }
    .notif-bell-btn:hover { background: var(--bg3); color: var(--text); }
    .notif-bell-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: var(--red);
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      border-radius: 10px;
      padding: 1px 4px;
      min-width: 16px;
      text-align: center;
      line-height: 1.4;
      pointer-events: none;
    }

    /* Breadcrumbs */
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 28px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-size: 11px;
    }
    .bc-item { color: var(--text3); text-decoration: none; transition: color 0.1s; }
    .bc-item:hover { color: var(--text2); }
    .bc-item.bc-current { color: var(--text2); font-weight: 500; }
    .bc-home { color: var(--text3); }
    .bc-sep { color: var(--border2); }

    /* Page content */
    .page-content { padding: 24px 28px; flex: 1; }

    /* ---- Cards ---- */
    .card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 16px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .card-title { font-weight: 600; font-size: 13px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.06em; }

    /* ---- Grid ---- */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }

    /* ---- Stat Cards ---- */
    .stat-card {
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
    }
    .stat-label { font-size: 11px; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .stat-value { font-size: 26px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .stat-sub { font-size: 11px; color: var(--text3); margin-top: 4px; }

    /* ---- Badges ---- */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .badge-green { background: rgba(34,197,94,0.12); color: var(--green); }
    .badge-yellow { background: rgba(245,158,11,0.12); color: var(--yellow); }
    .badge-red { background: rgba(239,68,68,0.12); color: var(--red); }
    .badge-blue { background: rgba(79,142,247,0.12); color: var(--accent); }
    .badge-purple { background: rgba(168,85,247,0.12); color: var(--purple); }
    .badge-cyan { background: rgba(6,182,212,0.12); color: var(--cyan); }
    .badge-orange { background: rgba(249,115,22,0.12); color: var(--orange); }
    .badge-grey { background: rgba(90,100,120,0.18); color: var(--text3); }
    .badge-emerald { background: rgba(16,185,129,0.12); color: var(--emerald); }

    /* ---- Table ---- */
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; }
    td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--bg3); }

    /* ---- Forms ---- */
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 12px; font-weight: 500; color: var(--text2); margin-bottom: 6px; }
    input, textarea, select {
      width: 100%;
      background: var(--bg3);
      border: 1px solid var(--border2);
      border-radius: 6px;
      color: var(--text);
      padding: 9px 12px;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--accent); }
    textarea { resize: vertical; min-height: 80px; }
    select option { background: var(--bg2); }

    /* ---- Buttons ---- */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-primary { background: var(--accent2); color: #fff; }
    .btn-primary:hover { background: var(--accent); }
    .btn-ghost { background: transparent; color: var(--text2); border: 1px solid var(--border2); }
    .btn-ghost:hover { background: var(--bg3); color: var(--text); }
    .btn-green { background: rgba(34,197,94,0.15); color: var(--green); border: 1px solid rgba(34,197,94,0.3); }
    .btn-red { background: rgba(239,68,68,0.12); color: var(--red); border: 1px solid rgba(239,68,68,0.3); }
    .btn-yellow { background: rgba(245,158,11,0.12); color: var(--yellow); border: 1px solid rgba(245,158,11,0.3); }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }

    /* ---- Priority Labels ---- */
    .pri-now { color: var(--red); }
    .pri-next { color: var(--orange); }
    .pri-later { color: var(--yellow); }
    .pri-hold { color: var(--text3); }
    .pri-not-now { color: var(--text3); text-decoration: line-through; }

    /* ---- Tier Badges ---- */
    .tier-0 { background: rgba(34,197,94,0.1); color: var(--green); border: 1px solid rgba(34,197,94,0.25); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .tier-1 { background: rgba(6,182,212,0.1); color: var(--cyan); border: 1px solid rgba(6,182,212,0.25); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .tier-2 { background: rgba(245,158,11,0.1); color: var(--yellow); border: 1px solid rgba(245,158,11,0.25); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .tier-3 { background: rgba(239,68,68,0.1); color: var(--red); border: 1px solid rgba(239,68,68,0.25); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }

    /* ---- P18+P21: Page transition loader bar — scaleX GPU, no layout recalc ---- */
    #page-loader {
      position: fixed;
      top: 0; left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, var(--accent), var(--purple), var(--cyan));
      z-index: 9999;
      transform: scaleX(0);
      transform-origin: left center;
      transition: transform 0.3s ease, opacity 0.3s ease;
      opacity: 0;
      will-change: transform, opacity;
    }
    #page-loader.loading {
      opacity: 1;
      transform: scaleX(0.75);
    }
    #page-loader.done {
      opacity: 0;
      transform: scaleX(1);
    }

    /* ---- P18: Skip to content accessibility ---- */
    #skip-to-content {
      position: absolute;
      left: -9999px;
      top: 0;
      padding: 8px 16px;
      background: var(--accent);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      border-radius: 0 0 6px 6px;
      z-index: 99999;
      text-decoration: none;
    }
    #skip-to-content:focus { left: 50%; transform: translateX(-50%); }

    /* ---- P18: Nav filter search ---- */
    .nav-filter-wrap {
      padding: 8px 8px 4px;
      flex-shrink: 0;
    }
    .nav-filter-input {
      width: 100%;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text2);
      padding: 5px 9px;
      font-size: 11px;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.15s;
    }
    .nav-filter-input:focus { border-color: var(--accent); color: var(--text); }
    .nav-filter-input::placeholder { color: var(--text3); }

    /* ---- P18: Nav dot indicator ---- */
    .nav-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ---- P18: Status bar at bottom ---- */
    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
      animation: pulse-green 2s infinite;
    }
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.2); }
      50% { box-shadow: 0 0 0 4px rgba(34,197,94,0.1); }
    }

    /* ---- Misc ---- */
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text3);
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }
    .tag { display: inline-block; background: var(--bg3); border: 1px solid var(--border2); border-radius: 4px; padding: 2px 8px; font-size: 11px; color: var(--text2); margin: 2px; }
    .law-bar {
      background: linear-gradient(90deg, rgba(79,142,247,0.08), transparent);
      border-left: 3px solid var(--accent);
      padding: 10px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text2);
      margin-bottom: 20px;
      border-radius: 0 6px 6px 0;
    }
    .blocker-bar {
      background: rgba(239,68,68,0.07);
      border-left: 3px solid var(--red);
      padding: 10px 16px;
      font-size: 13px;
      color: var(--red);
      margin-bottom: 12px;
      border-radius: 0 6px 6px 0;
    }
    .verified-note {
      background: rgba(239,68,68,0.07);
      border: 1px solid rgba(239,68,68,0.2);
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 12px;
      color: var(--red);
      margin-top: 8px;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .text-muted { color: var(--text3); }
    .text-sm { font-size: 12px; }
    .mt-4 { margin-top: 16px; }
    .mb-4 { margin-bottom: 16px; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .w-full { width: 100%; }
    .proof-matrix { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
    .proof-cell { background: var(--bg2); padding: 14px; text-align: center; }
    .proof-cell-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); margin-bottom: 6px; }
    .proof-cell-val { font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
    .exec-running { border-left: 3px solid var(--accent); }
    .exec-blocked { border-left: 3px solid var(--red); }
    .exec-done { border-left: 3px solid var(--green); opacity: 0.75; }
    .conn-active { border-left: 3px solid var(--green); }
    .conn-pending { border-left: 3px solid var(--yellow); }
    .conn-blocked { border-left: 3px solid var(--red); }

    /* ---- Toast Notification (P16) ---- */
    #toast-container {
      position: fixed;
      top: 68px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .toast {
      background: var(--bg2);
      border: 1px solid var(--border2);
      border-radius: 8px;
      padding: 12px 16px;
      min-width: 280px;
      max-width: 360px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      pointer-events: all;
      animation: toastIn 0.25s ease;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .toast-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .toast-body { flex: 1; }
    .toast-title { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .toast-msg { font-size: 11px; color: var(--text3); }
    .toast-close { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 14px; padding: 0; line-height: 1; flex-shrink: 0; }
    .toast-close:hover { color: var(--text); }
    .toast-green { border-left: 3px solid var(--green); }
    .toast-red { border-left: 3px solid var(--red); }
    .toast-yellow { border-left: 3px solid var(--yellow); }
    .toast-blue { border-left: 3px solid var(--accent); }

    /* ---- Mobile Responsive ---- */
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .main {
        margin-left: 0;
      }
      .topbar-menu-btn { display: flex; }
      .topbar-title { max-width: 140px; font-size: 13px; }
      .header-search-wrap { max-width: 200px; }
      .header-search-shortcut { display: none; }
      .page-content { padding: 16px; }
      .grid-4 { grid-template-columns: 1fr 1fr; }
      .grid-3 { grid-template-columns: 1fr 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      .proof-matrix { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 480px) {
      .header-search-wrap { display: none; }
      .grid-4 { grid-template-columns: 1fr; }
      .grid-3 { grid-template-columns: 1fr; }
    }
  </style>
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
      <div class="brand-sub">Platform v2.0.0-P21</div>
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
        <span>Live · P21</span>
      </div>
      <div style="margin-top:3px;font-size:9px">P21 · GPU-accel · 60fps nav</div>
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
        <!-- Notification Bell -->
        <div class="notif-bell-wrap">
          <a href="/notifications" class="notif-bell-btn" title="Notifications">🔔${bellBadgeHtml}</a>
        </div>
        <!-- Dark Mode Toggle -->
        <button class="dark-mode-btn" id="dark-mode-btn" onclick="toggleDarkMode()" title="Toggle dark/light mode">🌙</button>
        <!-- Search link (mobile fallback) -->
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

  <!-- P18 Scripts: page loader, nav filter, dark mode, sidebar, search shortcut, toast -->
  <script>
    // Dark mode
    (function() {
      const saved = localStorage.getItem('sovereign-theme')
      if (saved) {
        document.getElementById('html-root').setAttribute('data-theme', saved)
        document.getElementById('dark-mode-btn').textContent = saved === 'light' ? '🌙' : '☀️'
      }
    })()
    function toggleDarkMode() {
      const root = document.getElementById('html-root')
      const btn = document.getElementById('dark-mode-btn')
      const cur = root.getAttribute('data-theme')
      const next = cur === 'dark' ? 'light' : 'dark'
      root.setAttribute('data-theme', next)
      btn.textContent = next === 'light' ? '🌙' : '☀️'
      localStorage.setItem('sovereign-theme', next)
    }

    // Mobile sidebar
    function toggleSidebar() {
      const s = document.getElementById('sidebar')
      const o = document.getElementById('sidebar-overlay')
      s.classList.toggle('open')
      o.classList.toggle('active')
    }
    function closeSidebar() {
      document.getElementById('sidebar').classList.remove('open')
      document.getElementById('sidebar-overlay').classList.remove('active')
    }

    // Keyboard shortcut: / focuses header search
    document.addEventListener('keydown', function(e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT') {
        e.preventDefault()
        const inp = document.getElementById('header-search-input')
        if (inp) { inp.focus(); inp.select(); }
      }
      if (e.key === 'Escape') {
        const inp = document.getElementById('header-search-input')
        if (document.activeElement === inp) inp.blur()
        closeSidebar()
      }
    })

    // P21: CSS max-height collapsible — zero JS layout blocking
    function toggleNavGroup(id) {
      const items = document.getElementById('items-' + id)
      const chevron = document.getElementById('chevron-' + id)
      if (!items) return
      const isCollapsed = items.classList.contains('collapsed')
      // P21: Use requestAnimationFrame to batch DOM writes
      requestAnimationFrame(function() {
        items.classList.toggle('collapsed', !isCollapsed)
        if (chevron) {
          chevron.classList.toggle('open', !isCollapsed)
          chevron.classList.toggle('closed', isCollapsed)
          chevron.textContent = !isCollapsed ? '▾' : '▸'
        }
        // Update aria-expanded on header
        const header = document.querySelector('#group-' + id + ' .nav-group-header')
        if (header) header.setAttribute('aria-expanded', String(!isCollapsed))
        // Persist state
        try { localStorage.setItem('nav-group-' + id, !isCollapsed ? 'open' : 'closed') } catch(e) {}
      })
    }

    // Restore nav group states from localStorage
    ;(function() {
      const groups = ['core','governance','tenants','observability','workflows','notifications','search','platform']
      groups.forEach(function(id) {
        try {
          const state = localStorage.getItem('nav-group-' + id)
          const items = document.getElementById('items-' + id)
          const chevron = document.getElementById('chevron-' + id)
          if (!items) return
          if (state === 'closed') {
            items.classList.add('collapsed')
            if (chevron) { chevron.textContent = '▸'; chevron.classList.add('closed'); chevron.classList.remove('open') }
          } else if (state === 'open') {
            items.classList.remove('collapsed')
            if (chevron) { chevron.textContent = '▾'; chevron.classList.add('open'); chevron.classList.remove('closed') }
          }
        } catch(e) {}
      })
    })()

    // Toast API (P16)
    function showToast(title, msg, type, duration) {
      duration = duration || 4000
      const icons = { green: '✅', red: '❌', yellow: '⚠️', blue: 'ℹ️' }
      const container = document.getElementById('toast-container')
      const toast = document.createElement('div')
      toast.className = 'toast toast-' + (type || 'blue')
      toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span>' +
        '<div class="toast-body"><div class="toast-title">' + title + '</div><div class="toast-msg">' + (msg || '') + '</div></div>' +
        '<button class="toast-close" onclick="this.closest(\'.toast\').remove()">×</button>'
      container.appendChild(toast)
      setTimeout(function() { if (toast.parentNode) toast.remove() }, duration)
    }
    window.showToast = showToast

    // Auto-show toast from URL param ?toast=...
    (function() {
      const u = new URLSearchParams(window.location.search)
      if (u.get('toast_ok')) showToast(decodeURIComponent(u.get('toast_ok')), '', 'green')
      if (u.get('toast_err')) showToast(decodeURIComponent(u.get('toast_err')), '', 'red')
    })()

    // P21: Mobile search visibility — debounced resize (150ms) + passive flag
    ;(function() {
      function checkSearchVisibility() {
        const wrap = document.querySelector('.header-search-wrap')
        const iconBtn = document.getElementById('search-icon-btn')
        if (!wrap || !iconBtn) return
        const style = window.getComputedStyle(wrap)
        iconBtn.style.display = style.display === 'none' ? 'inline-flex' : 'none'
      }
      var _resizeTimer
      function debouncedResize() {
        clearTimeout(_resizeTimer)
        _resizeTimer = setTimeout(checkSearchVisibility, 150)
      }
      checkSearchVisibility()
      window.addEventListener('resize', debouncedResize, { passive: true })
    })()

    // P18: Page transition loading bar
    (function() {
      const loader = document.getElementById('page-loader')
      if (!loader) return
      // Show loader on link navigation
      document.addEventListener('click', function(e) {
        const a = e.target.closest('a[href]')
        if (!a) return
        const href = a.getAttribute('href')
        if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto') || a.target === '_blank') return
        if (href.startsWith('http') && !href.includes(window.location.hostname)) return
        // Same-origin navigation — show loader
        loader.className = 'loading'
      })
      document.addEventListener('submit', function(e) {
        const f = e.target
        if (f && f.tagName === 'FORM') loader.className = 'loading'
      })
      // On page load — finish
      window.addEventListener('pageshow', function() {
        loader.className = 'done'
        setTimeout(function() { loader.className = ''; loader.style.width = ''; }, 350)
      })
      // Instant finish on DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          loader.className = 'done'
          setTimeout(function() { loader.className = '' }, 350)
        })
      } else {
        // Already loaded
        loader.className = 'done'
        setTimeout(function() { loader.className = '' }, 350)
      }
    })()

    // P18+P21: Nav filter — debounced 120ms + requestAnimationFrame for batch DOM writes
    ;(function() {
      const input = document.getElementById('nav-filter')
      if (!input) return
      var _filterTimer
      input.addEventListener('input', function() {
        const val = this.value
        clearTimeout(_filterTimer)
        _filterTimer = setTimeout(function() {
          requestAnimationFrame(function() {
            const q = val.toLowerCase().trim()
            const allItems = document.querySelectorAll('.nav-item[data-nav-label]')
            const allGroups = document.querySelectorAll('.nav-group')
            if (!q) {
              // Restore original state — batch writes in rAF
              allItems.forEach(function(item) { item.style.display = '' })
              allGroups.forEach(function(group) { group.style.display = '' })
              return
            }
            // Show only matching items, expand their groups
            allGroups.forEach(function(group) {
              const id = group.id.replace('group-', '')
              const items = group.querySelectorAll('.nav-item[data-nav-label]')
              let hasMatch = false
              items.forEach(function(item) {
                const label = item.getAttribute('data-nav-label') || ''
                if (label.includes(q)) {
                  item.style.display = ''
                  hasMatch = true
                } else {
                  item.style.display = 'none'
                }
              })
              if (hasMatch) {
                group.style.display = ''
                // P21: Expand via classList.remove instead of style.display
                const groupItems = document.getElementById('items-' + id)
                if (groupItems) groupItems.classList.remove('collapsed')
                const chevron = document.getElementById('chevron-' + id)
                if (chevron) { chevron.textContent = '▾'; chevron.classList.add('open'); chevron.classList.remove('closed') }
              } else {
                group.style.display = 'none'
              }
            })
          })
        }, 120)
      })
      // Escape clears filter
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { this.value = ''; this.dispatchEvent(new Event('input')); this.blur() }
      })
    })()
  </script>
</body>
</html>`
}

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
