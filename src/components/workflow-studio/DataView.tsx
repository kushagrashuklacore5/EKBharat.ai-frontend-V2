import { useMemo, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { inferSchema, maskValue, type SchemaNode } from './engine/data'
import type { Item, JsonValue } from './engine/types'

type Mode = 'json' | 'table' | 'schema'

const cell = (v: JsonValue | undefined) => (v === undefined ? '' : v === null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** n8n-style data panel: JSON / Table / Schema views of an item array. */
export function DataView({ items, mask, empty, toolbar }: { items: Item[] | null; mask?: boolean; empty: ReactNode; toolbar?: ReactNode }) {
  const [mode, setMode] = useState<Mode>('json')
  const [copied, setCopied] = useState(false)
  const shown = useMemo(() => (items && mask ? (items.map((i) => maskValue(i)) as Item[]) : items), [items, mask])
  const json = useMemo(() => (shown ? JSON.stringify(shown.length === 1 ? shown[0] : shown, null, 2) : ''), [shown])
  const cols = useMemo(() => [...new Set((shown ?? []).flatMap((i) => Object.keys(i)))], [shown])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked — nothing to do */
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-1.5">
        <div role="tablist" aria-label="Data view" className="flex rounded-md bg-ink-900 p-0.5">
          {(['json', 'table', 'schema'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${mode === m ? 'bg-ink-850 text-fg shadow-[var(--shadow-sm)]' : 'text-muted hover:text-fg'}`}
            >
              {m === 'json' ? 'JSON' : m}
            </button>
          ))}
        </div>
        {shown && (
          <span className="font-mono text-[10.5px] text-faint">
            {shown.length} item{shown.length === 1 ? '' : 's'}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {toolbar}
          {shown && (
            <button type="button" onClick={copy} className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-muted hover:bg-ink-900 hover:text-fg" title="Copy JSON">
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </span>
      </div>
      <div className="mt-1.5 min-h-0 flex-1 overflow-auto rounded-md bg-[#1d3044]">
        {!shown ? (
          <div className="p-3 text-[12px] leading-relaxed text-[#9fb4c6]">{empty}</div>
        ) : mode === 'json' ? (
          <pre className="whitespace-pre-wrap break-all p-2.5 font-mono text-[11.5px] leading-relaxed text-[#cfe0ea]">{json}</pre>
        ) : mode === 'table' ? (
          shown.length ? (
            <table className="w-full border-collapse text-left font-mono text-[11px] text-[#cfe0ea]">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="sticky top-0 border-b border-white/10 bg-[#22384d] px-2 py-1.5 font-semibold text-[#9ad5e5]">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((it, r) => (
                  <tr key={r} className="odd:bg-white/[.02]">
                    {cols.map((c) => (
                      <td key={c} className="max-w-[220px] truncate border-b border-white/5 px-2 py-1" title={cell(it[c])}>
                        {cell(it[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-[12px] text-[#9fb4c6]">No items.</p>
          )
        ) : (
          <SchemaTree nodes={inferSchema(shown)} />
        )}
      </div>
    </div>
  )
}

function SchemaTree({ nodes, depth = 0 }: { nodes: SchemaNode[]; depth?: number }) {
  if (!nodes.length) return <p className="p-3 text-[12px] text-[#9fb4c6]">No fields.</p>
  return (
    <ul className={depth ? 'ml-3 border-l border-white/10 pl-2' : 'p-2.5'}>
      {nodes.map((n) => (
        <li key={n.key} className="py-0.5 font-mono text-[11.5px]">
          <span className="text-[#cfe0ea]">{n.key}</span> <span className="text-[#8cc39b]">{n.type}</span>
          {n.children && <SchemaTree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}
