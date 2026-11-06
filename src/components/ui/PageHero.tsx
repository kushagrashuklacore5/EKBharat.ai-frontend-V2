import { useEffect, useRef, type ReactNode } from 'react'
import { useReveal } from '../../hooks/useReveal'
import { PRODUCT_VISUALS, type VisualKind } from '../visuals/ProductVisuals'
import { Jaali } from './Jaali'

interface Props {
  eyebrow: string
  title: ReactNode
  lead: ReactNode
  actions?: ReactNode
  aside?: ReactNode
  /** a product visual shown in a dark showcase card, or any custom node */
  visual?: VisualKind | ReactNode
  accent?: string
  docTitle: string
  /** where this page sits in the platform stack, e.g. 'L4 · Compute' */
  level?: string
}

/** Header used by every inner page: copy on the left, a purpose-built visual on the right. */
export function PageHero({ eyebrow, title, lead, actions, aside, visual, accent = '#9ad5e5', docTitle, level }: Props) {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref)
  useEffect(() => {
    document.title = `${docTitle} — Ek भारत.AI`
  }, [docTitle])
  const Visual = typeof visual === 'string' ? PRODUCT_VISUALS[visual as VisualKind] : null
  const right = Visual ? (
    <div className="deep-card surface-dark stepwell relative overflow-hidden rounded-[20px] px-4 py-8 sm:px-8">
      <Jaali fade="radial" opacity={0.06} size={40} ink="#bfe3ea" />
      <div className="relative">
        <Visual />
      </div>
    </div>
  ) : (
    (visual as ReactNode) ?? null
  )
  return (
    <section ref={ref} className="atmos relative overflow-hidden pb-20 pt-32 md:pb-24 md:pt-40">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: `radial-gradient(45% 55% at 85% 30%, ${accent}40, transparent 70%)` }} />
        <div className="grid-bg absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_70%_at_75%_30%,black,transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#d2dee4]" />
      </div>
      <Jaali fade="left" opacity={0.05} size={44} />
      <div className={`container-x relative grid items-center gap-12 ${right ? 'lg:grid-cols-[1fr_1.05fr] lg:gap-16' : 'lg:grid-cols-[1.4fr_1fr]'}`}>
        <div>
          <div data-reveal aria-hidden="true" className="tri-hairline mb-7 w-24" />
          <p data-reveal className="eyebrow">
            {eyebrow}
            {level && <span className="ml-3 font-mono text-[11px] tracking-[0.1em] text-sandstone">{level}</span>}
          </p>
          <h1 data-reveal="1" className="display mt-6 text-[clamp(2.5rem,4.6vw,4.4rem)] text-fg">
            {title}
          </h1>
          <p data-reveal="2" className="mt-6 max-w-xl text-[1.08rem] leading-relaxed text-muted">
            {lead}
          </p>
          {actions && (
            <div data-reveal="3" className="mt-9 flex flex-wrap gap-3">
              {actions}
            </div>
          )}
          {right && aside && (
            <div data-reveal="4" className="mt-10 max-w-xl">
              {aside}
            </div>
          )}
        </div>
        {right ? <div data-reveal="2">{right}</div> : aside && <div data-reveal="3">{aside}</div>}
      </div>
    </section>
  )
}

/** Simple feature grid for inner pages. */
export function FeatureGrid({ items, cols = 3 }: { items: { t: string; d: string; tag?: string }[]; cols?: 2 | 3 | 4 }) {
  const c = cols === 4 ? 'lg:grid-cols-4' : cols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'
  return (
    <div className={`grid gap-x-10 gap-y-7 sm:grid-cols-2 sm:gap-y-10 ${c}`}>
      {items.map((it, i) => (
        <div key={it.t} data-reveal={String(i % 4)} className="border-t-2 border-line-strong pt-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
            {it.tag && <span className="rounded-full border border-line px-2 py-0.5 label text-muted">{it.tag}</span>}
          </div>
          <h3 className="mt-5 text-[17px] text-fg font-semibold">{it.t}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{it.d}</p>
        </div>
      ))}
    </div>
  )
}
