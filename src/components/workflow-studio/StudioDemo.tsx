import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useNodesInitialized,
  type Connection,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import {
  Check, ChevronRight, CircleDot, Download, History, Keyboard, MessageSquare, MousePointerClick, PanelLeft, Play, Plus, Redo2, RotateCcw, ShieldCheck, SlidersHorizontal, Square, StickyNote, Undo2, Upload, X,
} from 'lucide-react'
import { KIND_META, WORKFLOWS, cloneWorkflow } from './workflows'
import { FlowEdge, NoteNode, StudioNode, SubNode } from './StudioNode'
import { NodeInspector } from './NodeInspector'
import { DRAG_MIME, NodeLibrary } from './NodeLibrary'
import { ChatPanel, ExecutionsPanel, GovernancePanel, type ChatMsg } from './Panels'
import { WatchRun } from './WatchRun'
import { StudioActionsContext, toFlowEdges, toFlowNodes, toWorkflow, type FlowEdgeType, type StudioActions, type StudioNodeType } from './canvas'
import { useHistory } from './useHistory'
import { studioBus } from './studioBus'
import { getDef, toolLabel, validateWorkflow, type NodeTypeDef } from './engine/registry'
import { runWorkflow, summarize } from './engine/executor'
import { formatInr, modelLabel, provider } from './engine/routing'
import { resolveExpr, uid } from './engine/data'
import { exportWorkflow, importWorkflow, localStore as store, LOCAL_ACTOR } from './engine/store'
import { hashWorkflow, makeApproval } from './engine/approval'
import { ApprovalBar } from './ApprovalBar'
import { generateWithGroq } from './aiClient'
import type { AuditAction, Execution, ExecutionMode, GovernanceSettings, Item, Workflow } from './engine/types'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const nodeTypes: NodeTypes = { studio: StudioNode, sub: SubNode, note: NoteNode }
const edgeTypes: EdgeTypes = { flow: FlowEdge }

type Panel = 'inspector' | 'chat' | 'runs' | 'governance'
type PaletteCtx = { mode: 'free' } | { mode: 'from'; nodeId: string; handle: string } | { mode: 'edge'; edgeId: string }
type Snap = { nodes: StudioNodeType[]; edges: FlowEdgeType[] }

const mainWithInput = (d: NodeTypeDef) => d.role === 'main' && d.hasInput
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/** Load templates (with any locally saved edits) plus custom workflows. Stale saved copies are dropped. */
function initialCatalog(): Record<string, Workflow> {
  const stored = store.loadWorkflows()
  const valid = (w: Workflow) => Array.isArray(w?.nodes) && w.nodes.every((n) => !!getDef(n.type))
  const out: Record<string, Workflow> = {}
  WORKFLOWS.forEach((t) => (out[t.id] = stored[t.id] && valid(stored[t.id]) ? stored[t.id] : cloneWorkflow(t)))
  Object.values(stored)
    .filter((w) => !out[w.id] && valid(w))
    .sort((a, b) => a.meta.createdAt - b.meta.createdAt)
    .forEach((w) => (out[w.id] = w))
  return out
}

function blankWorkflow(): Workflow {
  const now = Date.now()
  return {
    id: uid('wf_'),
    name: 'Untitled workflow',
    description: 'A new workflow. Press Tab on the canvas or drag from the library to add nodes.',
    origin: 'custom',
    meta: { state: 'draft', active: false, version: 0, dirty: true, createdAt: now, updatedAt: now },
    nodes: [
      { id: uid('n'), type: 'trigger.manual', name: 'Manual Trigger', position: { x: 0, y: 0 }, config: { ...getDef('trigger.manual')!.defaults } },
      { id: uid('n'), type: 'note', name: 'Note', position: { x: 0, y: 140 }, config: {}, note: 'Tip: hover a node and press + to add the next step, or press Tab to search nodes.', size: { width: 260, height: 100 } },
    ],
    edges: [],
  }
}

