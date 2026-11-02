import { useEffect, useRef, useState } from 'react'
import { JetSky, type JetProgress } from './JetSky'
import { hasWebGL } from '../hero/heroScene'
import { BrandMark } from '../ui/BrandMark'
import { MARK_SRC } from '../ui/Logo'
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

/** The Ek भारत.AI symbol with its strata as separately movable layers. */
/** The official mark; it rises and sharpens into place as the reveal progresses. */
function LayeredSymbol({ sep }: { sep: number }) {
  return (
    <img
      src={MARK_SRC}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="h-full w-full object-contain"
      style={{ transform: `translateY(${-sep * 6}px) rotate(${-sep * 3}deg)`, filter: `drop-shadow(0 ${8 + sep * 10}px ${14 + sep * 10}px rgba(15,39,71,${0.18 + sep * 0.12}))` }}
    />
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
  // fighter jet draws the ribbon: desktop with WebGL and full motion only
  const [jet, setJet] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const on = () => setJet(!reduced && mq.matches && hasWebGL())
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [reduced])
  useEffect(() => {
    // section height changes with the jet; let ScrollTrigger re-measure
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 50)
    return () => window.clearTimeout(t)
  }, [jet])

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

  const lp = p
  const jetProgress = useRef<JetProgress>({ p: 0, lp: 0 })
  jetProgress.current = { p, lp }

  const grow = ease(range(lp, 0, 0.22))
  const sep = Math.sin(Math.PI * range(lp, 0.2, 0.75)) // separate, then settle
  const wipe = ease(range(lp, 0.22, 0.52))
  const extrude = ease(range(lp, 0.45, 0.78))
  const settle = ease(range(lp, 0.75, 1))
  // last scroll stage: the logo's tricolour ribbon sweeps across the wordmark
  const ribbonIn = jet ? range(lp, 0.72, 0.94) : ease(range(lp, 0.72, 0.94))
  // the Ashoka Chakra rises in just ahead of the ribbon sweep
  const chakraIn = ease(range(lp, 0.64, 0.9))
  const statement = range(lp, 0.8, 0.98)

  return (
    <section
      ref={sectionRef}
      aria-labelledby="brand-title"
      className={`relative ${reduced ? '' : jet ? 'h-[320vh]' : 'h-[210vh] md:h-[260vh]'}`}
      style={{ background: 'linear-gradient(180deg, #d2dee4 0%, #dbe4e9 40%, #dbe4e9 70%, #d2dee4 100%)' }}
    >
      <h2 id="brand-title" className="sr-only">
        Ek भारत.AI — build, connect, automate, orchestrate
      </h2>
      <div className={`${reduced ? 'py-28' : 'sticky top-0 h-[100svh]'} flex flex-col items-center justify-center overflow-hidden`}>
        {jet && <JetSky progress={jetProgress} sectionRef={sectionRef} />}
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
              style={{ opacity: range(lp, 0, 0.08), transform: `translateX(${(1 - wipe) * 18}vw) scale(${0.45 + grow * 0.55})` }}
            >
              <LayeredSymbol sep={sep} />
            </div>
            <div className="min-w-0 flex-1" style={{ clipPath: `inset(-20% ${(1 - wipe) * 100}% -40% 0)`, maxWidth: 980 }}>
              <BrandMark extrude={extrude} ribbon={ribbonIn} chakra={chakraIn} depth={16} animate={false} />
            </div>
          </div>
          <p className="mt-6 text-center text-[13px] font-semibold text-muted" style={{ opacity: range(lp, 0.4, 0.6) * (1 - statement) }}>
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
