import { evaluate, getPath, hash, OPERATORS, parseCsv, resolveExpr, safeJson, toItems } from './data'
import { detectLanguage, MODELS, STRATEGIES, TASKS } from './routing'
import type { AiTask, Availability, Item, JsonValue, NodeConfiguration, NodeInput, NodeKind, NodeOutput, ParamValue, RoutingStrategy, Workflow, WorkflowNode } from './types'

// ── Parameter schema ──────────────────────────────────────

export type ParamType = 'text' | 'textarea' | 'json' | 'code' | 'number' | 'select' | 'toggle'
export interface ParamField {
  key: string
  label: string
  type: ParamType
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  help?: string
  min?: number
  max?: number
  /** supports {{ $json.x }} expressions */
  expr?: boolean
  /** only show when another param has this value */
  showIf?: { key: string; equals: ParamValue | ParamValue[] }
}

export type SubSlot = 'model' | 'memory' | 'tools'
export type LibraryGroup = 'Triggers' | 'AI' | 'AI sub-nodes' | 'Logic' | 'Data' | 'India Stack' | 'Human Interaction' | 'Canvas'

export interface ExecContext {
  node: WorkflowNode
  input: NodeInput
  /** raw configured value */
  raw(key: string): ParamValue
  /** value with expressions resolved against an item */
  param(key: string, item?: Item): JsonValue
  signal: AbortSignal
  sub: { model?: WorkflowNode; memory?: WorkflowNode; tools: WorkflowNode[] }
  /** payload injected by the caller (chat message, test payload) for trigger nodes */
  triggerData?: Item[]
  /** call a model through the routing layer; records routing + usage on the step */
  ai(opts: { task: AiTask; prompt: string; strategy: RoutingStrategy; pinnedModel?: string; simulate: () => Item[] }): Promise<Item[]>
  /** pause for a human decision */
  approval(): Promise<boolean>
  log(text: string, tone?: 'info' | 'ok' | 'warn' | 'err'): void
}

export interface Issue {
  level: 'error' | 'warning'
  message: string
}

export interface NodeTypeDef {
  type: string
  kind: NodeKind
  title: string
  subtitle: string
  group: LibraryGroup
  availability: Availability
  /** short label for India-stack connectors (no third-party logos are bundled) */
  monogram?: string
  brand?: string
  role: 'main' | 'sub' | 'note'
  /** which agent slot a sub-node attaches to */
  subSlot?: SubSlot
  /** agent slots this node exposes */
  slots?: SubSlot[]
  hasInput: boolean
  outputs(config: NodeConfiguration): { id: string; label: string }[]
  params: ParamField[]
  defaults: NodeConfiguration
  /** India-stack write operations (for governance checks) */
  writes?(config: NodeConfiguration): boolean
  execute?(ctx: ExecContext): Promise<NodeOutput>
  validate?(node: WorkflowNode, wf: Workflow): Issue[]
}

const MAIN = [{ id: 'main', label: '' }]
const one = () => MAIN

const strategyField: ParamField = {
  key: 'strategy',
  label: 'Routing strategy',
  type: 'select',
  options: STRATEGIES.map((s) => ({ value: s.id, label: s.label })),
  help: 'How the model router chooses between providers for this step.',
}
const taskField: ParamField = { key: 'task', label: 'Task type', type: 'select', options: TASKS.filter((t) => t.id !== 'embed').map((t) => ({ value: t.id, label: t.label })) }
const sampleField: ParamField = {
  key: 'sample',
  label: 'Demo response (simulation adapter)',
  type: 'json',
  expr: true,
  help: 'Returned by the simulation adapter and merged into each input item. Supports {{ $json.field }}. Ignored when a real backend is connected.',
}
const payloadField: ParamField = { key: 'payload', label: 'Test payload', type: 'json', help: 'Sample event used when you run or test this trigger.' }

// ── Execution helpers ─────────────────────────────────────

const resolveDeep = (v: JsonValue, item: Item, count: number): JsonValue => {
  if (typeof v === 'string') return resolveExpr(v, item, { count })
  if (Array.isArray(v)) return v.map((x) => resolveDeep(x, item, count))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveDeep(x, item, count)]))
  return v
}

/** Items to iterate: the input, or a single empty item for nodes with no input. */
const itemsOf = (ctx: ExecContext): Item[] => (ctx.input.items.length ? ctx.input.items : [{}])

/** Merge the node's "sample" (with expressions) into each input item. */
function fromSample(ctx: ExecContext, extra?: (item: Item) => Item): Item[] {
  const raw = String(ctx.raw('sample') ?? '').trim()
  const parsed = raw ? safeJson(raw) : { ok: true as const, value: {} as JsonValue }
  if (!parsed.ok) throw new Error(`Demo response is not valid JSON: ${parsed.error}`)
  const items = itemsOf(ctx)
  return items.map((it) => {
    const s = resolveDeep(parsed.value, it, items.length)
    const add = s && typeof s === 'object' && !Array.isArray(s) ? (s as Item) : { result: s }
    return { ...it, ...add, ...(extra ? extra(it) : {}) }
  })
}

const wrap = (items: Item[]): NodeOutput => ({ outputs: [items] })

function triggerExec(defaultTrigger: string) {
  return async (ctx: ExecContext): Promise<NodeOutput> => {
    if (ctx.triggerData?.length) return wrap(ctx.triggerData.map((i) => ({ ...i, _trigger: defaultTrigger })))
    const raw = String(ctx.raw('payload') ?? '{}')
    const p = safeJson(raw || '{}')
    if (!p.ok) throw new Error(`Test payload is not valid JSON: ${p.error}`)
    return wrap(toItems(p.value).map((i) => ({ ...i })))
  }
}

