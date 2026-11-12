import { SITE } from '../../lib/config'
import { buildCatalog } from './engine/catalog'
import { toStudioWorkflow, AiWorkflowError, type RawAiWorkflow } from './engine/aiWorkflow'
import { getDef } from './engine/registry'
import type { Workflow, WorkflowApproval } from './engine/types'

/** Error with a user-facing message and optional detail lines. */
export class ApiError extends Error {
  constructor(message: string, readonly details: string[] = []) {
    super(message)
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${SITE.apiBase}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal })
  } catch (e) {
    throw new ApiError(e instanceof DOMException && e.name === 'AbortError' ? 'The request timed out. Please try again.' : 'Could not reach the Workflow Studio server. Is the backend running?')
  } finally {
    window.clearTimeout(t)
  }
  const data = (await res.json().catch(() => null)) as ({ success?: boolean; message?: string; details?: string[] } & T) | null
  if (!data) throw new ApiError(`The Workflow Studio server is not responding (HTTP ${res.status}). Is the backend running?`)
  if (!res.ok || data.success === false) throw new ApiError(data?.message || `Server error (${res.status}).`, Array.isArray(data?.details) ? data!.details : [])
  return data
}

/** Describe → Groq (server) → registry-validated Studio workflow. */
export async function generateWithGroq(prompt: string): Promise<{ workflow: Workflow; model: string; attempts: number }> {
  const out = await post<{ workflow: RawAiWorkflow; model: string; attempts: number }>('/api/workflows/generate', { prompt, catalog: buildCatalog() }, 120_000)
  try {
    return { workflow: toStudioWorkflow(out.workflow, { prompt, model: out.model }), model: out.model, attempts: out.attempts }
  } catch (e) {
    if (e instanceof AiWorkflowError) throw new ApiError(e.message, e.problems)
    throw e
  }
}

/** Plain-language description of a node for the email (type title, condition text). */
function describeNodes(nodes: WorkflowApproval['snapshot']['nodes']) {
  return nodes.map((n) => {
    const d = getDef(n.type)
    let condition: string | undefined
    if (n.type === 'logic.if' || n.type === 'logic.filter') condition = `${String(n.config.field)} ${String(n.config.operator)} ${String(n.config.value ?? '')}`.trim()
    if (n.type === 'logic.switch') condition = `${String(n.config.field)} is one of: ${String(n.config.cases)}`
    return {
      id: n.id,
      typeTitle: d?.title ?? n.type,
      kind: d?.kind ?? 'data',
      role: d?.role ?? 'main',
      availability: d?.availability ?? 'builtin',
      description: d?.subtitle ?? '',
      ...(condition ? { condition } : {}),
    }
  })
}

/** Email the exact approved snapshot to Core5 enquiry team. Resolves only when the SMTP server accepted the message. */
export async function sendWorkflowEmail(input: {
  senderName?: string
  senderEmail?: string
  senderPhone?: string
  to?: string
  note: string
  approval: WorkflowApproval
  workflow: Workflow
}) {
  const s = input.approval.snapshot
  const email = input.senderEmail || input.to || ''
  return post<{ message: string; messageId: string }>(
    '/api/workflows/email',
    {
      senderName: input.senderName || '',
      senderEmail: email,
      senderPhone: input.senderPhone || '',
      to: email,
      note: input.note,
      workflow: { id: s.id, name: s.name, description: s.description, nodes: s.nodes, edges: s.edges },
      approval: { approvedAt: input.approval.approvedAt, hash: input.approval.hash },
      details: describeNodes(s.nodes),
      ai: input.workflow.ai ? { model: input.workflow.ai.model, steps: input.workflow.ai.steps } : null,
    },
    60_000,
  )
}
