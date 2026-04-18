// ============================================================
// SOVEREIGN OS PLATFORM — TENANT BRANDING SURFACE (P7)
// Per-tenant white-label CSS/brand configuration.
// /branding — view/edit tenant branding
// /branding/css/:slug — serve tenant CSS vars (called from layout)
//
// SECURITY: No secrets stored. Only visual/display config.
// AUTH: GET /branding = auth required (branding data is tenant-sensitive)
//       POST /branding/:tid = auth required
//       GET /branding/css/:slug = public (CSS delivery)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { requireAuth, authStatusBadge, isAuthenticated } from '../lib/auth'
import { layout } from '../layout'

// ---- Default branding values ----
const BRAND_DEFAULTS = {
  brand_name: '',
  logo_url: '',
  primary_color: '#4f8ef7',
  secondary_color: '#1a1d27',
  accent_color: '#22c55e',
  text_color: '#e2e8f0',
  bg_color: '#0d0f14',
  font_family: 'system-ui, sans-serif',
  css_vars: '{}',
  custom_footer: '',
}

// ---- Build CSS string from branding config ----
export function buildBrandingCss(brand: {
  primary_color: string
  secondary_color: string
  accent_color: string
  text_color: string
  bg_color: string
  font_family: string
  css_vars: string
}): string {
  let extraVars = ''
  try {
    const vars = JSON.parse(brand.css_vars || '{}')
    extraVars = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')
  } catch (_) {}

  return `:root {
  --brand-primary: ${brand.primary_color};
  --brand-secondary: ${brand.secondary_color};
  --brand-accent: ${brand.accent_color};
  --brand-text: ${brand.text_color};
  --brand-bg: ${brand.bg_color};
  --brand-font: ${brand.font_family};
${extraVars}
}`
}

