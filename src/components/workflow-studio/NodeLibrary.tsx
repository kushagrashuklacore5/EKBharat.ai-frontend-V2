import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { GROUPS, LIBRARY, type NodeTypeDef } from './engine/registry'
import { NodeIcon } from './StudioNode'

export const DRAG_MIME = 'application/x-ekb-node'

const BADGE: Record<NodeTypeDef['availability'], { t: string; c: string } | null> = {
  builtin: null,
  simulated: { t: 'demo', c: 'text-cyan' },
  planned: { t: 'planned', c: 'text-amber' },
}

/** Searchable, grouped node library. Used as the sidebar and as the Tab-search palette. */
export function NodeLibrary({
  onPick,
  autoFocus,
  filter,
  onEscape,
}: {
  onPick(type: string): void
  autoFocus?: boolean
  /** restrict to some node types (e.g. only main-flow nodes when inserting on an edge) */
  filter?: (d: NodeTypeDef) => boolean
  onEscape?(): void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return LIBRARY.filter((d) => (!filter || filter(d)) && (!s || `${d.title} ${d.subtitle} ${d.group} ${d.type}`.toLowerCase().includes(s)))
  }, [q, filter])
  const groups = GROUPS.filter((g) => list.some((d) => d.group === g))
  const flat = groups.flatMap((g) => list.filter((d) => d.group === g))

  const onDragStart = (e: DragEvent, type: string) => {
    e.dataTransfer.setData(DRAG_MIME, type)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="p-3">
        <label className="flex items-center gap-2 rounded-md bg-ink-850 px-2.5 py-2 shadow-[inset_0_0_0_1px_var(--color-line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-cyan)]">
          <Search size={14} className="text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => (setQ(e.target.value), setActive(0))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onEscape?.()
              else if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(flat.length - 1, a + 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
              else if (e.key === 'Enter' && flat[active]) onPick(flat[active].type)
            }}
            placeholder="Search nodes"
            aria-label="Search nodes"
            className="w-full bg-transparent text-[13px] text-fg placeholder:text-faint focus:outline-none"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <p className="px-2 pb-1 text-[11.5px] font-bold text-faint">
              {g === 'India Stack' ? '🇮🇳 India Stack' : g}
            </p>
            {list
              .filter((d) => d.group === g)
              .map((d) => {
                const idx = flat.indexOf(d)
                const b = BADGE[d.availability]
                return (
                  <button
                    key={d.type}
                    type="button"
                    draggable
                    onDragStart={(e) => onDragStart(e, d.type)}
                    onClick={() => onPick(d.type)}
                    onMouseEnter={() => setActive(idx)}
                    className={`group flex w-full cursor-grab items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors active:cursor-grabbing ${idx === active && q ? 'bg-ink-850 shadow-[var(--shadow-sm)]' : 'hover:bg-ink-850 hover:shadow-[var(--shadow-sm)]'}`}
                    title={`${d.subtitle} — drag onto the canvas or click to add`}
                  >
                    <NodeIcon type={d.type} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-fg">{d.title}</span>
                        {b && <span className={`shrink-0 font-mono text-[9.5px] font-semibold ${b.c}`}>{b.t}</span>}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">{d.subtitle}</span>
                    </span>
                    <Plus size={14} className="text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )
              })}
          </div>
        ))}
        {!list.length && <p className="px-2 text-[13px] text-muted">No nodes match “{q}”.</p>}
        <p className="px-2 pt-1 text-[10.5px] leading-snug text-faint">
          <span className="font-semibold text-leaf">No badge</span> runs in your browser · <span className="font-semibold text-cyan">demo</span> uses a simulation adapter · <span className="font-semibold text-amber">planned</span> connector on the roadmap. No integration credentials are stored here.
        </p>
      </div>
    </div>
  )
}
