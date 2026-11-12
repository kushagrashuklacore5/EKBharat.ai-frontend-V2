/**
 * Shared, UI-independent types for Workflow Studio.
 * The engine only depends on these — never on React or React Flow — so the same
 * definitions can later be sent to a backend execution service unchanged.
 */

/** Visual/functional family of a node. Drives colour, icon and silhouette. */
export type NodeKind =
  | 'trigger'
  | 'agent'
  | 'llm'
  | 'knowledge'
  | 'condition'
  | 'database'
  | 'integration'
  | 'human'
  | 'output'
  | 'parallel'
  | 'data'
  | 'model'
  | 'memory'
  | 'tool'

/** JSON-compatible value carried between nodes. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }
/** One item flowing through the workflow (n8n-style: nodes process arrays of items). */
export type Item = { [k: string]: JsonValue }

/** What a node receives: all items from its fired incoming edges, merged. */
export interface NodeInput {
  items: Item[]
  /** per incoming edge, for nodes that care about provenance (e.g. Merge) */
  bySource: { edgeId: string; sourceId: string; items: Item[] }[]
}

/** What a node produces: one item array per output handle (index aligns with the node type's outputs). */
export interface NodeOutput {
  outputs: Item[][]
}

export type ParamValue = string | number | boolean
/** A node's configuration, keyed by parameter name. */
export type NodeConfiguration = Record<string, ParamValue>

export interface NodeSettings {
  /** retry automatically on failure */
  retryOnFail?: boolean
  maxTries?: number
  /** keep going with an error item instead of stopping the run */
  continueOnFail?: boolean
  /** demo-only failure injection */
  simulateFailure?: 'off' | 'once' | 'always'
}

export interface WorkflowNode {
  id: string
  /** node type id from the registry, e.g. "logic.if" */
  type: string
  name: string
  position: { x: number; y: number }
  config: NodeConfiguration
  settings?: NodeSettings
  /** pinned output used instead of executing (main output only) */
  pinned?: Item[]
  /** sticky-note text (type "note") */
  note?: string
  size?: { width: number; height: number }
  /** what the user still has to provide before this node can do real work (set by the AI generator) */
  needs?: string[]
}

export interface WorkflowEdge {
  id: string
  source: string
  /** output handle id on the source node, e.g. "main", "true", "false", "case-1", "sub" */
  sourceHandle?: string | null
  target: string
  /** input handle id on the target: "main", or an agent slot "model" | "memory" | "tools" */
  targetHandle?: string | null
  label?: string
}

export type WorkflowState = 'draft' | 'published'

export interface WorkflowMeta {
  state: WorkflowState
  active: boolean
  version: number
  /** true when edited after the last publish */
  dirty: boolean
  updatedAt: number
  createdAt: number
  /** user approval of an exact workflow snapshot (AI-generated workflows) */
  approval?: WorkflowApproval
  /** set when an approval was invalidated by an edit */
  approvalInvalidatedAt?: number
}

/** The workflow logic a user approved. Positions and sticky notes are not part of it. */
export interface WorkflowApproval {
  approvedAt: number
  approvedBy: string
  /** hash of the canonical workflow logic (see engine/approval.ts — mirrored on the server) */
  hash: string
  snapshot: { id: string; name: string; description: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }
}

/** How an AI-generated workflow was produced. */
export interface AiGeneration {
  prompt: string
  model: string
  provider: 'groq' | 'rules'
  summary: string
  steps: string[]
  purpose: 'lead_generation' | 'general'
  missing: { nodeId: string; what: string }[]
  warnings: string[]
  generatedAt: number
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  meta: WorkflowMeta
  /** origin, for UI: built-in template, user-created, imported, or generated */
  origin: 'template' | 'custom' | 'imported' | 'generated'
  ai?: AiGeneration
}

// ── Model routing ─────────────────────────────────────────

export type RoutingStrategy = 'quality' | 'cost' | 'latency' | 'balanced'
export type AiTask = 'classify' | 'extract' | 'reason' | 'generate' | 'chat' | 'embed'