export function createBrandingRoute() {
  const app = new Hono<{ Bindings: Env }>()

  // GET /branding/css/:slug — Serve tenant CSS (public, used in /t/:slug/* layout)
  app.get('/css/:slug', async (c) => {
    const slug = c.req.param('slug')
    const repo = createRepo(c.env.DB)
    const tenant = await repo.getTenantBySlug(slug)
    if (!tenant) {
      // Return empty CSS for unknown tenants
      return new Response(':root {}', {
        headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=300' }
      })
    }
    const brand = await repo.getTenantBranding(tenant.id)
    const css = buildBrandingCss(brand ?? { ...BRAND_DEFAULTS })
    return new Response(css, {
      headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=300' }
    })
  })

  // GET /branding — Branding management list (auth required)
  app.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const tenants = await repo.getTenants()
    const authed = await isAuthenticated(c, c.env)

    const rows = await Promise.all(
      tenants.filter(t => t.status === 'active' && t.approval_status === 'approved').map(async t => {
        const brand = await repo.getTenantBranding(t.id)
        const hasCustomBrand = brand && brand.brand_name
        return `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:12px 16px;font-family:monospace;font-size:13px;color:var(--text)">${t.slug}</td>
          <td style="padding:12px 16px;color:var(--text2)">${t.name}</td>
          <td style="padding:12px 16px">
            ${hasCustomBrand
              ? `<span style="display:flex;align-items:center;gap:8px">
                  <span style="width:16px;height:16px;background:${brand!.primary_color};border-radius:50%;display:inline-block;flex-shrink:0"></span>
                  <span style="font-size:13px;font-weight:500;color:var(--text)">${brand!.brand_name}</span>
                </span>`
              : `<span style="color:var(--text3);font-size:13px">Default</span>`}
          </td>
          <td style="padding:12px 16px">
            ${authed ? `<a href="/branding/${t.id}" style="color:#f59e0b;text-decoration:none;font-size:13px">Edit</a>` : '<span style="color:var(--text3)">—</span>'}
          </td>
        </tr>`
      })
    )

    const bodyHtml = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Tenant Branding</h1>
          <div style="font-size:12px;color:var(--text2)">White-label brand configuration per tenant. Applied on /t/:slug/* surfaces.</div>
        </div>
        <div>${authStatusBadge(!!c.env.PLATFORM_API_KEY, authed)}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text3);text-transform:uppercase">Slug</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text3);text-transform:uppercase">Tenant</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text3);text-transform:uppercase">Branding</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text3);text-transform:uppercase">Actions</th>
          </tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <div style="padding:12px 16px;background:rgba(79,142,247,0.06);border:1px solid rgba(79,142,247,0.15);border-radius:8px;font-size:12px;color:var(--text3)">
        <strong style="color:var(--accent)">How branding works:</strong> When accessing <code>/t/:slug/*</code> surfaces,
        the platform injects tenant-specific CSS variables via <code>/branding/css/:slug</code>.
        Edit a tenant's branding to customize colors, fonts, and logos.
        <span style="color:#a855f7;margin-left:8px">● P7 White-Label Branding Active.</span>
      </div>`

    return c.html(layout('Tenant Branding', bodyHtml, '/branding'))
  })

  // GET /branding/:tid — Edit branding for tenant (auth required)
  app.get('/:tid', async (c) => {
    const tid = c.req.param('tid')
    const repo = createRepo(c.env.DB)
    const tenant = await repo.getTenant(tid)
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
    const brand = await repo.getTenantBranding(tid)
    const b = brand ?? { ...BRAND_DEFAULTS }
    const saved = c.req.query('saved') === '1'

    const brandEditContent = `
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body{background:#0d0f14;color:#e2e8f0;font-family:system-ui,sans-serif}</style>
    <div style="padding:24px;max-width:1200px">
      <div style="margin-bottom:24px">
        <a href="/branding" style="color:#4f8ef7;text-decoration:none;font-size:13px">← Tenant Branding</a>
        <h1 style="font-size:20px;font-weight:700;color:#fff;margin:8px 0 4px">Brand Config: ${tenant.name}</h1>
        <p style="font-size:12px;color:#9aa3b2">Changes apply to /t/${tenant.slug}/* surfaces immediately after save.</p>
      </div>
      ${saved ? '<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:12px;margin-bottom:16px;color:#22c55e;font-size:13px">✓ Branding saved successfully.</div>' : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <form method="POST" action="/branding/${tid}" style="background:#111318;border:1px solid #232830;border-radius:8px;padding:24px">
          <h2 style="font-size:16px;font-weight:600;color:#fff;margin:0 0 20px">Brand Identity</h2>
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Brand Name</label>
            <input type="text" name="brand_name" value="${b.brand_name}" placeholder="${tenant.name}"
              style="width:100%;background:#1a1d27;border:1px solid #2d3440;border-radius:6px;padding:8px 12px;color:#fff;font-size:14px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Logo URL (optional)</label>
            <input type="url" name="logo_url" value="${b.logo_url}" placeholder="https://cdn.example.com/logo.png"
              style="width:100%;background:#1a1d27;border:1px solid #2d3440;border-radius:6px;padding:8px 12px;color:#fff;font-size:13px;font-family:monospace;box-sizing:border-box">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Primary Color</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" name="primary_color" value="${b.primary_color}" style="width:40px;height:36px;border:none;background:transparent;cursor:pointer;padding:0">
                <span style="font-size:12px;color:#9aa3b2;font-family:monospace">${b.primary_color}</span>
              </div>
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Accent Color</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" name="accent_color" value="${b.accent_color}" style="width:40px;height:36px;border:none;background:transparent;cursor:pointer;padding:0">
                <span style="font-size:12px;color:#9aa3b2;font-family:monospace">${b.accent_color}</span>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div>
              <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Background Color</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" name="bg_color" value="${b.bg_color}" style="width:40px;height:36px;border:none;background:transparent;cursor:pointer;padding:0">
                <span style="font-size:12px;color:#9aa3b2;font-family:monospace">${b.bg_color}</span>
              </div>
            </div>
            <div>
              <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Text Color</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" name="text_color" value="${b.text_color}" style="width:40px;height:36px;border:none;background:transparent;cursor:pointer;padding:0">
                <span style="font-size:12px;color:#9aa3b2;font-family:monospace">${b.text_color}</span>
              </div>
            </div>
          </div>
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Secondary Color</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="color" name="secondary_color" value="${b.secondary_color}" style="width:40px;height:36px;border:none;background:transparent;cursor:pointer;padding:0">
              <span style="font-size:12px;color:#9aa3b2;font-family:monospace">${b.secondary_color}</span>
            </div>
          </div>
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Font Family</label>
            <input type="text" name="font_family" value="${b.font_family}" placeholder="system-ui, sans-serif"
              style="width:100%;background:#1a1d27;border:1px solid #2d3440;border-radius:6px;padding:8px 12px;color:#fff;font-size:13px;font-family:monospace;box-sizing:border-box">
          </div>
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Extra CSS Variables <span style="color:#6b7280">(JSON: {"--var": "value"})</span></label>
            <textarea name="css_vars" rows="3" style="width:100%;background:#1a1d27;border:1px solid #2d3440;border-radius:6px;padding:8px 12px;color:#fff;font-size:13px;font-family:monospace;box-sizing:border-box">${b.css_vars}</textarea>
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;font-size:13px;color:#cbd5e1;margin-bottom:6px">Custom Footer Text</label>
            <input type="text" name="custom_footer" value="${b.custom_footer}" placeholder="Powered by Sovereign OS Platform"
              style="width:100%;background:#1a1d27;border:1px solid #2d3440;border-radius:6px;padding:8px 12px;color:#fff;font-size:14px;box-sizing:border-box">
          </div>
          <button type="submit" style="background:#4f8ef7;color:#fff;border:none;border-radius:6px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">Save Branding</button>
        </form>
        <div>
          <div style="background:#111318;border:1px solid #232830;border-radius:8px;padding:20px;margin-bottom:16px">
            <h3 style="font-size:13px;font-weight:600;color:#9aa3b2;margin:0 0 16px">Live Preview</h3>
            <div id="brand-preview" style="background:${b.bg_color};border-radius:8px;padding:16px;font-family:${b.font_family}">
              <div style="background:${b.secondary_color};border-radius:6px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:12px">
                ${b.logo_url ? `<img src="${b.logo_url}" style="height:24px;width:24px;object-fit:contain" alt="logo" onerror="this.style.display='none'">` : ''}
                <span style="color:${b.primary_color};font-weight:bold;font-size:16px">${b.brand_name || tenant.name}</span>
              </div>
              <div style="background:${b.secondary_color};border-radius:6px;padding:12px;margin-bottom:8px">
                <div style="color:${b.text_color};font-size:14px">Sample content block</div>
                <div style="color:${b.accent_color};font-size:12px;margin-top:4px">Accent text element</div>
              </div>
              <button style="background:${b.primary_color};color:#fff;border:none;border-radius:4px;padding:8px 16px;font-size:13px;cursor:pointer">Primary Action</button>
              ${b.custom_footer ? `<div style="margin-top:12px;border-top:1px solid ${b.secondary_color};padding-top:8px;font-size:11px;color:${b.text_color};opacity:0.6">${b.custom_footer}</div>` : ''}
            </div>
          </div>
          <div style="background:#111318;border:1px solid #232830;border-radius:8px;padding:20px">
            <h3 style="font-size:13px;font-weight:600;color:#9aa3b2;margin:0 0 12px">CSS Output</h3>
            <pre style="font-size:11px;color:#9aa3b2;overflow-x:auto;font-family:monospace;background:#0d0f14;border-radius:4px;padding:12px">:root {
  --brand-primary: ${b.primary_color};
  --brand-accent: ${b.accent_color};
  --brand-bg: ${b.bg_color};
  --brand-text: ${b.text_color};
}</pre>
            <p style="font-size:11px;color:#6b7280;margin:8px 0 0">Served at: <code style="font-family:monospace">/branding/css/${tenant.slug}</code></p>
          </div>
        </div>
      </div>
    </div>`

    return c.html(layout(`Brand Config: ${tenant.name}`, brandEditContent, '/branding'))
  })
  // POST /branding/:tid — Save branding (auth required)
  app.post('/:tid', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth && c.env.PLATFORM_API_KEY) return c.redirect('/auth/login?redirect=/branding')
    const tid = c.req.param('tid')
    const repo = createRepo(c.env.DB)
    const tenant = await repo.getTenant(tid)
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

    const form = await c.req.formData()
    const brandName = (form.get('brand_name') as string ?? '').trim()
    const logoUrl = (form.get('logo_url') as string ?? '').trim()
    const primaryColor = (form.get('primary_color') as string ?? '#4f8ef7').trim()
    const secondaryColor = (form.get('secondary_color') as string ?? '#1a1d27').trim()
    const accentColor = (form.get('accent_color') as string ?? '#22c55e').trim()
    const textColor = (form.get('text_color') as string ?? '#e2e8f0').trim()
    const bgColor = (form.get('bg_color') as string ?? '#0d0f14').trim()
    const fontFamily = (form.get('font_family') as string ?? 'system-ui, sans-serif').trim()
    const cssVarsRaw = (form.get('css_vars') as string ?? '{}').trim()
    const customFooter = (form.get('custom_footer') as string ?? '').trim()

    // Validate css_vars is valid JSON
    let cssVars = '{}'
    try { JSON.parse(cssVarsRaw); cssVars = cssVarsRaw } catch (_) {}

    await repo.upsertTenantBranding({
      tenant_id: tid,
      brand_name: brandName || tenant.name,
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      text_color: textColor,
      bg_color: bgColor,
      font_family: fontFamily,
      css_vars: cssVars,
      custom_footer: customFooter,
    })

    return c.redirect(`/branding/${tid}?saved=1`)
  })

  return app
}
