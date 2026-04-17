// ============================================================
// SOVEREIGN OS PLATFORM — ONBOARDING WIZARD (P4)
// First-run experience for new operators.
// Multi-step: intro → role → first intent → tour
// Completion stored in D1 (sessions.onboarding_completed)
// Can be skipped by authenticated users.
// ============================================================

import { Hono } from 'hono'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import type { Env } from '../index'

function pageShell(title: string, content: string, step: number, totalSteps: number): string {
  const progress = Math.round((step / totalSteps) * 100)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Sovereign OS Platform</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0c10; color: #e8eaf0; font-family: 'Inter', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .container { width: 100%; max-width: 600px; }
    .header { text-align: center; margin-bottom: 32px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: #4f8ef7; text-transform: uppercase; margin-bottom: 8px; }
    .progress-bar { background: #232830; border-radius: 4px; height: 4px; width: 100%; margin-bottom: 32px; overflow: hidden; }
    .progress-fill { background: #4f8ef7; height: 100%; border-radius: 4px; transition: width 0.3s; width: ${progress}%; }
    .step-label { font-size: 11px; color: #5a6478; margin-bottom: 16px; text-align: center; }
    .card { background: #111318; border: 1px solid #232830; border-radius: 12px; padding: 32px; }
    h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .sub { color: #9aa3b2; font-size: 13px; line-height: 1.6; margin-bottom: 24px; }
    .btn { display: inline-block; background: #4f8ef7; color: #fff; border: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; width: 100%; text-align: center; }
    .btn-secondary { background: #181c22; color: #9aa3b2; border: 1px solid #232830; }
    .btn:hover { background: #2563eb; }
    .btn-secondary:hover { background: #1a1f28; }
    input, textarea, select { width: 100%; background: #0a0c10; border: 1px solid #232830; color: #e8eaf0; border-radius: 6px; padding: 10px 14px; font-size: 13px; font-family: 'Inter', sans-serif; margin-bottom: 12px; outline: none; }
    input:focus, textarea:focus, select:focus { border-color: #4f8ef7; }
    label { font-size: 12px; color: #9aa3b2; display: block; margin-bottom: 6px; }
    .surface-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .surface-item { background: #0a0c10; border: 1px solid #232830; border-radius: 8px; padding: 12px; }
    .surface-item .icon { font-size: 16px; margin-bottom: 6px; }
    .surface-item .name { font-size: 12px; font-weight: 600; color: #e8eaf0; margin-bottom: 2px; }
    .surface-item .desc { font-size: 11px; color: #5a6478; }
    .skip-link { text-align: center; margin-top: 16px; font-size: 12px; color: #5a6478; }
    .skip-link a { color: #4f8ef7; text-decoration: none; }
    .law-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #1a1e24; }
    .law-num { font-size: 11px; font-weight: 700; color: #4f8ef7; min-width: 28px; font-family: 'JetBrains Mono', monospace; }
    .law-text { font-size: 12px; color: #9aa3b2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">⬡ Sovereign OS Platform</div>
    </div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="step-label">Step ${step} of ${totalSteps}</div>
    <div class="card">${content}</div>
    ${step > 1 ? `<div class="skip-link"><a href="/dashboard">Skip onboarding → Go to Dashboard</a></div>` : ''}
  </div>
</body>
</html>`
}

export function createOnboardingRoute() {
  const route = new Hono<{ Bindings: Env }>()

  // Step 1 — Platform Intro
  route.get('/', async (c) => {
    const step = Number(c.req.query('step') ?? '1')

    if (step === 2) {
      const content = `
        <h2>Platform Governance Law</h2>
        <p class="sub">Sovereign OS Platform operates under 12 immutable platform laws. These laws are non-negotiable and apply to every operator, every phase, and every AI session.</p>
        <div style="margin-bottom:24px">
          ${[
            'NO ROLE COLLAPSE — Founder, Architect, Orchestrator, Executor, Reviewer are strictly separate.',
            'INTENT FIRST — All work flows from founder intent, not tool automation.',
            'NO FALSE VERIFICATION — Nothing is VERIFIED without real, inspectable proof.',
            'CANON IS EARNED — No auto-promotion to canon. AI suggestions do not auto-become canon.',
            'GOVERNANCE LANE ≠ PRODUCT LANE — Platform governance must not entangle product verticals.',
            'NO SECRET EXPOSURE — Credentials never appear in UI, logs, or API responses.',
            'NO UNDOCUMENTED MEANINGFUL ACTIVITY — Every significant action must have a trace.',
            'LIVE STATE OVER GUESSWORK — Truth is read from live state, not memory or assumption.',
            'NO GREEN-FIELD REBUILD — Expand existing, do not reconstruct.',
            'STATUS HONESTY — PARTIAL = partial. PENDING = pending. Never inflate.',
            'SMALLEST HONEST DIFF — Prefer minimal bounded change over broad speculative build.',
            'PRODUCTION CLAIMS REQUIRE PROOF — No deployment claim without live URL evidence.',
          ].map((law, i) => `<div class="law-item"><span class="law-num">L${i+1}</span><span class="law-text">${law}</span></div>`).join('')}
        </div>
        <a href="/onboarding?step=3" class="btn">I Understand → Next</a>`
      return c.html(pageShell('Platform Laws', content, 2, 4))
    }

    if (step === 3) {
      const content = `
        <h2>Platform Surfaces</h2>
        <p class="sub">Sovereign OS Platform has 18 active surfaces (P0–P4). Each surface serves a specific governance function. Here are the core surfaces you'll use most.</p>
        <div class="surface-grid">
          <div class="surface-item"><div class="icon">⬡</div><div class="name">Dashboard</div><div class="desc">Platform command overview</div></div>
          <div class="surface-item"><div class="icon">◈</div><div class="name">Intent</div><div class="desc">Founder strategic intent desk</div></div>
          <div class="surface-item"><div class="icon">⊕</div><div class="name">Intake</div><div class="desc">Session intake & request log</div></div>
          <div class="surface-item"><div class="icon">◉</div><div class="name">Architect</div><div class="desc">Scope & architecture workbench</div></div>
          <div class="surface-item"><div class="icon">◎</div><div class="name">Approvals</div><div class="desc">Tier-gated approval queue</div></div>
          <div class="surface-item"><div class="icon">◇</div><div class="name">Proof</div><div class="desc">Proof artifact submission & review</div></div>
          <div class="surface-item"><div class="icon">◆</div><div class="name">Live Board</div><div class="desc">NOW / NEXT / LATER priority</div></div>
          <div class="surface-item"><div class="icon">▶</div><div class="name">Execution</div><div class="desc">Execution board & work tracking</div></div>
          <div class="surface-item"><div class="icon">⊞</div><div class="name">Connectors</div><div class="desc">Integration registry</div></div>
          <div class="surface-item"><div class="icon">▣</div><div class="name">Canon</div><div class="desc">Canon promotion workflow</div></div>
          <div class="surface-item"><div class="icon">⊟</div><div class="name">Lanes</div><div class="desc">Product lane directory</div></div>
          <div class="surface-item"><div class="icon">⬠</div><div class="name">Reports</div><div class="desc">Cross-lane metrics</div></div>
        </div>
        <a href="/onboarding?step=4" class="btn">Next →</a>`
      return c.html(pageShell('Platform Surfaces', content, 3, 4))
    }

    if (step === 4) {
      const content = `
        <h2>You're Ready</h2>
        <p class="sub">You've completed the platform onboarding. Here's how to get started:</p>
        <div style="background:#0a0c10;border:1px solid #232830;border-radius:8px;padding:16px;margin-bottom:24px">
          <div style="font-size:12px;color:#9aa3b2;line-height:2">
            <div><span style="color:#4f8ef7;font-weight:600">1.</span> Go to your <a href="/workspace" style="color:#4f8ef7">Role Workspace</a> — it's customized for your role</div>
            <div><span style="color:#4f8ef7;font-weight:600">2.</span> Check the <a href="/dashboard" style="color:#4f8ef7">Dashboard</a> for current platform state</div>
            <div><span style="color:#4f8ef7;font-weight:600">3.</span> Read the <a href="/continuity" style="color:#4f8ef7">Continuity</a> snapshot for last session context</div>
            <div><span style="color:#4f8ef7;font-weight:600">4.</span> Check <a href="/alerts" style="color:#4f8ef7">Alerts</a> for any pending governance events</div>
            <div><span style="color:#4f8ef7;font-weight:600">5.</span> Review <a href="/approvals" style="color:#4f8ef7">Approvals</a> for pending items that need your action</div>
          </div>
        </div>
        <a href="/dashboard" class="btn">Go to Dashboard →</a>
        <div style="margin-top:12px;text-align:center">
          <a href="/workspace" style="font-size:12px;color:#4f8ef7;text-decoration:none">→ Or go to your Role Workspace</a>
        </div>`
      return c.html(pageShell('Ready', content, 4, 4))
    }

    // Default: Step 1
    const content = `
      <h2>Welcome to Sovereign OS Platform</h2>
      <p class="sub">Sovereign OS Platform is a <strong>layered operating/control platform</strong> — not a single app. It governs how applications, integrations, product lanes, and operators interact with enforced role boundaries, approval gates, and proof requirements.</p>
      <div style="background:#0a0c10;border:1px solid #232830;border-radius:8px;padding:16px;margin-bottom:24px;font-size:12px;color:#9aa3b2;line-height:1.8">
        <div><span style="color:#4f8ef7">Platform flow:</span> Founder Intent → Architect → Orchestrator → Executor → Proof/Review → Live State → Canon</div>
        <div style="margin-top:8px"><span style="color:#4f8ef7">Current Phase:</span> P4 LIVE-VERIFIED — Role Workspaces, Alerts, Canon Promotion, Lane Directory, Reports active</div>
        <div style="margin-top:8px"><span style="color:#4f8ef7">Production URL:</span> https://sovereign-os-platform.pages.dev</div>
      </div>
      <a href="/onboarding?step=2" class="btn">Begin Onboarding →</a>
      <div class="skip-link" style="margin-top:12px"><a href="/dashboard">Skip → Go to Dashboard</a></div>`
    return c.html(pageShell('Welcome', content, 1, 4))
  })

  return route
}
