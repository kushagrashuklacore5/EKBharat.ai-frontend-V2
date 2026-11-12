import { uid } from './data'
import type { AuditAction, AuditEvent, Execution, GovernanceSettings, Workflow } from './types'

/**
 * Persistence abstraction. The MVP implementation keeps everything in this browser's
 * localStorage — convenient for a demo, NOT enterprise-grade persistence (single device,
 * clearable by the user, no access control). A backend implementation can replace it
 * without touching the UI.
 */
export interface StudioStore {
  loadWorkflows(): Record<string, Workflow>
  saveWorkflow(wf: Workflow): void
  deleteWorkflow(id: string): void
  loadExecutions(): Execution[]
  saveExecution(exec: Execution, retentionDays: number): Execution[]
  clearExecutions(): void
  loadAudit(): AuditEvent[]
  appendAudit(action: AuditAction, detail: string, workflowId?: string): AuditEvent[]
  loadGovernance(): GovernanceSettings
  saveGovernance(g: GovernanceSettings): void
}

const K = { wf: 'ekb.studio.v1.workflows', ex: 'ekb.studio.v1.executions', audit: 'ekb.studio.v1.audit', gov: 'ekb.studio.v1.governance' }
const MAX_EXEC = 25
const MAX_AUDIT = 200
/** No sign-in exists in the demo; every action is attributed to this local identity. */
export const LOCAL_ACTOR = 'Demo user (local, not signed in)'
export const DEFAULT_GOVERNANCE: GovernanceSettings = { maskPii: false, retentionDays: 30, requireApprovalForWrites: false }

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false // private mode, quota exceeded or storage blocked — the editor keeps working in memory
  }
}

export const localStore: StudioStore = {
  loadWorkflows: () => read<Record<string, Workflow>>(K.wf, {}),
  saveWorkflow(wf) {
    const all = read<Record<string, Workflow>>(K.wf, {})
    all[wf.id] = wf
    write(K.wf, all)
  },
  deleteWorkflow(id) {
    const all = read<Record<string, Workflow>>(K.wf, {})
    delete all[id]
    write(K.wf, all)
  },
  loadExecutions: () => read<Execution[]>(K.ex, []),
  saveExecution(exec, retentionDays) {
    const cutoff = Date.now() - retentionDays * 86_400_000
    const list = [exec, ...read<Execution[]>(K.ex, []).filter((e) => e.id !== exec.id && e.startedAt >= cutoff)].slice(0, MAX_EXEC)
    // if storage is full, retry with fewer entries
    for (let n = list.length; n > 0 && !write(K.ex, list.slice(0, n)); n = Math.floor(n / 2));
    return list
  },
  clearExecutions: () => void write(K.ex, []),
  loadAudit: () => read<AuditEvent[]>(K.audit, []),
  appendAudit(action, detail, workflowId) {
    const list = [{ id: uid('au_'), at: Date.now(), actor: LOCAL_ACTOR, action, detail, workflowId }, ...read<AuditEvent[]>(K.audit, [])].slice(0, MAX_AUDIT)
    write(K.audit, list)
    return list
  },
  loadGovernance: () => ({ ...DEFAULT_GOVERNANCE, ...read<Partial<GovernanceSettings>>(K.gov, {}) }),
  saveGovernance: (g) => void write(K.gov, g),
}

/** Serialize a workflow for export (strips runtime-only meta). */
export function exportWorkflow(wf: Workflow): string {
  return JSON.stringify({ format: 'ekbharat.workflow', version: 1, workflow: { name: wf.name, description: wf.description, nodes: wf.nodes, edges: wf.edges } }, null, 2)
}

/** Parse and validate an imported workflow file. Throws with a readable message on bad input. */
export function importWorkflow(text: string, knownTypes: (t: string) => boolean): Workflow {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  const body = (raw as { workflow?: unknown }).workflow ?? raw
  const w = body as Partial<Workflow>
  if (!w || !Array.isArray(w.nodes) || !Array.isArray(w.edges)) throw new Error('Expected an object with "nodes" and "edges" arrays.')
  const ids = new Set<string>()
  for (const n of w.nodes) {
    if (!n || typeof n.id !== 'string' || typeof n.type !== 'string' || !n.position) throw new Error('Every node needs id, type and position.')
    if (!knownTypes(n.type)) throw new Error(`Unknown node type "${n.type}".`)
    ids.add(n.id)
  }
  for (const e of w.edges) if (!e || !ids.has(e.source) || !ids.has(e.target)) throw new Error('An edge references a node that does not exist.')
  const now = Date.now()
  return {
    id: uid('wf_'),
    name: `${String(w.name ?? 'Imported workflow')}`.slice(0, 80),
    description: String(w.description ?? 'Imported from JSON.'),
    nodes: w.nodes.map((n) => ({ ...n, name: String(n.name ?? n.type), config: n.config ?? {} })),
    edges: w.edges,
    meta: { state: 'draft', active: false, version: 0, dirty: true, createdAt: now, updatedAt: now },
    origin: 'imported',
  }
}
