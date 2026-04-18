// ============================================================
// SOVEREIGN OS PLATFORM — SHARED HTML LAYOUT
// ============================================================

export function layout(title: string, content: string, activePage: string = '', alertCount: number = 0): string {
  const navP0P3 = [
    { path: '/dashboard', label: 'Dashboard', icon: '⬡' },
    { path: '/intent', label: 'Intent', icon: '◈' },
    { path: '/intake', label: 'Intake', icon: '⊕' },
    { path: '/architect', label: 'Architect', icon: '◉' },
    { path: '/approvals', label: 'Approvals', icon: '◎' },
    { path: '/proof', label: 'Proof', icon: '◇' },
    { path: '/live', label: 'Live', icon: '◆' },
    { path: '/records', label: 'Records', icon: '▣' },
    { path: '/continuity', label: 'Continuity', icon: '↻' },  // P2
    { path: '/execution', label: 'Execution', icon: '▶' },    // P3
    { path: '/connectors', label: 'Connectors', icon: '⊞' }, // P3
    { path: '/roles', label: 'Roles', icon: '◈' },           // P3
  ]
  const navP4 = [
    { path: '/workspace', label: 'Workspace', icon: '◈', badge: '' },    // P4
    { path: '/alerts', label: 'Alerts', icon: '◉', badge: alertCount > 0 ? String(alertCount) : '' },  // P4
    { path: '/canon', label: 'Canon', icon: '▣', badge: '' },             // P4
    { path: '/lanes', label: 'Lanes', icon: '⊟', badge: '' },             // P4
    { path: '/onboarding', label: 'Onboarding', icon: '⬠', badge: '' },  // P4
  ]
  const navP5 = [
    { path: '/tenants', label: 'Tenants', icon: '⊛', badge: '' },         // P5
    { path: '/ai-assist', label: 'AI Assist', icon: '◎', badge: '' },     // P5
    { path: '/api-keys', label: 'API Keys', icon: '⊕', badge: '' },       // P5
  ]
  const navP6 = [
    { path: '/reports', label: 'Observability', icon: '⧠', badge: 'P6' }, // P6 — upgraded
  ]
  const navP7 = [
    { path: '/branding', label: 'Branding', icon: '◈', badge: 'P7' },      // P7 — white-label
    { path: '/auth/sso', label: 'SSO', icon: '⊕', badge: 'P7' },           // P7 — OAuth2/SSO
  ]
  const navP8 = [
    { path: '/federation', label: 'Federation', icon: '🔗', badge: 'P8' },  // P8 — cross-tenant governance
    { path: '/marketplace', label: 'Marketplace', icon: '🛒', badge: 'P8' }, // P8 — connector marketplace
    { path: '/audit', label: 'Audit Trail', icon: '🔏', badge: 'P8' },      // P8 — immutable audit
  ]
  const navP9 = [
    { path: '/notifications', label: 'Notifications', icon: '🔔', badge: 'P9' }, // P9 — SSE notifications
    { path: '/workflows', label: 'Workflows', icon: '⚡', badge: 'P9' },          // P9 — workflow automation
    { path: '/health-dashboard', label: 'Health', icon: '🏥', badge: 'P9' },     // P9 — health dashboard
    { path: '/portal', label: 'Portal', icon: '🏠', badge: 'P9' },               // P9 — tenant portal
  ]
  const navP10 = [
    { path: '/reports', label: 'Reports', icon: '📊', badge: 'P10' },       // P10 — enhanced governance reports
    { path: '/api/v2/docs', label: 'API v2', icon: '⚙', badge: 'P10' },    // P10 — API v2 docs
    { path: '/policies', label: 'ABAC Policies', icon: '🔐', badge: 'P10' }, // P10 — ABAC policy editor
    { path: '/alert-rules', label: 'Alert Rules', icon: '🔔', badge: 'P10' }, // P10 — alert rules engine
  ]

  const navItems = navP0P3.map(n => {
    const isActive = activePage === n.path
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
    </a>`
  }).join('') + `<div class="nav-section-label">P4</div>` + navP4.map(n => {
    const isActive = activePage === n.path || activePage.startsWith('/w/')
    const badgeHtml = n.badge ? `<span style="background:#ef4444;color:#fff;border-radius:10px;padding:0 5px;font-size:10px;font-weight:700;margin-left:auto">${n.badge}</span>` : ''
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
      ${badgeHtml}
    </a>`
  }).join('') + `<div class="nav-section-label">P5</div>` + navP5.map(n => {
    const isActive = activePage === n.path
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
    </a>`
  }).join('') + `<div class="nav-section-label">P6</div>` + navP6.map(n => {
    const isActive = activePage === n.path
    const badgeHtml = n.badge ? `<span style="background:#22c55e;color:#000;border-radius:10px;padding:0 5px;font-size:9px;font-weight:700;margin-left:auto">${n.badge}</span>` : ''
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
      ${badgeHtml}
    </a>`
  }).join('') + `<div class="nav-section-label">P7</div>` + navP7.map(n => {
    const isActive = activePage === n.path || activePage.startsWith(n.path)
    const badgeHtml = `<span style="background:#a855f7;color:#fff;border-radius:10px;padding:0 5px;font-size:9px;font-weight:700;margin-left:auto">${n.badge}</span>`
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
      ${badgeHtml}
    </a>`
  }).join('') + `<div class="nav-section-label">P8</div>` + navP8.map(n => {
    const isActive = activePage === n.path || activePage === n.label.toLowerCase()
    const badgeHtml = `<span style="background:#f59e0b;color:#000;border-radius:10px;padding:0 5px;font-size:9px;font-weight:700;margin-left:auto">${n.badge}</span>`
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
      ${badgeHtml}
    </a>`
  }).join('') + `<div class="nav-section-label">P9</div>` + navP9.map(n => {
    const isActive = activePage === n.path || activePage.startsWith(n.path)
    const badgeHtml = `<span style="background:#06b6d4;color:#000;border-radius:10px;padding:0 5px;font-size:9px;font-weight:700;margin-left:auto">${n.badge}</span>`
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
      ${badgeHtml}
    </a>`
  }).join('') + `<div class="nav-section-label">P10</div>` + navP10.map(n => {
    const isActive = activePage === n.path || activePage.startsWith(n.path.split('?')[0])
    const badgeHtml = `<span style="background:#f97316;color:#fff;border-radius:10px;padding:0 5px;font-size:9px;font-weight:700;margin-left:auto">${n.badge}</span>`
    return `<a href="${n.path}" class="nav-item${isActive ? ' active' : ''}">
      <span class="nav-icon">${n.icon}</span>
      <span class="nav-label">${n.label}</span>
      ${badgeHtml}
    </a>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Sovereign OS Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
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
      --sidebar-w: 220px;
      --radius: 8px;
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
    .sidebar {
      width: var(--sidebar-w);
      min-height: 100vh;
      background: var(--bg2);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0; bottom: 0;
      z-index: 100;
    }
    .sidebar-brand {
      padding: 20px 16px 16px;
      border-bottom: 1px solid var(--border);
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
    .nav-section { padding: 10px 8px; flex: 1; }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      text-decoration: none;
      color: var(--text2);
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
      margin-bottom: 2px;
    }
    .nav-item:hover { background: var(--bg3); color: var(--text); }
    .nav-item.active { background: rgba(79,142,247,0.12); color: var(--accent); }
    .nav-icon { font-size: 15px; width: 20px; text-align: center; }
    .nav-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: var(--text3); text-transform: uppercase; padding: 10px 10px 4px; margin-top: 4px; }
    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--text3);
      font-family: 'JetBrains Mono', monospace;
    }
    /* ---- Main Content ---- */
    .main {
      margin-left: var(--sidebar-w);
      flex: 1;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      background: var(--bg2);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .topbar-title { font-weight: 600; font-size: 15px; }
    .topbar-meta { font-size: 12px; color: var(--text3); font-family: 'JetBrains Mono', monospace; }
    .page-content { padding: 28px; flex: 1; }
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
    /* ---- P3 Execution + Connector ---- */
    .badge-orange { background: rgba(249,115,22,0.12); color: var(--orange); }
    .exec-running { border-left: 3px solid var(--accent); }
    .exec-blocked { border-left: 3px solid var(--red); }
    .exec-done { border-left: 3px solid var(--green); opacity: 0.75; }
    .conn-active { border-left: 3px solid var(--green); }
    .conn-pending { border-left: 3px solid var(--yellow); }
    .conn-blocked { border-left: 3px solid var(--red); }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-name">Sovereign OS</div>
      <div class="brand-sub">Operating Platform v0.7</div>
    </div>
    <nav class="nav-section">${navItems}</nav>
    <div class="sidebar-footer">
      P7 — Enterprise Governance Expansion<br>
      No role collapse · No false verify
    </div>
  </aside>
  <div class="main">
    <header class="topbar">
      <div class="topbar-title">${title}</div>
      <div class="topbar-meta">Founder → L1 → L2 → L3 → Proof → Review → Live → Canon</div>
    </header>
    <main class="page-content">
      ${content}
    </main>
  </div>
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
