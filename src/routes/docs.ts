// ============================================================
// SOVEREIGN OS PLATFORM — DEVELOPER DOCS SURFACE (P11)
// Purpose: SDK documentation, API v2 getting started guide, integration reference
// Surface: /docs
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import type { Env } from '../index'

export function createDocsRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /docs — main documentation hub
  route.get('/', async (c) => {
    const content = `
      <div style="margin-bottom:32px">
        <h1 style="font-size:28px;font-weight:700;color:var(--text);margin:0">Developer Documentation</h1>
        <p style="color:var(--text3);font-size:14px;margin:8px 0 0">Sovereign OS Platform — API v2 SDK & Integration Reference</p>
        <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
          <a href="/docs/quickstart" style="padding:6px 14px;background:var(--accent);color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">Quick Start</a>
          <a href="/docs/api-v2" style="padding:6px 14px;background:rgba(79,142,247,0.15);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3);border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">API v2 Reference</a>
          <a href="/docs/authentication" style="padding:6px 14px;background:rgba(79,142,247,0.1);color:#4f8ef7;border:1px solid rgba(79,142,247,0.2);border-radius:6px;font-size:12px;text-decoration:none">Authentication</a>
          <a href="/docs/webhooks" style="padding:6px 14px;background:rgba(79,142,247,0.1);color:#4f8ef7;border:1px solid rgba(79,142,247,0.2);border-radius:6px;font-size:12px;text-decoration:none">Webhooks</a>
          <a href="/docs/abac" style="padding:6px 14px;background:rgba(79,142,247,0.1);color:#4f8ef7;border:1px solid rgba(79,142,247,0.2);border-radius:6px;font-size:12px;text-decoration:none">ABAC Policies</a>
          <a href="/api/v2/docs" style="padding:6px 14px;background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.2);border-radius:6px;font-size:12px;text-decoration:none">Live API Docs →</a>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px">
        ${[
          { title: 'Quick Start', desc: 'Get up and running with the API in 5 minutes', href: '/docs/quickstart', icon: '🚀' },
          { title: 'API v2 Reference', desc: 'Complete endpoint reference with examples', href: '/docs/api-v2', icon: '📚' },
          { title: 'Authentication', desc: 'API keys, auth flows, and session management', href: '/docs/authentication', icon: '🔐' },
          { title: 'Webhooks', desc: 'Real-time event delivery via HTTP callbacks', href: '/docs/webhooks', icon: '⚡' },
          { title: 'ABAC Policies', desc: 'Attribute-Based Access Control guide', href: '/docs/abac', icon: '🛡️' },
          { title: 'Workflow Automation', desc: 'Trigger chains, multi-step workflows, retry', href: '/docs/workflows', icon: '⚙️' },
        ].map(card => `
          <a href="${card.href}" style="display:block;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;text-decoration:none;transition:border-color 0.2s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-size:20px;margin-bottom:8px">${card.icon}</div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">${card.title}</div>
            <div style="font-size:12px;color:var(--text3)">${card.desc}</div>
          </a>
        `).join('')}
      </div>

      <!-- Platform Overview -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><div class="card-title">Platform Overview</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2);line-height:1.7">
          <p><strong style="color:var(--text)">Sovereign OS Platform</strong> is an enterprise governance platform providing structured workflows, multi-tenant isolation, real-time observability, and attribute-based access control.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px">
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Platform Surfaces (41 total)</div>
              ${[
                ['P0–P3', 'Core governance (dashboard, intent, intake, approvals, proof, live, records, continuity, execution, connectors, roles)'],
                ['P4', 'Workspace, alerts, canon, lanes, onboarding, reports'],
                ['P5', 'Multi-tenants, AI assist, API keys, API v1'],
                ['P6', 'Tenant namespace routing (/t/:slug/*)'],
                ['P7', 'SSO integration, white-label branding'],
                ['P8', 'Federation, marketplace, immutable audit'],
                ['P9', 'Notifications, workflows, health dashboard, tenant portal'],
                ['P10', 'API v2, ABAC policies, alert rules, enhanced reports'],
                ['P11', 'Remediation, event bus, developer docs, workflow v2'],
              ].map(([phase, desc]) => `
                <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
                  <span style="font-size:11px;font-weight:700;color:var(--accent);width:40px;flex-shrink:0">${phase}</span>
                  <span style="font-size:11px;color:var(--text3)">${desc}</span>
                </div>
              `).join('')}
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Tech Stack</div>
              ${[
                ['Runtime', 'Cloudflare Pages + Workers (Edge)'],
                ['Framework', 'Hono (TypeScript)'],
                ['Database', 'Cloudflare D1 (SQLite-compatible)'],
                ['KV Store', 'Cloudflare KV (rate limiting, SSE state)'],
                ['Auth', 'Session-based + API key'],
                ['API', 'REST + SSE (no WebSocket — CF Pages)'],
                ['Deployment', 'Wrangler Pages deploy'],
              ].map(([key, val]) => `
                <div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
                  <span style="font-size:11px;font-weight:700;color:var(--text2);width:80px;flex-shrink:0">${key}</span>
                  <span style="font-size:11px;color:var(--text3)">${val}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Base URLs -->
      <div class="card">
        <div class="card-header"><div class="card-title">Base URLs</div></div>
        <div style="padding:16px">
          ${[
            ['Production', 'https://sovereign-os-platform.pages.dev', 'green'],
            ['API v2 Base', 'https://sovereign-os-platform.pages.dev/api/v2', 'blue'],
            ['API v1 Base', 'https://sovereign-os-platform.pages.dev/api/v1', 'blue'],
            ['Health Check', 'https://sovereign-os-platform.pages.dev/health', 'yellow'],
          ].map(([label, url, color]) => {
            const colors: Record<string, string> = { green: '#22c55e', blue: '#4f8ef7', yellow: '#fbbf24' }
            return `
            <div style="display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:11px;font-weight:700;color:${colors[color]};width:100px;flex-shrink:0">${label}</span>
              <code style="font-size:12px;color:var(--text2);font-family:monospace">${url}</code>
              <a href="${url}" target="_blank" style="font-size:10px;color:var(--accent);text-decoration:none;margin-left:auto">Open →</a>
            </div>`
          }).join('')}
        </div>
      </div>
    `
    return c.html(layout('Developer Docs', content, '/docs'))
  })

  // GET /docs/quickstart
  route.get('/quickstart', async (c) => {
    const content = `
      <div style="margin-bottom:20px">
        <a href="/docs" style="color:var(--accent);font-size:13px;text-decoration:none">← Back to Docs</a>
      </div>
      <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0 0 8px">Quick Start</h1>
      <p style="color:var(--text3);margin:0 0 24px">Get up and running with the Sovereign OS Platform API in 5 minutes.</p>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Step 1: Get an API Key</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>Navigate to <a href="/api-keys" style="color:var(--accent)">/api-keys</a> and create a new API key. Keep it secure — it won't be shown again.</p>
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px;overflow-x:auto">X-API-Key: your-api-key-here</pre>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Step 2: Check Health</div></div>
        <div style="padding:16px">
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px;overflow-x:auto">curl https://sovereign-os-platform.pages.dev/health

# Response:
{
  "status": "ok",
  "version": "1.1.0-P11",
  "phase": "P11 — ABAC, Workflow v2, Remediation, Event Bus",
  "persistence": "d1",
  "kv_rate_limiter": "kv-enforced"
}</pre>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Step 3: Make Your First API v2 Call</div></div>
        <div style="padding:16px">
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px;overflow-x:auto">curl https://sovereign-os-platform.pages.dev/api/v2/intents \\
  -H "X-API-Key: your-api-key-here"

# Response:
{
  "data": [...],
  "meta": {
    "total": 5,
    "limit": 20,
    "cursor": null,
    "next_cursor": null
  }
}</pre>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Step 4: Check ABAC Policies</div></div>
        <div style="padding:16px">
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px;overflow-x:auto">curl -X POST https://sovereign-os-platform.pages.dev/policies/simulate \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key-here" \\
  -d '{
    "subject_type": "role",
    "subject_value": "viewer",
    "resource_type": "approvals",
    "action": "delete"
  }'

# Response:
{
  "decision": "deny",
  "allowed": false,
  "reason": "Policy evaluation: deny for role:viewer on approvals:delete",
  "policies_evaluated": 5
}</pre>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Available Resources (API v2)</div></div>
        <div style="padding:16px">
          ${[
            ['/api/v2/intents', 'GET', 'List all platform intents'],
            ['/api/v2/approvals', 'GET', 'List approval requests'],
            ['/api/v2/workflows', 'GET', 'List workflow definitions'],
            ['/api/v2/workflow-runs', 'GET', 'List workflow execution history'],
            ['/api/v2/notifications', 'GET', 'List notifications'],
            ['/api/v2/health-snapshots', 'GET', 'Platform health time-series'],
            ['/api/v2/audit-events', 'GET', 'Immutable audit log'],
            ['/api/v2/tenants', 'GET', 'Tenant registry'],
            ['/api/v2/connectors', 'GET', 'Connector hub'],
            ['/api/v2/docs', 'GET', 'Interactive API documentation'],
          ].map(([path, method, desc]) => `
            <div style="display:flex;gap:12px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:10px;font-weight:700;background:rgba(79,142,247,0.1);color:#4f8ef7;border-radius:3px;padding:2px 6px;width:40px;text-align:center">${method}</span>
              <code style="font-size:12px;color:var(--accent)">${path}</code>
              <span style="font-size:12px;color:var(--text3);margin-left:auto">${desc}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
    return c.html(layout('Quick Start — Docs', content, '/docs'))
  })

  // GET /docs/api-v2
  route.get('/api-v2', async (c) => {
    const content = `
      <div style="margin-bottom:20px">
        <a href="/docs" style="color:var(--accent);font-size:13px;text-decoration:none">← Back to Docs</a>
      </div>
      <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0 0 8px">API v2 Reference</h1>
      <p style="color:var(--text3);margin:0 0 24px">Structured REST endpoints with cursor pagination, rate limiting, and tenant-scoped data.</p>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Request Format</div></div>
        <div style="padding:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">Required Headers</div>
              <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:10px;font-size:11px">X-API-Key: your-api-key
Content-Type: application/json  # for POST</pre>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">Query Parameters (GET)</div>
              <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:10px;font-size:11px">?limit=20       # max 100
?cursor=abc     # cursor pagination
?tenant_id=x    # filter by tenant</pre>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Response Format</div></div>
        <div style="padding:16px">
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px">{
  "data": [ ...resources ],
  "meta": {
    "total": 42,
    "limit": 20,
    "cursor": "last-seen-id",
    "next_cursor": "next-page-cursor"  // null if no more pages
  }
}

// Error format:
{
  "error": "Unauthorized",
  "code": 401
}</pre>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Rate Limiting</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>Rate limiting is enforced via Cloudflare KV. Limits are per API key per minute:</p>
          <div style="display:flex;gap:20px;margin-top:8px">
            <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:12px 20px;text-align:center">
              <div style="font-size:20px;font-weight:700;color:#22c55e">60</div>
              <div style="font-size:11px;color:var(--text3)">req/min (default)</div>
            </div>
            <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:12px 20px;text-align:center">
              <div style="font-size:20px;font-weight:700;color:#fbbf24">429</div>
              <div style="font-size:11px;color:var(--text3)">status when exceeded</div>
            </div>
          </div>
          <p style="margin-top:12px">Response headers include: <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code></p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Endpoint Reference</div>
          <a href="/api/v2/docs" style="font-size:12px;color:var(--accent);text-decoration:none">Live Docs →</a>
        </div>
        <div style="padding:16px">
          ${[
            { resource: 'Intents', endpoints: [['GET /api/v2/intents', 'List intents (paginated)'], ['GET /api/v2/intents/:id', 'Get intent by ID']] },
            { resource: 'Approvals', endpoints: [['GET /api/v2/approvals', 'List approvals (paginated)'], ['GET /api/v2/approvals/:id', 'Get approval by ID']] },
            { resource: 'Workflows', endpoints: [['GET /api/v2/workflows', 'List workflows'], ['GET /api/v2/workflows/:id', 'Get workflow by ID']] },
            { resource: 'Workflow Runs', endpoints: [['GET /api/v2/workflow-runs', 'List runs (paginated)']] },
            { resource: 'Notifications', endpoints: [['GET /api/v2/notifications', 'List notifications']] },
            { resource: 'Health Snapshots', endpoints: [['GET /api/v2/health-snapshots', 'Time-series health data']] },
            { resource: 'Audit Events', endpoints: [['GET /api/v2/audit-events', 'Immutable audit log (paginated)']] },
            { resource: 'Tenants', endpoints: [['GET /api/v2/tenants', 'Tenant registry'], ['GET /api/v2/tenants/:id', 'Get tenant']] },
            { resource: 'Connectors', endpoints: [['GET /api/v2/connectors', 'Connector hub']] },
          ].map(g => `
            <div style="margin-bottom:16px">
              <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">${g.resource}</div>
              ${g.endpoints.map(([path, desc]) => `
                <div style="display:flex;gap:12px;align-items:center;padding:5px 8px;background:rgba(0,0,0,0.15);border-radius:4px;margin-bottom:4px">
                  <code style="font-size:11px;color:var(--accent)">${path}</code>
                  <span style="font-size:11px;color:var(--text3);margin-left:auto">${desc}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `
    return c.html(layout('API v2 Reference — Docs', content, '/docs'))
  })

  // GET /docs/authentication
  route.get('/authentication', async (c) => {
    const content = `
      <div style="margin-bottom:20px">
        <a href="/docs" style="color:var(--accent);font-size:13px;text-decoration:none">← Back to Docs</a>
      </div>
      <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0 0 8px">Authentication</h1>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">API Key Authentication (Recommended)</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>All API endpoints require an API key passed in the <code>X-API-Key</code> header.</p>
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px">curl https://sovereign-os-platform.pages.dev/api/v2/intents \\
  -H "X-API-Key: your-api-key-here"</pre>
          <p style="margin-top:12px">Generate keys at <a href="/api-keys" style="color:var(--accent)">/api-keys</a>.</p>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Session Authentication (UI)</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>For browser-based access, use the login form. Sessions are cookie-based and expire after 24h.</p>
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px">POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=your-password</pre>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">ABAC-Scoped Access</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>API keys can be associated with ABAC policies to limit resource access. See <a href="/docs/abac" style="color:var(--accent)">ABAC Policies</a> for details.</p>
          <p>Key scopes are enforced on: approvals (POST), audit (DELETE), policies (write), alert-rules (write).</p>
        </div>
      </div>
    `
    return c.html(layout('Authentication — Docs', content, '/docs'))
  })

  // GET /docs/webhooks
  route.get('/webhooks', async (c) => {
    const content = `
      <div style="margin-bottom:20px">
        <a href="/docs" style="color:var(--accent);font-size:13px;text-decoration:none">← Back to Docs</a>
      </div>
      <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0 0 8px">Webhooks</h1>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Webhook Delivery</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>Register a connector with a <code>webhook_url</code> to receive real-time event payloads. All webhooks use POST with JSON payload.</p>
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px">{
  "event_type": "approval.submitted",
  "tenant_id": "tenant-default",
  "resource_id": "apr-abc123",
  "resource_type": "approval",
  "actor": "user",
  "payload": { ...resource data },
  "timestamp": "2026-04-18T16:00:00.000Z"
}</pre>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Webhook Retry (P11)</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>P11 introduces a <code>webhook_delivery_queue</code> table for retry tracking. Failed deliveries are queued with up to 3 retries.</p>
          <p>Monitor delivery status at <a href="/connectors" style="color:var(--accent)">/connectors</a>.</p>
        </div>
      </div>
    `
    return c.html(layout('Webhooks — Docs', content, '/docs'))
  })

  // GET /docs/abac
  route.get('/abac', async (c) => {
    const content = `
      <div style="margin-bottom:20px">
        <a href="/docs" style="color:var(--accent);font-size:13px;text-decoration:none">← Back to Docs</a>
      </div>
      <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0 0 8px">ABAC Policies</h1>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Policy Model</div></div>
        <div style="padding:16px;font-size:13px;color:var(--text2)">
          <p>ABAC evaluates: <strong style="color:var(--text)">subject</strong> (role/user/tenant) + <strong style="color:var(--text)">resource</strong> + <strong style="color:var(--text)">action</strong> → <strong style="color:#22c55e">allow</strong>/<strong style="color:#ef4444">deny</strong></p>
          <div style="margin-top:12px">
            <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">Priority rules:</div>
            <ul style="font-size:12px;color:var(--text3);margin:0;padding-left:20px;line-height:1.8">
              <li>Lower priority number = higher precedence</li>
              <li>At equal priority, <strong style="color:#ef4444">deny</strong> beats allow</li>
              <li>No applicable policy → default allow (governance-first)</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Policy Simulation (P11)</div></div>
        <div style="padding:16px">
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px">POST /policies/simulate
Content-Type: application/json

{
  "subject_type": "role",
  "subject_value": "viewer",
  "resource_type": "approvals",
  "action": "delete",
  "tenant_id": "tenant-default"  // optional
}

# Response:
{
  "decision": "deny",
  "allowed": false,
  "reason": "Policy evaluation: deny for role:viewer on approvals:delete",
  "policies_evaluated": 5,
  "matched_policies": [...]
}</pre>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Protected Routes (P11 ABAC Enforcement)</div></div>
        <div style="padding:16px">
          ${[
            ['POST /approvals/:id/approve', 'admin', 'approve'],
            ['POST /canon/:id/promote', 'admin', 'approve'],
            ['DELETE /audit/:id', 'admin', 'delete'],
            ['POST /policies', 'admin', 'write'],
            ['POST /alert-rules', 'admin', 'write'],
          ].map(([route, role, action]) => `
            <div style="display:flex;gap:12px;align-items:center;padding:5px 8px;background:rgba(0,0,0,0.15);border-radius:4px;margin-bottom:4px">
              <code style="font-size:11px;color:var(--accent)">${route}</code>
              <span style="font-size:10px;color:var(--text3);margin-left:auto">requires: role:${role} + action:${action}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `
    return c.html(layout('ABAC Policies — Docs', content, '/docs'))
  })

  // GET /docs/workflows
  route.get('/workflows', async (c) => {
    const content = `
      <div style="margin-bottom:20px">
        <a href="/docs" style="color:var(--accent);font-size:13px;text-decoration:none">← Back to Docs</a>
      </div>
      <h1 style="font-size:24px;font-weight:700;color:var(--text);margin:0 0 8px">Workflow Automation (P11)</h1>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Multi-Step Workflows</div></div>
        <div style="padding:16px">
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px">// Multi-step workflow definition (steps_json field)
[
  {
    "type": "create_notification",
    "params": {
      "title": "Step 1: Notify Admin",
      "event_type": "approval_pending",
      "message": "New approval pending review"
    }
  },
  {
    "type": "log_audit",
    "params": {
      "event": "workflow_multistep_executed",
      "severity": "info"
    }
  },
  {
    "type": "trigger_webhook",
    "params": {
      "url": "https://your-endpoint.com/webhook",
      "payload": { "source": "sovereign-os" }
    }
  }
]</pre>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Action Types (P11)</div></div>
        <div style="padding:16px">
          ${[
            ['create_notification', 'Create a platform notification (D1 + KV)', ['event_type', 'title', 'message']],
            ['log_audit', 'Write to immutable audit trail (SHA-256)', ['event', 'severity']],
            ['send_email', 'Send email (requires RESEND_API_KEY; graceful degradation)', ['recipient', 'subject', 'body']],
            ['create_approval', 'Auto-create an approval request', ['title', 'description', 'tier']],
            ['trigger_webhook', 'Fire external HTTP webhook', ['url', 'payload']],
          ].map(([type, desc, params]) => `
            <div style="background:rgba(0,0,0,0.15);border-radius:6px;padding:10px 12px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <code style="font-size:12px;color:var(--accent);font-weight:700">${type}</code>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:4px">${desc}</div>
              <div style="font-size:10px;color:var(--text3)">params: ${(params as string[]).join(', ')}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Retry Workflows</div></div>
        <div style="padding:16px">
          <pre style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:6px;padding:12px;font-size:12px">POST /workflows/:run_id/retry
// Retries a failed workflow run with same input
// Creates a new run with retry_of = original_run_id</pre>
        </div>
      </div>
    `
    return c.html(layout('Workflow Automation — Docs', content, '/docs'))
  })

  return route
}