// ── Multilingual demo responder (used by the simulation adapter) ─────

const INTENT_WORDS: Record<string, string[]> = {
  pricing: ['price', 'pricing', 'cost', 'quote', 'plan', 'rate', 'kitna', 'keemat', 'daam', 'paisa', 'कीमत', 'दाम', 'मूल्य', 'प्राइस', 'पैसे', 'விலை', 'கட்டணம்', 'பிரைஸ்'],
  demo: ['demo', 'trial', 'call', 'meeting', 'dikhao', 'डेमो', 'दिखाइए', 'டெமோ', 'காட்டுங்கள்'],
  support: ['issue', 'problem', 'error', 'help', 'refund', 'charged', 'broken', 'not working', 'madad', 'dikkat', 'समस्या', 'मदद', 'शिकायत', 'दिक्कत', 'உதவி', 'பிரச்சனை', 'பிரச்சினை'],
  billing: ['bill', 'invoice', 'charged', 'refund', 'payment', 'बिल', 'भुगतान', 'பணம்'],
  shipping: ['delivery', 'shipping', 'courier', 'order', 'डिलीवरी', 'டெலிவரி'],
}

export function classify(text: string, categories: string[]) {
  const t = text.toLowerCase()
  let best = { category: categories[categories.length - 1] ?? 'other', hits: 0 }
  for (const c of categories) {
    const words = [...(INTENT_WORDS[c] ?? []), c]
    const hits = words.filter((w) => t.includes(w.toLowerCase())).length
    if (hits > best.hits) best = { category: c, hits }
  }
  return { category: best.category, confidence: best.hits ? Math.min(0.97, 0.72 + best.hits * 0.09) : 0.55 }
}

const REPLIES: Record<string, Record<string, string>> = {
  pricing: {
    English: 'Thanks for asking! Plans start with a free pilot, then usage-based pricing in INR. Could you share your team size so I can suggest the right plan?',
    Hinglish: 'Zaroor! Pricing ek free pilot se start hoti hai, phir INR mein usage-based. Aapki team kitni badi hai? Main sahi plan suggest kar deta hoon.',
    Hindi: 'ज़रूर! शुरुआत एक मुफ़्त पायलट से होती है, फिर INR में उपयोग-आधारित मूल्य। आपकी टीम कितनी बड़ी है? मैं सही प्लान सुझा दूँ।',
    Tamil: 'நிச்சயமாக! இலவச பைலட்டுடன் தொடங்கி, பிறகு INR-இல் பயன்பாட்டு அடிப்படையிலான கட்டணம். உங்கள் குழுவின் அளவைச் சொல்லுங்கள், சரியான திட்டத்தைப் பரிந்துரைக்கிறேன்.',
  },
  demo: {
    English: 'Happy to set up a demo. Our team will reach out to schedule a 30-minute walkthrough.',
    Hinglish: 'Bilkul, demo set kar dete hain. Hamari team 30 minute ke walkthrough ke liye aapse contact karegi.',
    Hindi: 'बिल्कुल, हम डेमो तय कर देते हैं। हमारी टीम 30 मिनट के वॉकथ्रू के लिए आपसे संपर्क करेगी।',
    Tamil: 'டெமோ ஏற்பாடு செய்கிறோம். 30 நிமிட விளக்கத்திற்கு எங்கள் குழு உங்களைத் தொடர்பு கொள்ளும்.',
  },
  support: {
    English: 'Sorry about the trouble. I have logged a support ticket and a specialist will follow up shortly.',
    Hinglish: 'Asuvidha ke liye maafi. Maine support ticket bana diya hai, ek specialist jaldi aapse baat karega.',
    Hindi: 'असुविधा के लिए खेद है। मैंने सपोर्ट टिकट बना दिया है, एक विशेषज्ञ जल्द ही संपर्क करेगा।',
    Tamil: 'சிரமத்திற்கு வருந்துகிறோம். ஆதரவு டிக்கெட் பதிவு செய்யப்பட்டுள்ளது, நிபுணர் விரைவில் தொடர்பு கொள்வார்.',
  },
  other: {
    English: 'Thanks for your message. Could you tell me a little more about what you need?',
    Hinglish: 'Message ke liye shukriya. Aapko kis cheez mein madad chahiye, thoda aur batayenge?',
    Hindi: 'संदेश के लिए धन्यवाद। आपको किस चीज़ में मदद चाहिए, थोड़ा और बताएँगे?',
    Tamil: 'உங்கள் செய்திக்கு நன்றி. உங்களுக்கு என்ன தேவை என்று இன்னும் கொஞ்சம் சொல்ல முடியுமா?',
  },
}

export function chatReply(item: Item): Item {
  const message = String(item.message ?? item.text ?? '')
  const language = String(item.language ?? detectLanguage(message))
  const cat = String(item.category ?? item.intent ?? classify(message, ['pricing', 'demo', 'support', 'other']).category)
  const key = cat in REPLIES ? cat : cat === 'billing' || cat === 'shipping' ? 'support' : 'other'
  const reply = REPLIES[key][language] ?? REPLIES[key].English
  const score = key === 'demo' ? 86 : key === 'pricing' ? 78 : key === 'support' ? 35 : 42
  return { reply, language, lead_score: score, qualified: score >= 60 }
}

// ── India Stack connectors (planned; demo adapters return sample data) ─────

