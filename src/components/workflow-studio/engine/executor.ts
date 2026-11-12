import { resolveExpr, uid } from './data'
import { getDef, RejectedError, type ExecContext, type NodeTypeDef } from './registry'
import { modelLabel, provider, route, setExecutionType, type CompletionResult } from './routing'
import type { Execution, ExecutionMode, ExecutionStep, Item, JsonValue, LogLine, NodeInput, NodeOutput, StepStatus, Workflow, WorkflowEdge, WorkflowNode } from './types'

/** Node types whose failure injection is applied at the model-provider level (to exercise fallback). */
const AI_TYPES = new Set(['ai.agent', 'ai.llm', 'ai.classifier', 'ai.docqa', 'ai.embeddings'])

export interface RunOptions {
  workflow: Workflow
  mode: ExecutionMode
  /** When true, calls live backend LLM gateway; when false, runs local simulation */
  liveAi?: boolean
  /** payload injected into the start trigger (chat message, test event) */
  triggerData?: Item[]
  /** which trigger starts the run; defaults to the first trigger (chat mode prefers a Chat Trigger) */
  startNodeId?: string
  /** "Execute step": run only this node and the ancestors it needs */
  destination?: string
  /** results to reuse (execute step / retry) */
  previous?: Execution
  /** "Retry": re-run this node and everything downstream, reuse the rest */
  retryFrom?: string
  signal: AbortSignal
  requestApproval(nodeId: string): Promise<boolean>
  onUpdate(exec: Execution): void
}

const isMainTarget = (e: WorkflowEdge) => !e.targetHandle || e.targetHandle === 'main'

function graph(wf: Workflow) {
  const byId = new Map(wf.nodes.map((n) => [n.id, n]))
  const mainNodes = wf.nodes.filter((n) => getDef(n.type)?.role === 'main')
  const mainIds = new Set(mainNodes.map((n) => n.id))
  const edges = wf.edges.filter((e) => isMainTarget(e) && mainIds.has(e.source) && mainIds.has(e.target))
  const incoming = new Map<string, WorkflowEdge[]>()
  const outgoing = new Map<string, WorkflowEdge[]>()
  edges.forEach((e) => {
    incoming.set(e.target, [...(incoming.get(e.target) ?? []), e])
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e])
  })
  const subOf = (id: string) => {
    const into = wf.edges.filter((e) => e.target === id && !isMainTarget(e))
    const pick = (slot: string) => into.filter((e) => e.targetHandle === slot).map((e) => byId.get(e.source)).filter((n): n is WorkflowNode => !!n)
    return { model: pick('model')[0], memory: pick('memory')[0], tools: pick('tools') }
  }
  return { byId, mainNodes, edges, incoming, outgoing, subOf }
}

function reach(start: string[], next: (id: string) => string[]) {
  const seen = new Set(start)
  const stack = [...start]
  while (stack.length) for (const n of next(stack.pop()!)) if (!seen.has(n)) (seen.add(n), stack.push(n))
  return seen
}

