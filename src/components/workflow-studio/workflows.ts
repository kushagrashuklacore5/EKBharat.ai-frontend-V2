import { getDef } from './engine/registry'
import type { NodeConfiguration, NodeKind, Workflow, WorkflowEdge, WorkflowNode } from './engine/types'

export type { NodeKind } from './engine/types'

export const KIND_META: Record<NodeKind, { label: string; color: string }> = {
  trigger: { label: 'Trigger', color: '#c4852f' },
  agent: { label: 'AI Agent', color: '#2f7fa8' },
  llm: { label: 'LLM', color: '#2c64a0' },
  knowledge: { label: 'Knowledge', color: '#2e8d81' },
  condition: { label: 'Condition', color: '#a8731c' },
  database: { label: 'Database', color: '#4b8a5c' },
  integration: { label: 'Integration', color: '#5d7083' },
  human: { label: 'Human approval', color: '#c0664a' },
  output: { label: 'Action', color: '#46607a' },
  parallel: { label: 'Parallel', color: '#5867a8' },
  data: { label: 'Data', color: '#557a8f' },
  model: { label: 'Chat Model', color: '#2c64a0' },
  memory: { label: 'Memory', color: '#7a6aa8' },
  tool: { label: 'Tool', color: '#5d7083' },
}

// ── builders ──────────────────────────────────────────────
const N = (id: string, type: string, name: string, x: number, y: number, config: NodeConfiguration = {}): WorkflowNode => ({
  id,
  type,
  name,
  position: { x, y },
  config: { ...(getDef(type)?.defaults ?? {}), ...config },
})
const E = (source: string, target: string, sourceHandle?: string, targetHandle?: string): WorkflowEdge => ({
  id: `${source}.${sourceHandle ?? 'main'}>${target}.${targetHandle ?? 'main'}`,
  source,
  target,
  sourceHandle: sourceHandle ?? 'main',
  targetHandle: targetHandle ?? 'main',
})
const J = (v: unknown) => JSON.stringify(v, null, 2)
const meta = () => ({ state: 'published' as const, active: false, version: 1, dirty: false, createdAt: 0, updatedAt: 0 })