const INDIA: { id: string; title: string; mono: string; brand: string; ops: string[]; writes: string[]; sample: string }[] = [
  { id: 'tally', title: 'Tally', mono: 'T', brand: '#3b5bab', ops: ['Create purchase voucher', 'Create sales voucher', 'Fetch ledger'], writes: ['Create purchase voucher', 'Create sales voucher'], sample: '{"tally_voucher_id":"PV-2611-0418","tally_status":"posted (demo)"}' },
  { id: 'zoho', title: 'Zoho CRM', mono: 'Z', brand: '#c8372d', ops: ['Create lead', 'Update deal', 'Search contact'], writes: ['Create lead', 'Update deal'], sample: '{"crm_lead_id":"ZL-48211","crm_owner":"round-robin (demo)"}' },
  { id: 'whatsapp', title: 'WhatsApp Business', mono: 'W', brand: '#25935b', ops: ['Send template message', 'Send text reply'], writes: ['Send template message', 'Send text reply'], sample: '{"wa_message_id":"wamid.demo.0007","wa_status":"queued (demo)"}' },
  { id: 'razorpay', title: 'Razorpay', mono: 'R', brand: '#2b6fd6', ops: ['Create payment link', 'Fetch payment', 'Create refund'], writes: ['Create payment link', 'Create refund'], sample: '{"payment_link":"https://rzp.example/demo","rzp_status":"created (demo)"}' },
  { id: 'gstn', title: 'GSTN', mono: 'G', brand: '#b0731c', ops: ['Verify GSTIN', 'Fetch return status'], writes: [], sample: '{"gstin_status":"Active","gstin_valid":true,"legal_name":"Sample Traders Pvt Ltd"}' },
  { id: 'einvoice', title: 'e-Invoice IRP', mono: 'IRP', brand: '#6a5aa8', ops: ['Generate IRN', 'Cancel IRN'], writes: ['Generate IRN', 'Cancel IRN'], sample: '{"irn":"demo-irn-7f3a…","ack_no":"1121xxxx (demo)"}' },
  { id: 'digilocker', title: 'DigiLocker', mono: 'DL', brand: '#2f6f99', ops: ['Fetch document', 'Verify document'], writes: [], sample: '{"document":"PAN (demo)","verified":true}' },
  { id: 'freshworks', title: 'Freshworks', mono: 'F', brand: '#2a8f74', ops: ['Create ticket', 'Update ticket'], writes: ['Create ticket', 'Update ticket'], sample: '{"ticket_id":"FD-90412","ticket_status":"open (demo)"}' },
  { id: 'sapb1', title: 'SAP Business One', mono: 'SAP', brand: '#2c6fb3', ops: ['Create A/P invoice', 'Fetch business partner'], writes: ['Create A/P invoice'], sample: '{"sap_doc_entry":"10442","sap_status":"draft (demo)"}' },
]

export const INDIA_STACK = INDIA.map((i) => ({ id: i.id, name: i.title, monogram: i.mono, color: i.brand }))

// ── Registry ──────────────────────────────────────────────

