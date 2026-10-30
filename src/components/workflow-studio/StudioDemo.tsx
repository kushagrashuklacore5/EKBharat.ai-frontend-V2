import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
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
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { Check, ChevronRight, CircleDot, Play, Plus, RotateCcw, Search, Square, X } from 'lucide-react'
import { KIND_META, NODE_LIBRARY, WORKFLOWS, type NodeKind, type StudioNodeData, type WorkflowDef } from './workflows'
import { FlowEdge, KIND_ICON, StudioNode, type FlowEdgeType, type RunStatus, type StudioNodeType } from './StudioNode'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const nodeTypes: NodeTypes = { studio: StudioNode }
const edgeTypes: EdgeTypes = { flow: FlowEdge }

const toNodes = (wf: WorkflowDef): StudioNodeType[] =>
  wf.nodes.map((n) => ({ id: n.id, type: 'studio', position: { x: n.x, y: n.y }, data: { ...n.data } }))
const toEdges = (wf: WorkflowDef): FlowEdgeType[] =>
  wf.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, type: 'flow' }))

interface LogLine {
  t: number
  node?: string
  text: string
  tone?: 'info' | 'ok' | 'warn' | 'err'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function Studio() {
  const [wfId, setWfId] = useState(WORKFLOWS[0].id)
  const wf = WORKFLOWS.find((w) => w.id === wfId)!
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNodeType>(toNodes(wf))
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(toEdges(wf))
  const [status, setStatus] = useState<Record<string, RunStatus>>({})
  const [skippedEdges, setSkippedEdges] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [libQuery, setLibQuery] = useState('')
  const [libOpen, setLibOpen] = useState(false)
  const runToken = useRef(0)
  const approval = useRef<((ok: boolean) => void) | null>(null)
  const startTime = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLOListElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const finePointer = useMediaQuery('(pointer: fine)')
  const wide = useMediaQuery('(min-width: 1024px)')

  // ── Workflow switching ───────────────────────────────
  const load = useCallback(
    (id: string) => {
      runToken.current++
      approval.current = null
      const next = WORKFLOWS.find((w) => w.id === id)!
      setWfId(id)
      setNodes(toNodes(next))
      setEdges(toEdges(next))
      setStatus({})
      setSkippedEdges(new Set())
      setSelectedId(null)
      setRunning(false)
      setLog([])
      requestAnimationFrame(() => fitView({ padding: 0.12, maxZoom: 1, duration: 500 }))
    },
    [setNodes, setEdges, fitView],
  )

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [log])

  const pushLog = (text: string, tone: LogLine['tone'] = 'info', node?: string) =>
    setLog((l) => [...l, { t: performance.now() - startTime.current, text, tone, node }])

