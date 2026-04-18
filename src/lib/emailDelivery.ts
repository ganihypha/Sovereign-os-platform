// ============================================================
// SOVEREIGN OS PLATFORM — EMAIL DELIVERY SERVICE (P7)
// Wires governance alerts to email dispatch.
// Provider: Resend (preferred) or SendGrid (fallback) or mock.
//
// SECURITY NON-NEGOTIABLES:
//   - API keys are NEVER stored in D1 — only read from env secrets at runtime
//   - API keys are NEVER logged or returned in any response
//   - Delivery status stored in D1 (alert_deliveries table)
//   - If no API key configured → skip gracefully (status: 'skipped')
//
// Usage: await dispatchAlertEmail(env, repo, alertId, alertTitle, alertMsg, tenantId)
// ============================================================

import type { Repo } from './repo'
import type { AlertDeliveryStatus } from '../types'

export interface EmailEnv {
  RESEND_API_KEY?: string
  SENDGRID_API_KEY?: string
}

export interface EmailResult {
  status: AlertDeliveryStatus
  provider: string
  message_id: string
  error: string
}

// ---- Resolve recipient email for a tenant ----
// Production: could look up tenant owner_email from repo.
// We use the tenant owner_email as delivery target.
async function resolveRecipientEmail(repo: Repo, tenantId: string): Promise<string> {
  try {
    const tenants = await repo.getTenants()
    const tenant = tenants.find(t => t.id === tenantId || t.slug === tenantId)
    if (tenant && tenant.owner_email) return tenant.owner_email
  } catch (_e) {
    // fallback
  }
  return ''
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

// ---- Send via SendGrid API ----
async function sendViaSendGrid(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<{ message_id: string; error: string }> {
  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'noreply@sovereign-os.platform', name: 'Sovereign OS Platform' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    })
    if (resp.status === 202) {
      // SendGrid returns 202 with no body on success
      const msgId = resp.headers.get('X-Message-Id') || ''
      return { message_id: msgId, error: '' }
    }
    const data = await resp.json() as { errors?: Array<{message: string}> }
    const err = data.errors?.[0]?.message || `HTTP ${resp.status}`
    return { message_id: '', error: err }
  } catch (e: unknown) {
    return { message_id: '', error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ---- Build alert email HTML ----
function buildAlertEmailHtml(
  alertTitle: string,
  alertMessage: string,
  severity: string,
  tenantName: string,
  alertId: string
): string {
  const colors: Record<string, string> = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#4f8ef7',
    low: '#6b7280',
  }
  const color = colors[severity] || colors.info
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Sovereign OS Platform Alert</title></head>
<body style="font-family:system-ui,sans-serif;background:#0d0f14;color:#e2e8f0;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#1a1d27;border-radius:8px;overflow:hidden">
    <div style="background:${color};padding:16px 24px">
      <h1 style="margin:0;font-size:18px;color:#fff">⚠ Platform Alert — ${tenantName}</h1>
    </div>
    <div style="padding:24px">
      <h2 style="color:${color};margin:0 0 12px">${alertTitle}</h2>
      <p style="color:#94a3b8;line-height:1.6;margin:0 0 20px">${alertMessage}</p>
      <div style="background:#0d0f14;border-radius:4px;padding:12px;font-size:12px;color:#64748b">
        <strong>Alert ID:</strong> ${alertId}<br>
        <strong>Severity:</strong> ${severity}<br>
        <strong>Tenant:</strong> ${tenantName}
      </div>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #2a2d3a;font-size:12px;color:#475569">
      Sovereign OS Platform — Governance Notification. Do not reply to this email.
    </div>
  </div>
</body>
</html>`
}

// ---- Main: Dispatch alert email ----
// Fire-and-log: records delivery attempt in D1 regardless of outcome.
// Never blocks the primary alert creation.
export async function dispatchAlertEmail(
  env: EmailEnv,
  repo: Repo,
  alertId: string,
  alertTitle: string,
  alertMessage: string,
  severity: string = 'info',
  tenantId: string = 'tenant-default'
): Promise<void> {
  // Resolve recipient
  const recipientEmail = await resolveRecipientEmail(repo, tenantId)
  if (!recipientEmail) {
    // No email configured for tenant — skip gracefully
    await repo.createAlertDelivery({
      alert_id: alertId,
      tenant_id: tenantId,
      recipient_email: '',
      delivery_status: 'skipped',
      provider: 'none',
      provider_message_id: '',
      error_message: 'No recipient email configured for tenant',
      sent_at: null,
    }).catch(() => {})
    return
  }

  let result: EmailResult

  if (env.RESEND_API_KEY) {
    const tenantName = tenantId.replace('tenant-', '')
    const html = buildAlertEmailHtml(alertTitle, alertMessage, severity, tenantName, alertId)
    const r = await sendViaResend(env.RESEND_API_KEY, recipientEmail, `[Alert] ${alertTitle}`, html)
    result = {
      status: r.error ? 'failed' : 'sent',
      provider: 'resend',
      message_id: r.message_id,
      error: r.error,
    }
  } else if (env.SENDGRID_API_KEY) {
    const tenantName = tenantId.replace('tenant-', '')
    const html = buildAlertEmailHtml(alertTitle, alertMessage, severity, tenantName, alertId)
    const r = await sendViaSendGrid(env.SENDGRID_API_KEY, recipientEmail, `[Alert] ${alertTitle}`, html)
    result = {
      status: r.error ? 'failed' : 'sent',
      provider: 'sendgrid',
      message_id: r.message_id,
      error: r.error,
    }
  } else {
    // No provider configured — skip gracefully
    result = {
      status: 'skipped',
      provider: 'none',
      message_id: '',
      error: 'No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.',
    }
  }

  // Record delivery attempt in D1
  await repo.createAlertDelivery({
    alert_id: alertId,
    tenant_id: tenantId,
    recipient_email: recipientEmail,
    delivery_status: result.status,
    provider: result.provider,
    provider_message_id: result.message_id,
    error_message: result.error,
    sent_at: result.status === 'sent' ? new Date().toISOString() : null,
  }).catch(() => {})
}
