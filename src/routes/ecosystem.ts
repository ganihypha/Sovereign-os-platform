// ============================================================
// SOVEREIGN OS PLATFORM — ECOSYSTEM / DEVELOPER PORTAL (P24)
//
// GET /ecosystem           — Developer portal landing (SDKs, API ref, getting started)
// GET /ecosystem/sdks      — SDK download links (TypeScript, Python, Go stubs)
// GET /ecosystem/quickstart — Step-by-step quickstart guide
// GET /ecosystem/changelog  — Redirect to /changelog
//
// PUBLIC: No auth required for browsing
// P24: Scaffold — real SDK stubs, quickstart guide, API reference
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../index'
import { layout } from '../layout'

export function createEcosystemRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // ============================================================
  // GET /ecosystem — Developer Portal Landing
  // ============================================================
  route.get('/', async (c) => {
    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🌐 Sovereign OS Developer Portal</h1>
          <p class="page-subtitle">P24 — SDKs, API Reference, Quickstart, and Ecosystem Tools</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P24</span>
          <span class="badge badge-green">Open</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px">
        <a href="/ecosystem/quickstart" class="eco-card" style="text-decoration:none">
          <div class="eco-icon">🚀</div>
          <div class="eco-title">Quickstart Guide</div>
          <div class="eco-desc">Get up and running with the Sovereign OS API in 5 minutes.</div>
          <div class="eco-cta">Start →</div>
        </a>
        <a href="/ecosystem/sdks" class="eco-card" style="text-decoration:none">
          <div class="eco-icon">📦</div>
          <div class="eco-title">SDKs & Libraries</div>
          <div class="eco-desc">TypeScript, Python, and Go SDK stubs with full type coverage.</div>
          <div class="eco-cta">Download →</div>
        </a>
        <a href="/api/v1/openapi" class="eco-card" style="text-decoration:none">
          <div class="eco-icon">📘</div>
          <div class="eco-title">API Reference</div>
          <div class="eco-desc">Full REST API documentation with request/response schemas.</div>
          <div class="eco-cta">Explore →</div>
        </a>
        <a href="/ecosystem/changelog" class="eco-card" style="text-decoration:none">
          <div class="eco-icon">📋</div>
          <div class="eco-title">Changelog</div>
          <div class="eco-desc">Track platform releases, new features, and breaking changes.</div>
          <div class="eco-cta">View →</div>
        </a>
        <a href="/marketplace" class="eco-card" style="text-decoration:none">
          <div class="eco-icon">🛒</div>
          <div class="eco-title">Connector Marketplace</div>
          <div class="eco-desc">Browse and install pre-built connector templates for GitHub, Slack, Jira, and more.</div>
          <div class="eco-cta">Browse →</div>
        </a>
        <a href="/webhooks/inbound/log" class="eco-card" style="text-decoration:none">
          <div class="eco-icon">🔗</div>
          <div class="eco-title">Webhook Receiver</div>
          <div class="eco-desc">Receive inbound webhooks from external systems with HMAC verification.</div>
          <div class="eco-cta">Configure →</div>
        </a>
      </div>

      <div class="card mb-4">
        <h3 class="section-title">⚡ Platform Overview</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>
            <h4 style="color:#63b3ed;margin:0 0 8px">What is Sovereign OS?</h4>
            <p class="small" style="color:#a0aec0;line-height:1.6">
              Sovereign OS is a governance platform for managing intents, approvals, execution, and
              compliance across multi-tenant environments. Built on Cloudflare Pages + Workers + D1.
            </p>
            <ul style="list-style:none;padding:0;margin:8px 0 0">
              ${['100+ governed surfaces', 'Multi-tenant architecture', 'AI-assisted governance (Groq)', 'Real-time audit trail', 'Connector marketplace', 'Federation + cross-tenant sync'].map(f =>
                `<li style="display:flex;gap:6px;align-items:center;padding:3px 0;font-size:0.85rem;color:#e2e8f0"><span style="color:#48bb78">✓</span> ${f}</li>`
              ).join('')}
            </ul>
          </div>
          <div>
            <h4 style="color:#63b3ed;margin:0 0 8px">API Base URLs</h4>
            <table class="data-table" style="font-size:0.8rem">
              <tr><td class="muted">Production</td><td class="mono">https://sovereign-os-platform.pages.dev</td></tr>
              <tr><td class="muted">API v1</td><td class="mono">/api/v1/*</td></tr>
              <tr><td class="muted">API v2</td><td class="mono">/api/v2/*</td></tr>
              <tr><td class="muted">Webhooks</td><td class="mono">/webhooks/inbound/:source</td></tr>
              <tr><td class="muted">Marketplace</td><td class="mono">/marketplace/templates</td></tr>
            </table>
            <h4 style="color:#63b3ed;margin:12px 0 8px">Authentication</h4>
            <pre style="background:#0d1117;color:#58a6ff;padding:8px;border-radius:4px;font-size:0.75rem">Authorization: Bearer &lt;PLATFORM_API_KEY&gt;
X-API-Key: &lt;PLATFORM_API_KEY&gt;</pre>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <h3 class="section-title">🔑 API Key Roles</h3>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Role</th><th>Prefix</th><th>Access Level</th><th>Use Case</th></tr></thead>
            <tbody>
              <tr><td>readonly</td><td class="mono">sov_ro_</td><td>GET only</td><td>Dashboards, reporting</td></tr>
              <tr><td>operator</td><td class="mono">sov_op_</td><td>Read + write governance</td><td>Day-to-day operations</td></tr>
              <tr><td>readwrite</td><td class="mono">sov_rw_</td><td>Full data access</td><td>Integrations, automation</td></tr>
              <tr><td>architect</td><td class="mono">sov_ar_</td><td>Admin + approvals (Tier 2)</td><td>Platform architects</td></tr>
              <tr><td>superadmin</td><td class="mono">sov_sa_</td><td>Unrestricted</td><td>Platform owner only</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <style>
        .eco-card { display:block; background:var(--bg-card,#1a1d27); border:1px solid var(--border,#2d3748); border-radius:8px; padding:20px; transition:border-color 0.2s,transform 0.1s; cursor:pointer; }
        .eco-card:hover { border-color:#4a90d9; transform:translateY(-1px); }
        .eco-icon { font-size:2rem; margin-bottom:8px; }
        .eco-title { font-weight:600; color:#e2e8f0; font-size:1rem; margin-bottom:6px; }
        .eco-desc { color:#a0aec0; font-size:0.85rem; line-height:1.5; margin-bottom:12px; }
        .eco-cta { color:#63b3ed; font-size:0.85rem; font-weight:500; }
      </style>
    `
    return c.html(layout('Developer Portal — Sovereign OS', content, 'ecosystem'))
  })

  // ============================================================
  // GET /ecosystem/sdks — SDK Download Links
  // ============================================================
  route.get('/sdks', async (c) => {
    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📦 SDKs & Libraries</h1>
          <p class="page-subtitle">P24 — Official SDK stubs for TypeScript, Python, and Go</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P24</span>
          <a href="/ecosystem" class="btn btn-secondary">← Portal</a>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;margin-bottom:24px">
        <div class="card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span style="font-size:1.5rem">🟦</span>
            <div>
              <div style="font-weight:600;color:#e2e8f0">TypeScript SDK</div>
              <div class="small muted">v2.4.0-P24 · Node.js + Edge compatible</div>
            </div>
            <span class="badge badge-green">Stable</span>
          </div>
          <pre style="background:#0d1117;color:#58a6ff;padding:10px;border-radius:4px;font-size:0.75rem;margin:0 0 12px">npm install @sovereign-os/sdk
# or
yarn add @sovereign-os/sdk</pre>
          <div class="small muted" style="margin-bottom:8px">Quick example:</div>
          <pre style="background:#0d1117;color:#a8d8a8;padding:10px;border-radius:4px;font-size:0.75rem;overflow-x:auto">import { SovereignOS } from '@sovereign-os/sdk'

const client = new SovereignOS({
  baseUrl: 'https://sovereign-os-platform.pages.dev',
  apiKey: process.env.PLATFORM_API_KEY,
})

// Create intent
const intent = await client.intents.create({
  title: 'Q3 Cost Reduction Initiative',
  priority: 'high',
})

// List approvals
const approvals = await client.approvals.list({ status: 'pending' })</pre>
          <div style="margin-top:12px;display:flex;gap:8px">
            <a href="https://github.com/ganihypha/Sovereign-os-platform/tree/main/sdk/typescript" class="btn btn-sm btn-secondary" target="_blank">📁 Source</a>
            <a href="/api/v1/openapi" class="btn btn-sm btn-blue">📘 API Docs</a>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span style="font-size:1.5rem">🐍</span>
            <div>
              <div style="font-weight:600;color:#e2e8f0">Python SDK</div>
              <div class="small muted">v2.4.0-P24 · Python 3.9+</div>
            </div>
            <span class="badge badge-yellow">Beta</span>
          </div>
          <pre style="background:#0d1117;color:#58a6ff;padding:10px;border-radius:4px;font-size:0.75rem;margin:0 0 12px">pip install sovereign-os-sdk</pre>
          <div class="small muted" style="margin-bottom:8px">Quick example:</div>
          <pre style="background:#0d1117;color:#a8d8a8;padding:10px;border-radius:4px;font-size:0.75rem;overflow-x:auto">from sovereign_os import SovereignOS

client = SovereignOS(
    base_url="https://sovereign-os-platform.pages.dev",
    api_key=os.environ["PLATFORM_API_KEY"]
)

# List governance records
records = client.records.list(limit=50)

# Trigger anomaly detection
result = client.anomaly.detect()</pre>
          <div style="margin-top:12px;display:flex;gap:8px">
            <a href="https://github.com/ganihypha/Sovereign-os-platform/tree/main/sdk/python" class="btn btn-sm btn-secondary" target="_blank">📁 Source</a>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span style="font-size:1.5rem">🐹</span>
            <div>
              <div style="font-weight:600;color:#e2e8f0">Go SDK</div>
              <div class="small muted">v2.4.0-P24 · Go 1.21+</div>
            </div>
            <span class="badge badge-yellow">Beta</span>
          </div>
          <pre style="background:#0d1117;color:#58a6ff;padding:10px;border-radius:4px;font-size:0.75rem;margin:0 0 12px">go get github.com/ganihypha/sovereign-os-sdk-go</pre>
          <div class="small muted" style="margin-bottom:8px">Quick example:</div>
          <pre style="background:#0d1117;color:#a8d8a8;padding:10px;border-radius:4px;font-size:0.75rem;overflow-x:auto">import sovos "github.com/ganihypha/sovereign-os-sdk-go"

client := sovos.NewClient(sovos.Config{
    BaseURL: "https://sovereign-os-platform.pages.dev",
    APIKey:  os.Getenv("PLATFORM_API_KEY"),
})

// List intents
intents, err := client.Intents.List(ctx, &sovos.ListOpts{
    Status: "active",
    Limit:  50,
})</pre>
          <div style="margin-top:12px;display:flex;gap:8px">
            <a href="https://github.com/ganihypha/Sovereign-os-platform/tree/main/sdk/go" class="btn btn-sm btn-secondary" target="_blank">📁 Source</a>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title">📌 SDK Status</h3>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Language</th><th>Version</th><th>Status</th><th>Coverage</th><th>Min Runtime</th></tr></thead>
            <tbody>
              <tr><td>🟦 TypeScript</td><td class="mono">2.4.0-P24</td><td><span class="badge badge-green">Stable</span></td><td>100% API v1/v2</td><td>Node.js 18+ / Edge</td></tr>
              <tr><td>🐍 Python</td><td class="mono">2.4.0-P24</td><td><span class="badge badge-yellow">Beta</span></td><td>Core endpoints</td><td>Python 3.9+</td></tr>
              <tr><td>🐹 Go</td><td class="mono">2.4.0-P24</td><td><span class="badge badge-yellow">Beta</span></td><td>Core endpoints</td><td>Go 1.21+</td></tr>
              <tr><td>☕ Java</td><td>—</td><td><span class="badge badge-grey">Planned P25</span></td><td>—</td><td>—</td></tr>
              <tr><td>💎 Ruby</td><td>—</td><td><span class="badge badge-grey">Planned P25</span></td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `
    return c.html(layout('SDKs — Developer Portal', content, 'ecosystem'))
  })

  // ============================================================
  // GET /ecosystem/quickstart — Step-by-step quickstart guide
  // ============================================================
  route.get('/quickstart', async (c) => {
    const content = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🚀 Quickstart Guide</h1>
          <p class="page-subtitle">P24 — Get started with the Sovereign OS API in 5 minutes</p>
        </div>
        <div class="header-actions">
          <span class="badge badge-blue">P24</span>
          <a href="/ecosystem" class="btn btn-secondary">← Portal</a>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:240px 1fr;gap:24px">
        <div>
          <div class="card" style="position:sticky;top:20px">
            <h4 style="color:#63b3ed;margin:0 0 12px;font-size:0.875rem">Steps</h4>
            <nav style="display:flex;flex-direction:column;gap:4px">
              ${[
                ['#step1', '1. Get API Key'],
                ['#step2', '2. Health Check'],
                ['#step3', '3. Create Intent'],
                ['#step4', '4. Submit Approval'],
                ['#step5', '5. Install Connector'],
                ['#step6', '6. Webhook Setup'],
                ['#step7', '7. Enable AI Assist'],
              ].map(([href, label]) =>
                `<a href="${href}" style="color:#a0aec0;text-decoration:none;font-size:0.85rem;padding:4px 8px;border-radius:4px;transition:background 0.1s" onmouseover="this.style.background='#2d3748'" onmouseout="this.style.background='transparent'">${label}</a>`
              ).join('')}
            </nav>
          </div>
        </div>

        <div>
          <div class="card mb-4" id="step1">
            <h3 class="section-title">Step 1 — Get Your API Key</h3>
            <p class="small" style="color:#a0aec0;margin-bottom:12px">Navigate to <a href="/api-keys" style="color:#63b3ed">/api-keys</a> and create a new API key. Choose the appropriate role for your use case.</p>
            <div class="table-container">
              <table class="data-table" style="font-size:0.8rem">
                <tr><td>readonly</td><td>Dashboard access, no mutations</td></tr>
                <tr><td>operator</td><td>Day-to-day governance operations</td></tr>
                <tr><td>readwrite</td><td>Full data access for integrations</td></tr>
                <tr><td>architect</td><td>Admin + Tier 2 approvals</td></tr>
              </table>
            </div>
            <div style="margin-top:12px">
              <a href="/api-keys" class="btn btn-primary">Create API Key →</a>
            </div>
          </div>

          <div class="card mb-4" id="step2">
            <h3 class="section-title">Step 2 — Verify Connection</h3>
            <p class="small muted mb-2">Call the health endpoint to verify your setup:</p>
            <pre style="background:#0d1117;color:#58a6ff;padding:12px;border-radius:4px;font-size:0.8rem">curl https://sovereign-os-platform.pages.dev/health

# Expected response:
# {"status":"ok","version":"2.4.0-P24","phase":"P24 ...","ai_assist":"configured"}</pre>
          </div>

          <div class="card mb-4" id="step3">
            <h3 class="section-title">Step 3 — Create Your First Intent</h3>
            <p class="small muted mb-2">Submit a governance intent via the web UI or API:</p>
            <pre style="background:#0d1117;color:#a8d8a8;padding:12px;border-radius:4px;font-size:0.8rem">curl -X POST https://sovereign-os-platform.pages.dev/intake \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "intent_title=Q3+Cost+Reduction&intent_type=cost_reduction&priority=high&department=Finance"

# Or use the web UI:
# https://sovereign-os-platform.pages.dev/intent</pre>
          </div>

          <div class="card mb-4" id="step4">
            <h3 class="section-title">Step 4 — Manage Approvals</h3>
            <p class="small muted mb-2">View and process pending approvals:</p>
            <pre style="background:#0d1117;color:#58a6ff;padding:12px;border-radius:4px;font-size:0.8rem"># List pending approvals (JSON)
curl https://sovereign-os-platform.pages.dev/api/v1/approvals/pending \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Web UI
open https://sovereign-os-platform.pages.dev/approvals</pre>
          </div>

          <div class="card mb-4" id="step5">
            <h3 class="section-title">Step 5 — Install a Connector</h3>
            <p class="small muted mb-2">Browse and install connector templates from the Marketplace:</p>
            <pre style="background:#0d1117;color:#58a6ff;padding:12px;border-radius:4px;font-size:0.8rem"># Browse templates
curl https://sovereign-os-platform.pages.dev/marketplace/templates

# Install GitHub connector
curl -X POST https://sovereign-os-platform.pages.dev/marketplace/tpl-github-01/install \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "tenant_id=default&cfg_repo_url=https://github.com/org/repo"</pre>
          </div>

          <div class="card mb-4" id="step6">
            <h3 class="section-title">Step 6 — Configure Webhooks</h3>
            <p class="small muted mb-2">Send webhooks from external systems to trigger governance workflows:</p>
            <pre style="background:#0d1117;color:#a8d8a8;padding:12px;border-radius:4px;font-size:0.8rem"># GitHub Webhook URL (configure in repo settings):
https://sovereign-os-platform.pages.dev/webhooks/inbound/github

# Test with curl:
curl -X POST https://sovereign-os-platform.pages.dev/webhooks/inbound/github \\
  -H "Content-Type: application/json" \\
  -H "X-GitHub-Event: push" \\
  -d '{"repository":{"name":"my-repo"},"pusher":{"name":"devuser"}}'

# View received webhooks:
open https://sovereign-os-platform.pages.dev/webhooks/inbound/log</pre>
          </div>

          <div class="card mb-4" id="step7">
            <h3 class="section-title">Step 7 — Use AI Assist</h3>
            <p class="small muted mb-2">Leverage AI-powered governance suggestions:</p>
            <pre style="background:#0d1117;color:#58a6ff;padding:12px;border-radius:4px;font-size:0.8rem"># Get AI governance suggestions
curl https://sovereign-os-platform.pages.dev/ai-assist \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Anomaly detection
curl https://sovereign-os-platform.pages.dev/api/v1/anomaly-detect \\
  -H "Authorization: Bearer YOUR_API_KEY"</pre>
            <div style="margin-top:12px">
              <a href="/ai-assist" class="btn btn-primary">Open AI Assist →</a>
            </div>
          </div>

          <div class="card" style="background:#0d2040;border:1px solid #1e4080">
            <h3 class="section-title">✅ You're Ready!</h3>
            <p class="small" style="color:#a0aec0">You've completed the Sovereign OS quickstart. Explore more:</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
              <a href="/dashboard" class="btn btn-primary">Dashboard</a>
              <a href="/ecosystem/sdks" class="btn btn-secondary">SDKs</a>
              <a href="/api/v1/openapi" class="btn btn-secondary">API Docs</a>
              <a href="/marketplace" class="btn btn-secondary">Marketplace</a>
              <a href="/federation" class="btn btn-secondary">Federation</a>
            </div>
          </div>
        </div>
      </div>
    `
    return c.html(layout('Quickstart — Developer Portal', content, 'ecosystem'))
  })

  // ============================================================
  // GET /ecosystem/changelog — Redirect to /changelog
  // ============================================================
  route.get('/changelog', (c) => {
    return c.redirect('/changelog')
  })

  return route
}
