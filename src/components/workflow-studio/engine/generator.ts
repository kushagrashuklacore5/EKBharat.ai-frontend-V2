import { uid } from './data'
import { getDef } from './registry'
import type { NodeConfiguration, Workflow, WorkflowEdge, WorkflowNode } from './types'

/**
 * Rule-based workflow generator (MVP).
 * Parses a plain-language description for triggers, AI steps, conditions, approvals and
 * integrations, and lays out a runnable workflow. It is deterministic keyword matching —
 * NOT LLM generation — and the UI labels it that way.
 */
interface Step {
  type: string
  name: string
  config?: NodeConfiguration
}

/** Word-prefix match: "qualif" matches "qualify", but "sap" does not match "whatsapp". */
const has = (t: string, ...w: string[]) => w.some((x) => new RegExp(`(^|[^a-z])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t))

export function generateWorkflow(prompt: string): { workflow: Workflow; understood: string[] } {
  const t = prompt.toLowerCase()
  const understood: string[] = []
  const steps: Step[] = []

  // trigger
  if (has(t, 'whatsapp', 'chat', 'message')) {
    steps.push({ type: 'trigger.chat', name: has(t, 'whatsapp') ? 'WhatsApp message' : 'Chat message', config: { channel: has(t, 'whatsapp') ? 'whatsapp' : 'web' } })
    understood.push(`Trigger: ${has(t, 'whatsapp') ? 'WhatsApp' : 'chat'} message`)
  } else if (has(t, 'every', 'daily', 'schedule', 'morning', 'weekly', 'nightly', 'hourly')) {
    steps.push({ type: 'trigger.schedule', name: 'Schedule', config: { cron: has(t, 'weekly') ? '0 9 * * 1' : has(t, 'hourly') ? '0 * * * *' : '0 9 * * *' } })
    understood.push('Trigger: schedule')
  } else if (has(t, 'email', 'mail', 'inbox')) {
    steps.push({ type: 'trigger.email', name: 'New email', config: { payload: '{\n  "from": "sender@example.com",\n  "subject": "New request",\n  "attachment": "document.pdf"\n}' } })
    understood.push('Trigger: new email')
  } else if (has(t, 'form', 'sign-up', 'signup', 'submission')) {
    steps.push({ type: 'trigger.form', name: 'Form submission', config: { payload: '{\n  "name": "Asha",\n  "email": "asha@example.com"\n}' } })
    understood.push('Trigger: form submission')
  } else {
    steps.push({ type: 'trigger.webhook', name: 'Webhook' })
    understood.push('Trigger: webhook (default)')
  }

  // AI understanding
  if (has(t, 'invoice', 'gst', 'extract', 'pdf', 'document')) {
    steps.push({ type: 'ai.agent', name: 'Extract details', config: { task: 'extract', goal: 'Extract the key fields from the incoming document.', sample: '{\n  "invoice_no": "INV-001",\n  "total": 11800,\n  "score": 75\n}' } })
    understood.push('AI: extract structured data')
  }
  if (has(t, 'qualify', 'score', 'lead')) {
    steps.push({ type: 'ai.agent', name: 'Qualify lead', config: { task: 'chat', goal: 'Qualify the lead and reply in their language.', sample: '' } })
    understood.push('AI: qualify the lead (score + reply)')
  } else if (has(t, 'classify', 'intent', 'categor', 'triage', 'route')) {
    steps.push({ type: 'ai.classifier', name: 'Classify', config: { categories: 'pricing, support, other' } })
    understood.push('AI: classify intent')
  } else if (has(t, 'summar', 'reply', 'answer', 'draft')) {
    steps.push({ type: 'ai.llm', name: 'Draft response', config: { task: 'chat', sample: '' } })
    understood.push('AI: draft a response')
  }

  // branching
  const qualifies = has(t, 'qualify', 'score', 'if ', 'only when', 'qualified')
  if (qualifies) {
    const field = steps.some((s) => s.name === 'Qualify lead') ? 'lead_score' : 'score'
    steps.push({ type: 'logic.if', name: 'Qualified?', config: { field, operator: 'gte', value: '60' } })
    understood.push(`Condition: ${field} ≥ 60`)
  }
  if (has(t, 'approv', 'review', 'manager', 'sign off')) {
    steps.push({ type: 'human.approval', name: 'Manager approval', config: { assignee: 'Manager' } })
    understood.push('Human approval step')
  }

  // destinations
  const dest: [string[], string, string][] = [
    [['tally'], 'india.tally', 'Post to Tally'],
    [['crm', 'zoho'], 'india.zoho', 'Add to CRM'],
    [['razorpay', 'payment link'], 'india.razorpay', 'Create payment link'],
    [['ticket', 'freshdesk', 'freshworks'], 'india.freshworks', 'Create ticket'],
    [['sap'], 'india.sapb1', 'Post to SAP B1'],
    [['database', 'sheet', 'store', 'save'], 'data.database', 'Save record'],
  ]
  dest.forEach(([words, type, name]) => {
    if (has(t, ...words)) {
      steps.push({ type, name })
      understood.push(`Action: ${name}`)
    }
  })
  if (has(t, 'notify', 'slack', 'alert', 'tell', 'inform')) {
    steps.push({ type: 'human.notify', name: 'Notify team', config: { channel: has(t, 'slack') ? 'Slack' : 'Email' } })
    understood.push('Notify the team')
  }
  if (steps[0].type === 'trigger.chat') {
    steps.push({ type: 'output.respond', name: 'Reply to customer' })
    understood.push('Reply in the same chat')
  }
  if (steps.length === 1) {
    steps.push({ type: 'ai.llm', name: 'Process with AI', config: { prompt: prompt.slice(0, 200) } })
    understood.push('AI: process the event (no specific steps recognised)')
  }

  // layout + wiring: linear chain; IF true → next step, false → reply (if any)
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  steps.forEach((s, i) => {
    const id = `g${i}`
    nodes.push({ id, type: s.type, name: s.name, position: { x: i * 260, y: i % 2 ? 40 : 0 }, config: { ...(getDef(s.type)?.defaults ?? {}), ...(s.config ?? {}) } })
    if (i > 0) {
      const prev = steps[i - 1]
      const handle = prev.type === 'logic.if' ? 'true' : prev.type === 'human.approval' ? 'approved' : 'main'
      edges.push({ id: `g${i - 1}.${handle}>${id}.main`, source: `g${i - 1}`, sourceHandle: handle, target: id, targetHandle: 'main' })
    }
    if (s.type === 'ai.agent') {
      nodes.push({ id: `${id}m`, type: 'sub.model', name: 'Model router', position: { x: i * 260, y: 190 }, config: { model: 'auto', strategy: 'balanced' } })
      edges.push({ id: `${id}m.sub>${id}.model`, source: `${id}m`, sourceHandle: 'sub', target: id, targetHandle: 'model' })
    }
  })
  const ifIdx = steps.findIndex((s) => s.type === 'logic.if')
  const replyIdx = steps.findIndex((s) => s.type === 'output.respond')
  if (ifIdx >= 0 && replyIdx > ifIdx + 1) edges.push({ id: `g${ifIdx}.false>g${replyIdx}.main`, source: `g${ifIdx}`, sourceHandle: 'false', target: `g${replyIdx}`, targetHandle: 'main' })

  const now = Date.now()
  const name = prompt.trim().replace(/\s+/g, ' ').slice(0, 48) + (prompt.trim().length > 48 ? '…' : '')
  return {
    understood,
    workflow: {
      id: uid('wf_'),
      name: name || 'Generated workflow',
      description: `Generated from: “${prompt.trim()}”. Rule-based generator (MVP) — review every step before use.`,
      nodes,
      edges,
      meta: { state: 'draft', active: false, version: 0, dirty: true, createdAt: now, updatedAt: now },
      origin: 'generated',
    },
  }
}