  // ── Simulated execution engine ───────────────────────
  const run = async () => {
    const token = ++runToken.current
    const alive = () => runToken.current === token
    const ns = nodes
    const es = edges
    const byId = new Map(ns.map((n) => [n.id, n]))
    const incoming = new Map<string, string[]>()
    const outgoing = new Map<string, FlowEdgeType[]>()
    es.forEach((e) => {
      incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.id])
      outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e])
    })
    const st: Record<string, RunStatus> = Object.fromEntries(ns.map((n) => [n.id, 'queued' as RunStatus]))
    const edgeState = new Map<string, 'pending' | 'fired' | 'skipped'>(es.map((e) => [e.id, 'pending']))
    const skippedSet = new Set<string>()
    startTime.current = performance.now()
    setRunning(true)
    setLog([])
    setStatus({ ...st })
    setSkippedEdges(new Set())
    pushLog(`Run started · ${wf.name}`, 'info')

    const roots = ns.filter((n) => !(incoming.get(n.id)?.length))
    if (!roots.length) {
      pushLog('No trigger found — add a trigger node to start the workflow.', 'err')
      setRunning(false)
      return
    }
    const disconnected = ns.filter((n) => n.data.kind !== 'trigger' && !(incoming.get(n.id)?.length))
    disconnected.forEach((n) => {
      st[n.id] = 'skipped'
      pushLog(`${n.data.title} is not connected — skipped`, 'warn', n.id)
    })

    const settle = (id: string, s: RunStatus) => {
      st[id] = s
      setStatus({ ...st })
    }
    const skipEdge = (eid: string) => {
      edgeState.set(eid, 'skipped')
      skippedSet.add(eid)
      setSkippedEdges(new Set(skippedSet))
    }

    let frontier = roots.filter((r) => r.data.kind === 'trigger').map((r) => r.id)
    if (!frontier.length) frontier = [roots[0].id]
    const visited = new Set<string>()

    while (frontier.length && alive()) {
      // run the current wave in parallel
      await Promise.all(
        frontier.map(async (id) => {
          visited.add(id)
          const n = byId.get(id)!
          const allSkipped = (incoming.get(id) ?? []).length > 0 && (incoming.get(id) ?? []).every((e) => edgeState.get(e) === 'skipped')
          if (allSkipped) {
            settle(id, 'skipped')
            ;(outgoing.get(id) ?? []).forEach((e) => skipEdge(e.id))
            return
          }
          settle(id, 'running')
          pushLog(`${n.data.title} · started`, 'info', id)
          await sleep(n.data.kind === 'trigger' ? 600 : 850 + Math.random() * 500)
          if (!alive()) return
          if (n.data.kind === 'human') {
            settle(id, 'waiting')
            setSelectedId(id)
            pushLog(`${n.data.title} · waiting for a decision`, 'warn', id)
            const ok = await new Promise<boolean>((res) => (approval.current = res))
            approval.current = null
            if (!alive()) return
            if (!ok) {
              settle(id, 'rejected')
              pushLog(`${n.data.title} · rejected — run stopped`, 'err', id)
              runToken.current++
              return
            }
          }
          settle(id, 'done')
          pushLog(`${n.data.output || `${n.data.title} · completed`}`, 'ok', id)
          ;(outgoing.get(id) ?? []).forEach((e) => {
            if (n.data.kind === 'condition') {
              const takes = n.data.takes ?? e.target
              if (e.target === takes) edgeState.set(e.id, 'fired')
              else skipEdge(e.id)
            } else edgeState.set(e.id, 'fired')
          })
        }),
      )
      if (!alive()) break
      // next wave: nodes whose inputs are all resolved
      const next = ns
        .filter((n) => !visited.has(n.id) && st[n.id] !== 'skipped')
        .filter((n) => {
          const ins = incoming.get(n.id) ?? []
          return ins.length > 0 && ins.every((e) => edgeState.get(e) !== 'pending')
        })
        .map((n) => n.id)
      frontier = next
    }

    const wasStopped = !alive()
    if (!wasStopped) {
      ns.forEach((n) => {
        if (st[n.id] === 'queued') st[n.id] = 'skipped'
      })
      setStatus({ ...st })
      const done = Object.values(st).filter((s) => s === 'done').length
      pushLog(`Run completed · ${done} steps executed in ${((performance.now() - startTime.current) / 1000).toFixed(1)}s (simulated)`, 'ok')
      runToken.current++
    }
    setRunning(false)
  }

  const stop = () => {
    runToken.current++
    approval.current?.(false)
    setRunning(false)
    pushLog('Run cancelled by user', 'warn')
    setStatus((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === 'running' || v === 'queued' || v === 'waiting' ? 'idle' : v])))
  }

  const reset = () => {
    runToken.current++
    approval.current = null
    setSelectedId(null)
    setRunning(false)
    setStatus({})
    setSkippedEdges(new Set())
    setLog([])
  }

  // ── Derived view state ─────────────────────────────
  const viewNodes = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, status: status[n.id] ?? 'idle' } })), [nodes, status])
  const viewEdges = useMemo(
    () =>
      edges.map((e) => {
        const s = status[e.source]
        const t = status[e.target]
        let state: 'idle' | 'active' | 'done' | 'skipped' = 'idle'
        if (skippedEdges.has(e.id)) state = 'skipped'
        else if (s === 'done' && (t === 'running' || t === 'queued')) state = t === 'running' ? 'active' : 'done'
        else if (s === 'done' && (t === 'done' || t === 'waiting' || t === 'rejected')) state = 'done'
        return { ...e, data: { state, color: state === 'done' ? '#8cc39b' : '#7cc4dd' } }
      }),
    [edges, status, skippedEdges, nodes],
  )

  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge({ ...c, type: 'flow' }, es)), [setEdges])

  const addNode = (kind: NodeKind, title: string, subtitle: string, position?: { x: number; y: number }) => {
    const id = `n${Date.now().toString(36)}`
    let pos = position
    if (!pos) {
      const r = wrapRef.current!.getBoundingClientRect()
      pos = screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    const data: StudioNodeData = { kind, title, subtitle, config: [{ label: 'Status', value: 'Not configured' }], output: `${title} · completed` }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type: 'studio', position: pos!, data, selected: true }])
    setSelectedId(id)
    setLibOpen(false)
  }

  const onDragStart = (e: DragEvent, i: number) => {
    e.dataTransfer.setData('application/x-aib-node', String(i))
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const i = e.dataTransfer.getData('application/x-aib-node')
    if (i === '') return
    const item = NODE_LIBRARY[Number(i)]
    addNode(item.kind, item.title, item.subtitle, screenToFlowPosition({ x: e.clientX - 98, y: e.clientY - 30 }))
  }

  const selected = viewNodes.find((n) => n.id === selectedId) ?? null
  const updateTitle = (title: string) =>
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, title } } : n)))
  const deleteSelected = () => {
    if (!selectedId) return
    setNodes((ns) => ns.filter((n) => n.id !== selectedId))
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
  }

  const filtered = NODE_LIBRARY.map((n, i) => ({ ...n, i })).filter((n) =>
    `${n.title} ${n.subtitle} ${n.group}`.toLowerCase().includes(libQuery.toLowerCase()),
  )
  const groups = [...new Set(filtered.map((f) => f.group))]
  const waitingNode = viewNodes.find((n) => n.data.status === 'waiting')
  const doneCount = Object.values(status).filter((s) => s === 'done').length

  return (
    <div className="surface-light overflow-hidden rounded-[14px] bg-ink-850 shadow-[0_2px_4px_rgb(0_0_0/.06),0_40px_80px_-30px_rgb(10_20_30/.55)] ring-1 ring-black/5">
      {/* ── Toolbar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <span className="hidden font-medium text-faint sm:inline">Workspace</span>
          <ChevronRight size={13} className="hidden text-faint sm:inline" />
          <span className="hidden font-medium text-faint sm:inline">Workflows</span>
          <ChevronRight size={13} className="hidden text-faint sm:inline" />
          <span className="truncate font-bold text-fg">{wf.name}</span>
          <span className="ml-1 hidden rounded bg-ink-900 px-1.5 py-0.5 text-[11px] font-semibold text-muted md:inline">Draft</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[12px] text-faint lg:inline">Simulated in your browser</span>
          <button
            type="button"
            onClick={reset}
            disabled={running}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-fg-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)] transition-colors hover:text-fg disabled:opacity-40"
          >
            <RotateCcw size={13} /> Reset
          </button>
          {running ? (
            <button type="button" onClick={stop} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[13px] font-semibold text-white">
              <Square size={11} fill="currentColor" /> Stop
            </button>
          ) : (
            <button type="button" onClick={run} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal px-3 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110">
              <Play size={12} fill="currentColor" /> Run workflow
            </button>
          )}
        </div>
      </div>

      {/* template tabs */}
      <div role="tablist" aria-label="Example workflows" className="flex gap-5 overflow-x-auto overflow-y-hidden border-b border-line bg-ink-900 px-4 [scrollbar-width:none]">
        {WORKFLOWS.map((w) => (
          <button
            key={w.id}
            role="tab"
            aria-selected={w.id === wfId}
            type="button"
            onClick={() => load(w.id)}
            className={`relative shrink-0 py-2.5 text-[13px] font-semibold transition-colors ${w.id === wfId ? 'text-fg' : 'text-muted hover:text-fg-soft'}`}
          >
            {w.name}
            <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal transition-opacity ${w.id === wfId ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        ))}
      </div>

      <div className="relative grid lg:h-[640px] lg:grid-cols-[224px_1fr_288px]">
        {/* ── Node library ─────────────────────────── */}
        <aside
          className={`${libOpen ? 'block' : 'hidden'} absolute inset-y-0 left-0 z-20 w-[248px] border-r border-line bg-ink-900 shadow-[var(--shadow-md)] lg:static lg:block lg:w-auto lg:overflow-y-auto lg:shadow-none`}
          aria-label="Node library"
        >
          <div className="p-3">
            <label className="flex items-center gap-2 rounded-md bg-ink-850 px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--color-line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-cyan)]">
              <Search size={14} className="text-faint" />
              <input
                value={libQuery}
                onChange={(e) => setLibQuery(e.target.value)}
                placeholder="Search nodes"
                aria-label="Search nodes"
                className="w-full bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
              />
            </label>
          </div>
          <div className="max-h-[540px] overflow-y-auto px-2 pb-3 lg:max-h-none">
            {groups.map((g) => (
              <div key={g} className="mb-3">
                <p className="px-2 pb-1 text-[11.5px] font-bold text-faint">{g}</p>
                {filtered
                  .filter((f) => f.group === g)
                  .map((item) => {
                    const Icon = KIND_ICON[item.kind]
                    const c = KIND_META[item.kind].color
                    return (
                      <button
                        key={item.i}
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStart(e, item.i)}
                        onClick={() => addNode(item.kind, item.title, item.subtitle)}
                        className="group flex w-full cursor-grab items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink-850 hover:shadow-[var(--shadow-sm)] active:cursor-grabbing"
                        title="Drag onto the canvas or click to add"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md text-white" style={{ background: c }}>
                          <Icon size={13} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-fg">{item.title}</span>
                          <span className="block truncate text-[11.5px] text-muted">{item.subtitle}</span>
                        </span>
                        <Plus size={14} className="text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    )
                  })}
              </div>
            ))}
            {!filtered.length && <p className="px-2 text-[13px] text-muted">No nodes match “{libQuery}”.</p>}
          </div>
        </aside>

        {/* ── Canvas (refined dark working surface) ─────────── */}
        <div
          ref={wrapRef}
          className="studio-flow relative h-[420px] bg-[#1d3044] sm:h-[560px] lg:h-full"
          style={{ backgroundImage: 'radial-gradient(120% 90% at 50% 0%, #22384d 0%, #1b2d40 70%)' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <ReactFlow<StudioNodeType, FlowEdgeType>
            nodes={viewNodes}
            edges={viewEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={{ padding: 0.14, maxZoom: 1 }}
            minZoom={0.3}
            maxZoom={1.6}
            zoomOnScroll={false}
            zoomOnPinch
            panOnScroll={false}
            preventScrolling={false}
            panOnDrag={finePointer}
            nodesDraggable={!running}
            colorMode="dark"
            attributionPosition="bottom-center"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.3} color="#3a536c" />
            <Controls showInteractive={false} position="bottom-left" />
            {wide && (
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                maskColor="rgba(16,28,40,.6)"
                nodeColor={(n) => KIND_META[(n.data as StudioNodeData).kind].color}
                nodeStrokeWidth={0}
                nodeBorderRadius={3}
                style={{ width: 150, height: 96 }}
              />
            )}
          </ReactFlow>
          <button
            type="button"
            onClick={() => setLibOpen((o) => !o)}
            className="absolute left-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-2.5 text-[13px] font-semibold text-[#182b3d] shadow-md lg:hidden"
            aria-expanded={libOpen}
          >
            {libOpen ? <X size={14} /> : <Plus size={14} />} Nodes
          </button>
          {(running || doneCount > 0) && (
            <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md bg-[#0f1d2b]/85 px-3 py-2 text-[12px] font-semibold text-[#dfe8ef] backdrop-blur">
              <span className="flex items-center gap-2">
                <CircleDot size={12} className={running ? 'pulse-dot text-[#7cc4dd]' : 'text-[#8cc39b]'} />
                {running ? 'Executing' : 'Last run'} · {doneCount}/{nodes.length} steps
              </span>
            </div>
          )}
        </div>

        {/* ── Inspector ─────────────────────────────── */}
        <aside className="flex flex-col border-t border-line bg-ink-850 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Node inspector">
          {waitingNode && (
            <div className="border-b border-line bg-[#fbf3e4] p-4">
              <p className="text-[12px] font-bold text-amber">Approval required</p>
              <p className="mt-1 text-[14px] font-bold text-fg">{waitingNode.data.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">The run is paused. Review the context and decide whether it may continue.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => approval.current?.(true)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-leaf text-[13px] font-semibold text-white hover:brightness-110">
                  <Check size={14} /> Approve
                </button>
                <button type="button" onClick={() => approval.current?.(false)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-ink-850 text-[13px] font-semibold text-danger shadow-[inset_0_0_0_1px_rgb(192_74_74/.4)]">
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          )}
          {selected ? (
            <div className="p-4">
              <div className="flex items-center gap-2.5">
                <SelectedIcon kind={selected.data.kind} />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold" style={{ color: KIND_META[selected.data.kind].color }}>
                    {KIND_META[selected.data.kind].label}
                  </p>
                  <p className="font-mono text-[11px] text-faint">node · {selected.id}</p>
                </div>
              </div>
              <label className="mt-4 block">
                <span className="text-[12px] font-semibold text-muted">Name</span>
                <input
                  value={selected.data.title}
                  onChange={(e) => updateTitle(e.target.value)}
                  className="mt-1 w-full rounded-md bg-ink-900 px-2.5 py-2 text-[13.5px] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-cyan)] focus:outline-none"
                />
              </label>
              <p className="mt-4 text-[12px] font-semibold text-muted">Configuration</p>
              <dl className="mt-1.5 divide-y divide-line rounded-md bg-ink-900">
                {selected.data.config.map((c) => (
                  <div key={c.label} className="flex items-start justify-between gap-3 px-2.5 py-2">
                    <dt className="text-[12.5px] text-muted">{c.label}</dt>
                    <dd className="text-right font-mono text-[11.5px] text-fg">{c.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[12px] font-semibold text-muted">Last output</p>
              <p className="mt-1.5 rounded-md bg-[#1d3044] px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-[#cfe0ea]">
                {selected.data.status === 'done' ? selected.data.output : selected.data.status === 'skipped' ? 'Branch not taken in this run' : 'Run the workflow to see output'}
              </p>
              <button type="button" onClick={deleteSelected} disabled={running} className="mt-4 text-[12.5px] font-semibold text-muted hover:text-danger disabled:opacity-40">
                Remove node
              </button>
            </div>
          ) : (
            !waitingNode && (
              <div className="p-4">
                <p className="text-[12px] font-bold text-faint">About this workflow</p>
                <p className="mt-2 text-[14px] leading-relaxed text-fg-soft">{wf.description}</p>
                <ul className="mt-4 space-y-2 text-[13px] text-muted">
                  <li className="flex gap-2"><span className="text-teal">→</span> Select a node to inspect it</li>
                  <li className="flex gap-2"><span className="text-teal">→</span> {finePointer ? 'Drag nodes from the library onto the canvas' : 'Tap Nodes to add steps'}</li>
                  <li className="flex gap-2"><span className="text-teal">→</span> Connect handles to create edges</li>
                  <li className="flex gap-2"><span className="text-teal">→</span> Press Run to simulate execution</li>
                </ul>
              </div>
            )
          )}
          {/* execution history */}
          <div className="mt-auto border-t border-line">
            <p className="px-4 pt-3 text-[12px] font-bold text-faint">Execution history</p>
            <ol ref={logRef} className="max-h-[200px] space-y-1.5 overflow-y-auto px-4 pb-4 pt-2 text-[12px] leading-snug" aria-live="polite">
              {log.length === 0 && <li className="text-muted">No runs yet — press Run workflow.</li>}
              {log.map((l, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-9 shrink-0 font-mono text-[11px] text-faint">{(l.t / 1000).toFixed(1)}s</span>
                  <span className={`mt-[5px] size-1.5 shrink-0 rounded-full ${l.tone === 'ok' ? 'bg-leaf' : l.tone === 'warn' ? 'bg-amber' : l.tone === 'err' ? 'bg-danger' : 'bg-cyan'}`} />
                  <span className={l.tone === 'err' ? 'text-danger' : 'text-fg-soft'}>{l.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}

function SelectedIcon({ kind }: { kind: NodeKind }) {
  const I = KIND_ICON[kind]
  return (
    <span className="grid size-8 place-items-center rounded-md text-white" style={{ background: KIND_META[kind].color }}>
      <I size={15} />
    </span>
  )
}

/** Interactive, fully client-side demonstration of the Workflow Studio. */
export default function StudioDemo() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  )
}