export interface ModelInfo {
  id: string
  label: string
  provider: 'Google' | 'Anthropic' | 'Sarvam' | 'Local'
  /** 1–5 relative scores used by the router (illustrative) */
  quality: number
  speed: number
  indic: number
  /** demo rates in INR per 1M tokens — NOT provider billing */
  inrPerMInput: number
  inrPerMOutput: number
  /** baseline latency in ms + ms per output token (simulation) */
  baseLatencyMs: number
  msPerToken: number
}

export interface ModelRoutingResult {
  strategy: RoutingStrategy
  task: AiTask
  language: string
  selected: string
  fallback: string | null
  reason: string
  /** set when the selected model failed and the fallback served the request */
  usedFallback: boolean
  candidates: { id: string; score: number }[]
}

export interface ModelUsage {
  nodeId: string
  nodeName: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  costInr: number
  /** "simulated" = deterministic demo adapter, "backend" = reported by server */
  source: 'simulated' | 'backend'
}

// ── Execution ─────────────────────────────────────────────

export type StepStatus = 'queued' | 'running' | 'success' | 'error' | 'waiting' | 'skipped' | 'rejected' | 'canceled'
export type ExecutionStatus = 'running' | 'success' | 'error' | 'canceled' | 'waiting'
export type ExecutionMode = 'full' | 'step' | 'chat' | 'retry'

export interface ExecutionStep {
  nodeId: string
  nodeName: string
  nodeType: string
  status: StepStatus
  startedAt?: number
  finishedAt?: number
  input: NodeInput
  output?: NodeOutput
  error?: string
  attempts: number
  pinned?: boolean
  routing?: ModelRoutingResult
  usage?: ModelUsage
  notes?: string[]
}

export interface LogLine {
  at: number
  nodeId?: string
  text: string
  tone: 'info' | 'ok' | 'warn' | 'err'
}

export interface Execution {
  id: string
  workflowId: string
  workflowName: string
  mode: ExecutionMode
  triggerType: string
  status: ExecutionStatus
  startedAt: number
  finishedAt?: number
  steps: Record<string, ExecutionStep>
  /** item count that travelled along each edge (absent = not fired) */
  edgeItems: Record<string, number>
  logs: LogLine[]
  usage: ModelUsage[]
  /** node that failed or awaited approval, if any */
  haltedAt?: string
  /** true when all AI metrics come from the simulation adapter */
  simulated: boolean
}

// ── Integrations & governance ─────────────────────────────

/**
 * builtin   – runs for real in the browser (logic, data transforms, HTTP with CORS)
 * simulated – a demo adapter returns sample data; the real connector is part of the managed product
 * planned   – connector on the roadmap; a demo adapter returns sample data
 */
export type Availability = 'builtin' | 'simulated' | 'planned'

export interface Integration {
  id: string
  name: string
  monogram: string
  color: string
  availability: Availability
  /** whether credentials are configured — always false in the browser demo */
  configured: boolean
}

export interface ApprovalEvent {
  executionId: string
  nodeId: string
  decision: 'approved' | 'rejected'
  actor: string
  at: number
  comment?: string
}

export type AuditAction =
  | 'workflow.created'
  | 'workflow.updated'
  | 'workflow.published'
  | 'workflow.activated'
  | 'workflow.deactivated'
  | 'workflow.imported'
  | 'workflow.exported'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.canceled'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.rejected'
  | 'governance.updated'
  | 'workflow.generated'
  | 'workflow.approved'
  | 'workflow.approval_invalidated'
  | 'workflow.emailed'

export interface AuditEvent {
  id: string
  at: number
  actor: string
  action: AuditAction
  workflowId?: string
  detail: string
}

export interface GovernanceSettings {
  /** mask phone numbers, emails, GSTIN/PAN in data views and logs */
  maskPii: boolean
  /** days to keep local execution history */
  retentionDays: number
  /** require a human approval before any India-stack write action */
  requireApprovalForWrites: boolean
}
