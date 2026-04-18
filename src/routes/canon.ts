// ============================================================
// SOVEREIGN OS PLATFORM — CANON PROMOTION ROUTE (P4)
// Formalizes the path from "output" to "canon".
// Only Founder or Architect role may promote or reject.
// No auto-promotion path exists.
// ============================================================

import { Hono } from 'hono'
import { layout } from '../layout'
import { createRepo } from '../lib/repo'
import { isAuthenticated } from '../lib/auth'
import type { Env } from '../index'
import type { CanonCandidate } from '../types'
import { abacGuardCanonPromote } from '../lib/abacMiddleware'

const STATUS_BADGE: Record<string, string> = {
  candidate: '<span style="background:rgba(79,142,247,0.15);color:#4f8ef7;border:1px solid rgba(79,142,247,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">CANDIDATE</span>',
  under_review: '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">UNDER REVIEW</span>',
  promoted: '<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">CANON ✓</span>',
  rejected: '<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">REJECTED</span>',
}

function candidateCard(item: CanonCandidate, isAuth: boolean): string {
  const status = (item as unknown as Record<string, string>).review_status ?? item.status
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE['candidate']
  const isPromotable = status === 'candidate' || status === 'under_review'

  return `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:12px" id="can-${item.id}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-size:14px;font-weight:600;color:var(--text)">${item.title}</span>
          ${badge}
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px;line-height:1.5">${item.content_ref}</div>
        <div style="font-size:11px;color:var(--text3);display:flex;gap:16px;flex-wrap:wrap">
          <span>Proposed by: ${item.proposed_by}</span>
          <span>${new Date(item.created_at).toLocaleDateString()}</span>
          ${item.approved_by ? `<span>Reviewed by: ${item.approved_by}</span>` : ''}
          ${item.review_notes ? `<span>Notes: ${item.review_notes}</span>` : ''}
        </div>
      </div>
      ${isAuth && isPromotable ? `
      <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
        <button onclick="openPromoteModal('${item.id}', '${item.title.replace(/'/g, "\\'")}', 'promote')" style="background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
          Promote to Canon
        </button>
        <button onclick="openPromoteModal('${item.id}', '${item.title.replace(/'/g, "\\'")}', 'reject')" style="background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
          Reject Candidate
        </button>
      </div>` : ''}
    </div>
  </div>`
}