const defs: NodeTypeDef[] = [
  // Triggers
  {
    type: 'trigger.manual', kind: 'trigger', title: 'Manual Trigger', subtitle: 'Run from the editor', group: 'Triggers', availability: 'builtin', role: 'main', hasInput: false, outputs: one,
    params: [payloadField], defaults: { payload: '{\n  "requested_by": "you"\n}' }, execute: triggerExec('manual'),
  },
  {
    type: 'trigger.webhook', kind: 'trigger', title: 'Webhook', subtitle: 'Start on an HTTP event', group: 'Triggers', availability: 'simulated', role: 'main', hasInput: false, outputs: one,
    params: [
      { key: 'method', label: 'HTTP method', type: 'select', options: ['POST', 'GET', 'PUT'].map((v) => ({ value: v, label: v })) },
      { key: 'path', label: 'Path', type: 'text', required: true, placeholder: '/hooks/new-lead', help: 'Live webhook URLs are issued by the managed runtime (not available in this demo).' },
      payloadField,
    ],
    defaults: { method: 'POST', path: '/hooks/event', payload: '{\n  "event": "created"\n}' }, execute: triggerExec('webhook'),
  },
  {
    type: 'trigger.schedule', kind: 'trigger', title: 'Schedule', subtitle: 'Run on a cron schedule', group: 'Triggers', availability: 'simulated', role: 'main', hasInput: false, outputs: one,
    params: [
      { key: 'cron', label: 'Cron expression', type: 'text', required: true, placeholder: '0 9 * * 1-5' },
      { key: 'timezone', label: 'Timezone', type: 'select', options: ['Asia/Kolkata', 'UTC'].map((v) => ({ value: v, label: v })) },
      payloadField,
    ],
    defaults: { cron: '0 9 * * 1-5', timezone: 'Asia/Kolkata', payload: '{}' },
    execute: async (ctx) => {
      const out = await triggerExec('schedule')(ctx)
      return { outputs: [out.outputs[0].map((i) => ({ ...i, fired_at: new Date().toISOString() }))] }
    },
    validate: (n) => (String(n.config.cron ?? '').trim().split(/\s+/).length !== 5 ? [{ level: 'error', message: 'Cron must have 5 fields (min hour day month weekday).' }] : []),
  },
  {
    type: 'trigger.chat', kind: 'trigger', title: 'Chat Trigger', subtitle: 'Message from chat or WhatsApp', group: 'Triggers', availability: 'builtin', role: 'main', hasInput: false, outputs: one,
    params: [
      { key: 'channel', label: 'Channel', type: 'select', options: [{ value: 'web', label: 'Web chat (test panel)' }, { value: 'whatsapp', label: 'WhatsApp Business (planned)' }] },
      { key: 'languages', label: 'Expected languages', type: 'text', placeholder: 'Hindi, English, Tamil' },
      payloadField,
    ],
    defaults: { channel: 'web', languages: 'Hindi, English, Tamil', payload: '{\n  "message": "Mujhe pricing chahiye.",\n  "sessionId": "demo-session"\n}' },
    execute: async (ctx) => {
      const out = await triggerExec('chat')(ctx)
      return { outputs: [out.outputs[0].map((i) => ({ ...i, language: detectLanguage(String(i.message ?? '')), channel: String(ctx.raw('channel')) }))] }
    },
  },
  {
    type: 'trigger.email', kind: 'trigger', title: 'New email', subtitle: 'Inbox event', group: 'Triggers', availability: 'simulated', role: 'main', hasInput: false, outputs: one,
    params: [{ key: 'mailbox', label: 'Mailbox', type: 'text', required: true }, payloadField], defaults: { mailbox: 'inbox', payload: '{}' }, execute: triggerExec('email'),
  },
  {
    type: 'trigger.form', kind: 'trigger', title: 'Form submission', subtitle: 'Website or app form', group: 'Triggers', availability: 'simulated', role: 'main', hasInput: false, outputs: one,
    params: [{ key: 'form', label: 'Form', type: 'text', required: true }, payloadField], defaults: { form: 'Contact form', payload: '{}' }, execute: triggerExec('form'),
  },

  // AI
  {
    type: 'ai.agent', kind: 'agent', title: 'AI Agent', subtitle: 'Reasoning with tools', group: 'AI', availability: 'simulated', role: 'main', hasInput: true, outputs: one, slots: ['model', 'memory', 'tools'],
    params: [
      { key: 'goal', label: 'Goal / instructions', type: 'textarea', required: true, expr: true },
      taskField,
      { key: 'maxSteps', label: 'Max reasoning steps', type: 'number', min: 1, max: 20 },
      sampleField,
    ],
    defaults: { goal: 'Complete the task using the connected tools.', task: 'reason', maxSteps: 6, sample: '' },
    execute: async (ctx) => {
      const m = ctx.sub.model
      if (!m) throw new Error('No Chat Model connected — attach one to the Model slot.')
      const pinned = String(m.config.model ?? 'auto')
      const tools = ctx.sub.tools.map((t) => toolLabel(t))
      const task = (String(ctx.raw('task')) || 'reason') as AiTask
      const items = await ctx.ai({
        task,
        prompt: String(ctx.param('goal', ctx.input.items[0])),
        strategy: (String(m.config.strategy) || 'balanced') as RoutingStrategy,
        pinnedModel: pinned === 'auto' ? undefined : pinned,
        simulate: () =>
          String(ctx.raw('sample') ?? '').trim()
            ? fromSample(ctx, () => ({ tools_called: tools }))
            : itemsOf(ctx).map((it) => ({ ...it, ...(task === 'chat' ? chatReply(it) : { answer: `Completed: ${String(ctx.raw('goal')).slice(0, 80)}` }), tools_called: tools, memory: ctx.sub.memory ? 'window buffer' : 'none' })),
      })
      if (tools.length) ctx.log(`${ctx.node.name} used tools: ${tools.join(', ')}`)
      return wrap(items)
    },
    validate: (n, wf) => {
      const has = (slot: SubSlot) => wf.edges.some((e) => e.target === n.id && e.targetHandle === slot)
      return has('model') ? [] : [{ level: 'error', message: 'Connect a Chat Model to the Model slot.' }]
    },
  },
  {
    type: 'ai.llm', kind: 'llm', title: 'LLM Call', subtitle: 'Routed model prompt', group: 'AI', availability: 'simulated', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, expr: true },
      taskField,
      strategyField,
      { key: 'format', label: 'Output format', type: 'select', options: [{ value: 'text', label: 'Text' }, { value: 'json', label: 'JSON (schema-validated)' }] },
      sampleField,
    ],
    defaults: { prompt: 'Summarise: {{ $json }}', task: 'generate', strategy: 'balanced', format: 'text', sample: '' },
    execute: async (ctx) => {
      const task = (String(ctx.raw('task')) || 'generate') as AiTask
      return wrap(
        await ctx.ai({
          task,
          prompt: String(ctx.param('prompt', ctx.input.items[0])),
          strategy: (String(ctx.raw('strategy')) || 'balanced') as RoutingStrategy,
          simulate: () =>
            String(ctx.raw('sample') ?? '').trim()
              ? fromSample(ctx)
              : itemsOf(ctx).map((it) => ({ ...it, ...(task === 'chat' ? { reply: chatReply(it).reply, language: chatReply(it).language } : { text: `Simulated ${task} response for: ${String(ctx.param('prompt', it)).slice(0, 60)}` }) })),
        }),
      )
    },
  },
  {
    type: 'ai.classifier', kind: 'llm', title: 'Text Classifier', subtitle: 'Label text into categories', group: 'AI', availability: 'simulated', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'text', label: 'Text to classify', type: 'text', required: true, expr: true },
      { key: 'categories', label: 'Categories (comma-separated)', type: 'text', required: true, help: 'The last category is used when nothing matches.' },
      strategyField,
    ],
    defaults: { text: '{{ $json.message }}', categories: 'pricing, demo, support, other', strategy: 'cost' },
    execute: async (ctx) => {
      const cats = String(ctx.raw('categories')).split(',').map((s) => s.trim()).filter(Boolean)
      return wrap(
        await ctx.ai({
          task: 'classify',
          prompt: `Classify into: ${cats.join(', ')}\n${String(ctx.param('text', ctx.input.items[0]))}`,
          strategy: (String(ctx.raw('strategy')) || 'cost') as RoutingStrategy,
          simulate: () =>
            itemsOf(ctx).map((it) => {
              const text = String(ctx.param('text', it) ?? '')
              return { ...it, ...classify(text, cats), language: detectLanguage(text) }
            }),
        }),
      )
    },
  },
  {
    type: 'ai.knowledge', kind: 'knowledge', title: 'Knowledge Retrieval', subtitle: 'RAG over your sources', group: 'AI', availability: 'simulated', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'index', label: 'Index', type: 'text', required: true },
      { key: 'query', label: 'Query', type: 'text', expr: true },
      { key: 'topK', label: 'Top K', type: 'number', min: 1, max: 20 },
      sampleField,
    ],
    defaults: { index: 'knowledge-base', query: '{{ $json.message }}', topK: 5, sample: '{"passages": 3, "sources": ["kb/article-1"]}' },
    execute: async (ctx) => {
      await sleepFor(ctx, 500)
      return wrap(fromSample(ctx))
    },
  },
  {
    type: 'ai.docqa', kind: 'knowledge', title: 'Document QA', subtitle: 'Answer from long documents', group: 'AI', availability: 'simulated', role: 'main', hasInput: true, outputs: one,
    params: [{ key: 'question', label: 'Question', type: 'text', required: true, expr: true }, { key: 'index', label: 'Document index', type: 'text', required: true }, strategyField, sampleField],
    defaults: { question: '{{ $json.question }}', index: 'contracts', strategy: 'quality', sample: '{"answer":"Clause 14.2 limits liability to 12 months of fees.","citations":["MSA.pdf p.41"]}' },
    execute: async (ctx) =>
      wrap(await ctx.ai({ task: 'reason', prompt: String(ctx.param('question', ctx.input.items[0])), strategy: (String(ctx.raw('strategy')) || 'quality') as RoutingStrategy, simulate: () => fromSample(ctx) })),
  },
  {
    type: 'ai.embeddings', kind: 'knowledge', title: 'Embeddings', subtitle: 'Vectorise text', group: 'AI', availability: 'simulated', role: 'main', hasInput: true, outputs: one,
    params: [{ key: 'text', label: 'Text', type: 'text', required: true, expr: true }, { key: 'dims', label: 'Dimensions', type: 'select', options: ['768', '1024'].map((v) => ({ value: v, label: v })) }],
    defaults: { text: '{{ $json.message }}', dims: '768' },
    execute: async (ctx) =>
      wrap(
        await ctx.ai({
          task: 'embed',
          prompt: String(ctx.param('text', ctx.input.items[0])),
          strategy: 'cost',
          simulate: () =>
            itemsOf(ctx).map((it) => {
              const h = hash(String(ctx.param('text', it)))
              return { ...it, embedding_preview: Array.from({ length: 6 }, (_, i) => Math.round((((h >> (i * 4)) & 0xff) / 255 - 0.5) * 1000) / 1000), dims: Number(ctx.raw('dims')) }
            }),
        }),
      ),
  },

  // AI sub-nodes
  {
    type: 'sub.model', kind: 'model', title: 'Chat Model', subtitle: 'Model or router for an agent', group: 'AI sub-nodes', availability: 'simulated', role: 'sub', subSlot: 'model', hasInput: false, outputs: () => [{ id: 'sub', label: 'model' }],
    params: [
      { key: 'model', label: 'Model', type: 'select', options: [{ value: 'auto', label: 'Auto — use the router' }, ...MODELS.map((m) => ({ value: m.id, label: `${m.label} · ${m.provider}` }))] },
      { ...strategyField, showIf: { key: 'model', equals: 'auto' } },
    ],
    defaults: { model: 'auto', strategy: 'balanced' },
  },
  {
    type: 'sub.memory', kind: 'memory', title: 'Memory', subtitle: 'Conversation context', group: 'AI sub-nodes', availability: 'simulated', role: 'sub', subSlot: 'memory', hasInput: false, outputs: () => [{ id: 'sub', label: 'memory' }],
    params: [
      { key: 'store', label: 'Store', type: 'select', options: [{ value: 'window', label: 'Window buffer (in run)' }, { value: 'session', label: 'Session store (planned)' }] },
      { key: 'window', label: 'Messages to keep', type: 'number', min: 1, max: 50 },
    ],
    defaults: { store: 'window', window: 10 },
  },
  {
    type: 'sub.tool', kind: 'tool', title: 'Agent Tool', subtitle: 'An action the agent may call', group: 'AI sub-nodes', availability: 'planned', role: 'sub', subSlot: 'tools', hasInput: false, outputs: () => [{ id: 'sub', label: 'tool' }],
    params: [
      { key: 'integration', label: 'Integration', type: 'select', options: [...INDIA.map((i) => ({ value: i.id, label: i.title })), { value: 'http', label: 'HTTP API' }] },
      { key: 'action', label: 'Allowed action', type: 'text', required: true },
    ],
    defaults: { integration: 'zoho', action: 'Create lead' },
  },

  // Logic
  {
    type: 'logic.if', kind: 'condition', title: 'IF', subtitle: 'Branch on a condition', group: 'Logic', availability: 'builtin', role: 'main', hasInput: true,
    outputs: () => [{ id: 'true', label: 'true' }, { id: 'false', label: 'false' }],
    params: [
      { key: 'field', label: 'Field', type: 'text', required: true, placeholder: 'score', help: 'Path into each item, e.g. lead.score or lines[0].hsn' },
      { key: 'operator', label: 'Operator', type: 'select', options: OPERATORS.map((o) => ({ value: o.id, label: o.label })) },
      { key: 'value', label: 'Value', type: 'text', expr: true },
    ],
    defaults: { field: 'score', operator: 'gte', value: '70' },
    execute: async (ctx) => {
      const t: Item[] = []
      const f: Item[] = []
      ctx.input.items.forEach((it) => (evaluate(it, String(ctx.raw('field')), String(ctx.raw('operator')), String(ctx.param('value', it) ?? '')) ? t : f).push(it))
      ctx.log(`${ctx.node.name}: ${t.length} true · ${f.length} false`)
      return { outputs: [t, f] }
    },
  },
  {
    type: 'logic.switch', kind: 'condition', title: 'Switch', subtitle: 'Route to labelled outputs', group: 'Logic', availability: 'builtin', role: 'main', hasInput: true,
    outputs: (c) => [...String(c.cases ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((v, i) => ({ id: `case-${i}`, label: v })), { id: 'fallback', label: 'other' }],
    params: [
      { key: 'field', label: 'Field', type: 'text', required: true },
      { key: 'cases', label: 'Cases (comma-separated values)', type: 'text', required: true, help: 'One output per value, plus "other".' },
    ],
    defaults: { field: 'category', cases: 'a, b' },
    execute: async (ctx) => {
      const cases = String(ctx.raw('cases')).split(',').map((s) => s.trim()).filter(Boolean)
      const outs: Item[][] = [...cases.map(() => []), []]
      ctx.input.items.forEach((it) => {
        const v = String(getPath(it, String(ctx.raw('field'))) ?? '').toLowerCase()
        const i = cases.findIndex((c) => c.toLowerCase() === v)
        outs[i === -1 ? cases.length : i].push(it)
      })
      return { outputs: outs }
    },
  },
  {
    type: 'logic.merge', kind: 'parallel', title: 'Merge', subtitle: 'Wait for inputs & combine', group: 'Logic', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [{ key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'append', label: 'Append items' }, { value: 'combine', label: 'Combine into one item' }] }],
    defaults: { mode: 'append' },
    execute: async (ctx) =>
      wrap(String(ctx.raw('mode')) === 'combine' ? [Object.assign({}, ...ctx.input.items) as Item] : ctx.input.items),
  },
  {
    type: 'logic.parallel', kind: 'parallel', title: 'Parallel', subtitle: 'Fan out to branches', group: 'Logic', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [{ key: 'note', label: 'Description', type: 'text' }], defaults: { note: 'Every connected branch runs at the same time.' },
    execute: async (ctx) => wrap(ctx.input.items),
  },
  {
    type: 'logic.loop', kind: 'parallel', title: 'Loop Over Items', subtitle: 'Split a list into items', group: 'Logic', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'field', label: 'List field', type: 'text', required: true, help: 'Each element becomes its own item; downstream nodes run once per item.' },
      { key: 'batchSize', label: 'Batch size', type: 'number', min: 1, max: 100 },
    ],
    defaults: { field: 'lines', batchSize: 1 },
    execute: async (ctx) => {
      const out: Item[] = []
      const size = Math.max(1, Number(ctx.raw('batchSize')) || 1)
      ctx.input.items.forEach((it) => {
        const list = getPath(it, String(ctx.raw('field')))
        if (!Array.isArray(list)) throw new Error(`"${String(ctx.raw('field'))}" is not a list on the input item.`)
        for (let i = 0; i < list.length; i += size) {
          const chunk = list.slice(i, i + size)
          const v = size === 1 ? chunk[0] : chunk
          out.push(v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Item), _index: i } : { value: v, _index: i })
        }
      })
      ctx.log(`${ctx.node.name}: split into ${out.length} items`)
      return wrap(out)
    },
  },
  {
    type: 'logic.filter', kind: 'condition', title: 'Filter', subtitle: 'Keep matching items', group: 'Logic', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'field', label: 'Field', type: 'text', required: true },
      { key: 'operator', label: 'Operator', type: 'select', options: OPERATORS.map((o) => ({ value: o.id, label: o.label })) },
      { key: 'value', label: 'Value', type: 'text', expr: true },
    ],
    defaults: { field: 'status', operator: 'equals', value: 'active' },
    execute: async (ctx) => {
      const kept = ctx.input.items.filter((it) => evaluate(it, String(ctx.raw('field')), String(ctx.raw('operator')), String(ctx.param('value', it) ?? '')))
      ctx.log(`${ctx.node.name}: kept ${kept.length} of ${ctx.input.items.length}`)
      return wrap(kept)
    },
  },

  // Data
  {
    type: 'data.json', kind: 'data', title: 'Edit Fields (JSON)', subtitle: 'Set or map fields', group: 'Data', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'json', label: 'Fields (JSON)', type: 'json', required: true, expr: true },
      { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'merge', label: 'Merge into item' }, { value: 'replace', label: 'Replace item' }] },
    ],
    defaults: { json: '{\n  "full_name": "{{ $json.name }}"\n}', mode: 'merge' },
    execute: async (ctx) => {
      const p = safeJson(String(ctx.raw('json')))
      if (!p.ok) throw new Error(`Fields JSON is invalid: ${p.error}`)
      const items = itemsOf(ctx)
      return wrap(
        items.map((it) => {
          const v = resolveDeep(p.value, it, items.length)
          const obj = v && typeof v === 'object' && !Array.isArray(v) ? (v as Item) : { value: v }
          return String(ctx.raw('mode')) === 'replace' ? obj : { ...it, ...obj }
        }),
      )
    },
  },
  {
    type: 'data.csv', kind: 'data', title: 'CSV', subtitle: 'Parse CSV into items', group: 'Data', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'csv', label: 'CSV text', type: 'code', required: true },
      { key: 'delimiter', label: 'Delimiter', type: 'select', options: [{ value: ',', label: 'Comma' }, { value: ';', label: 'Semicolon' }, { value: '\t', label: 'Tab' }] },
    ],
    defaults: { csv: 'name,city,score\nAsha,Pune,82\nRavi,Chennai,64', delimiter: ',' },
    execute: async (ctx) => wrap(parseCsv(String(ctx.raw('csv')), String(ctx.raw('delimiter')) || ',')),
  },
  {
    type: 'data.database', kind: 'database', title: 'Database', subtitle: 'Query or write rows', group: 'Data', availability: 'simulated', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'engine', label: 'Engine', type: 'select', options: ['Postgres', 'MySQL', 'MongoDB'].map((v) => ({ value: v, label: v })) },
      { key: 'operation', label: 'Operation', type: 'select', options: ['Select', 'Insert', 'Update'].map((v) => ({ value: v, label: v })) },
      { key: 'query', label: 'Query', type: 'code', required: true, expr: true },
      sampleField,
    ],
    defaults: { engine: 'Postgres', operation: 'Select', query: 'select * from orders where customer_id = {{ $json.customer_id }}', sample: '{"rows": 1}' },
    execute: async (ctx) => {
      await sleepFor(ctx, 450)
      return wrap(fromSample(ctx))
    },
  },
  {
    type: 'data.http', kind: 'integration', title: 'HTTP Request', subtitle: 'Call any REST API', group: 'Data', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'].map((v) => ({ value: v, label: v })) },
      { key: 'url', label: 'URL', type: 'text', required: true, expr: true },
      { key: 'live', label: 'Send a live request from this browser', type: 'toggle', help: 'Subject to the API allowing CORS. Off = use the demo response.' },
      { ...sampleField, showIf: { key: 'live', equals: false } },
    ],
    defaults: { method: 'GET', url: 'https://api.example.com/resource', live: false, sample: '{"status": 200}' },
    execute: async (ctx) => {
      if (!ctx.raw('live')) {
        await sleepFor(ctx, 400)
        return wrap(fromSample(ctx))
      }
      const out: Item[] = []
      for (const it of itemsOf(ctx)) {
        const method = String(ctx.raw('method'))
        const res = await fetch(String(ctx.param('url', it)), {
          method,
          signal: ctx.signal,
          headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
          body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(it),
        })
        const text = await res.text()
        const p = safeJson(text)
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`)
        out.push(...(p.ok ? toItems(p.value) : [{ body: text }]))
      }
      return wrap(out)
    },
  },
  {
    type: 'data.code', kind: 'data', title: 'Code', subtitle: 'JavaScript transform', group: 'Data', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [{ key: 'code', label: 'JavaScript', type: 'code', required: true, help: 'Receives `items` (array). Return an array of objects. Runs only in your browser when you run the workflow.' }],
    defaults: { code: 'return items.map((item) => ({ ...item, processed: true }))' },
    execute: async (ctx) => {
      let result: unknown
      try {
        result = new Function('items', `"use strict";\n${String(ctx.raw('code'))}`)(structuredClone(ctx.input.items))
      } catch (e) {
        throw new Error(`Code error: ${e instanceof Error ? e.message : String(e)}`)
      }
      if (result === undefined) throw new Error('Code must return an array of items.')
      return wrap(toItems(result as JsonValue))
    },
  },

  // India Stack
  ...INDIA.map<NodeTypeDef>((c) => ({
    type: `india.${c.id}`, kind: 'integration', title: c.title, subtitle: c.ops[0], group: 'India Stack', availability: 'planned', monogram: c.mono, brand: c.brand, role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'operation', label: 'Operation', type: 'select', options: c.ops.map((o) => ({ value: o, label: o })) },
      { key: 'credential', label: 'Credential', type: 'select', options: [{ value: '', label: 'Not configured — connector planned' }] },
      sampleField,
    ],
    defaults: { operation: c.ops[0], credential: '', sample: c.sample },
    writes: (cfg) => c.writes.includes(String(cfg.operation)),
    execute: async (ctx) => {
      await sleepFor(ctx, 550)
      ctx.log(`${ctx.node.name}: ${c.title} connector is planned — demo adapter returned sample data`, 'warn')
      return wrap(fromSample(ctx))
    },
  })),

  // Human interaction
  {
    type: 'human.approval', kind: 'human', title: 'Approval', subtitle: 'Approve or reject', group: 'Human Interaction', availability: 'builtin', role: 'main', hasInput: true,
    outputs: () => [{ id: 'approved', label: 'approved' }, { id: 'rejected', label: 'rejected' }],
    params: [
      { key: 'assignee', label: 'Assignee', type: 'text', required: true },
      { key: 'message', label: 'Message to approver', type: 'textarea', expr: true },
      { key: 'timeout', label: 'Timeout', type: 'select', options: ['1h', '4h', '8h', '24h'].map((v) => ({ value: v, label: `${v} → escalate` })) },
    ],
    defaults: { assignee: 'Manager', message: 'Please review this item.', timeout: '8h' },
    execute: async (ctx) => {
      const ok = await ctx.approval()
      return { outputs: ok ? [ctx.input.items.map((i) => ({ ...i, approved: true })), []] : [[], ctx.input.items.map((i) => ({ ...i, approved: false }))] }
    },
  },
  {
    type: 'human.review', kind: 'human', title: 'Review', subtitle: 'A person checks before continuing', group: 'Human Interaction', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [{ key: 'assignee', label: 'Reviewer', type: 'text', required: true }, { key: 'message', label: 'Instructions', type: 'textarea', expr: true }],
    defaults: { assignee: 'Reviewer', message: 'Check the draft before it is sent.' },
    execute: async (ctx) => {
      const ok = await ctx.approval()
      if (!ok) throw new RejectedError()
      return wrap(ctx.input.items.map((i) => ({ ...i, reviewed: true })))
    },
  },
  {
    type: 'human.notify', kind: 'output', title: 'Notification', subtitle: 'Email, chat or WhatsApp', group: 'Human Interaction', availability: 'simulated', role: 'main', hasInput: true, outputs: one,
    params: [
      { key: 'channel', label: 'Channel', type: 'select', options: ['Email', 'Slack', 'Microsoft Teams', 'WhatsApp (planned)'].map((v) => ({ value: v, label: v })) },
      { key: 'to', label: 'To', type: 'text', required: true },
      { key: 'message', label: 'Message', type: 'textarea', required: true, expr: true },
    ],
    defaults: { channel: 'Email', to: 'team@company.example', message: 'Workflow finished for {{ $json.id }}' },
    execute: async (ctx) => {
      await sleepFor(ctx, 350)
      return wrap(itemsOf(ctx).map((it) => ({ ...it, notification: { channel: String(ctx.raw('channel')), to: String(ctx.raw('to')), message: String(ctx.param('message', it)), sent: 'simulated' } })))
    },
  },
  {
    type: 'output.respond', kind: 'output', title: 'Respond to Chat', subtitle: 'Reply to the caller', group: 'Human Interaction', availability: 'builtin', role: 'main', hasInput: true, outputs: one,
    params: [{ key: 'reply', label: 'Reply', type: 'textarea', required: true, expr: true }],
    defaults: { reply: '{{ $json.reply }}' },
    execute: async (ctx) =>
      wrap(itemsOf(ctx).map((it) => {
        const r = String(ctx.param('reply', it) ?? '').trim()
        return { reply: r || chatReply(it).reply, language: String(it.language ?? detectLanguage(String(it.message ?? ''))) }
      })),
  },

  // Canvas
  { type: 'note', kind: 'data', title: 'Sticky Note', subtitle: 'Document the canvas', group: 'Canvas', availability: 'builtin', role: 'note', hasInput: false, outputs: () => [], params: [], defaults: {} },
]

export class RejectedError extends Error {
  constructor() {
    super('Rejected by reviewer')
  }
}

async function sleepFor(ctx: ExecContext, ms: number) {
  await new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms)
    ctx.signal.addEventListener('abort', () => {
      clearTimeout(t)
      rej(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export function toolLabel(n: WorkflowNode) {
  const id = String(n.config.integration ?? '')
  const name = INDIA.find((i) => i.id === id)?.title ?? (id === 'http' ? 'HTTP API' : id)
  return `${name}: ${String(n.config.action ?? '')}`
}

export const REGISTRY: Record<string, NodeTypeDef> = Object.fromEntries(defs.map((d) => [d.type, d]))
export const LIBRARY = defs
export const GROUPS: LibraryGroup[] = ['Triggers', 'AI', 'AI sub-nodes', 'Logic', 'Data', 'India Stack', 'Human Interaction', 'Canvas']
export const getDef = (type: string): NodeTypeDef | undefined => REGISTRY[type]

/** Static validation for a node: required params, wiring, and node-specific rules. */
export function validateNode(node: WorkflowNode, wf: Workflow, opts?: { requireApprovalForWrites?: boolean }): Issue[] {
  const def = getDef(node.type)
  if (!def) return [{ level: 'error', message: `Unknown node type "${node.type}".` }]
  if (def.role === 'note') return []

  const rawIssues: Issue[] = []

  // Check required parameters with default fallback
  def.params.forEach((p) => {
    if (!p.required) return
    if (p.showIf) {
      const cur = node.config[p.showIf.key]
      const eq = Array.isArray(p.showIf.equals) ? p.showIf.equals.includes(cur) : cur === p.showIf.equals
      if (!eq) return
    }
    const v = node.config[p.key] ?? def.defaults[p.key]
    if (v === undefined || v === '' || (typeof v === 'string' && !v.trim())) {
      rawIssues.push({ level: 'error', message: `"${p.label}" is required.` })
    }
  })

  // Add needs configuration only if not already filled by config or default
  ;(node.needs ?? []).forEach((n) => {
    const isAssigneeNeed = /assign|approver/i.test(n)
    if (isAssigneeNeed && (node.config.assignee || def.defaults.assignee)) return
    rawIssues.push({ level: 'warning', message: `Needs configuration: ${n}` })
  })

  if (def.role === 'sub') {
    if (!wf.edges.some((e) => e.source === node.id)) rawIssues.push({ level: 'warning', message: `Attach to an AI Agent's ${def.subSlot} slot.` })
  } else if (def.hasInput && !wf.edges.some((e) => e.target === node.id && (e.targetHandle ?? 'main') === 'main')) {
    rawIssues.push({ level: 'warning', message: 'Not connected — this node will not run.' })
  }
  if (opts?.requireApprovalForWrites && def.writes?.(node.config) && !hasUpstreamApproval(node.id, wf)) {
    rawIssues.push({ level: 'warning', message: 'Governance: write action has no upstream human approval.' })
  }

  const all = [...rawIssues, ...(def.validate?.(node, wf) ?? [])]

  // Deduplicate issues by message
  const seen = new Set<string>()
  return all.filter((iss) => {
    const key = iss.message.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function hasUpstreamApproval(id: string, wf: Workflow): boolean {
  const seen = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const e of wf.edges) {
      if (e.target !== cur || seen.has(e.source)) continue
      seen.add(e.source)
      const t = wf.nodes.find((n) => n.id === e.source)?.type
      if (t === 'human.approval' || t === 'human.review') return true
      stack.push(e.source)
    }
  }
  return false
}

/** Workflow-level validation. */
export function validateWorkflow(wf: Workflow, opts?: { requireApprovalForWrites?: boolean }) {
  const byNode: Record<string, Issue[]> = {}
  wf.nodes.forEach((n) => {
    const i = validateNode(n, wf, opts)
    if (i.length) byNode[n.id] = i
  })
  const global: Issue[] = []
  if (!wf.nodes.some((n) => getDef(n.type)?.kind === 'trigger')) global.push({ level: 'error', message: 'Add a trigger node to start the workflow.' })
  const errors = global.filter((g) => g.level === 'error').length + Object.values(byNode).flat().filter((i) => i.level === 'error').length
  return { byNode, global, errors }
}
