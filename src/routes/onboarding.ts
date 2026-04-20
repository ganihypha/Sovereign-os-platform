// ============================================================
// SOVEREIGN OS PLATFORM — ONBOARDING WIZARD (P22 UPGRADE)
// P22: Full 5-step wizard with D1 tracking (onboarding_wizard_state)
//
// Steps:
//   1. Account Setup      — confirm tenant details, admin contact
//   2. Configure Roles    — assign initial roles to first operator
//   3. Create First Workflow — create initial intent/workflow
//   4. Register First Connector — register first integration connector
//   5. Complete          — onboarding done, go to dashboard
//
// D1 tracking: onboarding_wizard_state table (migration 0024)
// Welcome email: fire-and-catch on step 1 completion
// Redirect: new tenants with onboarding_complete = 0 → /onboarding
// ============================================================

import { Hono } from 'hono'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import { emailWelcome } from '../lib/emailService'
import type { Env } from '../index'

const TOTAL_STEPS = 5

const STEP_LABELS = [
  'Account Setup',
  'Configure Roles',
  'Create First Workflow',
  'Register First Connector',
  'Complete',
]

function pageShell(title: string, content: string, step: number): string {
  const progress = Math.round((step / TOTAL_STEPS) * 100)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} — Sovereign OS Platform Onboarding</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0c10;color:#e8eaf0;font-family:system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
    .container{width:100%;max-width:600px}
    .header{text-align:center;margin-bottom:24px}
    .brand{font-size:11px;font-weight:700;letter-spacing:.12em;color:#4f8ef7;text-transform:uppercase;margin-bottom:4px}
    .progress-bar{background:#232830;border-radius:4px;height:4px;width:100%;margin-bottom:8px;overflow:hidden}
    .progress-fill{background:#4f8ef7;height:100%;border-radius:4px;transition:width .3s;width:${progress}%}
    .step-label{font-size:11px;color:#5a6478;margin-bottom:20px;text-align:center}
    .card{background:#111318;border:1px solid #232830;border-radius:12px;padding:32px}
    h2{font-size:22px;font-weight:700;margin-bottom:8px}
    .sub{color:#9aa3b2;font-size:13px;line-height:1.6;margin-bottom:24px}
    .btn{display:inline-block;background:#4f8ef7;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;width:100%;text-align:center;margin-bottom:10px}
    .btn-green{background:#22c55e}
    .btn-secondary{background:#181c22;color:#9aa3b2;border:1px solid #232830}
    input,select{width:100%;background:#0a0c10;border:1px solid #232830;color:#e8eaf0;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:12px;outline:none}
    input:focus,select:focus{border-color:#4f8ef7}
    label{font-size:12px;color:#9aa3b2;display:block;margin-bottom:6px}
    .step-nav{display:flex;gap:6px;justify-content:center;margin-bottom:24px;flex-wrap:wrap}
    .step-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #232830;color:#5a6478}
    .step-dot.done{background:#22c55e;border-color:#22c55e;color:#fff}
    .step-dot.active{background:#4f8ef7;border-color:#4f8ef7;color:#fff}
    .skip-link{text-align:center;margin-top:12px;font-size:12px;color:#5a6478}
    .skip-link a{color:#4f8ef7;text-decoration:none}
    .check-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1a1e24;font-size:13px}
    .check-item .ck{color:#22c55e;font-size:16px}
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">⬡ Sovereign OS Platform</div>
  </div>
  <div class="progress-bar"><div class="progress-fill"></div></div>
  <div class="step-label">Step ${step} of ${TOTAL_STEPS} — ${STEP_LABELS[step - 1]}</div>
  <div class="card">${content}</div>
  ${step < TOTAL_STEPS
    ? `<div class="skip-link"><a href="/dashboard">Skip onboarding → Go to Dashboard</a></div>`
    : ''}
</div>
</body>
</html>`
}

// ---- D1 helpers (fire-and-catch) ----
async function getOrCreateWizardState(db: D1Database, tenantId: string) {
  try {
    const id = `onb-${tenantId}`
    // Ensure row exists
    await db.prepare(
      `INSERT OR IGNORE INTO onboarding_wizard_state
       (id, tenant_id, current_step, step1_done, step2_done, step3_done, step4_done, step5_done,
        welcome_email_sent, last_activity_at, created_at)
       VALUES (?, ?, 1, 0, 0, 0, 0, 0, 0, datetime('now'), datetime('now'))`
    ).bind(id, tenantId).run()

    return await db.prepare(
      'SELECT * FROM onboarding_wizard_state WHERE tenant_id = ? LIMIT 1'
    ).bind(tenantId).first<{
      id: string; tenant_id: string; current_step: number
      step1_done: number; step2_done: number; step3_done: number
      step4_done: number; step5_done: number; welcome_email_sent: number
    }>()
  } catch (_e) {
    return null
  }
}

async function markStepDone(db: D1Database, tenantId: string, step: number) {
  try {
    const col = `step${step}_done`
    const nextStep = Math.min(step + 1, TOTAL_STEPS)
    await db.prepare(
      `UPDATE onboarding_wizard_state
       SET ${col} = 1, current_step = ?, last_activity_at = datetime('now')
       WHERE tenant_id = ?`
    ).bind(nextStep, tenantId).run()
  } catch (_e) { /* non-blocking */ }
}

async function markWelcomeEmailSent(db: D1Database, tenantId: string) {
  try {
    await db.prepare(
      `UPDATE onboarding_wizard_state SET welcome_email_sent = 1 WHERE tenant_id = ?`
    ).bind(tenantId).run()
  } catch (_e) { /* non-blocking */ }
}

export function createOnboardingRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // GET /onboarding — wizard entry (shows current step)
  route.get('/', async (c) => {
    const tenantId = c.req.query('tid') ?? 'tenant-default'
    const stepParam = Number(c.req.query('step') ?? '0')

    // Get or create wizard state from D1
    const state = c.env.DB ? await getOrCreateWizardState(c.env.DB, tenantId) : null
    const currentStep = stepParam > 0 ? stepParam : (state?.current_step ?? 1)

    return c.html(renderStep(currentStep, state, tenantId, c.req.query('saved')))
  })

  // POST /onboarding/step — complete a step + advance
  route.post('/step', async (c) => {
    const body = await c.req.parseBody()
    const step = Number(body['step'] ?? '1')
    const tenantId = String(body['tenant_id'] ?? 'tenant-default')
    const operatorName = String(body['operator_name'] ?? 'Operator')
    const adminEmail = String(body['admin_email'] ?? '')

    if (c.env.DB) {
      await markStepDone(c.env.DB, tenantId, step)

      // Step 1 complete → fire-and-catch welcome email
      if (step === 1 && adminEmail) {
        const state = await getOrCreateWizardState(c.env.DB, tenantId)
        if (state && !state.welcome_email_sent) {
          emailWelcome(c.env, adminEmail, operatorName).catch(() => {})
          await markWelcomeEmailSent(c.env.DB, tenantId)
        }
      }
    }

    const nextStep = Math.min(step + 1, TOTAL_STEPS)
    return c.redirect(`/onboarding?step=${nextStep}&tid=${tenantId}&saved=1`)
  })

  return route
}

// ---- Render step content ----
function renderStep(
  step: number,
  state: { step1_done: number; step2_done: number; step3_done: number; step4_done: number; step5_done: number } | null,
  tenantId: string,
  saved?: string
): string {
  const savedBanner = saved
    ? `<div style="background:rgba(34,197,94,.08);border:1px solid #22c55e;border-radius:6px;padding:10px 14px;font-size:12px;color:#22c55e;margin-bottom:16px">✓ Step saved successfully.</div>`
    : ''

  switch (step) {
    case 1:
      return pageShell('Account Setup', `
        ${savedBanner}
        <h2>Step 1: Account Setup</h2>
        <p class="sub">Confirm your operator details and admin contact for governance notifications.</p>
        <form method="POST" action="/onboarding/step">
          <input type="hidden" name="step" value="1">
          <input type="hidden" name="tenant_id" value="${tenantId}">
          <label>Operator / Company Name</label>
          <input type="text" name="operator_name" placeholder="e.g. Sovereign OS, BarberKas" required>
          <label>Admin Email (for governance notifications)</label>
          <input type="email" name="admin_email" placeholder="admin@company.com">
          <label>Tenant ID (read-only)</label>
          <input type="text" value="${tenantId}" readonly style="opacity:.5;cursor:not-allowed">
          <button type="submit" class="btn">Save & Continue →</button>
        </form>
        <div class="skip-link"><a href="/dashboard">Skip → Go to Dashboard</a></div>
      `, 1)

    case 2:
      return pageShell('Configure Roles', `
        ${savedBanner}
        <h2>Step 2: Configure Roles</h2>
        <p class="sub">Assign initial governance roles for your operators. Roles enforce separation of duties (LAW 1).</p>
        <form method="POST" action="/onboarding/step">
          <input type="hidden" name="step" value="2">
          <input type="hidden" name="tenant_id" value="${tenantId}">
          <label>Primary Role for First Operator</label>
          <select name="primary_role">
            <option value="founder">Founder — Strategic intent + final approval</option>
            <option value="architect">Architect — Scope + design decisions</option>
            <option value="orchestrator">Orchestrator — Session coordination</option>
            <option value="executor" selected>Executor — Implementation work</option>
            <option value="reviewer">Reviewer — Proof verification</option>
          </select>
          <label>First Operator Name</label>
          <input type="text" name="first_operator" placeholder="e.g. Alice Chen">
          <div style="background:#0a0c10;border:1px solid #232830;border-radius:8px;padding:14px;margin-bottom:16px;font-size:12px;color:#9aa3b2">
            <strong style="color:#4f8ef7">LAW 1 — No Role Collapse:</strong><br>
            Founder / Architect / Orchestrator / Executor / Reviewer are separate roles.<br>
            No single operator should hold all roles simultaneously.
          </div>
          <button type="submit" class="btn">Save & Continue →</button>
        </form>
        <div class="skip-link"><a href="/onboarding?step=3&tid=${tenantId}">Skip this step →</a></div>
      `, 2)

    case 3:
      return pageShell('Create First Workflow', `
        ${savedBanner}
        <h2>Step 3: Create First Workflow</h2>
        <p class="sub">Create your first governance workflow. Start with a simple intent to understand the platform flow.</p>
        <form method="POST" action="/onboarding/step">
          <input type="hidden" name="step" value="3">
          <input type="hidden" name="tenant_id" value="${tenantId}">
          <label>Workflow / Intent Name</label>
          <input type="text" name="workflow_name" placeholder="e.g. Platform Bootstrap, Product Launch Q3">
          <label>Workflow Goal (brief)</label>
          <input type="text" name="workflow_goal" placeholder="e.g. Establish governance baseline for platform">
          <label>Priority</label>
          <select name="priority">
            <option value="P0">P0 — Critical (platform foundation)</option>
            <option value="P1" selected>P1 — High (active sprint)</option>
            <option value="P2">P2 — Normal (backlog)</option>
          </select>
          <div style="margin-bottom:16px">
            <a href="/intake" style="font-size:12px;color:#4f8ef7">→ Or create directly in Intent/Intake surface</a>
          </div>
          <button type="submit" class="btn">Save & Continue →</button>
        </form>
        <div class="skip-link"><a href="/onboarding?step=4&tid=${tenantId}">Skip this step →</a></div>
      `, 3)

    case 4:
      return pageShell('Register First Connector', `
        ${savedBanner}
        <h2>Step 4: Register First Connector</h2>
        <p class="sub">Register your first integration connector. Connectors enable the platform to communicate with external services.</p>
        <form method="POST" action="/onboarding/step">
          <input type="hidden" name="step" value="4">
          <input type="hidden" name="tenant_id" value="${tenantId}">
          <label>Connector Name</label>
          <input type="text" name="connector_name" placeholder="e.g. Slack Notifications, GitHub Webhooks">
          <label>Connector Type</label>
          <select name="connector_type">
            <option value="webhook">Webhook (outbound HTTP POST)</option>
            <option value="slack">Slack (notification sink)</option>
            <option value="github">GitHub (repository events)</option>
            <option value="email">Email (SMTP/Resend)</option>
            <option value="custom">Custom API</option>
          </select>
          <label>Endpoint URL (optional for now)</label>
          <input type="url" name="connector_url" placeholder="https://hooks.slack.com/...">
          <div style="margin-bottom:16px">
            <a href="/connectors" style="font-size:12px;color:#4f8ef7">→ Or register directly in Connectors surface</a>
          </div>
          <button type="submit" class="btn">Save & Continue →</button>
        </form>
        <div class="skip-link"><a href="/onboarding?step=5&tid=${tenantId}">Skip this step →</a></div>
      `, 4)

    case 5:
    default:
      return pageShell('Onboarding Complete', `
        <h2>🎉 Onboarding Complete!</h2>
        <p class="sub">You've completed all 5 onboarding steps. Your Sovereign OS Platform is ready for governance operations.</p>
        <div style="margin-bottom:24px">
          ${[
            'Account & admin contact configured',
            'Initial roles assigned (no role collapse)',
            'First workflow / intent created',
            'First connector registered',
          ].map(item => `
            <div class="check-item">
              <span class="ck">✓</span>
              <span>${item}</span>
            </div>`).join('')}
        </div>
        <div style="background:#0a0c10;border:1px solid #232830;border-radius:8px;padding:14px;margin-bottom:20px;font-size:12px;color:#9aa3b2;line-height:1.9">
          <strong style="color:#e2e8f0;display:block;margin-bottom:8px">Recommended next steps:</strong>
          <div>→ <a href="/dashboard" style="color:#4f8ef7">Dashboard</a> — Check current platform state</div>
          <div>→ <a href="/plans" style="color:#4f8ef7">Plans</a> — Review your plan features (SSO, AI Assist)</div>
          <div>→ <a href="/billing" style="color:#4f8ef7">Billing</a> — Configure billing & upgrade if needed</div>
          <div>→ <a href="/branding" style="color:#4f8ef7">Branding</a> — White-label your platform portal</div>
          <div>→ <a href="/ai-assist" style="color:#4f8ef7">AI Assist</a> — Enable AI governance suggestions</div>
        </div>
        <a href="/dashboard" class="btn btn-green">Go to Dashboard →</a>
        <a href="/status" class="btn btn-secondary" style="margin-top:8px">View Platform Status →</a>
      `, 5)
  }
}