export function createCanonRoute() {
  const route = new Hono<{ Bindings: Env }>()

  route.get('/', async (c) => {
    const repo = createRepo(c.env.DB)
    const isAuth = await isAuthenticated(c, c.env)

    const [candidates, promotions] = await Promise.all([
      repo.getCanonCandidates(),
      repo.getCanonPromotions(),
    ])

    const active = candidates.filter(c => {
      const s = (c as unknown as Record<string,string>).review_status ?? c.status
      return s === 'candidate' || s === 'under_review'
    })
    const promoted = candidates.filter(c => {
      const s = (c as unknown as Record<string,string>).review_status ?? c.status
      return s === 'promoted'
    })
    const rejected = candidates.filter(c => {
      const s = (c as unknown as Record<string,string>).review_status ?? c.status
      return s === 'rejected'
    })

    const activeHtml = active.length === 0
      ? `<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:24px;text-align:center;color:#22c55e;font-size:13px">No candidates awaiting review</div>`
      : active.map(c => candidateCard(c, isAuth)).join('')

    const promotedHtml = promoted.length > 0
      ? `<div style="margin-top:32px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">CANON ITEMS (${promoted.length})</div>
          ${promoted.map(c => candidateCard(c, false)).join('')}
         </div>`
      : ''

    const rejectedHtml = rejected.length > 0
      ? `<div style="margin-top:32px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">REJECTED (${rejected.length})</div>
          ${rejected.map(c => candidateCard(c, false)).join('')}
         </div>`
      : ''

    const auditHtml = promotions.length > 0
      ? `<div style="margin-top:32px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">PROMOTION AUDIT LOG (${promotions.length})</div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="border-bottom:1px solid var(--border)">
                <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Action</th>
                <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Candidate</th>
                <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Acted By</th>
                <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Reason</th>
                <th style="padding:10px 16px;text-align:left;color:var(--text3);font-weight:600">Date</th>
              </tr></thead>
              <tbody>
                ${promotions.slice(0, 20).map(p => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 16px"><span style="color:${p.action==='promote'?'#22c55e':'#ef4444'};font-weight:600">${p.action.toUpperCase()}</span></td>
                  <td style="padding:10px 16px;color:var(--text2)">${p.canon_candidate_id}</td>
                  <td style="padding:10px 16px;color:var(--text2)">${p.acted_by} (${p.acted_by_role})</td>
                  <td style="padding:10px 16px;color:var(--text2)">${p.reason || '—'}</td>
                  <td style="padding:10px 16px;color:var(--text3)">${new Date(p.acted_at).toLocaleDateString()}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
         </div>`
      : ''

    const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Canon Promotion</h1>
        <div style="font-size:12px;color:var(--text2)">${active.length} awaiting review · ${promoted.length} promoted · ${rejected.length} rejected · No auto-promotion exists</div>
      </div>
    </div>

    <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:16px;margin-bottom:24px;font-size:12px;color:var(--text2)">
      <span style="color:#a855f7;font-weight:700">Canon Promotion Policy:</span> Only Founder or Architect may promote to canon. 
      Promotion requires explicit confirmation and a reason note. Promoted items are read-only. No auto-promotion path exists at any point. 
      <a href="/records" style="color:var(--accent)">View Records →</a>
    </div>

    <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;margin-bottom:12px">AWAITING REVIEW (${active.length})</div>
    ${activeHtml}
    ${promotedHtml}
    ${rejectedHtml}
    ${auditHtml}

    <!-- Modal -->
    <div id="promote-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:32px;max-width:480px;width:90%;margin:16px">
        <h3 id="modal-title" style="font-size:16px;font-weight:700;margin-bottom:8px"></h3>
        <p id="modal-desc" style="font-size:12px;color:var(--text2);margin-bottom:20px"></p>
        <form id="promote-form" method="POST">
          <input type="hidden" id="modal-action" name="action" value="promote">
          <div style="margin-bottom:16px">
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:6px">Reason (required):</label>
            <textarea name="reason" id="modal-reason" required rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:10px;font-size:13px;font-family:inherit;resize:vertical" placeholder="Provide justification for this action..."></textarea>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" onclick="closeModal()" style="background:var(--bg);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:10px 20px;font-size:13px;cursor:pointer">Cancel</button>
            <button type="submit" id="modal-submit-btn" style="border-radius:6px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;border:none"></button>
          </div>
        </form>
      </div>
    </div>

    <script>
    function openPromoteModal(id, title, action) {
      const modal = document.getElementById('promote-modal')
      const form = document.getElementById('promote-form')
      const titleEl = document.getElementById('modal-title')
      const descEl = document.getElementById('modal-desc')
      const actionInput = document.getElementById('modal-action')
      const submitBtn = document.getElementById('modal-submit-btn')
      
      form.action = '/canon/' + id + '/' + action
      actionInput.value = action
      titleEl.textContent = action === 'promote' ? 'Promote to Canon: ' + title : 'Reject Candidate: ' + title
      descEl.textContent = action === 'promote'
        ? 'This will permanently promote this candidate to canon. Canon items are read-only after promotion. This action is recorded in the audit log.'
        : 'This will reject this candidate. The rejection is permanent and recorded in the audit log.'
      submitBtn.textContent = action === 'promote' ? 'Promote to Canon' : 'Reject'
      submitBtn.style.background = action === 'promote' ? '#22c55e' : '#ef4444'
      submitBtn.style.color = '#fff'
      
      document.getElementById('modal-reason').value = ''
      modal.style.display = 'flex'
    }
    function closeModal() {
      document.getElementById('promote-modal').style.display = 'none'
    }
    document.getElementById('promote-modal').addEventListener('click', function(e) {
      if (e.target === this) closeModal()
    })
    </script>`

    return c.html(layout('Canon Promotion', content, '/canon'))
  })

  // POST promote — ABAC guarded (P12)
  route.post('/:id/promote', abacGuardCanonPromote, async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED', message: 'Founder or Architect key required.' }, 401)

    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const reason = String(body.reason ?? '').trim()

    if (!reason) return c.json({ error: 'REASON_REQUIRED', message: 'Promotion reason is required.' }, 400)

    const candidate = await repo.getCanonCandidates().then(cs => cs.find(c => c.id === id))
    if (!candidate) return c.json({ error: 'NOT_FOUND', message: 'Canon candidate not found.' }, 404)

    const status = (candidate as unknown as Record<string,string>).review_status ?? candidate.status
    if (status === 'promoted' || status === 'rejected') {
      return c.json({ error: 'ALREADY_RESOLVED', message: `Candidate is already ${status}.` }, 400)
    }

    // Update candidate status
    await repo.updateCanonCandidate(id, {
      status: 'promoted',
      approved_by: 'operator',
      promoted_at: new Date().toISOString(),
    })

    // Record promotion in audit log
    await repo.createCanonPromotion({
      canon_candidate_id: id,
      action: 'promote',
      acted_by: 'operator',
      acted_by_role: 'architect',
      reason,
      acted_at: new Date().toISOString(),
    })

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('text/html')) return c.redirect('/canon')
    return c.json({ success: true, id, action: 'promoted' })
  })

  // POST reject — ABAC guarded (P12)
  route.post('/:id/reject', abacGuardCanonPromote, async (c) => {
    const isAuth = await isAuthenticated(c, c.env)
    if (!isAuth) return c.json({ error: 'AUTH_REQUIRED', message: 'Founder or Architect key required.' }, 401)

    const repo = createRepo(c.env.DB)
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const reason = String(body.reason ?? '').trim()

    if (!reason) return c.json({ error: 'REASON_REQUIRED', message: 'Rejection reason is required.' }, 400)

    const candidate = await repo.getCanonCandidates().then(cs => cs.find(c => c.id === id))
    if (!candidate) return c.json({ error: 'NOT_FOUND', message: 'Canon candidate not found.' }, 404)

    const status = (candidate as unknown as Record<string,string>).review_status ?? candidate.status
    if (status === 'promoted' || status === 'rejected') {
      return c.json({ error: 'ALREADY_RESOLVED', message: `Candidate is already ${status}.` }, 400)
    }

    await repo.updateCanonCandidate(id, { status: 'rejected' })

    await repo.createCanonPromotion({
      canon_candidate_id: id,
      action: 'reject',
      acted_by: 'operator',
      acted_by_role: 'architect',
      reason,
      acted_at: new Date().toISOString(),
    })

    const accept = c.req.header('accept') ?? ''
    if (accept.includes('text/html')) return c.redirect('/canon')
    return c.json({ success: true, id, action: 'rejected' })
  })

  return route
}
