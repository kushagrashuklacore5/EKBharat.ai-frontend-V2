import { useEffect, useRef, useState } from 'react'
import { JetSky, PRELUDE_END, type JetProgress } from './JetSky'
import { hasWebGL } from '../hero/heroScene'
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

/**
 * Scroll-driven brand reveal. A tall section with a sticky stage; scroll
 * progress (not hijacked scrolling) choreographs the sequence:
 *  0.02–0.40  wordmark wipes in
 *  0.45–0.78  extrusion builds behind the letterforms · strata settle
 *  0.75–1.00  the mark eases up and the brand statement resolves
 */
export function BrandReveal() {
  const reduced = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [p, setP] = useState(reduced ? 1 : 0)
  // the jet draws the ribbon on every device with WebGL (phones included);
  // the heavier wafer → GPU prelude runs only on wide screens
  const [jet, setJet] = useState(false)
  const [prelude, setPrelude] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const on = () => {
      const gl = !reduced && hasWebGL()
      setJet(gl)
      setPrelude(gl && mq.matches)
    }
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [reduced])
  useEffect(() => {
    // section height changes with the jet; let ScrollTrigger re-measure
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 50)
    return () => window.clearTimeout(t)
  }, [jet, prelude])

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
        // one update per frame, and none when the change is too small to see
        raf = requestAnimationFrame(() => setP((prev) => (Math.abs(prev - self.progress) < 0.0015 && self.progress % 1 !== 0 ? prev : self.progress)))
      },
    })
    return () => {
      cancelAnimationFrame(raf)
      st.kill()
    }
    // re-create when the jet mode changes the section height
  }, [reduced, jet, prelude])

  // with the tech prelude, the logo sequence runs on the remaining scroll
  const lp = prelude ? range(p, PRELUDE_END, 1) : p
  const jetProgress = useRef<JetProgress>({ p: 0, lp: 0, prelude: false })
  jetProgress.current = { p, lp, prelude }

  const grow = ease(range(lp, 0, 0.22))
  const wipe = ease(range(lp, 0.02, 0.4))
  // stage 2: depth builds only after the characters have formed, and completes before the jet arrives (lp 0.64)
  const extrude = ease(range(lp, 0.4, 0.62))
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
      className={`relative ${reduced ? '' : prelude ? 'h-[340vh]' : 'h-[230vh]'}`}
      style={{ background: 'linear-gradient(180deg, #d2dee4 0%, #dbe4e9 40%, #dbe4e9 70%, #d2dee4 100%)' }}
    >
      <h2 id="brand-title" className="sr-only">
        Ek भारत.AI — build, connect, automate, orchestrate
      </h2>
      <div className={`${reduced ? 'py-28' : 'sticky top-0 h-[100svh]'} flex flex-col items-center justify-center overflow-hidden`}>
        {jet && <JetSky progress={jetProgress} sectionRef={sectionRef} prelude={prelude} />}
        {/* soft light that blooms with the reveal */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 size-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(154,213,229,.45), transparent)', opacity: 0.3 + extrude * 0.7, transform: `translate(-50%,-50%) scale(${0.6 + grow * 0.6})` }}
          aria-hidden="true"
        />
        <div
          className="container-x relative [--rise:-9vh] [--shrink:0.12] max-md:[--rise:calc(-122px-1.5svh)] max-md:[--shrink:0.08]"
          // phones: the closing statement is taller than the free space under a centred logo,
          // so the logo rises further to sit in the top band instead of being covered
          style={{ transform: `translateY(calc(var(--rise) * ${settle})) scale(calc(1 - var(--shrink) * ${settle}))`, transition: reduced ? undefined : 'none' }}
        >
          <div className="flex items-center justify-center gap-[2.5vw]">
            <div className="min-w-0 flex-1" style={{ clipPath: `inset(-20% ${(1 - wipe) * 100}% -40% 0)`, maxWidth: 980 }}>
              <BrandMark extrude={extrude} ribbonTone="faded" ribbon={ribbonIn} chakra={chakraIn} depth={16} animate={false} />
            </div>
          </div>
          <p className="mt-6 text-center text-[13px] font-semibold text-muted" style={{ opacity: range(lp, 0.4, 0.6) * (1 - statement) }}>
            Infrastructure · Intelligence · Automation
          </p>
        </div>

        {/* brand statement resolves at the end */}
        <div
          className="container-x absolute inset-x-0 bottom-[8vh] max-md:bottom-[3svh]"
          style={{ opacity: statement, transform: `translateY(${(1 - statement) * 30}px)`, pointerEvents: statement > 0.5 ? 'auto' : 'none' }}
        >
          <div className="grid gap-5 md:gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-end">
            <p className="display text-[clamp(1.3rem,5.4vw,1.6rem)] text-fg md:text-[clamp(1.6rem,2.6vw,2.4rem)]">
              One AI infrastructure &amp; intelligence partner — <span className="serif-accent text-teal">from silicon to workflow.</span>
            </p>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 md:gap-x-8 md:gap-y-5 lg:grid-cols-4">
              {VERBS.map(([v, d]) => (
                <div key={v} className="border-t border-line-strong pt-3">
                  <dt className="text-[14px] font-bold text-fg md:text-[15px]">{v}.</dt>
                  <dd className="mt-1 text-[12px] leading-snug text-muted md:text-[13px] md:leading-relaxed">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
