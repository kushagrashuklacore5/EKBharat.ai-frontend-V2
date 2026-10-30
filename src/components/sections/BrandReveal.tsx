import { useEffect, useRef, useState } from 'react'
import { BrandMark } from '../ui/BrandMark'
import { ScrollTrigger } from '../../lib/gsap'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const VERBS = [
  ['Build', 'Custom AI applications, agents and models — by your team or ours.'],
  ['Connect', 'Your data, systems and model providers, behind one platform.'],
  ['Automate', 'Business processes as visual, observable AI workflows.'],
  ['Orchestrate', 'Agents, models and compute, coordinated and governed.'],
]

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const ease = (x: number) => 1 - Math.pow(1 - x, 3)

/** The Bharat.Ai symbol with its strata as separately movable layers. */
function LayeredSymbol({ sep }: { sep: number }) {
  // sep 0..1 — strata slide out to the right and lift, revealing the construction
  const s = (k: number) => `translate(${sep * k * 6}px, ${-sep * k * 3}px)`
  return (
    <svg viewBox="-2 -6 52 50" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="br-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17475b" />
          <stop offset="1" stopColor="#38a6a2" />
        </linearGradient>
      </defs>
      <rect x="5" y="4" width="7" height="32" rx="2.2" fill="#102a40" />
      <g style={{ transform: s(1.6) }}>
        <path d="M13 4 H25 a6 6 0 0 1 0 12 H13 Z" fill="url(#br-g)" />
        <circle cx="25.5" cy="10" r="2.1" fill="#ebeff0" />
      </g>
      <g style={{ transform: s(0.9) }}>
        <path d="M13 17.5 H22 a2.5 2.5 0 0 1 0 5 H13 Z" fill="#102a40" opacity=".85" />
        <circle cx="22" cy="20" r="1.5" fill="#ebeff0" />
      </g>
      <g style={{ transform: s(2.3) }}>
        <path d="M13 24 H27.5 a6 6 0 0 1 0 12 H13 Z" fill="url(#br-g)" />
        <circle cx="27.5" cy="30" r="2.4" fill="#d5b68a" />
      </g>
      {/* construction lines appear while separated */}
      <g opacity={sep * 0.7}>
        {[10, 20, 30].map((y) => (
          <line key={y} x1="0" x2="48" y1={y} y2={y} stroke="#1d6a80" strokeWidth=".25" strokeDasharray="1 1.5" />
        ))}
      </g>
    </svg>
  )
}

/**
 * Scroll-driven brand reveal. A tall section with a sticky stage; scroll
 * progress (not hijacked scrolling) choreographs the sequence:
 *  0.00–0.22  compact symbol fades in and grows
 *  0.18–0.55  symbol strata separate · wordmark wipes in beside it
 *  0.45–0.78  extrusion builds behind the letterforms · strata settle
 *  0.75–1.00  the mark eases up and the brand statement resolves
 */
export function BrandReveal() {
  const reduced = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [p, setP] = useState(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) {
      setP(1)
      return
    }
    const el = sectionRef.current
    if (!el) return
    let raf = 0
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => setP(self.progress))
      },
    })
    return () => {
      cancelAnimationFrame(raf)
      st.kill()
    }
  }, [reduced])

  const grow = ease(range(p, 0, 0.22))
  const sep = Math.sin(Math.PI * range(p, 0.2, 0.75)) // separate, then settle
  const wipe = ease(range(p, 0.22, 0.52))
  const extrude = ease(range(p, 0.45, 0.78))
  const settle = ease(range(p, 0.75, 1))
  const statement = range(p, 0.8, 0.98)

  return (
    <section
      ref={sectionRef}
      aria-labelledby="brand-title"
      className={`relative ${reduced ? '' : 'h-[210vh] md:h-[260vh]'}`}
      style={{ background: 'linear-gradient(180deg, #d2dee4 0%, #dbe4e9 40%, #dbe4e9 70%, #d2dee4 100%)' }}
    >
      <h2 id="brand-title" className="sr-only">
        Bharat.Ai — build, connect, automate, orchestrate
      </h2>
      <div className={`${reduced ? 'py-28' : 'sticky top-0 h-[100svh]'} flex flex-col items-center justify-center overflow-hidden`}>
        {/* soft light that blooms with the reveal */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 size-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(154,213,229,.45), transparent)', opacity: 0.3 + extrude * 0.7, transform: `translate(-50%,-50%) scale(${0.6 + grow * 0.6})` }}
          aria-hidden="true"
        />
        <div
          className="container-x relative"
          style={{ transform: `translateY(${-settle * 9}vh) scale(${1 - settle * 0.12})`, transition: reduced ? undefined : 'none' }}
        >
          <div className="flex items-center justify-center gap-[2.5vw]">
            <div
              className="aspect-square w-[clamp(64px,13vw,170px)] shrink-0"
              style={{ opacity: range(p, 0, 0.08), transform: `translateX(${(1 - wipe) * 18}vw) scale(${0.45 + grow * 0.55})` }}
            >
              <LayeredSymbol sep={sep} />
            </div>
            <div className="min-w-0 flex-1" style={{ clipPath: `inset(-20% ${(1 - wipe) * 100}% -40% 0)`, maxWidth: 980 }}>
              <BrandMark extrude={extrude} depth={16} animate={false} />
            </div>
          </div>
          <p className="mt-6 text-center text-[13px] font-semibold text-muted" style={{ opacity: range(p, 0.4, 0.6) * (1 - statement) }}>
            Infrastructure · Intelligence · Automation
          </p>
        </div>

        {/* brand statement resolves at the end */}
        <div
          className="container-x absolute inset-x-0 bottom-[8vh]"
          style={{ opacity: statement, transform: `translateY(${(1 - statement) * 30}px)`, pointerEvents: statement > 0.5 ? 'auto' : 'none' }}
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-end">
            <p className="display text-[clamp(1.6rem,2.6vw,2.4rem)] text-fg">
              One AI infrastructure &amp; intelligence partner — <span className="serif-accent text-teal">from silicon to workflow.</span>
            </p>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
              {VERBS.map(([v, d]) => (
                <div key={v} className="border-t border-line-strong pt-3">
                  <dt className="text-[15px] font-bold text-fg">{v}.</dt>
                  <dd className="mt-1 text-[13px] leading-relaxed text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
