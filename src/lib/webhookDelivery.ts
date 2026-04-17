// ============================================================
// SOVEREIGN OS PLATFORM — WEBHOOK DELIVERY RUNTIME (P5)
// Governance-safe outbound webhook delivery.
// CRITICAL RULES:
//   - Never store raw payload in logs
//   - Never store raw secrets or auth tokens
//   - Store payload_hash (SHA-256) only
//   - target_url_hint = sanitized URL (no query secrets)
//   - Log every attempt with governance metadata
// ============================================================

import type { Repo } from './repo'

// ---- Hash helpers (Web Crypto — works in Cloudflare Workers) ----
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Sanitize URL: remove query string params that look like secrets (token, key, secret, auth)
function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    const sensitiveParams = ['token', 'key', 'secret', 'auth', 'api_key', 'access_token', 'password']
    for (const p of sensitiveParams) {
      if (u.searchParams.has(p)) u.searchParams.set(p, '[REDACTED]')
    }
    // Return only origin + pathname + sanitized params (truncate to 100 chars)
    return (u.origin + u.pathname + (u.search ? u.search : '')).slice(0, 100)
  } catch {
    return url.slice(0, 100)
  }
}

export interface WebhookPayload {
  event_type: string
  tenant_id: string
  connector_id: string
  data: Record<string, unknown>
}

export interface DeliveryResult {
  log_id: string
  status: 'delivered' | 'failed'
  http_status: number | null
  error?: string
}

// ============================================================
// deliverWebhook
// Fire-and-log pattern: attempt delivery, record result.
// Does NOT throw — always returns a result with log reference.
// ============================================================
export async function deliverWebhook(
  repo: Repo,
  webhookUrl: string,
  payload: WebhookPayload
): Promise<DeliveryResult> {
  const payloadJson = JSON.stringify(payload)
  const payloadHash = await sha256(payloadJson)
  const targetUrlHint = sanitizeUrl(webhookUrl)

  // Create pending log entry first (governance: log even if delivery fails)
  const logEntry = await repo.createWebhookDeliveryLog({
    connector_id: payload.connector_id,
    tenant_id: payload.tenant_id,
    event_type: payload.event_type,
    payload_hash: payloadHash,
    target_url_hint: targetUrlHint,
    attempt: 1,
    status: 'pending',
    http_status: null,
    response_hint: '',
    error_message: '',
    delivered_at: null,
  })

  // Attempt delivery
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sovereign-Event': payload.event_type,
        'X-Sovereign-Tenant': payload.tenant_id,
      },
      body: payloadJson,
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    const responseText = await response.text().catch(() => '')
    const responseHint = responseText.slice(0, 100) // sanitized — first 100 chars only
    const delivered = response.status >= 200 && response.status < 300

    await repo.updateWebhookDeliveryStatus(
      logEntry.id,
      delivered ? 'delivered' : 'failed',
      response.status,
      responseHint,
      delivered ? '' : `HTTP ${response.status}`
    )

    return {
      log_id: logEntry.id,
      status: delivered ? 'delivered' : 'failed',
      http_status: response.status,
      error: delivered ? undefined : `HTTP ${response.status}`,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 200) : 'Unknown error'
    await repo.updateWebhookDeliveryStatus(logEntry.id, 'failed', null, '', errMsg)
    return {
      log_id: logEntry.id,
      status: 'failed',
      http_status: null,
      error: errMsg,
    }
  }
}

// ============================================================
// triggerConnectorWebhooks
// Given an event, find all active connectors with webhook_url
// and fire webhooks to each.
// ============================================================
export async function triggerConnectorWebhooks(
  repo: Repo,
  eventType: string,
  tenantId: string,
  eventData: Record<string, unknown>
): Promise<void> {
  try {
    const connectors = await repo.getConnectors()
    const webhookConnectors = connectors.filter(c =>
      c.status === 'active' &&
      c.connector_type === 'webhook' &&
      (c as unknown as Record<string, unknown>)['webhook_url'] &&
      (c.tenant_id === tenantId || c.tenant_id === 'default')
    )

    for (const connector of webhookConnectors) {
      const webhookUrl = (connector as unknown as Record<string, unknown>)['webhook_url'] as string
      if (!webhookUrl) continue
      // Fire-and-forget: do not await individual deliveries to avoid blocking
      deliverWebhook(repo, webhookUrl, {
        event_type: eventType,
        tenant_id: tenantId,
        connector_id: connector.id,
        data: eventData,
      }).catch(() => { /* individual failures are logged in webhook_delivery_log */ })
    }
  } catch {
    // Webhook delivery failure must never break the main flow
  }
}
