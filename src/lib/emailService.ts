// ============================================================
// SOVEREIGN OS PLATFORM — EMAIL SERVICE (P19)
// Governance event email notifications via Resend API.
//
// SECURITY NON-NEGOTIABLES:
//   - RESEND_API_KEY is NEVER logged or returned in any response
//   - All sends are fire-and-catch (never block main request)
//   - Delivery attempts logged to email_log D1 table
//   - If RESEND_API_KEY not set → skip gracefully (status: skipped)
//
// Events that trigger email:
//   - tier3_approval_requested: Tier 3 approval request created
//   - execution_blocked: Execution task blocked
//   - canon_candidate_ready: Canon candidate ready for review
// ============================================================

export interface EmailServiceEnv {
  RESEND_API_KEY?: string
  DB?: D1Database
}

export type GovernanceEventType =
  | 'tier3_approval_requested'
  | 'execution_blocked'
  | 'canon_candidate_ready'

interface GovernanceEmailPayload {
  eventType: GovernanceEventType
  recipient: string
  subject: string
  bodyHtml: string
}

// ---- Generate a unique email log ID ----
function generateEmailId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ---- Send via Resend API ----
async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<{ message_id: string; error: string }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sovereign OS Platform <noreply@sovereign-os.platform>',
        to: [to],
        subject,
        html,
      }),
    })
    const data = await resp.json() as { id?: string; message?: string; name?: string }
    if (!resp.ok) {
      return { message_id: '', error: data.message || data.name || `HTTP ${resp.status}` }
    }
    return { message_id: data.id || '', error: '' }
  } catch (e: unknown) {
    return { message_id: '', error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ---- Build governance event email HTML ----
function buildGovernanceEmailHtml(
  eventType: GovernanceEventType,
  subject: string,
  bodyHtml: string
): string {
  const eventColors: Record<GovernanceEventType, string> = {
    tier3_approval_requested: '#ef4444',
    execution_blocked: '#f59e0b',
    canon_candidate_ready: '#22c55e',
  }
  const eventIcons: Record<GovernanceEventType, string> = {
    tier3_approval_requested: '⚖️',
    execution_blocked: '🚫',
    canon_candidate_ready: '✅',
  }
  const color = eventColors[eventType] || '#4f8ef7'
  const icon = eventIcons[eventType] || '🔔'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#0d0f14;color:#e2e8f0;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#1a1d27;border-radius:8px;overflow:hidden;border:1px solid #2a2d3a">
    <div style="background:${color};padding:16px 24px;display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">${icon}</span>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-bottom:2px">Sovereign OS Platform</div>
        <h1 style="margin:0;font-size:16px;font-weight:700;color:#fff">${subject}</h1>
      </div>
    </div>
    <div style="padding:24px;line-height:1.6;color:#cbd5e1">
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #2a2d3a;font-size:11px;color:#475569;display:flex;justify-content:space-between">
      <span>Sovereign OS Platform — Governance Notification</span>
      <span>${new Date().toISOString()}</span>
    </div>
  </div>
</body>
</html>`
}

// ---- Log delivery attempt to D1 email_log ----
async function logEmailDelivery(
  db: D1Database | undefined,
  id: string,
  recipient: string,
  subject: string,
  eventType: GovernanceEventType,
  status: 'sent' | 'failed' | 'skipped',
  provider: string,
  errorMessage: string,
  sentAt: string | null
): Promise<void> {
  if (!db) return
  try {
    await db.prepare(
      `INSERT INTO email_log (id, recipient, subject, event_type, status, provider, error_message, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, recipient, subject, eventType, status, provider, errorMessage, sentAt).run()
  } catch (_e) {
    // Never throw — logging failure must not affect main flow
  }
}

// ============================================================
// MAIN: Send governance event email
// Fire-and-catch — caller must NOT await this if it should be non-blocking.
// Example: sendGovernanceEmail(env, ...).catch(() => {})
// ============================================================
export async function sendGovernanceEmail(
  env: EmailServiceEnv,
  eventType: GovernanceEventType,
  recipient: string,
  subject: string,
  bodyHtml: string
): Promise<void> {
  const emailId = generateEmailId()

  if (!env.RESEND_API_KEY) {
    // Graceful degradation — log as skipped
    await logEmailDelivery(
      env.DB, emailId, recipient, subject, eventType,
      'skipped', 'none', 'RESEND_API_KEY not configured', null
    )
    return
  }

  if (!recipient || !recipient.includes('@')) {
    await logEmailDelivery(
      env.DB, emailId, recipient, subject, eventType,
      'skipped', 'none', 'No valid recipient email', null
    )
    return
  }

  const html = buildGovernanceEmailHtml(eventType, subject, bodyHtml)
  const { message_id, error } = await sendViaResend(env.RESEND_API_KEY, recipient, subject, html)

  const status = error ? 'failed' : 'sent'
  const sentAt = status === 'sent' ? new Date().toISOString() : null

  await logEmailDelivery(
    env.DB, emailId, recipient, subject, eventType,
    status, 'resend', error, sentAt
  )
}

// ============================================================
// CONVENIENCE WRAPPERS — one per governance event type
// ============================================================

// Tier 3 approval requested
export async function emailTier3ApprovalRequested(
  env: EmailServiceEnv,
  recipient: string,
  approvalId: string,
  itemTitle: string,
  requestedBy: string
): Promise<void> {
  const subject = `[Action Required] Tier 3 Approval Requested — ${itemTitle}`
  const bodyHtml = `
    <p>A <strong>Tier 3 (critical)</strong> governance approval has been requested and requires your review.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;color:#94a3b8;font-size:13px;width:140px">Approval ID</td>
          <td style="padding:8px;font-family:monospace;font-size:13px;color:#e2e8f0">${approvalId}</td></tr>
      <tr style="background:#0d0f14"><td style="padding:8px;color:#94a3b8;font-size:13px">Item</td>
          <td style="padding:8px;font-size:13px;color:#e2e8f0">${itemTitle}</td></tr>
      <tr><td style="padding:8px;color:#94a3b8;font-size:13px">Requested By</td>
          <td style="padding:8px;font-size:13px;color:#e2e8f0">${requestedBy}</td></tr>
    </table>
    <p><a href="https://sovereign-os-platform.pages.dev/approvals" style="display:inline-block;background:#ef4444;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">Review Approval →</a></p>
    <p style="font-size:12px;color:#64748b;margin-top:20px">This is an automated notification from Sovereign OS Platform governance system.</p>
  `
  return sendGovernanceEmail(env, 'tier3_approval_requested', recipient, subject, bodyHtml)
}

// Execution blocked
export async function emailExecutionBlocked(
  env: EmailServiceEnv,
  recipient: string,
  taskId: string,
  taskTitle: string,
  blockReason: string
): Promise<void> {
  const subject = `[Alert] Execution Blocked — ${taskTitle}`
  const bodyHtml = `
    <p>An execution task has been <strong>blocked</strong> and requires attention.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;color:#94a3b8;font-size:13px;width:140px">Task ID</td>
          <td style="padding:8px;font-family:monospace;font-size:13px;color:#e2e8f0">${taskId}</td></tr>
      <tr style="background:#0d0f14"><td style="padding:8px;color:#94a3b8;font-size:13px">Task</td>
          <td style="padding:8px;font-size:13px;color:#e2e8f0">${taskTitle}</td></tr>
      <tr><td style="padding:8px;color:#94a3b8;font-size:13px">Block Reason</td>
          <td style="padding:8px;font-size:13px;color:#f59e0b">${blockReason}</td></tr>
    </table>
    <p><a href="https://sovereign-os-platform.pages.dev/execution" style="display:inline-block;background:#f59e0b;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">View Execution Board →</a></p>
    <p style="font-size:12px;color:#64748b;margin-top:20px">This is an automated notification from Sovereign OS Platform governance system.</p>
  `
  return sendGovernanceEmail(env, 'execution_blocked', recipient, subject, bodyHtml)
}

// Canon candidate ready
export async function emailCanonCandidateReady(
  env: EmailServiceEnv,
  recipient: string,
  candidateId: string,
  candidateTitle: string
): Promise<void> {
  const subject = `[Canon] Candidate Ready for Review — ${candidateTitle}`
  const bodyHtml = `
    <p>A governance canon candidate is <strong>ready for promotion review</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;color:#94a3b8;font-size:13px;width:140px">Candidate ID</td>
          <td style="padding:8px;font-family:monospace;font-size:13px;color:#e2e8f0">${candidateId}</td></tr>
      <tr style="background:#0d0f14"><td style="padding:8px;color:#94a3b8;font-size:13px">Title</td>
          <td style="padding:8px;font-size:13px;color:#e2e8f0">${candidateTitle}</td></tr>
    </table>
    <p><a href="https://sovereign-os-platform.pages.dev/canon" style="display:inline-block;background:#22c55e;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:8px">Review Canon →</a></p>
    <p style="font-size:12px;color:#64748b;margin-top:20px">This is an automated notification from Sovereign OS Platform governance system.</p>
  `
  return sendGovernanceEmail(env, 'canon_candidate_ready', recipient, subject, bodyHtml)
}
