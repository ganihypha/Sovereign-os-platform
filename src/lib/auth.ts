// ============================================================
// SOVEREIGN OS PLATFORM — MINIMAL AUTH LAYER (P1)
// P19: Added platform_sessions write on successful login
//
// Strategy: API Key gate using SHA-256 hash comparison
//   - API key is set via environment variable: PLATFORM_API_KEY
//   - Requests must include header: X-Platform-Key: <key>
//   - OR cookie: platform_key=<key> (for browser sessions)
//   - If PLATFORM_API_KEY is not configured → auth is UNCONFIGURED
//     (access is blocked with a clear warning, not silently open)
//
// WHAT IS PROTECTED:
//   - All POST/PUT/DELETE routes (state-mutating actions)
//   - /api/* mutation endpoints
//
// WHAT IS NOT PROTECTED (yet):
//   - GET routes for page views (read-only)
//   - /api/status (public health check)
//
// Auth status is visible as: configured / unconfigured / missing
// No key value is ever logged or rendered in UI.
// ============================================================

import type { Context, Next } from 'hono'

export type AuthEnv = {
  Bindings: {
    PLATFORM_API_KEY?: string
    DB?: D1Database
  }
}

// ---- P19: Write session to platform_sessions D1 table ----
// Fire-and-catch: never blocks auth flow on failure
async function writeSessionRecord(
  db: D1Database | undefined,
  roleName: string,
  ip: string
): Promise<void> {
  if (!db) return
  try {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()
    // platform_sessions schema (from 0017): id, user_id, session_token_hash, ip_address, user_agent, last_active_at, created_at, expires_at, force_logout
    // Store role in user_id field (platform uses role-based single-key auth)
    await db.prepare(
      `INSERT INTO platform_sessions (id, user_id, session_token_hash, ip_address, last_active_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, roleName, '', ip, now, now).run()
  } catch (_e) {
    // Graceful degradation — session write failure does not block login
  }
}

// Hash a string using Web Crypto (available in CF Workers + modern browsers)
export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Constant-time string comparison to prevent timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Extract key from request (header or cookie)
function extractKey(c: Context): string | null {
  // Priority: X-Platform-Key header > cookie
  const header = c.req.header('X-Platform-Key')
  if (header) return header.trim()

  const cookie = c.req.header('cookie')
  if (cookie) {
    const match = cookie.match(/platform_key=([^;]+)/)
    if (match) return match[1].trim()
  }
  return null
}

// Auth status page HTML — shown when key is missing
function authLoginPage(message: string, redirect: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Required — Sovereign OS Platform</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0c10; color: #e8eaf0;
      font-family: 'Inter', system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .box {
      background: #111318; border: 1px solid #232830;
      border-radius: 12px; padding: 40px; width: 100%; max-width: 400px;
    }
    .logo { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #4f8ef7;
      text-transform: uppercase; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .sub { color: #9aa3b2; font-size: 13px; margin-bottom: 28px; line-height: 1.6; }
    .err { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
      color: #ef4444; border-radius: 6px; padding: 10px 14px; font-size: 12px; margin-bottom: 20px; }
    input {
      width: 100%; background: #0a0c10; border: 1px solid #232830;
      color: #e8eaf0; border-radius: 6px; padding: 10px 14px;
      font-size: 14px; font-family: 'JetBrains Mono', monospace;
      margin-bottom: 12px; outline: none;
    }
    input:focus { border-color: #4f8ef7; }
    button {
      width: 100%; background: #4f8ef7; color: #fff; border: none;
      border-radius: 6px; padding: 11px; font-size: 14px; font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #2563eb; }
    .note { font-size: 11px; color: #5a6478; margin-top: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="box">
    <div class="logo">⬡ Sovereign OS Platform</div>
    <h1>Access Required</h1>
    <p class="sub">This platform is access-controlled. Enter your platform key to continue.</p>
    ${message ? `<div class="err">${message}</div>` : ''}
    <form method="POST" action="/auth/login">
      <input type="hidden" name="redirect" value="${redirect}">
      <input type="password" name="key" placeholder="Platform access key" autocomplete="off" autofocus>
      <button type="submit">Continue →</button>
    </form>
    <p class="note">Key is stored in a session cookie. Never share your key. Auth status is shown as readiness only — no key values are exposed.</p>
  </div>
</body>
</html>`
}

// Auth status indicator for layout (shows readiness, never key value)
export function authStatusBadge(configured: boolean, hasKey: boolean): string {
  if (!configured) {
    return '<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">AUTH UNCONFIGURED</span>'
  }
  if (hasKey) {
    return '<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">AUTH OK</span>'
  }
  return '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">AUTH MISSING</span>'
}

// ---- Middleware: require auth for mutating routes ----
// Use on routes where POST/PUT/DELETE should be gated.
export function requireAuth(env: { PLATFORM_API_KEY?: string }) {
  return async (c: Context, next: Next) => {
    const configuredKey = env.PLATFORM_API_KEY

    // If PLATFORM_API_KEY is not configured → block ALL mutations
    if (!configuredKey) {
      if (c.req.method !== 'GET') {
        return c.json({
          error: 'AUTH_UNCONFIGURED',
          message: 'PLATFORM_API_KEY is not configured. All mutating actions are blocked until auth is properly set up.',
          guidance: 'Set PLATFORM_API_KEY environment variable / secret to enable auth.'
        }, 503)
      }
      return next()
    }

    // For GET requests → allow (read-only pages are not gated in P1)
    if (c.req.method === 'GET') {
      return next()
    }

    // For mutations → verify key
    const providedKey = extractKey(c)
    if (!providedKey) {
      // If request is from browser form, redirect to login
      const accept = c.req.header('accept') ?? ''
      if (accept.includes('text/html')) {
        return c.html(authLoginPage('', c.req.url), 401)
      }
      return c.json({ error: 'AUTH_REQUIRED', message: 'X-Platform-Key header is required.' }, 401)
    }

    // Hash the provided key and compare
    const providedHash = await hashKey(providedKey)
    const configuredHash = await hashKey(configuredKey)

    if (!safeEqual(providedHash, configuredHash)) {
      return c.json({ error: 'AUTH_INVALID', message: 'Invalid platform key.' }, 403)
    }

    return next()
  }
}

// ---- Middleware: API endpoint auth (header-only, no browser redirect) ----
export function requireApiAuth(env: { PLATFORM_API_KEY?: string }) {
  return async (c: Context, next: Next) => {
    const configuredKey = env.PLATFORM_API_KEY

    // Skip for /api/status (public)
    if (c.req.path === '/api/status') return next()

    if (!configuredKey) {
      if (c.req.method !== 'GET') {
        return c.json({
          error: 'AUTH_UNCONFIGURED',
          message: 'PLATFORM_API_KEY environment variable is not set. Mutations are disabled.'
        }, 503)
      }
      return next()
    }

    if (c.req.method === 'GET') return next()

    const providedKey = c.req.header('X-Platform-Key')
    if (!providedKey) {
      return c.json({ error: 'AUTH_REQUIRED', message: 'X-Platform-Key header is required for mutations.' }, 401)
    }

    const providedHash = await hashKey(providedKey)
    const configuredHash = await hashKey(configuredKey)

    if (!safeEqual(providedHash, configuredHash)) {
      return c.json({ error: 'AUTH_INVALID', message: 'Invalid platform key.' }, 403)
    }

    return next()
  }
}

// ---- Auth login handler (POST /auth/login) ----
export function handleAuthLogin(env: { PLATFORM_API_KEY?: string; DB?: D1Database }) {
  return async (c: Context) => {
    const body = await c.req.parseBody()
    const providedKey = String(body.key ?? '').trim()
    const redirect = String(body.redirect ?? '/dashboard')

    if (!env.PLATFORM_API_KEY) {
      return c.html(authLoginPage('Auth is not configured on this server.', '/dashboard'), 503)
    }

    const providedHash = await hashKey(providedKey)
    const configuredHash = await hashKey(env.PLATFORM_API_KEY)

    if (!safeEqual(providedHash, configuredHash)) {
      return c.html(authLoginPage('Invalid key. Try again.', redirect), 401)
    }

    // P19: Write session record to platform_sessions (fire-and-catch)
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
    writeSessionRecord(env.DB, 'platform-admin', ip).catch(() => {})

    // Set session cookie (httpOnly, sameSite strict)
    // Note: key value is stored in cookie — user is responsible for secure transport (HTTPS)
    const safeRedirect = redirect.startsWith('/') ? redirect : '/dashboard'
    return new Response(null, {
      status: 302,
      headers: {
        'Location': safeRedirect,
        'Set-Cookie': `platform_key=${providedKey}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`
      }
    })
  }
}

// ---- Auth logout handler (POST /auth/logout) ----
export function handleAuthLogout() {
  return async (_c: Context) => {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/dashboard',
        'Set-Cookie': 'platform_key=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
      }
    })
  }
}

// ---- Helper: check if current request has valid auth ----
export async function isAuthenticated(c: Context, env: { PLATFORM_API_KEY?: string }): Promise<boolean> {
  if (!env.PLATFORM_API_KEY) return false
  const providedKey = extractKey(c)
  if (!providedKey) return false
  const providedHash = await hashKey(providedKey)
  const configuredHash = await hashKey(env.PLATFORM_API_KEY)
  return safeEqual(providedHash, configuredHash)
}
