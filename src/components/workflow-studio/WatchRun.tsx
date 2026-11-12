import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getDef } from './engine/registry'
import { maskValue } from './engine/data'
import { modelLabel } from './engine/routing'
import { NodeIcon } from './StudioNode'
import { StepIcon } from './Panels'
import type { Execution, Workflow } from './engine/types'

/** Order main-flow nodes breadth-first from the triggers, so the list reads like the flow. */
function flowOrder(wf: Workflow) {
  const main = wf.nodes.filter((n) => getDef(n.type)?.role === 'main')
  const ids = new Set(main.map((n) => n.id))
  const seen = new Set<string>()
  const queue = main.filter((n) => getDef(n.type)?.kind === 'trigger').map((n) => n.id)
  const out: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    wf.edges.filter((e) => e.source === id && ids.has(e.target)).forEach((e) => queue.push(e.target))
  }
  main.forEach((n) => !seen.has(n.id) && out.push(n.id))
  return out.map((id) => main.find((n) => n.id === id)!)
}

/** Simplified, touch-friendly view of a workflow and its live execution, for small screens. */
export function WatchRun({ workflow, exec, mask }: { workflow: Workflow; exec: Execution | null; mask: boolean }) {
  const nodes = useMemo(() => flowOrder(workflow), [workflow])
  const [open, setOpen] = useState<string | null>(null)
  const done = exec ? Object.values(exec.steps).filter((s) => s.status === 'success').length : 0
  return (
    <div className="bg-[#1d3044] p-3 sm:p-4">
      {exec && (
        <div className="mb-3">
          <div className="flex justify-between text-[11.5px] font-semibold text-[#dfe8ef]">
            <span className="capitalize">{exec.status}</span>
            <span>
              {done}/{nodes.length} steps
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#8cc39b] transition-[width] duration-500" style={{ width: `${(done / Math.max(1, nodes.length)) * 100}%` }} />
          </div>
        </div>
      )}
      <ol className="space-y-2">
        {nodes.map((n, i) => {
          const s = exec?.steps[n.id]
          const out = s?.output?.outputs.flat() ?? null
          const expanded = open === n.id
          return (
            <li key={n.id} className="relative">
              {i < nodes.length - 1 && <span className="absolute left-[27px] top-[48px] h-[calc(100%-36px)] w-px bg-white/15" aria-hidden="true" />}
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : n.id)}
                className={`relative flex w-full items-center gap-3 rounded-[10px] bg-[#fbfcfd] p-2.5 text-left ${s?.status === 'running' ? 'ring-2 ring-[#7cc4dd]' : s?.status === 'error' ? 'ring-2 ring-[#c04a4a]' : ''} ${s?.status === 'skipped' ? 'opacity-50' : ''}`}
                aria-expanded={expanded}
              >
                <NodeIcon type={n.type} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#182b3d]">{n.name}</span>
                  <span className="block truncate text-[11px] text-[#5d7083]">
                    {s?.usage ? `${modelLabel(s.usage.model)} · ${s.usage.latencyMs}ms` : getDef(n.type)?.title}
                    {s?.startedAt && s.finishedAt ? ` · ${((s.finishedAt - s.startedAt) / 1000).toFixed(1)}s` : ''}
                  </span>
                </span>
                {s && <StepIcon s={s.status} />}
                <ChevronDown size={14} className={`text-[#8495a6] transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[#15283a] p-2.5 font-mono text-[11px] leading-relaxed text-[#cfe0ea]">
                  {s?.error ? `Error: ${s.error}` : out ? JSON.stringify(mask ? out.map((o) => maskValue(o)) : out, null, 2) : 'No output yet — run the workflow.'}
                </pre>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
