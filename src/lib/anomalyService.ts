// ============================================================
// SOVEREIGN OS PLATFORM — ANOMALY DETECTION SERVICE (P8)
// ML/AI pipeline for metrics_snapshots time-series analysis
//
// Strategy:
//   1. Statistical baseline from last N snapshots (rolling average)
//   2. Flag deviation > threshold as anomaly
//   3. Use OPENAI_API_KEY for AI summary (graceful degradation if missing)
//   4. All AI outputs tagged 'ai-generated' — never auto-promoted
//   5. Alert written to platform_alerts on anomaly detection
//
// LAWS:
// - OPENAI_API_KEY missing → fallback to heuristic-only (no failure)
// - No AI output is canonical without human confirmation
// - Deviation threshold: configurable, default 30%
// ============================================================
import type { D1Database } from '@cloudflare/workers-types'
import type { AnomalyDetectionResult } from '../types'
import { writeAuditEvent } from './auditService'

const DEFAULT_THRESHOLD = 0.30  // 30% deviation triggers anomaly flag
const BASELINE_WINDOW = 5       // use last 5 snapshots for baseline

interface MetricPoint {
  period_label: string
  value: number
}

function calcBaseline(points: MetricPoint[]): number {
  if (!points.length) return 0
  const sum = points.reduce((a, b) => a + b.value, 0)
  return sum / points.length
}

function calcDeviation(value: number, baseline: number): number {
  if (baseline === 0) return 0
  return Math.abs(value - baseline) / baseline
}

function severityFromDeviation(dev: number): 'low' | 'medium' | 'high' {
  if (dev >= 0.60) return 'high'
  if (dev >= 0.40) return 'medium'
  return 'low'
}

// Extract metric fields from a metrics_snapshot row
function extractMetrics(row: Record<string, unknown>): Record<string, number> {
  return {
    total_sessions:     Number(row.total_sessions ?? 0),
    active_sessions:    Number(row.active_sessions ?? 0),
    pending_approvals:  Number(row.pending_approvals ?? 0),
    running_executions: Number(row.running_executions ?? 0),
    active_connectors:  Number(row.active_connectors ?? 0),
    unread_alerts:      Number(row.unread_alerts ?? 0),
  }
}

export async function runAnomalyDetection(
  db: D1Database | undefined,
  opts: {
    tenant_id?: string
    threshold?: number
    openai_api_key?: string
    write_alerts?: boolean
  } = {}
): Promise<AnomalyDetectionResult[]> {
  if (!db) return []

  const threshold = opts.threshold ?? DEFAULT_THRESHOLD
  const tenant_id = opts.tenant_id || 'default'
  const detected_at = new Date().toISOString()
  const results: AnomalyDetectionResult[] = []

  try {
    // Fetch recent snapshots for tenant
    const rows = await db.prepare(`
      SELECT * FROM metrics_snapshots
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(tenant_id, BASELINE_WINDOW + 5).all()

    const snapshots = (rows.results || []) as unknown as Record<string, unknown>[]
    if (snapshots.length < 2) return []  // Need at least 2 points

    // Current period = most recent
    const current = snapshots[0]
    const baseline_points = snapshots.slice(1, BASELINE_WINDOW + 1)

    const currentMetrics = extractMetrics(current)
    const metricKeys = Object.keys(currentMetrics)

    for (const metric of metricKeys) {
      const currentVal = currentMetrics[metric]

      const baselineData: MetricPoint[] = baseline_points.map(s => ({
        period_label: String(s.period_label ?? ''),
        value: Number((extractMetrics(s))[metric] ?? 0),
      }))

      const baseline = calcBaseline(baselineData)
      const deviation = calcDeviation(currentVal, baseline)
      const is_anomaly = deviation > threshold
      const severity = severityFromDeviation(deviation)

      // AI summary — graceful degradation
      let ai_summary = `[ai-generated] Metric '${metric}' deviation: ${(deviation * 100).toFixed(1)}% vs baseline ${baseline.toFixed(1)}. Current: ${currentVal}.`
      let confidence = 'statistical-only'

      if (is_anomaly && opts.openai_api_key) {
        try {
          ai_summary = await getAiAnomalySummary({
            metric,
            currentVal,
            baseline,
            deviation,
            severity,
            tenant_id,
            openai_api_key: opts.openai_api_key,
          })
          confidence = 'ai-assisted'
        } catch (_e) {
          // AI failed — fallback to statistical summary
          confidence = 'statistical-fallback'
        }
      }

      const anomalyResult: AnomalyDetectionResult = {
        tenant_id,
        metric,
        period: String(current.period_label ?? 'latest'),
        value: currentVal,
        baseline: Math.round(baseline * 100) / 100,
        deviation_pct: Math.round(deviation * 10000) / 100,
        is_anomaly,
        severity,
        ai_summary,
        confidence,
        detected_at,
      }

      results.push(anomalyResult)

      // Write alert if anomaly detected
      if (is_anomaly && opts.write_alerts && db) {
        const alertId = 'alert-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
        try {
          await db.prepare(`
            INSERT INTO platform_alerts
              (id, alert_type, title, message, severity, object_type, object_id,
               acknowledged, created_at)
            VALUES (?, 'connector_error', ?, ?, ?, 'metrics_snapshot', ?, 0, ?)
          `).bind(
            alertId,
            `Anomaly detected: ${metric} [${tenant_id}]`,
            ai_summary.slice(0, 500),
            severity,
            String(current.id ?? ''),
            detected_at
          ).run()
        } catch (_e) { /* alert write non-blocking */ }

        await writeAuditEvent(db, {
          event_type: 'anomaly.detected',
          object_type: 'metrics_snapshot',
          object_id: String(current.id ?? ''),
          actor: 'anomaly-detector',
          tenant_id,
          payload_summary: `${metric} deviation ${(deviation * 100).toFixed(1)}% — ${severity}`,
          surface: '/api/v1/anomaly-detect',
        })
      }
    }

    return results
  } catch (_e) {
    return []
  }
}

async function getAiAnomalySummary(opts: {
  metric: string
  currentVal: number
  baseline: number
  deviation: number
  severity: string
  tenant_id: string
  openai_api_key: string
}): Promise<string> {
  const prompt = `You are a platform observability assistant. Analyze this metric anomaly and provide a brief 1-sentence governance-focused summary.
Metric: ${opts.metric}
Tenant: ${opts.tenant_id}
Current value: ${opts.currentVal}
Baseline (avg last ${BASELINE_WINDOW} periods): ${opts.baseline.toFixed(2)}
Deviation: ${(opts.deviation * 100).toFixed(1)}%
Severity: ${opts.severity}
Respond with only the summary sentence. Tag it with [ai-generated] at the start.`

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.openai_api_key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.3,
    }),
  })

  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`)
  const data = await resp.json() as { choices: { message: { content: string } }[] }
  const content = data.choices?.[0]?.message?.content?.trim() || ''
  if (!content.startsWith('[ai-generated]')) {
    return `[ai-generated] ${content}`
  }
  return content
}
