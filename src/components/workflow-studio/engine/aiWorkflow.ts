import { safeJson, toItems, uid } from './data'
import { getDef, validateWorkflow, type ParamField } from './registry'
import type { Item, NodeConfiguration, ParamValue, Workflow, WorkflowEdge, WorkflowNode } from './types'

/** Raw workflow as returned by the backend (shape enforced by the Groq JSON schema + server checks). */
export interface RawAiWorkflow {
  name: string
  summary: string
  purpose: 'lead_generation' | 'general'
  steps: string[]
  nodes: { id: string; type: string; name: string; config: { key: string; value: string }[]; needs: string[] }[]
  edges: { from: string; to: string; fromOutput: string; toInput: string }[]
  demoInput: string
}

export class AiWorkflowError extends Error {
  constructor(message: string, readonly problems: string[]) {
    super(message)
  }
}

const SLOT_INPUTS = new Set(['model', 'memory', 'tools'])

function coerce(field: ParamField, raw: string): { ok: true; value: ParamValue } | { ok: false; why: string } {
  const v = String(raw ?? '')
  switch (field.type) {
    case 'number': {
      const n = Number(v)
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, why: `"${v}" is not a number` }
    }
    case 'toggle':
      return { ok: true, value: /^(true|yes|1|on)$/i.test(v.trim()) }
    case 'select': {
      const o = field.options?.find((x) => x.value.toLowerCase() === v.toLowerCase() || x.label.toLowerCase() === v.toLowerCase())
      return o ? { ok: true, value: o.value } : { ok: false, why: `"${v}" is not one of ${field.options?.map((x) => x.value).join(', ')}` }
    }
    case 'json': {
      if (!v.trim()) return { ok: true, value: '' }
      // LLMs sometimes over-escape JSON embedded in a string (\" instead of ")
      const p = [v, v.replace(/\\"/g, '"').replace(/\\\\/g, '\\')].map(safeJson).find((x) => x.ok)
      return p && p.ok ? { ok: true, value: JSON.stringify(p.value, null, 2) } : { ok: false, why: 'invalid JSON' }
    }
    default:
      return { ok: true, value: v }
  }
}

/**
 * Convert and validate an LLM-generated workflow against the node registry.
 * Throws AiWorkflowError for anything the canvas cannot represent faithfully
 * (unsupported node types, impossible connections, no trigger). Recoverable gaps
 * (unknown params, missing required values) become warnings / "needs configuration".
 */
export function toStudioWorkflow(raw: RawAiWorkflow, meta: { prompt: string; model: string }): Workflow {
  const problems: string[] = []
  const warnings: string[] = []
  if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) throw new AiWorkflowError('The AI response is not a workflow.', ['missing nodes/edges'])
  if (!raw.nodes.length) throw new AiWorkflowError('The AI returned an empty workflow.', ['no nodes'])
  if (raw.nodes.length > 40) throw new AiWorkflowError('The AI returned too many nodes.', [`${raw.nodes.length} nodes (max 40)`])

  // ── nodes ───────────────────────────────
  const idMap = new Map<string, string>()
  const nodes: WorkflowNode[] = []
  for (const rn of raw.nodes) {
    const def = getDef(String(rn.type))
    if (!def || def.role === 'note') {
      problems.push(`Unsupported node type "${rn.type}".`)
      continue
    }
    if (idMap.has(rn.id)) {
      problems.push(`Duplicate node id "${rn.id}".`)
      continue
    }
    const id = uid('ai')
    idMap.set(rn.id, id)
    const config: NodeConfiguration = { ...def.defaults }
    for (const { key, value } of rn.config ?? []) {
      const field = def.params.find((p) => p.key === key)
      if (!field) {
        warnings.push(`${rn.name}: ignored unknown setting "${key}".`)
        continue
      }
      const c = coerce(field, value)
      if (c.ok) config[key] = c.value
      else warnings.push(`${rn.name}: ${field.label} — ${c.why}; kept the default.`)
    }
    const needs = (rn.needs ?? []).map((s) => String(s).slice(0, 200)).filter(Boolean)
    nodes.push({ id, type: def.type, name: String(rn.name || def.title).slice(0, 60), position: { x: 0, y: 0 }, config, ...(needs.length ? { needs } : {}) })
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // ── edges ───────────────────────────────
  const edges: WorkflowEdge[] = []
  const seen = new Set<string>()
  for (const re of raw.edges) {
    const s = byId.get(idMap.get(re.from) ?? '')
    const t = byId.get(idMap.get(re.to) ?? '')
    if (!s || !t) {
      problems.push(`Connection ${re.from} → ${re.to} references a missing node.`)
      continue
    }
    const sd = getDef(s.type)!
    const td = getDef(t.type)!
    let sourceHandle = re.fromOutput || 'main'
    let targetHandle = re.toInput || 'main'
    if (sd.role === 'sub') {
      sourceHandle = 'sub'
      targetHandle = sd.subSlot!
      if (!td.slots?.includes(sd.subSlot!)) {
        problems.push(`${s.name} (${sd.title}) can only attach to an AI Agent's ${sd.subSlot} slot, not to ${t.name}.`)
        continue
      }
    } else {
      const outs = sd.outputs(s.config).map((o) => o.id)
      if (!outs.includes(sourceHandle)) {
        if (outs.length === 1) sourceHandle = outs[0]
        else {
          problems.push(`${s.name} has no output "${re.fromOutput}" (valid: ${outs.join(', ')}).`)
          continue
        }
      }
      if (SLOT_INPUTS.has(targetHandle)) {
        problems.push(`${s.name} cannot connect to the ${targetHandle} slot of ${t.name}; only AI sub-nodes can.`)
        continue
      }
      targetHandle = 'main'
      if (!td.hasInput) {
        problems.push(`${t.name} (${td.title}) has no input, so ${s.name} cannot connect to it.`)
        continue
      }
    }
    const key = `${s.id}.${sourceHandle}>${t.id}.${targetHandle}`
    if (seen.has(key) || s.id === t.id) continue
    seen.add(key)
    edges.push({ id: key, source: s.id, sourceHandle, target: t.id, targetHandle })
  }

  // every AI Agent needs a model — attach a routed Chat Model instead of failing
  for (const n of nodes.filter((x) => getDef(x.type)?.slots?.includes('model'))) {
    if (edges.some((e) => e.target === n.id && e.targetHandle === 'model')) continue
    const m: WorkflowNode = { id: uid('ai'), type: 'sub.model', name: 'Model router', position: { x: 0, y: 0 }, config: { ...getDef('sub.model')!.defaults } }
    nodes.push(m)
    edges.push({ id: `${m.id}.sub>${n.id}.model`, source: m.id, sourceHandle: 'sub', target: n.id, targetHandle: 'model' })
    warnings.push(`${n.name}: attached an automatic Model router (every AI Agent needs a model).`)
  }

  if (!nodes.some((n) => getDef(n.type)?.kind === 'trigger')) problems.push('The workflow has no trigger node.')
  if (problems.length) throw new AiWorkflowError('The generated workflow uses nodes or connections Workflow Studio does not support.', problems)

  // demo input (fictional) goes into the trigger's test payload, marked as demo data
  const trigger = nodes.find((n) => getDef(n.type)?.kind === 'trigger')!
  const demo = raw.demoInput ? safeJson(raw.demoInput) : null
  if (demo?.ok && getDef(trigger.type)!.params.some((p) => p.key === 'payload')) {
    const items: Item[] = toItems(demo.value).slice(0, 10).map((i) => ({ ...i, _demo: true }))
    trigger.config.payload = JSON.stringify(items.length === 1 ? items[0] : items, null, 2)
  }

  layout(nodes, edges)

  const now = Date.now()
  const wf: Workflow = {
    id: uid('wf_'),
    name: String(raw.name || 'AI-generated workflow').slice(0, 70),
    description: String(raw.summary || meta.prompt).slice(0, 600),
    nodes,
    edges,
    meta: { state: 'draft', active: false, version: 0, dirty: true, createdAt: now, updatedAt: now },
    origin: 'generated',
    ai: {
      prompt: meta.prompt,
      model: meta.model,
      provider: 'groq',
      summary: String(raw.summary ?? '').slice(0, 600),
      steps: (raw.steps ?? []).map((s) => String(s).slice(0, 240)).slice(0, 12),
      purpose: raw.purpose === 'lead_generation' ? 'lead_generation' : 'general',
      missing: nodes.flatMap((n) => (n.needs ?? []).map((what) => ({ nodeId: n.id, what }))),
      warnings,
      generatedAt: now,
    },
  }
  // required values the AI could not fill → "needs configuration" on that node
  const v = validateWorkflow(wf)
  for (const [nodeId, issues] of Object.entries(v.byNode)) {
    const n = wf.nodes.find((x) => x.id === nodeId)
    const already = (n?.needs ?? []).join(' ').toLowerCase()
    const req = issues
      .filter((i) => i.level === 'error' && i.message.endsWith('is required.'))
      .map((i) => i.message.replace(' is required.', '').replace(/"/g, ''))
      // skip when the AI already explained this requirement in its own words
      .filter((label) => !new RegExp(`\\b${label.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '')}\\b`).test(already))
      .map((label) => `Provide ${label}`)
    if (n && req.length) {
      n.needs = [...new Set([...(n.needs ?? []), ...req])]
      req.forEach((what) => wf.ai!.missing.push({ nodeId, what }))
    }
  }
  return wf
}

/** Left-to-right layered layout; sub-nodes sit under the agent they serve. */
function layout(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const main = nodes.filter((n) => getDef(n.type)?.role === 'main')
  const mainEdges = edges.filter((e) => e.targetHandle === 'main')
  const depth = new Map<string, number>()
  main.filter((n) => getDef(n.type)?.kind === 'trigger').forEach((n) => depth.set(n.id, 0))
  for (let pass = 0; pass < main.length; pass++) {
    let changed = false
    for (const e of mainEdges) {
      const d = depth.get(e.source)
      if (d === undefined) continue
      if ((depth.get(e.target) ?? -1) < d + 1 && d + 1 <= main.length) {
        depth.set(e.target, d + 1)
        changed = true
      }
    }
    if (!changed) break
  }
  main.forEach((n) => !depth.has(n.id) && depth.set(n.id, 0))
  const layers = new Map<number, WorkflowNode[]>()
  main.forEach((n) => layers.set(depth.get(n.id)!, [...(layers.get(depth.get(n.id)!) ?? []), n]))
  const hasSubs = (n: WorkflowNode) => edges.some((e) => e.target === n.id && e.targetHandle !== 'main')
  layers.forEach((list, d) => {
    let y = -((list.length - 1) * 170) / 2
    list.forEach((n) => {
      n.position = { x: d * 290, y }
      y += hasSubs(n) ? 300 : 170
    })
  })
  const subs = nodes.filter((n) => getDef(n.type)?.role === 'sub')
  const perTarget = new Map<string, number>()
  subs.forEach((s) => {
    const target = nodes.find((n) => n.id === edges.find((e) => e.source === s.id)?.target)
    const i = perTarget.get(target?.id ?? '') ?? 0
    perTarget.set(target?.id ?? '', i + 1)
    s.position = target ? { x: target.position.x - 30 + i * 175, y: target.position.y + 180 } : { x: 0, y: 420 + i * 70 }
  })
}
