import type { ReactNode } from 'react'

export interface StepLevel {
  k: string
  title: string
  body: ReactNode
  /** small tag shown on the riser, e.g. the product name */
  tag?: string
}

/**
 * Stepwell Stack: levels drawn as terraces that step inward as they descend,
 * like the galleries of a stepwell. Reads top → bottom (surface → depth).
 * Each terrace has a sandstone lip and a recessed riser; reveals in sequence.
 */
export function StepwellStack({ levels, className = '', compact = false }: { levels: StepLevel[]; className?: string; compact?: boolean }) {
  const n = levels.length
  return (
    <ol className={`relative ${className}`}>
      {levels.map((l, i) => {
        // each step down is inset a little further on both sides
        const inset = `${(i / Math.max(1, n - 1)) * (compact ? 8 : 14)}%`
        return (
          <li key={l.k} data-reveal={String(Math.min(i, 5))} className="relative" style={{ marginInline: `clamp(0px, ${inset}, 9rem)` }}>
            <div
              className={`stepwell sandstone-lip relative grid items-center gap-x-6 gap-y-1 rounded-[10px] bg-ink-850/70 ${compact ? 'px-5 py-3.5' : 'px-6 py-5 md:px-8'} sm:grid-cols-[auto_1fr_auto]`}
              style={{ zIndex: n - i }}
            >
              <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-sandstone">{l.k}</span>
              <div>
                <p className={`font-semibold text-fg ${compact ? 'text-[14.5px]' : 'text-[16px]'}`}>{l.title}</p>
                <div className={`text-muted ${compact ? 'text-[12.5px]' : 'mt-1 text-[13.5px] leading-relaxed'}`}>{l.body}</div>
              </div>
              {l.tag && <span className="hidden rounded-md border border-line px-2 py-1 font-mono text-[10.5px] text-faint sm:block">{l.tag}</span>}
            </div>
            {/* riser between terraces */}
            {i < n - 1 && <div aria-hidden="true" className="mx-auto h-3 w-[calc(100%-2rem)] bg-gradient-to-b from-ink-700/70 to-transparent [clip-path:polygon(0_0,100%_0,97%_100%,3%_100%)]" />}
          </li>
        )
      })}
    </ol>
  )
}
