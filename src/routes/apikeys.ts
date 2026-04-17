// ============================================================
// SOVEREIGN OS PLATFORM — PUBLIC API KEY MANAGEMENT (P5)
// Manages external public API keys.
// Auth: GET requires auth, POST requires auth
// Key management: raw key shown once at issuance, never stored
// Rate limiting: pluggable abstraction (KV-backed when binding available)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { createRepo } from '../lib/repo'
import { layout } from '../layout'
import { isAuthenticated } from '../lib/auth'

// ---- Secure key generation (Web Crypto) ----
async function generateApiKey(): Promise<{ rawKey: string; keyHash: string }> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const rawKey = 'sov_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey))
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return { rawKey, keyHash }
}

export function createApiKeysRoute() {
  const app = new Hono<{ Bindings: Env }>()

  // GET /api-keys — Key management dashboard
  app.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)

    if (!authenticated) {
      const unreadAlerts = await repo.getUnreadAlertCount()
      return c.html(layout('API Key Management', `
        <div class="page-header">
          <h1 class="page-title">API Key Management</h1>
        </div>
        <div class="card">
          <div class="card-body" style="text-align:center;padding:40px">
            <p style="color:var(--text2);margin-bottom:16px">Authentication required to manage API keys.</p>
            <a href="/auth/login" class="btn btn-primary">Login to Manage API Keys</a>
          </div>
        </div>`, '/api-keys', unreadAlerts), 401)
    }

    const [keys, unreadAlerts] = await Promise.all([
      repo.getPublicApiKeys(),
      repo.getUnreadAlertCount(),
    ])

    // Check for newly issued key in flash (query param)
    const newKey = c.req.query('new_key')
    const newKeyBanner = newKey ? `
      <div class="card mb-4" style="border-left:3px solid var(--success);background:rgba(16,185,129,0.05)">
        <div class="card-body">
          <strong>Key issued successfully.</strong> Copy this key now — it will not be shown again:
          <div style="background:var(--bg);border:1px solid var(--border);padding:10px;margin:8px 0;border-radius:4px;font-family:monospace;font-size:13px;word-break:break-all">${escHtml(newKey)}</div>
          <p style="font-size:11px;color:var(--text2)">Store this securely. The raw key is not stored in the platform.</p>
        </div>
      </div>` : ''

    const keyRows = keys.map(k => `
      <tr>
        <td><strong>${escHtml(k.label)}</strong><br>
          <span style="font-size:11px;color:var(--text2)">ID: <code>${k.id.slice(0,8)}</code></span></td>
        <td><span class="badge ${k.role_scope === 'readwrite' ? 'badge-yellow' : 'badge-blue'}">${k.role_scope}</span></td>
        <td>${k.active ? '<span class="badge badge-green">active</span>' : '<span class="badge badge-red">revoked</span>'}</td>
        <td>${k.rate_limit}/hr</td>
        <td style="font-size:11px">${k.request_count}</td>
        <td style="font-size:11px;color:var(--text2)">${k.last_used_at ? k.last_used_at.slice(0,16) : 'never'}</td>
        <td style="font-size:11px;color:var(--text2)">${escHtml(k.issued_by)}</td>
        ${k.active ? `<td>
          <form method="POST" action="/api-keys/${k.id}/revoke" style="display:inline">
            <button class="btn btn-sm btn-red" onclick="return confirm('Revoke this key?')">Revoke</button>
          </form>
        </td>` : '<td><span style="font-size:11px;color:var(--text3)">revoked</span></td>'}
      </tr>`).join('')

    const body = `
      ${newKeyBanner}
      <div class="page-header">
        <div>
          <h1 class="page-title">API Key Management</h1>
          <p class="page-subtitle">Public API key issuance and revocation. Raw keys are never stored.</p>
        </div>
        <button class="btn btn-primary" onclick="document.getElementById('issue-form').style.display='block';this.style.display='none'">+ Issue New Key</button>
      </div>

      <div id="issue-form" style="display:none" class="card mb-4">
        <div class="card-header">
          <h2 class="card-title">Issue New Public API Key</h2>
          <span class="badge badge-yellow">Key shown once at issuance only</span>
        </div>
        <div class="card-body">
          <form method="POST" action="/api-keys">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group">
                <label class="form-label">Label *</label>
                <input class="form-input" name="label" required placeholder="e.g. barberkas-integration">
              </div>
              <div class="form-group">
                <label class="form-label">Scope</label>
                <select class="form-input" name="role_scope">
                  <option value="readonly">Read-only</option>
                  <option value="readwrite">Read-Write</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Rate Limit (requests/hour)</label>
                <input class="form-input" name="rate_limit" type="number" value="100" min="1" max="10000">
              </div>
              <div class="form-group">
                <label class="form-label">Tenant</label>
                <input class="form-input" name="tenant_id" value="tenant-default" placeholder="tenant-default">
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label class="form-label">Notes</label>
                <input class="form-input" name="notes" placeholder="Purpose or owner notes">
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button type="submit" class="btn btn-primary">Issue Key</button>
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('issue-form').style.display='none'">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Issued Keys</h2>
          <span class="badge badge-blue">${keys.length} total / ${keys.filter(k => k.active).length} active</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Label</th><th>Scope</th><th>Status</th><th>Rate Limit</th>
                <th>Requests</th><th>Last Used</th><th>Issued By</th><th>Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y">${keyRows || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text2)">No API keys issued yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="card mt-4" style="background:var(--bg2)">
        <div class="card-body">
          <h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Rate Limiting Status</h3>
          <p style="font-size:12px;color:var(--text2)">
            <span class="badge badge-yellow">PARTIAL</span>
            Rate limiting is enforced at the in-memory counter level per request.
            KV-backed distributed rate limiting requires <code>KV</code> binding configuration.
            Current: pluggable abstraction with in-memory fallback (resets on deploy).
          </p>
        </div>
      </div>`

    return c.html(layout('API Key Management', body, '/api-keys', unreadAlerts))
  })

  // POST /api-keys — Issue new key
  app.post('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const body = await c.req.parseBody()
    const label = String(body['label'] || '').trim()
    const role_scope = (body['role_scope'] === 'readwrite' ? 'readwrite' : 'readonly') as 'readonly' | 'readwrite'
    const rate_limit = Math.min(10000, Math.max(1, Number(body['rate_limit']) || 100))
    const tenant_id = String(body['tenant_id'] || 'tenant-default').trim()
    const notes = String(body['notes'] || '').trim()
    const issued_by = 'architect'  // derived from auth role

    if (!label) return c.json({ error: 'label is required' }, 400)

    // Generate key — raw key shown once, hash stored
    const { rawKey, keyHash } = await generateApiKey()

    await repo.createPublicApiKey({
      label, tenant_id, key_hash: keyHash,
      role_scope, rate_limit, active: true,
      last_used_at: null, request_count: 0,
      issued_by, notes
    })

    // Redirect with raw key in query param (flash once)
    return c.redirect(`/api-keys?new_key=${encodeURIComponent(rawKey)}`)
  })

  // POST /api-keys/:id/revoke — Revoke key
  app.post('/:id/revoke', async (c) => {
    const repo = createRepo(c.env.DB)
    const authenticated = await isAuthenticated(c, c.env)
    if (!authenticated) return c.json({ error: 'Authentication required' }, 401)

    const id = c.req.param('id')
    await repo.revokePublicApiKey(id)
    return c.redirect('/api-keys')
  })

  return app
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
