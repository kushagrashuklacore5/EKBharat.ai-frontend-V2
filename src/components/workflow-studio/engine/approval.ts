import type { Workflow, WorkflowApproval, WorkflowEdge, WorkflowNode } from './types'

/**
 * Canonical workflow-logic hashing for approvals.
 * Covers node types, names, configuration, settings, pinned data and connections.
 * Ignores canvas positions and sticky notes, so tidying the layout does not invalidate an approval.
 *
 * KEEP IN SYNC with server/workflow-mail.js (`canonical` / `hashWorkflow`): the server
 * recomputes this hash to refuse sharing a snapshot that does not match its approval.
 */
export function stableStringify(v: unknown): string {
  if (v === undefined) return 'null'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`
}

export function canonical(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const n = nodes
    .filter((x) => x.type !== 'note')
    .map((x) => ({
      id: x.id,
      type: x.type,
      name: x.name,
      config: x.config ?? {},
      settings: x.settings && Object.values(x.settings).some((s) => s !== undefined && s !== false && s !== 'off') ? x.settings : null,
      pinned: x.pinned ?? null,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const e = edges
    .map((x) => ({ source: x.source, sourceHandle: x.sourceHandle ?? 'main', target: x.target, targetHandle: x.targetHandle ?? 'main' }))
    .sort((a, b) => {
      const ka = `${a.source}|${a.sourceHandle}|${a.target}|${a.targetHandle}`
      const kb = `${b.source}|${b.sourceHandle}|${b.target}|${b.targetHandle}`
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })
  return stableStringify({ nodes: n, edges: e })
}

function fnv(s: string, seed: number) {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** 64-bit (two independent FNV-1a passes) hex digest of the workflow logic. Not a security hash — a change detector. */
export function hashWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): string {
  const c = canonical(nodes, edges)
  return fnv(c, 2166136261) + fnv(c, 0x811c9dc5 ^ 0x5bd1e995)
}

export function makeApproval(wf: Workflow, by: string): WorkflowApproval {
  const nodes = structuredClone(wf.nodes)
  const edges = structuredClone(wf.edges)
  return { approvedAt: Date.now(), approvedBy: by, hash: hashWorkflow(nodes, edges), snapshot: { id: wf.id, name: wf.name, description: wf.description, nodes, edges } }
}

export const approvalIsCurrent = (wf: Workflow) => !!wf?.meta?.approval && wf.meta.approval.hash === hashWorkflow(wf.nodes, wf.edges)
