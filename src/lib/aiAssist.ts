// ============================================================
// SOVEREIGN OS PLATFORM — AI ORCHESTRATION ASSIST (P5)
// AI remains Layer 2 assist only. Human confirmation is MANDATORY.
// CRITICAL RULES:
//   - All outputs tagged 'ai-generated' (never 'verified')
//   - Human confirmation/discard gate mandatory
//   - No auto-approval, no auto-canon-promotion
//   - Graceful degradation if AI secret missing
//   - Every invocation logged to ai_assist_log
//   - Never leak prompts, secrets, or raw sensitive data
// ============================================================

import type { Repo } from './repo'
import type { AiAssistType } from '../types'

// ---- Hash helper (Web Crypto) ----
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface AssistRequest {
  assist_type: AiAssistType
  context: string           // The text context to assist with
  session_id?: string
  tenant_id: string
  created_by: string        // Role label of requester
}

export interface AssistResult {
  log_id: string
  output: string             // The AI-generated suggestion (tagged as ai-generated)
  confidence_tag: 'ai-generated'
  model_hint: string
  requires_confirmation: true  // ALWAYS true — human gate mandatory
  warning: string
}

export interface DegradedAssistResult {
  log_id: string
  output: null
  confidence_tag: 'ai-generated'
  model_hint: 'none'
  requires_confirmation: true
  warning: string
  degraded: true
}

// ============================================================
// runAiAssist
// Main entry point for AI assist invocations.
// Returns AssistResult or DegradedAssistResult (if API key missing).
// Always logs to ai_assist_log.
// ============================================================
export async function runAiAssist(
  repo: Repo,
  request: AssistRequest,
  openAiApiKey?: string
): Promise<AssistResult | DegradedAssistResult> {
  const promptHash = await sha256(request.context)
  const modelHint = openAiApiKey ? 'gpt-4o-mini' : 'none'

  // Graceful degradation: if no API key, return degraded result
  if (!openAiApiKey) {
    const logEntry = await repo.createAiAssistLog({
      tenant_id: request.tenant_id,
      session_id: request.session_id ?? null,
      assist_type: request.assist_type,
      prompt_hash: promptHash,
      model_hint: 'none',
      confidence_tag: 'ai-generated',
      output_summary: '[DEGRADED: AI key not configured]',
      confirmed_by: null,
      confirmed_at: null,
      discarded: false,
      created_by: request.created_by,
    })

    return {
      log_id: logEntry.id,
      output: null,
      confidence_tag: 'ai-generated',
      model_hint: 'none',
      requires_confirmation: true,
      warning: 'AI assist is not configured. Set OPENAI_API_KEY to enable AI suggestions.',
      degraded: true,
    }
  }

  // Build prompt based on assist_type
  const systemPrompt = buildSystemPrompt(request.assist_type)
  const userPrompt = request.context.slice(0, 2000) // cap at 2000 chars

  let output = ''
  let outputSummary = ''

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json() as Record<string, unknown>
    const choices = data['choices'] as Array<Record<string, unknown>> | undefined
    const message = choices?.[0]?.['message'] as Record<string, unknown> | undefined
    output = String(message?.['content'] ?? '')
    outputSummary = output.slice(0, 200) // first 200 chars for audit log
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 100) : 'AI call failed'
    output = `[AI assist failed: ${errMsg}]`
    outputSummary = output
  }

  // Log the invocation — never log raw prompt, only hash
  const logEntry = await repo.createAiAssistLog({
    tenant_id: request.tenant_id,
    session_id: request.session_id ?? null,
    assist_type: request.assist_type,
    prompt_hash: promptHash,
    model_hint: modelHint,
    confidence_tag: 'ai-generated',
    output_summary: outputSummary,
    confirmed_by: null,
    confirmed_at: null,
    discarded: false,
    created_by: request.created_by,
  })

  return {
    log_id: logEntry.id,
    output,
    confidence_tag: 'ai-generated',
    model_hint: modelHint,
    requires_confirmation: true,
    warning: 'This output is AI-generated and must be reviewed by a human before use. Do not use as verified fact.',
  }
}

// ---- Build system prompt by assist type ----
function buildSystemPrompt(assistType: AiAssistType): string {
  const base = `You are a governance assistant for Sovereign OS Platform.
Your role is Layer 2 (Orchestrator assist) only.
ALL your outputs are tagged as 'ai-generated' and require human review.
You MUST NOT auto-approve, auto-promote to canon, or make binding decisions.
Be concise (max 400 words). Be specific. Highlight risks.`

  switch (assistType) {
    case 'session_brief':
      return `${base}\n\nTask: Generate a bounded session brief from the provided context. Include: goal, scope-in, scope-out, acceptance criteria, constraints. Format as structured text.`
    case 'scope_suggestion':
      return `${base}\n\nTask: Suggest a clear scope boundary for the provided context. Identify what should be IN scope and what should be OUT. Highlight scope creep risks.`
    case 'risk_assessment':
      return `${base}\n\nTask: Assess governance risks in the provided context. Rate each risk as LOW/MEDIUM/HIGH. Include mitigation suggestions.`
    case 'review_summary':
      return `${base}\n\nTask: Summarize the key points from the provided content for reviewer attention. Highlight approval tier implications.`
    case 'general':
    default:
      return `${base}\n\nTask: Provide a governance-aware analysis of the provided context.`
  }
}