export const WORKFLOWS: Workflow[] = [
  {
    id: 'gst',
    name: 'GST Invoice → Tally',
    description:
      'Demonstration workflow (not a customer deployment): read a GST invoice, extract and validate its tax details, reconcile it against the PO, route exceptions to finance and post an approved purchase voucher to Tally.',
    origin: 'template',
    meta: meta(),
    nodes: [
      N('t', 'trigger.email', 'GST invoice received', 0, 0, { mailbox: 'accounts-payable', payload: J({ from: 'billing@sampletraders.example', subject: 'Invoice INV-2611-0418', attachment: 'INV-2611-0418.pdf' }) }),
      N('x', 'ai.agent', 'Data Extraction', 260, 0, {
        goal: 'Extract GSTIN, invoice number, HSN/SAC lines, taxable value and GST from {{ $json.attachment }}',
        task: 'extract',
        sample: J({ invoice_no: 'INV-2611-0418', gstin: '09ABCDE1234F1Z5', hsn: ['8471', '8517'], lines: [{ hsn: '8471', desc: 'Laptop', taxable: 60000 }, { hsn: '8517', desc: 'Router', taxable: 40000 }], taxable_value: 100000, igst: 18000, total: 118000 }),
      }),
      N('xm', 'sub.model', 'Model router', 215, 175, { model: 'auto', strategy: 'cost' }),
      N('xt', 'sub.tool', 'GSTN lookup', 395, 175, { integration: 'gstn', action: 'Verify GSTIN' }),
      N('v', 'india.gstn', 'GSTIN check', 560, 0, { operation: 'Verify GSTIN', sample: J({ gstin_status: 'Active', gstin_valid: true }) }),
      N('r', 'data.database', 'Reconcile with PO', 860, 0, {
        query: "select * from purchase_orders where supplier_gstin = '{{ $json.gstin }}'",
        sample: J({ po_number: 'PO-7781', po_matched: true, hsn_match: false, variance_pct: 0.4, mismatch: 'HSN on line 2 differs from PO' }),
      }),
      N('c', 'logic.if', 'Clean match?', 0, 330, { field: 'hsn_match', operator: 'isTrue', value: '' }),
      N('h', 'human.approval', 'Finance approval', 290, 410, { assignee: 'Accounts lead', message: '{{ $json.invoice_no }}: {{ $json.mismatch }}', timeout: '8h' }),
      N('y', 'india.tally', 'Tally entry', 580, 330, { operation: 'Create purchase voucher', sample: J({ tally_voucher_id: 'PV-{{ $json.invoice_no }}', tally_status: 'posted (demo)' }) }),
      N('o', 'human.notify', 'Notify AP team', 860, 330, { channel: 'Slack', to: '#accounts-payable', message: '{{ $json.invoice_no }} posted to Tally as {{ $json.tally_voucher_id }} · total ₹{{ $json.total }}' }),
    ],
    edges: [E('t', 'x'), E('xm', 'x', 'sub', 'model'), E('xt', 'x', 'sub', 'tools'), E('x', 'v'), E('v', 'r'), E('r', 'c'), E('c', 'h', 'false'), E('c', 'y', 'true'), E('h', 'y', 'approved'), E('y', 'o')],
  },
  {
    id: 'multilingual',
    name: 'Multilingual Lead Qualification',
    description:
      'A customer writes in Hindi, Tamil, English or Hinglish. The workflow detects language and intent, an agent qualifies the lead and replies in the same language, and qualified leads go to the CRM. Try it from the Test chat tab.',
    origin: 'template',
    meta: meta(),
    nodes: [
      N('t', 'trigger.chat', 'WhatsApp / web message', 0, 60, { payload: J({ message: 'Mujhe pricing chahiye.', sessionId: 'demo-session', phone: '+91 98765 43210' }) }),
      N('c', 'ai.classifier', 'Detect language & intent', 260, 60, { categories: 'pricing, demo, support, other', strategy: 'cost' }),
      N('s', 'logic.switch', 'Route by intent', 520, 60, { field: 'category', cases: 'pricing, demo, support' }),
      N('a', 'ai.agent', 'Lead Qualifier', 800, -120, { goal: "Qualify the lead and reply in the customer's language ({{ $json.language }}).", task: 'chat', sample: '' }),
      N('am', 'sub.model', 'Model router', 700, 50, { model: 'auto', strategy: 'balanced' }),
      N('ae', 'sub.memory', 'Chat memory', 865, 50),
      N('at', 'sub.tool', 'Zoho CRM', 1030, 50, { integration: 'zoho', action: 'Create lead' }),
      N('l', 'ai.llm', 'Support reply', 800, 250, { prompt: 'Reply politely in {{ $json.language }} to: {{ $json.message }}', task: 'chat', strategy: 'latency', sample: '' }),
      N('i', 'logic.if', 'Qualified?', 1100, -120, { field: 'lead_score', operator: 'gte', value: '60' }),
      N('z', 'india.zoho', 'Create CRM lead', 1380, -120, { operation: 'Create lead', sample: J({ crm_lead_id: 'ZL-48211', crm_owner: 'round-robin (demo)' }) }),
      N('f', 'india.freshworks', 'Create ticket', 1100, 250, { operation: 'Create ticket' }),
      N('r', 'output.respond', 'Reply in same language', 1660, 60),
    ],
    edges: [
      E('t', 'c'), E('c', 's'),
      E('s', 'a', 'case-0'), E('s', 'a', 'case-1'), E('s', 'l', 'case-2'), E('s', 'l', 'fallback'),
      E('am', 'a', 'sub', 'model'), E('ae', 'a', 'sub', 'memory'), E('at', 'a', 'sub', 'tools'),
      E('a', 'i'), E('i', 'z', 'true'), E('i', 'r', 'false'), E('z', 'r'), E('l', 'f'), E('f', 'r'),
    ],
  },
  {
    id: 'support',
    name: 'AI Customer Support',
    description: 'Classify an incoming chat message, ground the answer in your help centre and order data, and route refunds to a human before replying.',
    origin: 'template',
    meta: meta(),
    nodes: [
      N('t', 'trigger.chat', 'Incoming message', 0, 0, { payload: J({ message: 'I was charged twice for my order A-1042.', customer_id: 'C-2231', sessionId: 'demo-session' }) }),
      N('a', 'ai.classifier', 'Intent Detection', 260, 0, { categories: 'billing, shipping, support, other', strategy: 'cost' }),
      N('k', 'ai.knowledge', 'Help centre', 520, -90, { index: 'help-centre-v3', query: '{{ $json.message }}', sample: J({ passages: 3, kb_source: 'Refunds & duplicate charges' }) }),
      N('d', 'data.database', 'Order history', 520, 90, { query: "select * from orders where customer_id = '{{ $json.customer_id }}'", sample: J({ order_id: 'A-1042', payments_found: 2, refund_eligible: true }) }),
      N('mg', 'logic.merge', 'Merge context', 780, 0, { mode: 'combine' }),
      N('m', 'ai.llm', 'Draft reply', 0, 290, { prompt: 'Using {{ $json.kb_source }}, reply to: {{ $json.message }}', task: 'chat', strategy: 'quality', sample: '' }),
      N('c', 'logic.if', 'Needs approval?', 260, 290, { field: 'refund_eligible', operator: 'isTrue', value: '' }),
      N('h', 'human.approval', 'Support lead approval', 520, 220, { assignee: 'Support lead', message: 'Refund for {{ $json.order_id }}', timeout: '4h' }),
      N('o', 'output.respond', 'Reply to customer', 800, 290),
    ],
    edges: [E('t', 'a'), E('a', 'k'), E('a', 'd'), E('k', 'mg'), E('d', 'mg'), E('mg', 'm'), E('m', 'c'), E('c', 'h', 'true'), E('c', 'o', 'false'), E('h', 'o', 'approved')],
  },
  {
    id: 'leads',
    name: 'AI Lead Generation',
    description: 'Enrich new sign-ups in parallel, score them against your ideal customer profile and hand qualified leads to sales.',
    origin: 'template',
    meta: meta(),
    nodes: [
      N('t', 'trigger.form', 'New sign-up', 0, 0, { form: 'Website contact form', payload: J({ name: 'Priya Sharma', email: 'priya@company.example', company: 'Sample Logistics', interest: 'Ops automation' }) }),
      N('p', 'logic.parallel', 'Enrich in parallel', 260, 0),
      N('w', 'data.http', 'Company lookup', 520, -110, { url: 'https://api.example.com/company?name={{ $json.company }}', sample: J({ industry: 'Logistics', employees: '200–500', city: 'Pune' }) }),
      N('r', 'ai.agent', 'Research Agent', 520, 90, { goal: 'Research {{ $json.company }} and summarise priorities.', task: 'reason', sample: J({ research_summary: 'Expanding warehouse network; evaluating dispatch automation.' }) }),
      N('rm', 'sub.model', 'Model router', 460, 250, { model: 'auto', strategy: 'quality' }),
      N('rt', 'sub.tool', 'Web search', 630, 250, { integration: 'http', action: 'web_search' }),
      N('mg', 'logic.merge', 'Merge enrichment', 800, 0, { mode: 'combine' }),
      N('s', 'ai.llm', 'Score vs ICP', 1060, 0, { prompt: 'Score {{ $json.company }} against our ICP. Return {score, reasons[]}.', task: 'classify', strategy: 'cost', format: 'json', sample: J({ score: 82, reasons: ['Logistics ICP', '200–500 employees'] }) }),
      N('c', 'logic.if', 'Score ≥ 70?', 800, 330, { field: 'score', operator: 'gte', value: '70' }),
      N('crm', 'india.zoho', 'Create CRM lead', 1060, 260, { operation: 'Create lead' }),
      N('n', 'human.notify', 'Nurture email', 1060, 420, { channel: 'Email', to: '{{ $json.email }}', message: 'Resources on AI automation for {{ $json.company }}' }),
      N('o', 'human.notify', 'Notify sales', 1320, 260, { channel: 'Slack', to: '#sales-inbound', message: 'Qualified lead {{ $json.name }} ({{ $json.company }}) · score {{ $json.score }}' }),
    ],
    edges: [E('t', 'p'), E('p', 'w'), E('p', 'r'), E('rm', 'r', 'sub', 'model'), E('rt', 'r', 'sub', 'tools'), E('w', 'mg'), E('r', 'mg'), E('mg', 's'), E('s', 'c'), E('c', 'crm', 'true'), E('c', 'n', 'false'), E('crm', 'o')],
  },
  {
    id: 'invoice',
    name: 'Invoice Processing',
    description: 'Extract fields from invoices, match them to purchase orders, and route exceptions to finance before posting to the ERP.',
    origin: 'template',
    meta: meta(),
    nodes: [
      N('t', 'trigger.email', 'Invoice received', 0, 0, { mailbox: 'accounts-payable', payload: J({ attachment: 'invoice_0931.pdf', from: 'ap@vendor.example' }) }),
      N('x', 'ai.agent', 'Document Extraction', 260, 0, {
        goal: 'Extract vendor, PO number, totals and line items from {{ $json.attachment }}',
        task: 'extract',
        sample: J({ vendor: 'Vendor Co', po_number: 'PO-5520', total: 48200, tax: 7353, lines: [{ sku: 'A-11', qty: 4 }, { sku: 'B-07', qty: 10 }] }),
      }),
      N('xm', 'sub.model', 'Model router', 260, 175, { model: 'auto', strategy: 'latency' }),
      N('po', 'data.database', 'Match purchase order', 540, 0, { engine: 'Postgres', query: "select total from purchase_orders where po = '{{ $json.po_number }}'", sample: J({ po_total: 48000, variance_pct: 0.42 }) }),
      N('c', 'logic.if', 'Within tolerance?', 0, 330, { field: 'variance_pct', operator: 'lte', value: '1' }),
      N('erp', 'india.sapb1', 'Post to ERP', 290, 260, { operation: 'Create A/P invoice' }),
      N('h', 'human.approval', 'Finance review', 290, 420, { assignee: 'AP team', message: 'Variance {{ $json.variance_pct }}% on {{ $json.po_number }}' }),
      N('o', 'human.notify', 'Confirm to vendor', 570, 260, { channel: 'Email', to: '{{ $json.from }}', message: 'Invoice for {{ $json.po_number }} accepted.' }),
    ],
    edges: [E('t', 'x'), E('xm', 'x', 'sub', 'model'), E('x', 'po'), E('po', 'c'), E('c', 'erp', 'true'), E('c', 'h', 'false'), E('h', 'erp', 'approved'), E('erp', 'o')],
  },
  {
    id: 'research',
    name: 'Multi-Agent Research',
    description: 'An orchestrator plans the work, specialised agents research and verify, and an editor reviews the report before it is published.',
    origin: 'template',
    meta: meta(),
    nodes: [
      N('t', 'trigger.manual', 'Research brief', 0, 0, { payload: J({ topic: 'AI in Indian logistics', depth: 'standard', audience: 'leadership' }) }),
      N('o', 'ai.agent', 'Orchestrator', 260, 0, { goal: 'Plan research on {{ $json.topic }} for {{ $json.audience }}', task: 'reason', sample: J({ plan: ['Market size', 'Key players', 'Adoption barriers', 'Regulation'] }) }),
      N('r', 'ai.agent', 'Research Agent', 560, -110, { goal: 'Collect sources for each item in the plan', task: 'reason', sample: J({ sources: 14 }) }),
      N('k', 'ai.knowledge', 'Internal knowledge', 560, 90, { index: 'reports-archive', query: '{{ $json.topic }}', sample: J({ internal_passages: 5 }) }),
      N('m1', 'sub.model', 'Model router', 260, 175, { model: 'auto', strategy: 'quality' }),
      N('rt', 'sub.tool', 'Web search', 840, -110, { integration: 'http', action: 'web_search' }),
      N('mg', 'logic.merge', 'Merge findings', 860, 60, { mode: 'combine' }),
      N('an', 'ai.agent', 'Analysis Agent', 0, 360, { goal: 'Synthesise findings on {{ $json.topic }}', task: 'reason', sample: J({ findings: '4 key findings drafted' }) }),
      N('v', 'ai.agent', 'Verification Agent', 300, 360, { goal: 'Check every claim has a citation', task: 'extract', sample: J({ claims_flagged: 2, claims_corrected: 2 }) }),
      N('m2', 'sub.model', 'Model router', 150, 530, { model: 'claude-sonnet' }),
      N('h', 'human.review', 'Editor review', 600, 360, { assignee: 'Research lead' }),
      N('out', 'human.notify', 'Publish report', 880, 360, { channel: 'Email', to: 'leadership@company.example', message: 'Report on {{ $json.topic }} is ready.' }),
    ],
    edges: [
      E('t', 'o'), E('o', 'r'), E('o', 'k'), E('r', 'mg'), E('k', 'mg'), E('mg', 'an'), E('an', 'v'), E('v', 'h'), E('h', 'out'),
      E('m1', 'o', 'sub', 'model'), E('m1', 'r', 'sub', 'model'), E('rt', 'r', 'sub', 'tools'), E('m2', 'an', 'sub', 'model'), E('m2', 'v', 'sub', 'model'),
    ],
  },
]

export const TEMPLATE_IDS = WORKFLOWS.map((w) => w.id)
export const cloneWorkflow = (w: Workflow): Workflow => structuredClone(w)
