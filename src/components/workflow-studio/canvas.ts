import { createContext, useContext } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { getDef, type Issue } from './engine/registry'
import type { Item, NodeConfiguration, NodeSettings, StepStatus, Workflow, WorkflowEdge, WorkflowNode } from './engine/types'

/** Data carried by a React Flow node. View-only fields are injected at render time. */
export interface StudioNodeData extends Record<string, unknown> {
  type: string
  name: string
  config: NodeConfiguration
  settings?: NodeSettings
  pinned?: Item[]
  note?: string
  needs?: string[]
  // view-only
  status?: StepStatus
  issues?: Issue[]
  durationMs?: number
  slotInfo?: { model?: string; memory?: string; tools: string[] }
  usedModel?: string
}
export type StudioNodeType = Node<StudioNodeData, 'studio' | 'sub' | 'note'>

export interface FlowEdgeData extends Record<string, unknown> {
  state?: 'idle' | 'active' | 'done' | 'skipped'
  items?: number
  sub?: boolean
}
export type FlowEdgeType = Edge<FlowEdgeData, 'flow'>

const rfType = (type: string): StudioNodeType['type'] => {
  const role = getDef(type)?.role
  return role === 'sub' ? 'sub' : role === 'note' ? 'note' : 'studio'
}

export function toFlowNodes(wf: Workflow): StudioNodeType[] {
  return wf.nodes.map((n) => ({
    id: n.id,
    type: rfType(n.type),
    position: { ...n.position },
    data: { type: n.type, name: n.name, config: { ...n.config }, settings: n.settings ? { ...n.settings } : undefined, pinned: n.pinned, note: n.note, ...(n.needs?.length ? { needs: [...n.needs] } : {}) },
    ...(n.size ? { width: n.size.width, height: n.size.height } : {}),
    ...(rfType(n.type) === 'note' ? { zIndex: -1 } : {}),
  }))
}

export function toFlowEdges(wf: Workflow): FlowEdgeType[] {
  return wf.edges.map((e) => ({ ...e, type: 'flow' as const, sourceHandle: e.sourceHandle ?? 'main', targetHandle: e.targetHandle ?? 'main' }))
}

/** Convert the canvas back into an engine workflow (strips view-only fields). */
export function toWorkflow(base: Workflow, nodes: StudioNodeType[], edges: FlowEdgeType[]): Workflow {
  const wn: WorkflowNode[] = nodes.map((n) => ({
    id: n.id,
    type: n.data.type,
    name: n.data.name,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    config: n.data.config,
    ...(n.data.settings ? { settings: n.data.settings } : {}),
    ...(n.data.pinned ? { pinned: n.data.pinned } : {}),
    ...(n.data.needs?.length ? { needs: n.data.needs } : {}),
    ...(n.type === 'note' ? { note: n.data.note ?? '', size: { width: n.width ?? n.measured?.width ?? 240, height: n.height ?? n.measured?.height ?? 140 } } : {}),
  }))
  const we: WorkflowEdge[] = edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? 'main', targetHandle: e.targetHandle ?? 'main', ...(e.label ? { label: String(e.label) } : {}) }))
  return { ...base, nodes: wn, edges: we }
}

export interface StudioActions {
  readOnly: boolean
  addFrom(nodeId: string, handleId: string): void
  insertOnEdge(edgeId: string): void
  deleteEdge(edgeId: string): void
  open(nodeId: string): void
  updateNote(nodeId: string, text: string): void
}
export const StudioActionsContext = createContext<StudioActions | null>(null)
export const useStudioActions = () => useContext(StudioActionsContext)
