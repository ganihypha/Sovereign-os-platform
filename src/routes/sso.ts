// ============================================================
// SOVEREIGN OS PLATFORM — SSO / OAuth2 ROUTE (P7)
// Tenant-scoped SSO configuration and PKCE flow.
// Provider: Auth0 or Clerk (configured per tenant in D1).
//
// SECURITY NON-NEGOTIABLES:
//   - client_secret NEVER stored in D1 — read from env secrets only
//   - state param CSRF protection required on callback
//   - PKCE required (pkce_enabled=1 enforced)
//   - Provider config updates require auth
//
// Routes:
//   GET  /auth/sso              — SSO landing page
//   GET  /auth/sso/config/:tid  — Get SSO config for tenant (auth required)
//   POST /auth/sso/config/:tid  — Upsert SSO config for tenant (auth required)
//   GET  /auth/sso/init/:tid    — Initiate OAuth2 PKCE flow for tenant
//   GET  /auth/sso/callback     — OAuth2 callback handler
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { isAuthenticated, authStatusBadge } from '../lib/auth'
import { layout } from '../layout'
import { planGuard } from '../lib/planGuard'

export function createSsoRoute() {
  const app = new Hono<{ Bindings: Env }>()

  // GET /auth/sso — SSO landing page
  app.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const tenants = await repo.getTenants()
    const authed = await isAuthenticated(c, c.env)

    const tenantRows = await Promise.all(
      tenants.filter(t => t.status === 'active' && t.approval_status === 'approved').map(async t => {
        const cfg = await repo.getSsoConfig(t.id)
        const enabled = cfg?.enabled && cfg.provider !== 'none'
        return `<tr>
          <td class="px-4 py-3 font-mono text-sm">${t.slug}</td>
          <td class="px-4 py-3">${t.name}</td>
          <td class="px-4 py-3"><span class="font-mono text-xs px-2 py-1 rounded ${enabled ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}">${enabled ? (cfg?.provider ?? 'none') : 'not configured'}</span></td>
          <td class="px-4 py-3">
            ${enabled
              ? `<a href="/auth/sso/init/${t.id}" class="text-blue-400 hover:underline text-sm">Initiate SSO</a>`
              : `<span class="text-gray-500 text-sm">—</span>`}
            ${authed ? ` <a href="/auth/sso/config/${t.id}" class="text-yellow-400 hover:underline text-sm ml-2">Configure</a>` : ''}
          </td>
        </tr>`
      })
    )

    return c.html(layout('SSO Integration', `
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-white">SSO / OAuth2 Integration</h1>
          <p class="text-gray-400 text-sm mt-1">Per-tenant Single Sign-On configuration. Provider: Auth0 or Clerk.</p>
        </div>
        <div class="flex gap-3">${authStatusBadge(!!c.env.PLATFORM_API_KEY, authed)}</div>
      </div>
      <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-4 mb-6 text-sm text-yellow-300">
        <strong>Security Notice:</strong> Client secrets are NEVER stored in the database.
        Set them via Cloudflare secrets: <code>npx wrangler pages secret put AUTH0_CLIENT_SECRET</code>
        or <code>CLERK_SECRET_KEY</code>.
      </div>
      <div class="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <table class="w-full">
          <thead><tr class="border-b border-gray-700">
            <th class="px-4 py-3 text-left text-xs text-gray-400 uppercase">Slug</th>
            <th class="px-4 py-3 text-left text-xs text-gray-400 uppercase">Tenant</th>
            <th class="px-4 py-3 text-left text-xs text-gray-400 uppercase">SSO Provider</th>
            <th class="px-4 py-3 text-left text-xs text-gray-400 uppercase">Actions</th>
          </tr></thead>
          <tbody>${tenantRows.join('')}</tbody>
        </table>
      </div>
      <div class="mt-6 bg-gray-900 rounded-lg border border-gray-700 p-4 text-sm text-gray-400">
        <strong class="text-gray-200">P7 SSO Scope:</strong>
        Auth0 and Clerk providers supported. PKCE flow enforced for all tenants.
        Tenant-scoped configuration — each tenant can have its own IdP.
      </div>
    `, '/auth/sso'))
  })

  // GET /auth/sso/config/:tid — SSO config editor (auth required)
  app.get('/config/:tid', async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth && c.env.PLATFORM_API_KEY) return c.redirect(`/auth/login?redirect=/auth/sso`)
    const tid = c.req.param('tid')
    const repo = createRepo(c.env.DB)
    const tenant = await repo.getTenant(tid)
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
    const cfg = await repo.getSsoConfig(tid)

    return c.html(layout('SSO Integration', `
      <div class="mb-6">
        <a href="/auth/sso" class="text-blue-400 hover:underline text-sm">← SSO Integration</a>
        <h1 class="text-2xl font-bold text-white mt-2">SSO Config: ${tenant.name}</h1>
        <p class="text-gray-400 text-sm">Tenant ID: <code class="font-mono">${tid}</code></p>
      </div>
      <div class="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-4 mb-6 text-sm text-yellow-300">
        <strong>Important:</strong> <code>client_secret</code> must be set via Cloudflare Secrets — NOT stored here.
        This form only saves the public-side OAuth2 parameters.
      </div>
      <form method="POST" action="/auth/sso/config/${tid}" class="bg-gray-900 rounded-lg border border-gray-700 p-6 space-y-4 max-w-2xl">
        <div>
          <label class="block text-sm text-gray-300 mb-1">Provider</label>
          <select name="provider" class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white">
            <option value="none" ${(!cfg || cfg.provider === 'none') ? 'selected' : ''}>None (SSO disabled)</option>
            <option value="auth0" ${cfg?.provider === 'auth0' ? 'selected' : ''}>Auth0</option>
            <option value="clerk" ${cfg?.provider === 'clerk' ? 'selected' : ''}>Clerk</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Enabled</label>
          <input type="checkbox" name="enabled" value="1" ${cfg?.enabled ? 'checked' : ''} class="mr-2">
          <span class="text-gray-400 text-sm">Activate SSO for this tenant</span>
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Client ID <span class="text-gray-500">(non-secret — public OAuth2 param)</span></label>
          <input type="text" name="client_id" value="${cfg?.client_id ?? ''}" placeholder="your-auth0-client-id"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm">
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Domain <span class="text-gray-500">(e.g. yourapp.auth0.com or clerk domain)</span></label>
          <input type="text" name="domain" value="${cfg?.domain ?? ''}" placeholder="yourapp.auth0.com"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm">
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Redirect URI</label>
          <input type="text" name="redirect_uri" value="${cfg?.redirect_uri ?? '/auth/sso/callback'}" placeholder="/auth/sso/callback"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm">
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Scopes</label>
          <input type="text" name="scopes" value="${cfg?.scopes ?? 'openid profile email'}" placeholder="openid profile email"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm">
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Config Notes</label>
          <textarea name="config_notes" rows="2" placeholder="Any notes about this SSO setup"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm">${cfg?.config_notes ?? ''}</textarea>
        </div>
        <div class="pt-2">
          <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-medium">Save SSO Config</button>
        </div>
      </form>
    `, '/auth/sso'))
  })

  // POST /auth/sso/config/:tid — Save SSO config (auth required)
  app.post('/config/:tid', async (c) => {
    const isAuthPost = await isAuthenticated(c, c.env)
    if (!isAuthPost && c.env.PLATFORM_API_KEY) return c.json({ error: 'AUTH_REQUIRED' }, 401)
    const tid = c.req.param('tid')
    const repo = createRepo(c.env.DB)
    const tenant = await repo.getTenant(tid)
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)

    const form = await c.req.formData()
    const provider = (form.get('provider') as string ?? 'none') as 'auth0' | 'clerk' | 'none'
    const enabled = form.get('enabled') === '1'
    const clientId = (form.get('client_id') as string ?? '').trim()
    const domain = (form.get('domain') as string ?? '').trim()
    const redirectUri = (form.get('redirect_uri') as string ?? '/auth/sso/callback').trim()
    const scopes = (form.get('scopes') as string ?? 'openid profile email').trim()
    const configNotes = (form.get('config_notes') as string ?? '').trim()

    await repo.upsertSsoConfig({
      tenant_id: tid,
      provider,
      enabled: provider !== 'none' && enabled,
      client_id: clientId,
      domain,
      redirect_uri: redirectUri,
      scopes,
      pkce_enabled: true,  // Always enforce PKCE
      config_notes: configNotes,
      created_by: 'Architect',
    })

    return c.redirect('/auth/sso?saved=1')
  })

  // GET /auth/sso/init/:tid — Initiate OAuth2 PKCE flow (P22: plan gate — enterprise only)
  app.use('/init/:tid', planGuard('sso'))
  app.get('/init/:tid', async (c) => {
    const tid = c.req.param('tid')
    const repo = createRepo(c.env.DB)
    const cfg = await repo.getSsoConfig(tid)

    if (!cfg || !cfg.enabled || cfg.provider === 'none') {
      return c.html(layout('SSO Integration', `
        <div class="max-w-lg mx-auto text-center py-16">
          <h2 class="text-xl font-bold text-red-400 mb-2">SSO Not Configured</h2>
          <p class="text-gray-400 mb-4">Tenant <code class="font-mono">${tid}</code> does not have SSO enabled.</p>
          <a href="/auth/sso" class="text-blue-400 hover:underline">← Back to SSO</a>
        </div>
      `, '/auth/sso'), 400)
    }

    // Build OAuth2 authorization URL with PKCE
    // Generate code_verifier (random, 43-128 chars)
    const codeVerifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 64)

    // code_challenge = base64url(sha256(code_verifier))
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier))
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    // state = random CSRF token
    const state = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    // Build authorization URL based on provider
    let authUrl = ''
    const redirectUri = encodeURIComponent(cfg.redirect_uri || '/auth/sso/callback')
    const scopes = encodeURIComponent(cfg.scopes || 'openid profile email')

    if (cfg.provider === 'auth0') {
      authUrl = `https://${cfg.domain}/authorize?` +
        `response_type=code&client_id=${cfg.client_id}&redirect_uri=${redirectUri}` +
        `&scope=${scopes}&state=${state}&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256`
    } else if (cfg.provider === 'clerk') {
      authUrl = `https://${cfg.domain}/oauth/authorize?` +
        `response_type=code&client_id=${cfg.client_id}&redirect_uri=${redirectUri}` +
        `&scope=${scopes}&state=${state}&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256`
    }

    if (!authUrl) {
      return c.html(layout('SSO Integration', `
        <div class="max-w-lg mx-auto text-center py-16">
          <h2 class="text-xl font-bold text-red-400 mb-2">SSO Config Error</h2>
          <p class="text-gray-400">Could not build authorization URL. Check domain and client_id.</p>
        </div>
      `, '/auth/sso'), 400)
    }

    // P21: Store state+code_verifier in KV with 5-minute TTL for real PKCE verification
    const kvKey = `sso_pkce_${state}`
    const kvPayload = JSON.stringify({ codeVerifier, tenantId: tid, provider: cfg.provider, issuedAt: Date.now() })
    if (c.env.RATE_LIMITER_KV) {
      // Reuse RATE_LIMITER_KV for PKCE state storage (300s TTL = 5 min window)
      await c.env.RATE_LIMITER_KV.put(kvKey, kvPayload, { expirationTtl: 300 })
    }

    return c.redirect(authUrl)
  })

  // GET /auth/sso/callback — OAuth2 callback (P21: real token exchange with KV PKCE verification)
  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')
    const errorDesc = c.req.query('error_description')

    if (error) {
      return c.html(layout('SSO Integration', `
        <div class="max-w-lg mx-auto text-center py-16">
          <h2 class="text-xl font-bold text-red-400 mb-2">SSO Error</h2>
          <p class="text-gray-400 mb-2">${error}</p>
          <p class="text-gray-500 text-sm">${errorDesc ?? ''}</p>
          <a href="/auth/sso" class="text-blue-400 hover:underline mt-4 block">← Back</a>
        </div>
      `, '/auth/sso'), 400)
    }

    if (!code) {
      return c.html(layout('SSO Integration', `
        <div class="max-w-lg mx-auto text-center py-16">
          <h2 class="text-xl font-bold text-yellow-400 mb-2">SSO Callback</h2>
          <p class="text-gray-400">No authorization code received. This endpoint is for OAuth2 callbacks only.</p>
          <a href="/auth/sso" class="text-blue-400 hover:underline mt-4 block">← Back</a>
        </div>
      `, '/auth/sso'), 200)
    }

    // P21: Real token exchange with KV PKCE state verification
    let pkceData: { codeVerifier: string; tenantId: string; provider: string; issuedAt: number } | null = null

    if (state && c.env.RATE_LIMITER_KV) {
      try {
        const kvKey = `sso_pkce_${state}`
        const raw = await c.env.RATE_LIMITER_KV.get(kvKey)
        if (raw) {
          pkceData = JSON.parse(raw)
          // Delete after use (one-time PKCE state)
          await c.env.RATE_LIMITER_KV.delete(kvKey)
        }
      } catch { /* KV unavailable — continue without PKCE verification */ }
    }

    // If we have PKCE data + provider secret — attempt real token exchange
    let tokenExchangeResult: { success: boolean; userEmail?: string; error?: string } = { success: false }
    if (pkceData && code) {
      const repo = createRepo(c.env.DB)
      const cfg = await repo.getSsoConfig(pkceData.tenantId).catch(() => null)

      if (cfg && cfg.enabled && cfg.provider !== 'none') {
        const clientSecret = cfg.provider === 'auth0'
          ? c.env.AUTH0_CLIENT_SECRET
          : c.env.CLERK_SECRET_KEY

        if (clientSecret) {
          try {
            // Build token endpoint URL
            const tokenEndpoint = cfg.provider === 'auth0'
              ? `https://${cfg.domain}/oauth/token`
              : `https://${cfg.domain}/oauth/token`

            const redirectUri = cfg.redirect_uri || `${new URL(c.req.url).origin}/auth/sso/callback`

            const tokenResp = await fetch(tokenEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: cfg.client_id || '',
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
                code_verifier: pkceData.codeVerifier,
              }).toString(),
            })

            if (tokenResp.ok) {
              const tokenData = await tokenResp.json() as Record<string, unknown>
              // Extract user email from id_token JWT claims (base64 decode middle part)
              let userEmail = 'sso-user@' + (cfg.domain || 'provider')
              if (tokenData.id_token && typeof tokenData.id_token === 'string') {
                try {
                  const payload = JSON.parse(atob(tokenData.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
                  userEmail = payload.email || payload.sub || userEmail
                } catch { /* ignore JWT parse errors */ }
              }

              // Store SSO session in D1 (fire-and-catch)
              if (c.env.DB) {
                const sessionId = `sso_${crypto.randomUUID()}`
                // Hash access token — NEVER store plaintext
                const encoder2 = new TextEncoder()
                const hashBuf = await crypto.subtle.digest('SHA-256', encoder2.encode(String(tokenData.access_token || sessionId)))
                const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

                c.env.DB.prepare(
                  `INSERT OR IGNORE INTO sso_sessions (id, provider, state, code_verifier_hash, user_email, access_token_hash, expires_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                  sessionId,
                  cfg.provider,
                  state?.substring(0, 64) ?? '',
                  tokenHash.substring(0, 64),
                  userEmail.substring(0, 200),
                  tokenHash,
                  new Date(Date.now() + 3600 * 1000).toISOString()
                ).run().catch(() => {})
              }

              tokenExchangeResult = { success: true, userEmail }
            } else {
              const errBody = await tokenResp.text().catch(() => '')
              tokenExchangeResult = { success: false, error: `Token exchange failed (${tokenResp.status})` }
            }
          } catch (fetchErr) {
            tokenExchangeResult = { success: false, error: 'Token exchange network error' }
          }
        } else {
          tokenExchangeResult = { success: false, error: `${cfg.provider.toUpperCase()} client secret not configured. Set via wrangler secret.` }
        }
      }
    }

    if (tokenExchangeResult.success) {
      return c.html(layout('SSO Integration', `
        <div class="max-w-lg mx-auto py-8">
          <h1 class="text-xl font-bold text-green-400 mb-4">✓ SSO Login Successful</h1>
          <div class="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-4">
            <p class="text-gray-300 mb-2">Authenticated as: <strong class="text-white">${tokenExchangeResult.userEmail}</strong></p>
            <p class="text-gray-400 text-sm mb-4">OAuth2 PKCE token exchange completed. Session recorded.</p>
            <div class="bg-green-900/20 border border-green-700/40 rounded p-3 text-sm text-green-300 mb-4">
              <strong>Session Active.</strong> Role assignment is handled by the platform admin.
              Visit <a href="/admin/sessions" class="underline">/admin/sessions</a> to manage sessions.
            </div>
          </div>
          <a href="/dashboard" class="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded font-medium">→ Go to Dashboard</a>
        </div>
      `, '/auth/sso'))
    }

    // Fallback: show callback received + instructions
    return c.html(layout('SSO Integration', `
      <div class="max-w-lg mx-auto py-8">
        <h1 class="text-xl font-bold text-yellow-400 mb-4">SSO Callback Received</h1>
        <div class="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-4">
          <p class="text-gray-300 mb-3">Authorization code received.</p>
          <p class="text-gray-400 text-sm mb-2">State: <code class="font-mono">${state?.substring(0,12) ?? 'none'}...</code></p>
          <p class="text-gray-400 text-sm mb-4">Code: <code class="font-mono">${code.substring(0,12)}...</code></p>
          ${tokenExchangeResult.error ? `
          <div class="bg-yellow-900/20 border border-yellow-700/40 rounded p-3 text-sm text-yellow-300 mb-3">
            <strong>Token Exchange Status:</strong> ${tokenExchangeResult.error}
          </div>` : ''}
          <div class="bg-blue-900/20 border border-blue-700/40 rounded p-3 text-sm text-blue-300">
            <strong>To activate full SSO:</strong> Configure <code>AUTH0_CLIENT_SECRET</code> or 
            <code>CLERK_SECRET_KEY</code> via <code>npx wrangler pages secret put</code>.
          </div>
        </div>
        <a href="/dashboard" class="text-blue-400 hover:underline">→ Continue to Dashboard</a>
      </div>
    `, '/auth/sso'))
  })

  return app
}
