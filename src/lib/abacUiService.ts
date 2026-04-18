// src/lib/abacUiService.ts
// P13 — ABAC-Aware UI Config Service
// ai-generated [human-confirmation-gate: required before canonization]
//
// Features:
// - Load UI config (which surfaces/actions need which roles)
// - JS snippet generator: injects client-side role check on page
// - Log ABAC deny events for analytics
// - Deny count stats for /health-dashboard
// ============================================================

export interface AbacUiConfig {
  surface: string
  resource_type: string
  action: string
  role_required: string
  tooltip_deny: string
}

// ============================================================
// Get ABAC UI config for a specific surface
// ============================================================
export async function getAbacUiConfig(
  db: D1Database,
  surface?: string
): Promise<AbacUiConfig[]> {
  try {
    let q = `SELECT surface, resource_type, action, role_required, tooltip_deny FROM abac_ui_config`
    const p: any[] = []
    if (surface) { q += ` WHERE surface = ?`; p.push(surface) }
    q += ` ORDER BY surface, resource_type, action`

    const rows = await db.prepare(q).bind(...p).all<AbacUiConfig>()
    return rows.results || []
  } catch {
    return []
  }
}

// ============================================================
// Log an ABAC deny event
// ============================================================
export async function logAbacDeny(
  db: D1Database,
  opts: {
    surface: string
    resource_type: string
    action: string
    subject_role: string
    tenant_id?: string
  }
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO abac_deny_log (surface, resource_type, action, subject_role, tenant_id, denied_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      opts.surface, opts.resource_type, opts.action,
      opts.subject_role, opts.tenant_id || null
    ).run()
  } catch { /* non-blocking */ }
}

// ============================================================
// Get deny stats for /health-dashboard
// ============================================================
export async function getAbacDenyStats(db: D1Database): Promise<{
  total_denials: number
  denials_last_24h: number
  top_denied_surfaces: Array<{ surface: string; count: number }>
  top_denied_roles: Array<{ role: string; count: number }>
  routes_guarded: number
}> {
  try {
    const [total, recent, topSurfaces, topRoles, guarded] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM abac_deny_log`).first<{ cnt: number }>(),
      db.prepare(`SELECT COUNT(*) as cnt FROM abac_deny_log WHERE denied_at >= datetime('now', '-1 day')`).first<{ cnt: number }>(),
      db.prepare(`SELECT surface, COUNT(*) as count FROM abac_deny_log GROUP BY surface ORDER BY count DESC LIMIT 5`).all<{ surface: string; count: number }>(),
      db.prepare(`SELECT subject_role as role, COUNT(*) as count FROM abac_deny_log GROUP BY subject_role ORDER BY count DESC LIMIT 5`).all<{ role: string; count: number }>(),
      db.prepare(`SELECT COUNT(DISTINCT surface || ':' || resource_type || ':' || action) as cnt FROM abac_ui_config`).first<{ cnt: number }>()
    ])

    return {
      total_denials: total?.cnt || 0,
      denials_last_24h: recent?.cnt || 0,
      top_denied_surfaces: topSurfaces.results || [],
      top_denied_roles: topRoles.results || [],
      routes_guarded: guarded?.cnt || 5 // default: 5 routes from P12
    }
  } catch {
    return { total_denials: 0, denials_last_24h: 0, top_denied_surfaces: [], top_denied_roles: [], routes_guarded: 5 }
  }
}

// ============================================================
// Generate client-side ABAC UI JavaScript for a surface
// Returns inline JS that calls /policies/simulate and disables buttons
// ============================================================
export function generateAbacUiScript(surface: string, configs: AbacUiConfig[]): string {
  if (configs.length === 0) return ''

  const guards = configs.map(cfg => ({
    action: cfg.action,
    resource: cfg.resource_type,
    tooltip: cfg.tooltip_deny,
    selector: `[data-abac-action="${cfg.action}"][data-abac-resource="${cfg.resource_type}"]`
  }))

  return `
<script>
// SOVEREIGN OS — ABAC-Aware UI (P13)
// Auto-disables action buttons based on current user role via /policies/simulate
(async function abacUiEnforce() {
  const surface = '${surface}';
  const guards = ${JSON.stringify(guards)};

  // Get current role from cookie or default to 'viewer'
  function getCurrentRole() {
    const match = document.cookie.match(/(?:^|;)\\s*platform_role=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : 'viewer';
  }

  const role = getCurrentRole();

  // Check each guard via simulate endpoint
  for (const guard of guards) {
    try {
      const resp = await fetch('/policies/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_type: 'role',
          subject_value: role,
          resource_type: guard.resource,
          action: guard.action,
          tenant_id: 'tenant-default'
        })
      });
      if (!resp.ok) continue;
      const data = await resp.json();

      if (data.decision === 'deny') {
        // Disable buttons matching selector
        const els = document.querySelectorAll(guard.selector);
        els.forEach(el => {
          el.disabled = true;
          el.classList.add('opacity-50', 'cursor-not-allowed');
          el.title = guard.tooltip + ' (role: ' + role + ')';
          el.setAttribute('aria-disabled', 'true');
          // Wrap with tooltip span if not already
          const span = document.createElement('span');
          span.className = 'inline-block cursor-not-allowed';
          span.title = guard.tooltip + ' (role: ' + role + ')';
          el.parentNode && el.parentNode.insertBefore(span, el);
          span.appendChild(el);
        });
        // Also disable submit buttons in forms with matching data attrs
        document.querySelectorAll('form[data-abac-action="' + guard.action + '"]').forEach(form => {
          const submit = form.querySelector('button[type="submit"], input[type="submit"]');
          if (submit) {
            (submit as HTMLButtonElement).disabled = true;
            submit.classList.add('opacity-50', 'cursor-not-allowed');
            submit.title = guard.tooltip + ' (role: ' + role + ')';
          }
        });
      }
    } catch (e) {
      // Fail-open: do not disable on error
    }
  }

  // Show role badge if role is viewer
  if (role === 'viewer') {
    const badge = document.createElement('div');
    badge.className = 'fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-800 text-xs px-3 py-2 rounded-lg shadow z-50';
    badge.innerHTML = '⚠️ Viewing as <strong>' + role + '</strong> — Some actions are restricted';
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 6000);
  }
})();
</script>`
}

// ============================================================
// Tenant-scoped ABAC: get policies for a tenant
// ============================================================
export async function getTenantPolicies(
  db: D1Database,
  tenant_id: string
): Promise<Array<{ policy_id: string; delegated_by: string; delegated_at: string }>> {
  try {
    const rows = await db.prepare(`
      SELECT policy_id, delegated_by, delegated_at
      FROM tenant_policies
      WHERE tenant_id = ?
      ORDER BY delegated_at DESC
    `).bind(tenant_id).all<{ policy_id: string; delegated_by: string; delegated_at: string }>()
    return rows.results || []
  } catch { return [] }
}

export async function assignTenantPolicy(
  db: D1Database,
  tenant_id: string,
  policy_id: string,
  delegated_by: string = 'admin'
): Promise<void> {
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO tenant_policies (tenant_id, policy_id, delegated_by)
      VALUES (?, ?, ?)
    `).bind(tenant_id, policy_id, delegated_by).run()
  } catch { /* non-blocking */ }
}

export async function removeTenantPolicy(
  db: D1Database,
  tenant_id: string,
  policy_id: string
): Promise<void> {
  try {
    await db.prepare(`
      DELETE FROM tenant_policies WHERE tenant_id = ? AND policy_id = ?
    `).bind(tenant_id, policy_id).run()
  } catch { /* non-blocking */ }
}