function Studio() {
  const [catalog, setCatalog] = useState<Record<string, Workflow>>(initialCatalog)
  const [wfId, setWfId] = useState(WORKFLOWS[0].id)
  const base = catalog[wfId] ?? catalog[WORKFLOWS[0].id]
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNodeType>(toFlowNodes(base))
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(toFlowEdges(base))
  const [executions, setExecutions] = useState<Execution[]>(() => store.loadExecutions())
  const [live, setLive] = useState<Execution | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('inspector')
  const [palette, setPalette] = useState<PaletteCtx | null>(null)
  const [libOpen, setLibOpen] = useState(true)
  const [gov, setGov] = useState<GovernanceSettings>(() => store.loadGovernance())
  const [audit, setAudit] = useState(() => store.loadAudit())
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [approvalFor, setApprovalFor] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const narrow = useMediaQuery('(max-width: 767px)')
  const [view, setView] = useState<'canvas' | 'watch'>('canvas')
  const finePointer = useMediaQuery('(pointer: fine)')
  const wide = useMediaQuery('(min-width: 1024px)')
  const { screenToFlowPosition, fitView } = useReactFlow()

  const abortRef = useRef<AbortController | null>(null)
  const approvalRef = useRef<((ok: boolean) => void) | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const clipboard = useRef<Snap | null>(null)
  const savedSig = useRef('')
  const sessionId = useRef(uid('chat_'))
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  useEffect(() => setView(narrow ? 'watch' : 'canvas'), [narrow])

  // fit once nodes are measured (the canvas is lazy-mounted, so the initial fitView can run before layout settles)
  const nodesReady = useNodesInitialized()
  useEffect(() => {
    if (nodesReady) requestAnimationFrame(() => fitView({ padding: 0.12, maxZoom: 1 }))
  }, [nodesReady, wfId, view, fitView])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200)
  }, [])
  const log = useCallback((action: AuditAction, detail: string, id?: string) => setAudit(store.appendAudit(action, detail, id)), [])

  // ── history (undo / redo) ─────────────────────────────
  const getSnap = useCallback((): Snap => ({ nodes: nodesRef.current, edges: edgesRef.current }), [])
  const applySnap = useCallback(
    (s: Snap) => {
      setNodes(s.nodes)
      setEdges(s.edges)
    },
    [setNodes, setEdges],
  )
  const hist = useHistory<Snap>(getSnap, applySnap)

  // ── derived workflow, validation, execution in view ───
  const wf = useMemo(() => toWorkflow(base, nodes, edges), [base, nodes, edges])
  const validation = useMemo(() => validateWorkflow(wf, gov), [wf, gov])
  const viewing = viewingId ? executions.find((e) => e.id === viewingId) ?? null : null
  const exec = viewing ?? (live && live.workflowId === wfId ? live : null)
  const readOnly = !!viewing
  const locked = readOnly || running
  // approval of AI-generated workflows: valid only while the logic hash still matches
  const logicHash = useMemo(() => hashWorkflow(wf.nodes, wf.edges), [wf.nodes, wf.edges])
  const approvalCurrent = !!base.meta.approval && base.meta.approval.hash === logicHash
  const aiResult = useMemo(() => {
    const ap = base.meta.approval
    if (!ap || !approvalCurrent) return null
    return executions.find((e) => e.workflowId === wfId && (e.mode === 'full' || e.mode === 'retry') && e.startedAt >= ap.approvedAt) ?? null
  }, [executions, wfId, base.meta.approval, approvalCurrent])

  // ── auto-save (debounced) ─────────────────────────────
  useEffect(() => {
    const sig = JSON.stringify([wf.nodes, wf.edges])
    if (!savedSig.current) {
      savedSig.current = sig
      return
    }
    if (sig === savedSig.current || readOnly) return
    const t = window.setTimeout(() => {
      savedSig.current = sig
      const next: Workflow = { ...wf, meta: { ...wf.meta, dirty: true, updatedAt: Date.now() } }
      store.saveWorkflow(next)
      setCatalog((c) => ({ ...c, [next.id]: next }))
      const last = store.loadAudit()[0]
      if (!(last?.action === 'workflow.updated' && last.workflowId === next.id && Date.now() - last.at < 120_000)) log('workflow.updated', `Edited “${next.name}”`, next.id)
    }, 700)
    return () => window.clearTimeout(t)
  }, [wf, readOnly, log])

  // ── workflow switching ────────────────────────────────
  const load = useCallback(
    (id: string, source?: Record<string, Workflow>) => {
      const next = (source ?? catalog)[id]
      if (!next) return
      abortRef.current?.abort()
      approvalRef.current = null
      setWfId(id)
      const ns = toFlowNodes(next)
      const es = toFlowEdges(next)
      setNodes(ns)
      setEdges(es)
      savedSig.current = JSON.stringify([toWorkflow(next, ns, es).nodes, toWorkflow(next, ns, es).edges])
      hist.clear()
      setLive(null)
      setViewingId(null)
      setSelectedId(null)
      setModalId(null)
      setApprovalFor(null)
      setChat([])
      setPalette(null)
      requestAnimationFrame(() => fitView({ padding: 0.12, maxZoom: 1, duration: 500 }))
    },
    [catalog, setNodes, setEdges, fitView, hist],
  )

  const addWorkflow = useCallback(
    (w: Workflow, action: AuditAction, detail: string) => {
      store.saveWorkflow(w)
      const next = { ...catalog, [w.id]: w }
      setCatalog(next)
      load(w.id, next)
      log(action, detail, w.id)
    },
    [catalog, load, log],
  )

  // requests from the page (templates list, workflow generator)
  useEffect(
    () =>
      studioBus.subscribe((r) => {
        if (r.kind === 'template') load(r.id)
        else
          addWorkflow(
            r.workflow,
            r.workflow.origin === 'generated' ? 'workflow.generated' : 'workflow.created',
            `Generated “${r.workflow.name}”${r.workflow.ai ? ` with ${r.workflow.ai.provider === 'groq' ? `Groq (${r.workflow.ai.model})` : 'rules'}` : ''}`,
          )
      }),
    [load, addWorkflow],
  )

  // ── execution ─────────────────────────────────────────
  const startRun = async (o: { mode: ExecutionMode; triggerData?: Item[]; destination?: string; retryFrom?: string; previous?: Execution; liveAi?: boolean }) => {
    if (running) return null
    if (validation.global.some((g) => g.level === 'error')) {
      flash(validation.global[0].message)
      return null
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setViewingId(null)
    setRunning(true)
    log('execution.started', `${o.mode} run of “${wf.name}”`, wf.id)
    const result = await runWorkflow({
      workflow: wf,
      mode: o.mode,
      liveAi: o.liveAi,
      triggerData: o.triggerData,
      destination: o.destination,
      retryFrom: o.retryFrom,
      previous: o.previous,
      signal: ctrl.signal,
      onUpdate: setLive,
      requestApproval: (nodeId) =>
        new Promise<boolean>((resolve, reject) => {
          approvalRef.current = resolve
          setApprovalFor(nodeId)
          setSelectedId(nodeId)
          log('approval.requested', `Approval requested at “${nodesRef.current.find((n) => n.id === nodeId)?.data.name}”`, wf.id)
          ctrl.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    }).catch((err: unknown): Execution | null => {
      flash(`Run failed: ${err instanceof Error ? err.message : String(err)}`)
      return null
    })
    setRunning(false)
    setApprovalFor(null)
    approvalRef.current = null
    if (abortRef.current === ctrl) abortRef.current = null
    if (!result) return null
    setExecutions(store.saveExecution(result, gov.retentionDays))
    const s = summarize(result)
    const detail = `“${result.workflowName}” #${result.id.slice(3, 11)} · ${(s.durationMs / 1000).toFixed(1)}s · ${s.tokens} tokens`
    log(result.status === 'success' ? 'execution.completed' : result.status === 'canceled' ? 'execution.canceled' : 'execution.failed', detail, wf.id)
    if (result.status === 'error' && result.haltedAt) setSelectedId(result.haltedAt)
    return result
  }

  const decide = (ok: boolean) => {
    const node = nodes.find((n) => n.id === approvalFor)
    log(ok ? 'approval.granted' : 'approval.rejected', `“${node?.data.name}” ${ok ? 'approved' : 'rejected'}`, wf.id)
    approvalRef.current?.(ok)
    approvalRef.current = null
    setApprovalFor(null)
  }
  const stop = () => abortRef.current?.abort()
  const previousFor = () => (live && live.workflowId === wfId ? live : executions.find((e) => e.workflowId === wfId))
  const executeStep = (id: string) => void startRun({ mode: 'step', destination: id, previous: previousFor() ?? undefined })
  const retry = () => {
    const prev = exec ?? previousFor()
    if (prev?.haltedAt) void startRun({ mode: 'retry', retryFrom: prev.haltedAt, previous: prev })
  }
  const clearRun = () => {
    setLive(null)
    setViewingId(null)
  }

  const sendChat = async (text: string) => {
    setChat((c) => [...c, { id: uid('m'), role: 'user', text }])
    const r = await startRun({ mode: 'chat', triggerData: [{ message: text, sessionId: sessionId.current }] })
    if (!r) return
    const replies = Object.values(r.steps)
      .filter((s) => s.nodeType === 'output.respond' && s.status === 'success')
      .flatMap((s) => s.output?.outputs[0] ?? [])
    const s = summarize(r)
    const models = [...new Set(r.usage.map((u) => modelLabel(u.model)))].join(', ')
    if (replies.length)
      replies.forEach((it) =>
        setChat((c) => [...c, { id: uid('m'), role: 'bot', text: String(it.reply ?? ''), meta: `${String(it.language ?? '')} · ${(s.durationMs / 1000).toFixed(1)}s · ${formatInr(s.cost)}${models ? ` · ${models}` : ''}${r.simulated ? ' · simulated' : ''}` }]),
      )
    else setChat((c) => [...c, { id: uid('m'), role: 'system', text: `Run ${r.status} without a chat reply — add a “Respond to Chat” node.` }])
  }

  // ── editing ───────────────────────────────────────────
  const uniqueName = (title: string) => {
    const names = new Set(nodesRef.current.map((n) => n.data.name))
    if (!names.has(title)) return title
    let i = 2
    while (names.has(`${title} ${i}`)) i++
    return `${title} ${i}`
  }

  const addNode = (type: string, ctx: PaletteCtx | { mode: 'drop'; x: number; y: number } = { mode: 'free' }) => {
    const def = getDef(type)
    if (!def || locked) return
    hist.snapshot()
    const id = uid('n')
    let position: { x: number; y: number }
    const extraEdges: FlowEdgeType[] = []
    let removeEdge: string | null = null
    if (ctx.mode === 'drop') position = { x: ctx.x, y: ctx.y }
    else if (ctx.mode === 'from') {
      const src = nodesRef.current.find((n) => n.id === ctx.nodeId)
      const outs = src ? getDef(src.data.type)?.outputs(src.data.config) ?? [] : []
      const idx = Math.max(0, outs.findIndex((o) => o.id === ctx.handle))
      position = { x: (src?.position.x ?? 0) + 280, y: (src?.position.y ?? 0) + (outs.length > 1 ? (idx - (outs.length - 1) / 2) * 130 : 0) }
      extraEdges.push({ id: uid('e'), source: ctx.nodeId, sourceHandle: ctx.handle, target: id, targetHandle: 'main', type: 'flow' })
    } else if (ctx.mode === 'edge') {
      const e = edgesRef.current.find((x) => x.id === ctx.edgeId)
      const s = nodesRef.current.find((n) => n.id === e?.source)
      const t = nodesRef.current.find((n) => n.id === e?.target)
      position = s && t ? { x: (s.position.x + t.position.x) / 2, y: (s.position.y + t.position.y) / 2 + 40 } : { x: 0, y: 0 }
      if (e) {
        removeEdge = e.id
        extraEdges.push({ id: uid('e'), source: e.source, sourceHandle: e.sourceHandle, target: id, targetHandle: 'main', type: 'flow' })
        extraEdges.push({ id: uid('e'), source: id, sourceHandle: 'main', target: e.target, targetHandle: e.targetHandle, type: 'flow' })
      }
    } else {
      const r = wrapRef.current!.getBoundingClientRect()
      position = screenToFlowPosition({ x: r.left + r.width / 2 - 100, y: r.top + r.height / 2 - 30 })
    }
    const node: StudioNodeType = {
      id,
      type: def.role === 'sub' ? 'sub' : def.role === 'note' ? 'note' : 'studio',
      position,
      data: { type, name: uniqueName(def.title), config: { ...def.defaults }, ...(def.role === 'note' ? { note: '' } : {}) },
      selected: true,
      ...(def.role === 'note' ? { width: 240, height: 130, zIndex: -1 } : {}),
    }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node])
    setEdges((es) => [...es.filter((e) => e.id !== removeEdge), ...extraEdges])
    setSelectedId(def.role === 'note' ? null : id)
    setPanel('inspector')
    setLibOpen(false)
    setPalette(null)
    clearRun()
  }

  const isValidConnection = useCallback((c: Edge | Connection) => {
    if (c.source === c.target) return false
    const src = nodesRef.current.find((n) => n.id === c.source)
    const tgt = nodesRef.current.find((n) => n.id === c.target)
    const sd = src && getDef(src.data.type)
    const td = tgt && getDef(tgt.data.type)
    if (!sd || !td) return false
    const th = c.targetHandle ?? 'main'
    if (sd.role === 'sub') return !!td.slots?.includes(sd.subSlot!) && th === sd.subSlot && !(sd.subSlot !== 'tools' && edgesRef.current.some((e) => e.target === c.target && e.targetHandle === th))
    if (th !== 'main' || !td.hasInput) return false
    return !edgesRef.current.some((e) => e.source === c.source && e.target === c.target && (e.sourceHandle ?? 'main') === (c.sourceHandle ?? 'main'))
  }, [])

  const onConnect = useCallback(
    (c: Connection) => {
      hist.snapshot()
      setEdges((es) => addEdge({ ...c, id: uid('e'), type: 'flow' }, es))
      setLive(null)
    },
    [setEdges, hist],
  )

  const updateNode = (id: string, patch: Partial<StudioNodeType['data']>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))

  const deleteNodes = (ids: string[]) => {
    if (locked || !ids.length) return
    hist.snapshot()
    setNodes((ns) => ns.filter((n) => !ids.includes(n.id)))
    setEdges((es) => es.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)))
    setSelectedId(null)
    setModalId(null)
  }

  const copy = () => {
    const sel = nodesRef.current.filter((n) => n.selected)
    if (!sel.length) return
    const ids = new Set(sel.map((n) => n.id))
    clipboard.current = { nodes: sel, edges: edgesRef.current.filter((e) => ids.has(e.source) && ids.has(e.target)) }
    try {
      void navigator.clipboard?.writeText(exportWorkflow({ ...wf, nodes: wf.nodes.filter((n) => ids.has(n.id)), edges: wf.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) }))
    } catch {
      /* system clipboard unavailable — the in-app clipboard still works */
    }
    flash(`Copied ${sel.length} node${sel.length > 1 ? 's' : ''}`)
  }
  const paste = () => {
    const c = clipboard.current
    if (!c || locked) return
    hist.snapshot()
    const map = new Map(c.nodes.map((n) => [n.id, uid('n')]))
    const ns = c.nodes.map((n) => ({ ...n, id: map.get(n.id)!, position: { x: n.position.x + 48, y: n.position.y + 48 }, selected: true, data: { ...n.data, name: uniqueName(n.data.name) } }))
    const es = c.edges.map((e) => ({ ...e, id: uid('e'), source: map.get(e.source)!, target: map.get(e.target)!, selected: false }))
    setNodes((cur) => [...cur.map((n) => ({ ...n, selected: false })), ...ns])
    setEdges((cur) => [...cur, ...es])
    clipboard.current = { nodes: ns, edges: es }
  }

  const actions: StudioActions = {
    readOnly: locked,
    addFrom: (nodeId, handle) => setPalette({ mode: 'from', nodeId, handle }),
    insertOnEdge: (edgeId) => setPalette({ mode: 'edge', edgeId }),
    deleteEdge: (edgeId) => {
      hist.snapshot()
      setEdges((es) => es.filter((e) => e.id !== edgeId))
    },
    open: (id) => {
      setSelectedId(id)
      setModalId(id)
    },
    updateNote: (id, text) => updateNode(id, { note: text }),
  }

  // ── publish / activate / import / export ─────────────
  const setMeta = (patch: Partial<Workflow['meta']>, action: AuditAction, detail: string) => {
    const next: Workflow = { ...wf, meta: { ...wf.meta, ...patch, updatedAt: Date.now() } }
    store.saveWorkflow(next)
    setCatalog((c) => ({ ...c, [next.id]: next }))
    log(action, detail, next.id)
  }
  const publish = () => {
    if (validation.errors) return flash(`Fix ${validation.errors} error${validation.errors > 1 ? 's' : ''} before publishing`)
    const v = wf.meta.version + 1
    setMeta({ state: 'published', version: v, dirty: false }, 'workflow.published', `Published “${wf.name}” v${v}`)
    flash(`Published v${v} (saved in this browser)`)
  }
  const toggleActive = () => {
    if (!wf.meta.active && (wf.meta.state !== 'published' || validation.errors)) return flash('Publish a valid version before activating')
    const on = !wf.meta.active
    setMeta({ active: on }, on ? 'workflow.activated' : 'workflow.deactivated', `${on ? 'Activated' : 'Deactivated'} “${wf.name}”`)
    if (on) flash('Marked active. Live triggers need the managed runtime — not available in this demo.')
  }

  // ── AI workflow approval (generated workflows) ───────
  const approve = () => {
    if (validation.errors) {
      const first = Object.entries(validation.byNode).find(([, is]) => is.some((i) => i.level === 'error'))?.[0]
      if (first) (setSelectedId(first), setPanel('inspector'))
      return flash(validation.global[0]?.message ?? `Fix ${validation.errors} error${validation.errors > 1 ? 's' : ''} before approving`)
    }
    const ap = makeApproval(wf, LOCAL_ACTOR)
    setMeta({ approval: ap, approvalInvalidatedAt: undefined }, 'workflow.approved', `Approved “${wf.name}” (fingerprint ${ap.hash})`)
    flash('Workflow approved')
  }
  const editAi = () => {
    const target = nodes.find((n) => n.data.needs?.length) ?? nodes.find((n) => n.type === 'studio')
    if (target) setSelectedId(target.id)
    setPanel('inspector')
    flash('Click any step to edit it. Changes after approval require approving again.')
  }
  const [regenerating, setRegenerating] = useState(false)
  const regenerate = async () => {
    const prompt = wf.ai?.prompt
    if (!prompt || regenerating) return
    if (!window.confirm('Replace this workflow with a new AI-generated version? Your edits to it will be lost.')) return
    setRegenerating(true)
    try {
      const { workflow } = await generateWithGroq(prompt)
      const next: Workflow = { ...workflow, id: wf.id, meta: { ...workflow.meta, createdAt: wf.meta.createdAt } }
      store.saveWorkflow(next)
      const cat = { ...catalog, [next.id]: next }
      setCatalog(cat)
      load(next.id, cat)
      log('workflow.generated', `Regenerated “${next.name}” with Groq (${workflow.ai?.model})`, next.id)
    } catch (e) {
      flash(`Regeneration failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRegenerating(false)
    }
  }
  const runApproved = async (live?: boolean) => {
    if (!approvalCurrent) return flash('Approve the current version first')
    await startRun({ mode: 'full', liveAi: live ?? true })
  }
  const retryApproved = async () => {
    if (aiResult?.haltedAt && approvalCurrent) await startRun({ mode: 'retry', retryFrom: aiResult.haltedAt, previous: aiResult })
  }
  // any change to the approved logic revokes the approval (it can never be reused for running or sharing)
  useEffect(() => {
    if (!base.meta.approval || approvalCurrent || readOnly) return
    setMeta({ approval: undefined, approvalInvalidatedAt: Date.now() }, 'workflow.approval_invalidated', `Approval of “${wf.name}” invalidated by an edit`)
    flash('The workflow changed — approval invalidated. Approve again to run or share it.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalCurrent, base.meta.approval, readOnly])
  const doExport = () => {
    const blob = new Blob([exportWorkflow(wf)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${wf.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow'}.workflow.json`
    a.click()
    URL.revokeObjectURL(a.href)
    log('workflow.exported', `Exported “${wf.name}”`, wf.id)
  }
  const doImport = async (file: File) => {
    try {
      const w = importWorkflow(await file.text(), (t) => !!getDef(t))
      addWorkflow(w, 'workflow.imported', `Imported “${w.name}” from ${file.name}`)
      flash(`Imported “${w.name}”`)
    } catch (e) {
      flash(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const restoreTemplate = () => {
    const t = WORKFLOWS.find((w) => w.id === wfId)
    if (!t) return
    store.deleteWorkflow(t.id)
    const next = { ...catalog, [t.id]: cloneWorkflow(t) }
    setCatalog(next)
    load(t.id, next)
    flash('Template restored')
  }
  const removeWorkflow = (id: string) => {
    if (!window.confirm('Delete this workflow from this browser?')) return
    store.deleteWorkflow(id)
    const next = { ...catalog }
    delete next[id]
    setCatalog(next)
    if (id === wfId) load(WORKFLOWS[0].id, next)
  }
  const renameWorkflow = (name: string) => {
    const next: Workflow = { ...wf, name, meta: { ...wf.meta, dirty: true, updatedAt: Date.now() } }
    setCatalog((c) => ({ ...c, [next.id]: next }))
    store.saveWorkflow(next)
  }
  const changeGov = (g: GovernanceSettings) => {
    setGov(g)
    store.saveGovernance(g)
    log('governance.updated', `Mask PII: ${g.maskPii ? 'on' : 'off'} · approval-before-write warnings: ${g.requireApprovalForWrites ? 'on' : 'off'} · retention ${g.retentionDays}d`)
  }

  // ── keyboard ──────────────────────────────────────────
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (isTyping(e.target) || modalId) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (e.key === 'Tab' && !e.shiftKey && e.target === wrapRef.current && !locked) {
      e.preventDefault()
      setPalette({ mode: 'free' })
    } else if (mod && k === 'z' && !e.shiftKey) (e.preventDefault(), !locked && hist.undo())
    else if (mod && ((k === 'z' && e.shiftKey) || k === 'y')) (e.preventDefault(), !locked && hist.redo())
    else if (mod && k === 'c') copy()
    else if (mod && k === 'v') (e.preventDefault(), paste())
    else if (mod && k === 'enter') (e.preventDefault(), void startRun({ mode: 'full' }))
    else if (mod && k === 's') (e.preventDefault(), flash('All changes are auto-saved in this browser'))
    else if (!mod && e.key === '1') fitView({ padding: 0.12, maxZoom: 1, duration: 400 })
    else if (e.shiftKey && k === 's') addNode('note')
    else if (e.key === '?') setShowKeys((s) => !s)
    else if (e.key === 'Escape') (setPalette(null), setShowKeys(false))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData(DRAG_MIME)
    if (!type) return
    const p = screenToFlowPosition({ x: e.clientX - 100, y: e.clientY - 30 })
    addNode(type, { mode: 'drop', x: p.x, y: p.y })
  }

  // ── view models ───────────────────────────────────────
  const viewNodes = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return nodes.map((n) => {
      const st = exec?.steps[n.id]
      const def = getDef(n.data.type)
      let slotInfo: StudioNodeType['data']['slotInfo']
      if (def?.slots) {
        const into = edges.filter((e) => e.target === n.id && e.targetHandle && e.targetHandle !== 'main')
        const src = (slot: string) => into.filter((e) => e.targetHandle === slot).map((e) => byId.get(e.source)).filter((x): x is StudioNodeType => !!x)
        const m = src('model')[0]
        slotInfo = {
          model: m ? (m.data.config.model === 'auto' ? `Auto · ${String(m.data.config.strategy)}` : modelLabel(String(m.data.config.model))) : undefined,
          memory: src('memory')[0]?.data.name,
          tools: src('tools').map((t) => toolLabel({ id: t.id, type: t.data.type, name: t.data.name, position: t.position, config: t.data.config })),
        }
      }
      return {
        ...n,
        data: {
          ...n.data,
          status: st?.status,
          issues: validation.byNode[n.id],
          durationMs: st?.startedAt && st.finishedAt ? st.finishedAt - st.startedAt : undefined,
          slotInfo,
          usedModel: st?.usage?.model,
        },
      }
    })
  }, [nodes, edges, exec, validation])

  const viewEdges = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return edges.map((e) => {
      const sub = !!e.targetHandle && e.targetHandle !== 'main'
      const src = byId.get(e.source)
      const outs = src ? getDef(src.data.type)?.outputs(src.data.config) ?? [] : []
      const label = outs.length > 1 ? outs.find((o) => o.id === e.sourceHandle)?.label : e.label
      let state: 'idle' | 'active' | 'done' | 'skipped' = 'idle'
      const items = exec?.edgeItems[e.id]
      if (exec && !sub) {
        const s = exec.steps[e.source]
        const t = exec.steps[e.target]
        if (items !== undefined) state = t?.status === 'running' ? 'active' : 'done'
        else if (s && ['success', 'skipped', 'rejected'].includes(s.status)) state = 'skipped'
      }
      return { ...e, label, data: { state, items, sub } }
    })
  }, [edges, nodes, exec])

  const selected = viewNodes.find((n) => n.id === selectedId) ?? null
  const modalNode = viewNodes.find((n) => n.id === modalId) ?? null
  const doneCount = exec ? Object.values(exec.steps).filter((s) => s.status === 'success').length : 0
  const mainCount = wf.nodes.filter((n) => getDef(n.type)?.role === 'main').length
  const hasChat = wf.nodes.some((n) => n.type === 'trigger.chat')
  const waitingNode = approvalFor ? nodes.find((n) => n.id === approvalFor) : null
  const approvalMsg = waitingNode && live?.steps[waitingNode.id] ? String(resolveExpr(String(waitingNode.data.config.message ?? ''), live.steps[waitingNode.id].input.items[0] ?? {}, { count: 1 })) : ''
  const lastFailed = exec?.status === 'error' && exec.haltedAt
  const isTemplate = WORKFLOWS.some((w) => w.id === wfId)
  const original = WORKFLOWS.find((w) => w.id === wfId)
  const templateEdited = useMemo(
    () => !!original && (base.meta.version !== original.meta.version || JSON.stringify([original.nodes, original.edges]) !== JSON.stringify([wf.nodes, wf.edges])),
    [original, base.meta.version, wf.nodes, wf.edges],
  )
  const tabs = Object.values(catalog)

  const inspectorFor = (n: StudioNodeType, layout: 'panel' | 'modal') => (
    <NodeInspector
      key={`${n.id}-${layout}`}
      node={n}
      step={exec?.steps[n.id]}
      issues={validation.byNode[n.id] ?? []}
      readOnly={readOnly}
      running={running}
      mask={gov.maskPii}
      layout={layout}
      onSave={(p) => {
        hist.snapshot()
        // saving a node's settings counts as the user having addressed its "needs configuration" notes
        updateNode(n.id, { ...p, needs: undefined })
        log('workflow.updated', `Configured “${p.name}” in “${wf.name}”`, wf.id)
      }}
      onExecuteStep={() => executeStep(n.id)}
      onRetry={retry}
      onPin={(pin) => {
        hist.snapshot()
        updateNode(n.id, { pinned: pin ? exec?.steps[n.id]?.output?.outputs[0] : undefined })
      }}
      onDelete={() => deleteNodes([n.id])}
      onOpenFull={layout === 'panel' ? () => setModalId(n.id) : undefined}
      onClose={layout === 'modal' ? () => setModalId(null) : undefined}
    />
  )

  return (
    <StudioActionsContext.Provider value={actions}>
      <div className="surface-light overflow-hidden rounded-[14px] bg-ink-850 shadow-[0_2px_4px_rgb(0_0_0/.06),0_40px_80px_-30px_rgb(10_20_30/.55)] ring-1 ring-black/5" onKeyDown={onKeyDown}>
        {/* ── Toolbar ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="hidden font-medium text-faint sm:inline">Workspace</span>
            <ChevronRight size={13} className="hidden text-faint sm:inline" />
            <span className="hidden font-medium text-faint sm:inline">Workflows</span>
            <ChevronRight size={13} className="hidden text-faint sm:inline" />
            {isTemplate ? (
              <span className="truncate font-bold text-fg">{wf.name}</span>
            ) : (
              <input value={wf.name} onChange={(e) => renameWorkflow(e.target.value)} disabled={locked} aria-label="Workflow name" className="min-w-0 max-w-[220px] truncate rounded bg-transparent px-1 font-bold text-fg hover:bg-ink-900 focus:bg-ink-900 focus:outline-none" />
            )}
            {wf.origin === 'generated' ? (
              <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${approvalCurrent ? 'bg-[#e5f1e8] text-leaf' : 'bg-[#fbf0dc] text-amber'}`}>{approvalCurrent ? 'Approved' : 'Not approved'}</span>
            ) : (
              <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${wf.meta.state === 'published' ? 'bg-[#e5f1e8] text-leaf' : 'bg-ink-900 text-muted'}`} title={wf.meta.dirty && wf.meta.state === 'published' ? 'Edited since the last publish' : undefined}>
                {wf.meta.state === 'published' ? `Published v${wf.meta.version}${wf.meta.dirty ? ' · edited' : ''}` : 'Draft'}
              </span>
            )}
            {templateEdited && (
              <button type="button" onClick={restoreTemplate} disabled={locked} className="hidden text-[11.5px] font-semibold text-faint underline-offset-2 hover:text-fg hover:underline md:inline">
                Restore template
              </button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <label className="mr-1 hidden items-center gap-1.5 text-[12px] font-semibold text-muted sm:flex" title="Active workflows run on their trigger in the managed runtime">
              <button type="button" role="switch" aria-checked={wf.meta.active} onClick={toggleActive} disabled={locked} className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${wf.meta.active ? 'bg-leaf' : 'bg-ink-600'}`} aria-label="Active">
                <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${wf.meta.active ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
              {wf.meta.active ? 'Active' : 'Inactive'}
            </label>
            <IconBtn label="Undo (Ctrl+Z)" onClick={hist.undo} disabled={!hist.canUndo || locked}>
              <Undo2 size={14} />
            </IconBtn>
            <IconBtn label="Redo (Ctrl+Shift+Z)" onClick={hist.redo} disabled={!hist.canRedo || locked}>
              <Redo2 size={14} />
            </IconBtn>
            <IconBtn label="Import workflow JSON" onClick={() => fileRef.current?.click()} disabled={running}>
              <Upload size={14} />
            </IconBtn>
            <IconBtn label="Export workflow JSON" onClick={doExport}>
              <Download size={14} />
            </IconBtn>
            <IconBtn label="Keyboard shortcuts (?)" onClick={() => setShowKeys((s) => !s)}>
              <Keyboard size={14} />
            </IconBtn>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (e.target.files?.[0] && void doImport(e.target.files[0]), (e.target.value = ''))} />
            <button type="button" onClick={publish} disabled={locked || (wf.meta.state === 'published' && !wf.meta.dirty)} className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] font-semibold text-fg-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:text-fg disabled:opacity-40">
              Publish
            </button>
            <span className="hidden text-[12px] text-faint xl:inline">{provider.simulated ? 'Simulated in your browser' : 'Model gateway connected'}</span>
            <button type="button" onClick={clearRun} disabled={running || !exec} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-fg-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:text-fg disabled:opacity-40" title="Clear run results from the canvas">
              <RotateCcw size={13} /> Reset
            </button>
            {lastFailed && !running && (
              <button type="button" onClick={retry} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[13px] font-semibold text-white hover:brightness-110">
                <RotateCcw size={12} /> Retry
              </button>
            )}
            {running ? (
              <button type="button" onClick={stop} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[13px] font-semibold text-white">
                <Square size={11} fill="currentColor" /> Stop
              </button>
            ) : (
              <button type="button" onClick={() => void startRun({ mode: 'full' })} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal px-3 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110" title="Run workflow (Ctrl+Enter)">
                <Play size={12} fill="currentColor" /> Run workflow
              </button>
            )}
          </div>
        </div>

        {/* workflow tabs */}
        <div className="flex items-center border-b border-line bg-ink-900">
          <div role="tablist" aria-label="Workflows" className="flex min-w-0 flex-1 gap-5 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none]">
            {tabs.map((w) => (
              <span key={w.id} className="relative flex shrink-0 items-center gap-1">
                <button
                  role="tab"
                  aria-selected={w.id === wfId}
                  type="button"
                  onClick={() => w.id !== wfId && load(w.id)}
                  title={w.name}
                  className={`relative py-2.5 text-[13px] font-semibold transition-colors ${w.id === wfId ? 'text-fg' : 'text-muted hover:text-fg-soft'}`}
                >
                  <span className="block max-w-[220px] truncate">{w.name}</span>
                  <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal transition-opacity ${w.id === wfId ? 'opacity-100' : 'opacity-0'}`} />
                </button>
                {w.origin !== 'template' && (
                  <button type="button" onClick={() => removeWorkflow(w.id)} className="grid size-4 place-items-center rounded text-faint hover:bg-ink-700 hover:text-danger" aria-label={`Delete ${w.name}`}>
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
            <button type="button" onClick={() => addWorkflow(blankWorkflow(), 'workflow.created', 'Created a blank workflow')} disabled={running} className="inline-flex shrink-0 items-center gap-1 py-2.5 text-[12.5px] font-semibold text-cyan hover:text-fg disabled:opacity-40">
              <Plus size={13} /> New
            </button>
          </div>
          <div className="flex shrink-0 gap-0.5 px-2 lg:hidden" role="group" aria-label="View mode">
            {(['canvas', 'watch'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`rounded px-2 py-1 text-[11.5px] font-semibold ${view === v ? 'bg-ink-850 text-fg shadow-[var(--shadow-sm)]' : 'text-muted'}`}>
                {v === 'canvas' ? 'Canvas' : 'Watch run'}
              </button>
            ))}
          </div>
        </div>

        {wf.origin === 'generated' && !viewing && (
          <ApprovalBar
            wf={wf}
            approvalCurrent={approvalCurrent}
            errors={validation.errors}
            running={running}
            regenerating={regenerating}
            result={aiResult}
            live={running && live?.workflowId === wfId ? live : null}
            mask={gov.maskPii}
            onApprove={approve}
            onEdit={editAi}
            onRegenerate={() => void regenerate()}
            onRun={(live) => void runApproved(live)}
            onRetry={() => void retryApproved()}
            onEmailed={(to) => log('workflow.emailed', `Emailed approved “${wf.name}” (fingerprint ${base.meta.approval?.hash}) to ${to}`, wf.id)}
          />
        )}

        <div className={`relative grid lg:h-[780px] xl:h-[840px] transition-all duration-200 ${libOpen ? 'lg:grid-cols-[180px_1fr_320px] xl:grid-cols-[190px_1fr_330px]' : 'lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_330px]'}`}>
          {/* ── Node library ─────────────────────────── */}
          <aside
            className={`${libOpen ? 'flex' : 'hidden'} absolute inset-y-0 left-0 z-20 w-[240px] flex-col border-r border-line bg-ink-900 shadow-[var(--shadow-md)] lg:static ${libOpen ? 'lg:flex' : 'lg:hidden'} lg:w-auto lg:min-h-0 lg:shadow-none`}
            aria-label="Node library"
          >
            <NodeLibrary onPick={(t) => addNode(t)} />
          </aside>

          {/* ── Canvas ─────────── */}
          {view === 'watch' && !wide ? (
            <WatchRun workflow={wf} exec={exec} mask={gov.maskPii} />
          ) : (
            <div
              ref={wrapRef}
              tabIndex={0}
              aria-label="Workflow canvas. Press Tab to search and add a node, question mark for shortcuts."
              className="studio-flow relative h-[460px] bg-[#1d3044] outline-none sm:h-[560px] lg:h-full"
              style={{ backgroundImage: 'radial-gradient(120% 90% at 50% 0%, #22384d 0%, #1b2d40 70%)' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onMouseDown={(e) => {
                if (!isTyping(e.target)) wrapRef.current?.focus({ preventScroll: true })
              }}
            >
              <ReactFlow<StudioNodeType, FlowEdgeType>
                nodes={viewNodes}
                edges={viewEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                isValidConnection={isValidConnection}
                onBeforeDelete={async () => {
                  if (locked) return false
                  hist.snapshot()
                  return true
                }}
                onNodeDragStart={() => hist.snapshot()}
                onNodeClick={(_, n) => {
                  if (n.type === 'note') return
                  setSelectedId(n.id)
                  setPanel('inspector')
                }}
                onNodeDoubleClick={(_, n) => n.type !== 'note' && actions.open(n.id)}
                onPaneClick={() => (setSelectedId(null), setPalette(null))}
                deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
                fitView
                fitViewOptions={{ padding: 0.14, maxZoom: 1 }}
                minZoom={0.25}
                maxZoom={1.6}
                zoomOnScroll={false}
                zoomOnPinch
                panOnScroll={false}
                preventScrolling={false}
                panOnDrag={finePointer}
                nodesDraggable={!locked}
                nodesConnectable={!locked}
                colorMode="dark"
                attributionPosition="bottom-center"
              >
                {/* Silicon Jaali node grid: an engineered lattice with via-like nodes at every crossing */}
                <Background id="jaali-lines" variant={BackgroundVariant.Lines} gap={40} lineWidth={0.6} color="rgba(120,160,185,.10)" />
                <Background id="jaali-vias" variant={BackgroundVariant.Dots} gap={40} size={2.2} color="#3a536c" />
                <Background id="jaali-fine" variant={BackgroundVariant.Dots} gap={20} size={0.9} color="rgba(58,83,108,.55)" />
                <Controls showInteractive={false} position="bottom-left" fitViewOptions={{ padding: 0.12, maxZoom: 1, duration: 400 }} />
                {wide && (
                  <MiniMap
                    position="bottom-right"
                    pannable
                    zoomable
                    maskColor="rgba(16,28,40,.6)"
                    nodeColor={(n) => {
                      const d = getDef((n.data as StudioNodeType['data']).type)
                      return d?.role === 'note' ? '#a8731c55' : d?.brand ?? KIND_META[d?.kind ?? 'data'].color
                    }}
                    nodeStrokeWidth={0}
                    nodeBorderRadius={3}
                    style={{ width: 150, height: 96 }}
                  />
                )}
              </ReactFlow>

              <div className="absolute left-3 top-3 z-10 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setLibOpen((o) => !o)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0f1d2b]/85 px-2.5 text-[12px] font-semibold text-[#dfe8ef] backdrop-blur hover:bg-[#0f1d2b] shadow-md border border-white/10"
                  title={libOpen ? 'Collapse library to widen flowchart' : 'Show node library'}
                  aria-expanded={libOpen}
                >
                  <PanelLeft size={13} /> {libOpen ? 'Hide Library' : 'Library'}
                </button>
                {!locked && (
                  <>
                    <button type="button" onClick={() => setPalette({ mode: 'free' })} className="hidden h-8 items-center gap-1.5 rounded-md bg-[#0f1d2b]/80 px-2.5 text-[12px] font-semibold text-[#dfe8ef] backdrop-blur hover:bg-[#0f1d2b] lg:inline-flex" title="Search nodes (Tab)">
                      <Plus size={13} /> Add node <kbd className="rounded bg-white/10 px-1 font-mono text-[10px]">Tab</kbd>
                    </button>
                    <button type="button" onClick={() => addNode('note')} className="hidden h-8 items-center gap-1.5 rounded-md bg-[#0f1d2b]/80 px-2.5 text-[12px] font-semibold text-[#dfe8ef] backdrop-blur hover:bg-[#0f1d2b] lg:inline-flex" title="Sticky note (Shift+S)">
                      <StickyNote size={13} /> Note
                    </button>
                  </>
                )}
              </div>

              {(running || exec) && (
                <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md bg-[#0f1d2b]/85 px-3 py-2 text-[12px] font-semibold text-[#dfe8ef] backdrop-blur">
                  <span className="flex items-center gap-2">
                    <CircleDot size={12} className={running ? 'pulse-dot text-[#7cc4dd]' : exec?.status === 'error' ? 'text-[#ef8c8c]' : 'text-[#8cc39b]'} />
                    {running ? (exec?.status === 'waiting' ? 'Awaiting approval' : 'Executing') : viewing ? `Execution #${viewing.id.slice(3, 11)}` : exec?.status === 'error' ? 'Last run failed' : 'Last run'} · {doneCount}/{mainCount} steps
                  </span>
                </div>
              )}

              {viewing && (
                <div className="absolute left-1/2 top-14 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md bg-[#fbf3e4] px-3 py-1.5 text-[12px] font-semibold text-[#7a5414] shadow-md">
                  Viewing a past execution (read-only)
                  <button type="button" onClick={() => setViewingId(null)} className="rounded bg-[#7a5414] px-2 py-0.5 text-white">
                    Back to editor
                  </button>
                </div>
              )}

              {exec && !running && exec.finishedAt && (
                <button type="button" onClick={() => setPanel('runs')} className="absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-md bg-[#0f1d2b]/85 px-3 py-1.5 font-mono text-[11px] text-[#dfe8ef] backdrop-blur hover:bg-[#0f1d2b] md:flex">
                  {(() => {
                    const s = summarize(exec)
                    return `${(s.durationMs / 1000).toFixed(1)}s · ${s.tokens.toLocaleString('en-IN')} tokens · ${formatInr(s.cost)}${exec.simulated ? ' (simulated)' : ''}`
                  })()}
                  <span className="font-sans font-semibold text-[#9ad5e5]">Breakdown →</span>
                </button>
              )}

              {palette && (
                <div className="absolute left-1/2 top-12 z-30 flex max-h-[min(440px,80%)] w-[300px] -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-ink-900 shadow-[var(--shadow-lg)] ring-1 ring-black/10" role="dialog" aria-label="Add node">
                  <div className="flex items-center justify-between px-3 pt-2.5 text-[11.5px] font-bold text-faint">
                    {palette.mode === 'from' ? 'Add next step' : palette.mode === 'edge' ? 'Insert step' : 'Add node'}
                    <button type="button" onClick={() => setPalette(null)} aria-label="Close" className="text-faint hover:text-fg">
                      <X size={13} />
                    </button>
                  </div>
                  <NodeLibrary autoFocus onPick={(t) => addNode(t, palette)} filter={palette.mode === 'free' ? undefined : mainWithInput} onEscape={() => (setPalette(null), wrapRef.current?.focus())} />
                </div>
              )}

              {showKeys && <Shortcuts onClose={() => setShowKeys(false)} />}

              {toast && (
                <div role="status" className="absolute bottom-14 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-md bg-[#0f1d2b] px-3 py-2 text-[12.5px] font-semibold text-[#dfe8ef] shadow-lg">
                  {toast}
                </div>
              )}
            </div>
          )}

          {/* ── Right panel ─────────────────────────────── */}
          <aside className="flex flex-col border-t border-line bg-ink-850 lg:min-h-0 lg:border-l lg:border-t-0" aria-label="Workflow panels">
            {waitingNode && (
              <div className="border-b border-line bg-[#fbf3e4] p-4">
                <p className="text-[12px] font-bold text-amber">Approval required</p>
                <p className="mt-1 text-[14px] font-bold text-fg">{waitingNode.data.name}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{approvalMsg || 'The run is paused. Review the context and decide whether it may continue.'}</p>
                <p className="mt-1 text-[11.5px] text-faint">Assignee: {String(waitingNode.data.config.assignee ?? '—')} · you are acting as the assignee in this demo.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => decide(true)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-leaf text-[13px] font-semibold text-white hover:brightness-110">
                    <Check size={14} /> Approve
                  </button>
                  <button type="button" onClick={() => decide(false)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-ink-850 text-[13px] font-semibold text-danger shadow-[inset_0_0_0_1px_rgb(192_74_74/.4)]">
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            )}
            <div role="tablist" aria-label="Panels" className="flex border-b border-line px-2">
              {(
                [
                  ['inspector', 'Inspector', SlidersHorizontal],
                  ['chat', 'Chat', MessageSquare],
                  ['runs', 'Executions', History],
                  ['governance', 'Governance', ShieldCheck],
                ] as const
              ).map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" aria-selected={panel === id} onClick={() => setPanel(id)} className={`relative flex flex-1 items-center justify-center gap-1 px-1 py-2.5 text-[11.5px] font-semibold ${panel === id ? 'text-fg' : 'text-muted hover:text-fg-soft'}`}>
                  <Icon size={12} /> {label}
                  <span className={`absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-teal ${panel === id ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {panel === 'inspector' &&
                (selected && selected.type !== 'note' ? (
                  inspectorFor(selected, 'panel')
                ) : (
                  <div className="p-4">
                    <p className="text-[12px] font-bold text-faint">About this workflow</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-fg-soft">{wf.description}</p>
                    {(validation.global.length > 0 || validation.errors > 0) && (
                      <ul className="mt-3 space-y-1 rounded-md bg-[#fbf0dc] p-2 text-[12px] text-[#7a5414]">
                        {validation.global.map((g) => (
                          <li key={g.message}>• {g.message}</li>
                        ))}
                        {validation.errors > 0 && <li>• {validation.errors} node error{validation.errors > 1 ? 's' : ''} — look for the red ⚠ badges.</li>}
                      </ul>
                    )}
                    <ul className="mt-4 space-y-2 text-[13px] text-muted">
                      <li className="flex gap-2"><MousePointerClick size={14} className="mt-0.5 shrink-0 text-teal" /> Click a node to inspect; double-click for the full Input · Parameters · Output view</li>
                      <li className="flex gap-2"><span className="text-teal">→</span> {finePointer ? 'Drag from the library, press Tab, or use the + on a node’s output' : 'Tap Nodes to add steps'}</li>
                      <li className="flex gap-2"><span className="text-teal">→</span> Hover a connection to insert a step or delete it</li>
                      <li className="flex gap-2"><span className="text-teal">→</span> Press Run, or try the Test chat with Hindi or Tamil</li>
                    </ul>
                    <p className="mt-4 text-[11px] leading-snug text-faint">Edits auto-save in this browser. Logic, data and branching run for real here; AI models and connectors use clearly labelled demo adapters.</p>
                  </div>
                ))}
              {panel === 'chat' && (
                <ChatPanel
                  messages={chat}
                  onSend={(t) => void sendChat(t)}
                  busy={running}
                  live={running ? live : null}
                  hasChatTrigger={hasChat}
                  onOpenChatTemplate={() => {
                    load('multilingual')
                    setPanel('chat')
                  }}
                  onClear={() => setChat([])}
                  mask={gov.maskPii}
                />
              )}
              {panel === 'runs' && (
                <ExecutionsPanel
                  executions={executions}
                  viewingId={viewingId}
                  onOpen={(id) => {
                    const ex = executions.find((e) => e.id === id)
                    if (ex && ex.workflowId !== wfId && catalog[ex.workflowId]) load(ex.workflowId)
                    setViewingId(id)
                  }}
                  onClear={() => {
                    store.clearExecutions()
                    setExecutions([])
                    setViewingId(null)
                  }}
                />
              )}
              {panel === 'governance' && <GovernancePanel gov={gov} onChange={changeGov} audit={audit} />}
            </div>
          </aside>
        </div>

        {modalNode && (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0b2034]/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`${modalNode.data.name} details`} onMouseDown={(e) => e.target === e.currentTarget && setModalId(null)} onKeyDown={(e) => e.key === 'Escape' && setModalId(null)}>
            <div className="surface-light flex h-[min(88vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-[14px] bg-ink-850 shadow-[var(--shadow-lg)]">{inspectorFor(modalNode, 'modal')}</div>
          </div>
        )}
      </div>
    </StudioActionsContext.Provider>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick(): void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className="grid size-8 place-items-center rounded-md text-fg-soft hover:bg-ink-900 hover:text-fg disabled:opacity-35">
      {children}
    </button>
  )
}

const KEYS: [string, string][] = [
  ['Tab', 'Search & add a node (canvas focused)'],
  ['Ctrl + Enter', 'Run workflow'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / redo'],
  ['Ctrl + C / Ctrl + V', 'Copy / paste selected nodes'],
  ['Delete / Backspace', 'Delete selection'],
  ['Shift + S', 'Add sticky note'],
  ['1', 'Zoom to fit'],
  ['Double-click node', 'Open Input · Parameters · Output'],
  ['?', 'Toggle this list'],
]

function Shortcuts({ onClose }: { onClose(): void }) {
  return (
    <div className="absolute right-3 top-14 z-30 w-[290px] rounded-lg bg-ink-900 p-3 shadow-[var(--shadow-lg)] ring-1 ring-black/10" role="dialog" aria-label="Keyboard shortcuts">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-faint">Keyboard shortcuts</p>
        <button type="button" onClick={onClose} aria-label="Close" className="text-faint hover:text-fg">
          <X size={13} />
        </button>
      </div>
      <dl className="mt-2 space-y-1">
        {KEYS.map(([k, d]) => (
          <div key={k} className="flex justify-between gap-3 text-[11.5px]">
            <dt className="font-mono font-semibold text-fg">{k}</dt>
            <dd className="text-right text-muted">{d}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Interactive Workflow Studio: real logic & data flow in the browser, labelled simulation adapters for AI and connectors. */
export default function StudioDemo() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  )
}
