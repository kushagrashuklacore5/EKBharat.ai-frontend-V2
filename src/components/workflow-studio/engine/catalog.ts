import { LIBRARY } from './registry'

/**
 * A compact, serialisable description of the node registry, sent to the backend so the
 * LLM is prompted (and its output structurally checked) against exactly the nodes this
 * frontend can render and run. The registry stays the single source of truth; the
 * frontend re-validates every generated workflow against it before showing it.
 */
export interface CatalogEntry {
  type: string
  title: string
  description: string
  group: string
  availability: string
  role: 'main' | 'sub'
  hasInput: boolean
  /** static output handle ids; Switch is described by `dynamicOutputs` */
  outputs: string[]
  dynamicOutputs?: string
  slots?: string[]
  subSlot?: string
  params: { key: string; type: string; required: boolean; options?: string[]; hint?: string }[]
  /** fields this node adds to each item, so later conditions/expressions reference real fields */
  produces?: string
}

/** What each node type actually outputs (mirrors the executors in registry.ts). */
const PRODUCES: Record<string, string> = {
  'trigger.manual': 'the fields of its "payload" JSON',
  'trigger.webhook': 'the fields of its "payload" JSON',
  'trigger.schedule': 'the fields of its "payload" JSON plus fired_at',
  'trigger.chat': 'message, sessionId, language (Hindi|Tamil|Hinglish|English), channel',
  'trigger.email': 'the fields of its "payload" JSON (e.g. from, subject, attachment)',
  'trigger.form': 'the fields of its "payload" JSON (the form fields)',
  'ai.agent': 'input fields + the keys of its "sample" object + tools_called (task "chat" with empty sample adds reply, language, lead_score 0-100, qualified true/false)',
  'ai.llm': 'input fields + the keys of its "sample" object (task "chat" with empty sample adds reply, language; otherwise text)',
  'ai.classifier': 'input fields + category (one of the categories), confidence (0-1), language. Keyword-style intent labelling of short free text such as customer messages — not for scoring leads',
  'ai.knowledge': 'input fields + the keys of its "sample" object',
  'ai.docqa': 'input fields + the keys of its "sample" object (e.g. answer, citations)',
  'ai.embeddings': 'input fields + embedding_preview, dims',
  'logic.if': 'passes items unchanged to "true" or "false"',
  'logic.switch': 'passes items unchanged to the matching case output',
  'logic.merge': 'all input items (append) or one combined item (combine)',
  'logic.parallel': 'items unchanged to every connected branch',
  'logic.loop': 'one item per element of the list found at "field" (the element\'s own fields)',
  'logic.filter': 'only the items matching the condition',
  'data.json': 'input fields + the fields in its "json" template (or only those in replace mode)',
  'data.csv': 'one item per CSV row (header names become fields)',
  'data.database': 'input fields + the keys of its "sample" object',
  'data.http': 'input fields + the keys of its "sample" object (or the live JSON response)',
  'data.code': 'whatever the JavaScript returns. The "code" param is a function BODY that receives only `items` (array of objects) and must `return` an array of objects; $json and expressions are NOT available inside code, and there is no network access. Prefer ai.llm for writing summaries/reports',
  'human.approval': 'items unchanged + approved true/false on "approved"/"rejected"',
  'human.review': 'items unchanged + reviewed true',
  'human.notify': 'input fields + notification {channel,to,message}',
  'output.respond': 'reply, language',
}

export function buildCatalog(): CatalogEntry[] {
  return LIBRARY.filter((d) => d.role !== 'note').map((d) => ({
    type: d.type,
    title: d.title,
    description: d.subtitle,
    group: d.group,
    availability: d.availability,
    role: d.role as 'main' | 'sub',
    hasInput: d.hasInput,
    outputs: d.type === 'logic.switch' ? [] : d.outputs(d.defaults).map((o) => o.id),
    ...(d.type === 'logic.switch' ? { dynamicOutputs: 'one output "case-<i>" per comma-separated value in the "cases" param (0-based), plus "fallback"' } : {}),
    ...(d.slots ? { slots: d.slots } : {}),
    ...(d.subSlot ? { subSlot: d.subSlot } : {}),
    params: d.params.map((p) => ({
      key: p.key,
      type: p.type,
      required: !!p.required,
      ...(p.options ? { options: p.options.map((o) => o.value) } : {}),
      ...(p.help || p.placeholder ? { hint: (p.help ?? p.placeholder ?? '').slice(0, 120) } : {}),
    })),
    produces: PRODUCES[d.type] ?? (d.type.startsWith('india.') ? 'input fields + the keys of its "sample" object' : undefined),
  }))
}