export async function runWorkflow(opts: RunOptions): Promise<Execution> {
  const wf = opts.workflow
  if (opts.liveAi !== undefined) {
    setExecutionType(opts.liveAi ? 'live' : 'demo')
  }
  const g = graph(wf)
  const triggers = g.mainNodes.filter((n) => getDef(n.type)?.kind === 'trigger')
  const started = Date.now()
  let exec: Execution = {
    id: uid('ex_'),
    workflowId: wf.id,
    workflowName: wf.name,
    mode: opts.mode,
    triggerType: 'manual',
    status: 'running',
    startedAt: started,
    steps: {},
    edgeItems: {},
    logs: [],
    usage: [],
    simulated: provider.simulated,
  }
  const emit = () => opts.onUpdate({ ...exec })
  const log = (text: string, tone: LogLine['tone'] = 'info', nodeId?: string) => {
    exec = { ...exec, logs: [...exec.logs, { at: Date.now() - started, text, tone, nodeId }] }
    emit()
  }
  const setStep = (id: string, patch: Partial<ExecutionStep>) => {
    const n = g.byId.get(id)!
    const prev: ExecutionStep = exec.steps[id] ?? { nodeId: id, nodeName: n.name, nodeType: n.type, status: 'queued', input: { items: [], bySource: [] }, attempts: 0 }
    exec = { ...exec, steps: { ...exec.steps, [id]: { ...prev, ...patch } } }
    emit()
  }
  const finish = (status: Execution['status'], haltedAt?: string) => {
    exec = { ...exec, status, finishedAt: Date.now(), haltedAt }
    emit()
    return exec
  }

  // ── pick start trigger & scope ───────────────────────
  const start =
    (opts.startNodeId && triggers.find((t) => t.id === opts.startNodeId)) ||
    (opts.mode === 'chat' ? triggers.find((t) => t.type === 'trigger.chat') : undefined) ||
    (opts.destination ? triggers.find((t) => reach([opts.destination!], (id) => (g.incoming.get(id) ?? []).map((e) => e.source)).has(t.id)) : undefined) ||
    (opts.previous?.steps && triggers.find((t) => opts.previous!.steps[t.id]?.status === 'success')) ||
    triggers[0]
  if (!start) {
    log('No trigger found — add a trigger node to start the workflow.', 'err')
    return finish('error')
  }
  exec.triggerType = getDef(start.type)?.title ?? start.type
  const downstream = (id: string) => (g.outgoing.get(id) ?? []).map((e) => e.target)
  const upstream = (id: string) => (g.incoming.get(id) ?? []).map((e) => e.source)
  let scope = reach([start.id], downstream)
  if (opts.destination) {
    const anc = reach([opts.destination], upstream)
    scope = new Set([...scope].filter((id) => anc.has(id)))
    if (!scope.has(opts.destination)) {
      log('This node is not reachable from a trigger — connect it first.', 'err', opts.destination)
      return finish('error', opts.destination)
    }
  }
  // nodes whose previous results we reuse instead of re-executing
  const reuse = new Set<string>()
  if (opts.previous) {
    const rerun = opts.retryFrom ? reach([opts.retryFrom], downstream) : new Set(opts.destination ? [opts.destination] : [])
    scope.forEach((id) => {
      const p = opts.previous!.steps[id]
      if (!rerun.has(id) && p?.status === 'success' && p.output) reuse.add(id)
    })
  }

  scope.forEach((id) => setStep(id, { status: 'queued' }))
  log(`${opts.mode === 'step' ? 'Executing step' : opts.mode === 'retry' ? 'Retrying run' : 'Run started'} · ${wf.name}${provider.simulated ? ' (simulation adapter)' : ' (live AI backend)'}`)
  if (opts.mode !== 'step') {
    const unreachable = g.mainNodes.filter((n) => !scope.has(n.id) && n.id !== start.id && getDef(n.type)?.kind !== 'trigger')
    unreachable.forEach((n) => log(`${n.name} is not reachable from ${start.name} — skipped`, 'warn', n.id))
  }

  // edge resolution: items fired along the edge, or null when the edge is dead
  const resolved = new Map<string, Item[] | null>()
  const done = new Set<string>()
  let failed: string | null = null

  const fire = (node: WorkflowNode, def: NodeTypeDef, output: NodeOutput | null) => {
    const outs = def.outputs(node.config)
    for (const e of g.outgoing.get(node.id) ?? []) {
      if (!output) {
        resolved.set(e.id, null)
        continue
      }
      let idx = outs.findIndex((o) => o.id === (e.sourceHandle ?? 'main'))
      if (idx < 0) idx = 0
      const items = output.outputs[idx] ?? []
      resolved.set(e.id, items.length ? items : null)
      if (items.length) exec = { ...exec, edgeItems: { ...exec.edgeItems, [e.id]: items.length } }
    }
    emit()
  }

  const executeNode = async (node: WorkflowNode) => {
    const def = getDef(node.type)!
    const ins = (g.incoming.get(node.id) ?? []).filter((e) => scope.has(e.source))
    const bySource = ins.filter((e) => resolved.get(e.id)).map((e) => ({ edgeId: e.id, sourceId: e.source, items: resolved.get(e.id)! }))
    const input: NodeInput = { items: bySource.flatMap((b) => b.items), bySource }
    const isStart = node.id === start.id

    if (!isStart && def.hasInput && !input.items.length) {
      setStep(node.id, { status: 'skipped', input })
      fire(node, def, null)
      return
    }
    if (reuse.has(node.id)) {
      const p = opts.previous!.steps[node.id]
      setStep(node.id, { ...p, notes: ['Reused output from the previous run'] })
      fire(node, def, p.output!)
      return
    }
    if (node.pinned?.length) {
      const output: NodeOutput = { outputs: [node.pinned, ...def.outputs(node.config).slice(1).map(() => [])] }
      setStep(node.id, { status: 'success', input, output, pinned: true, startedAt: Date.now(), finishedAt: Date.now(), attempts: 0 })
      log(`${node.name} · used pinned data (${node.pinned.length} items)`, 'info', node.id)
      fire(node, def, output)
      return
    }

    const settings = node.settings ?? {}
    const maxTries = settings.retryOnFail ? Math.max(1, Math.min(5, settings.maxTries ?? 2)) : 1
    setStep(node.id, { status: 'running', input, startedAt: Date.now(), error: undefined, routing: undefined, usage: undefined })
    log(`${node.name} · started`, 'info', node.id)

    for (let attempt = 1; attempt <= maxTries; attempt++) {
      const inject = settings.simulateFailure === 'always' || (settings.simulateFailure === 'once' && attempt === 1 && opts.mode !== 'retry')
      try {
        const ctx: ExecContext = {
          node,
          input,
          signal: opts.signal,
          sub: g.subOf(node.id),
          triggerData: isStart ? opts.triggerData : undefined,
          raw: (k) => node.config[k] ?? def.defaults[k] ?? '',
          param: (k, item) => {
            const v = node.config[k] ?? def.defaults[k] ?? ''
            return typeof v === 'string' ? resolveExpr(v, item ?? {}, { count: input.items.length }) : (v as JsonValue)
          },
          log: (t, tone) => log(t, tone ?? 'info', node.id),
          approval: async () => {
            setStep(node.id, { status: 'waiting' })
            exec = { ...exec, status: 'waiting' }
            log(`${node.name} · waiting for a decision`, 'warn', node.id)
            const ok = await opts.requestApproval(node.id)
            exec = { ...exec, status: 'running' }
            setStep(node.id, { status: 'running' })
            log(`${node.name} · ${ok ? 'approved' : 'rejected'}`, ok ? 'ok' : 'warn', node.id)
            return ok
          },
          ai: async ({ task, prompt, strategy, pinnedModel, simulate }) => {
            const r = route({ strategy, task, text: `${prompt} ${JSON.stringify(input.items.slice(0, 3))}`, pinned: pinnedModel })
            let res: CompletionResult
            let used = r.selected
            try {
              res = await provider.complete({ model: r.selected, task, prompt, input: input.items, nodeName: node.name, simulate, signal: opts.signal, forceFail: inject })
            } catch (err) {
              if (isAbort(err) || !r.fallback) throw err
              log(`${node.name} · ${errMsg(err)} → falling back to ${modelLabel(r.fallback)}`, 'warn', node.id)
              used = r.fallback
              res = await provider.complete({ model: r.fallback, task, prompt, input: input.items, nodeName: node.name, simulate, signal: opts.signal, forceFail: settings.simulateFailure === 'always' })
            }
            const usage = { nodeId: node.id, nodeName: node.name, model: used, inputTokens: res.inputTokens, outputTokens: res.outputTokens, latencyMs: res.latencyMs, costInr: res.costInr, source: res.source }
            exec = { ...exec, usage: [...exec.usage.filter((u) => u.nodeId !== node.id), usage] }
            setStep(node.id, { routing: { ...r, usedFallback: used !== r.selected }, usage })
            return res.items
          },
        }
        if (inject && !AI_TYPES.has(node.type)) {
          await new Promise((r) => setTimeout(r, 400))
          throw new Error('Simulated failure: upstream service timed out (demo)')
        }
        const output = await def.execute!(ctx)
        setStep(node.id, { status: 'success', output, finishedAt: Date.now(), attempts: attempt })
        const counts = output.outputs.map((o) => o.length)
        log(`${node.name} · completed → ${counts.length > 1 ? counts.join(' / ') : counts[0]} item${counts[0] === 1 && counts.length === 1 ? '' : 's'}`, 'ok', node.id)
        fire(node, def, output)
        return
      } catch (err) {
        if (isAbort(err)) throw err
        if (err instanceof RejectedError) {
          setStep(node.id, { status: 'rejected', finishedAt: Date.now(), attempts: attempt, error: err.message })
          log(`${node.name} · rejected — this branch stops`, 'warn', node.id)
          fire(node, def, null)
          return
        }
        const msg = errMsg(err)
        if (attempt < maxTries) {
          log(`${node.name} · attempt ${attempt} failed (${msg}) — retrying`, 'warn', node.id)
          setStep(node.id, { attempts: attempt })
          continue
        }
        if (settings.continueOnFail) {
          const output: NodeOutput = { outputs: [(input.items.length ? input.items : [{}]).map((i) => ({ ...i, error: msg }))] }
          setStep(node.id, { status: 'success', output, error: msg, finishedAt: Date.now(), attempts: attempt, notes: ['Continued after error'] })
          log(`${node.name} · failed but continued (${msg})`, 'warn', node.id)
          fire(node, def, output)
          return
        }
        setStep(node.id, { status: 'error', error: msg, finishedAt: Date.now(), attempts: attempt })
        log(`${node.name} · failed: ${msg}`, 'err', node.id)
        failed = node.id
        return
      }
    }
  }

  try {
    let frontier = [start.id]
    while (frontier.length) {
      if (opts.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      await Promise.all(frontier.map((id) => (done.add(id), executeNode(g.byId.get(id)!))))
      if (failed) break
      frontier = [...scope].filter((id) => {
        if (done.has(id)) return false
        const ins = (g.incoming.get(id) ?? []).filter((e) => scope.has(e.source))
        return ins.length > 0 && ins.every((e) => resolved.has(e.id))
      })
    }
  } catch (err) {
    if (!isAbort(err)) throw err
    Object.values(exec.steps).forEach((s) => {
      if (s.status === 'running' || s.status === 'waiting' || s.status === 'queued') setStep(s.nodeId, { status: 'canceled' as StepStatus })
    })
    log('Run cancelled by user', 'warn')
    return finish('canceled')
  }

  if (failed) {
    Object.values(exec.steps).forEach((s) => s.status === 'queued' && setStep(s.nodeId, { status: 'canceled' }))
    log(`Run stopped at ${g.byId.get(failed)!.name}. Fix the node or press Retry.`, 'err', failed)
    return finish('error', failed)
  }
  Object.values(exec.steps).forEach((s) => s.status === 'queued' && setStep(s.nodeId, { status: 'skipped' }))
  const ok = Object.values(exec.steps).filter((s) => s.status === 'success').length
  const tokens = exec.usage.reduce((a, u) => a + u.inputTokens + u.outputTokens, 0)
  log(`${opts.mode === 'step' ? 'Step executed' : 'Run completed'} · ${ok} steps · ${((Date.now() - started) / 1000).toFixed(1)}s${tokens ? ` · ${tokens.toLocaleString('en-IN')} tokens` : ''}`, 'ok')
  return finish('success')
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Summary numbers for an execution (used by the run summary and history). */
export function summarize(exec: Execution) {
  const tokens = exec.usage.reduce((a, u) => a + u.inputTokens + u.outputTokens, 0)
  const cost = exec.usage.reduce((a, u) => a + u.costInr, 0)
  const byModel = new Map<string, { tokens: number; cost: number; calls: number }>()
  exec.usage.forEach((u) => {
    const m = byModel.get(u.model) ?? { tokens: 0, cost: 0, calls: 0 }
    byModel.set(u.model, { tokens: m.tokens + u.inputTokens + u.outputTokens, cost: m.cost + u.costInr, calls: m.calls + 1 })
  })
  return { tokens, cost, durationMs: (exec.finishedAt ?? Date.now()) - exec.startedAt, byModel: [...byModel.entries()].map(([model, v]) => ({ model, ...v })) }
}
