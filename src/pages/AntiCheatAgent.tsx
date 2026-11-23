import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Jaali } from '../components/ui/Jaali'
import { useReveal } from '../hooks/useReveal'

// The tablet app renders at a fixed design size; we scale it to fit the column.
const TABLET_W = 1120
const TABLET_H = 840

const STATS = [
  { t: 'Vision · Audio · Browser signals', strong: true },
  { t: 'Human proctor signs off' },
  { t: '100% timestamped evidence' },
  { t: 'Real-time incident flagging' },
]

export default function AntiCheatAgentPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  useEffect(() => {
    document.title = 'AI Cheating Detection — Ek भारत.AI'
  }, [])

  // Measure the tablet container and scale the full-size iframe down to fit it,
  // so the whole tablet stays visible and its internal layout never collapses.
  const tabletBox = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    const el = tabletBox.current
    if (!el) return
    const update = () => setScale(el.clientWidth / TABLET_W)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref}>
      <section className="atmos relative flex min-h-[88vh] items-center overflow-hidden pb-20 pt-32 md:pt-40">
        {/* Ambient Ek Bharat lighting */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(48% 55% at 78% 25%, #3a90aa38, transparent 70%)' }}
          />
          <div className="grid-bg absolute inset-0 opacity-50 [mask-image:radial-gradient(70%_70%_at_30%_35%,black,transparent)]" />
        </div>
        <Jaali fade="left" opacity={0.05} size={44} />

        <div className="container-x relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,680px)] lg:gap-16">
            <div className="max-w-2xl">
            <div data-reveal aria-hidden="true" className="tri-hairline mb-7 w-24" />
            <p data-reveal className="eyebrow">
              AI agents · academic integrity
            </p>

            <h1 data-reveal="1" className="display mt-6 text-[clamp(2.6rem,5.2vw,4.8rem)] leading-[1.03] text-fg">
              <span className="text-gradient">AI Cheating Detection</span>
              <br />
              That Protects Exam Integrity
            </h1>

            <p data-reveal="2" className="mt-6 max-w-xl text-[1.1rem] leading-relaxed text-muted">
              Not just a lockdown browser — AI agents that watch vision, audio and session telemetry
              in real time, flag suspicious behaviour, and hand timestamped evidence to human proctors
              for the final call.
            </p>

            <div data-reveal="3" className="mt-9 flex flex-wrap gap-3">
              <Button to="/contact">Get Started Today</Button>
              <Button to="/solutions" variant="secondary">
                See features
              </Button>
            </div>

            {/* Stat row */}
            <div data-reveal="4" className="mt-11 border-t border-line pt-6">
              <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
                {STATS.map((s) => (
                  <li
                    key={s.t}
                    className={`flex items-center gap-2 font-mono text-[12.5px] tracking-[-0.01em] ${
                      s.strong ? 'font-semibold text-fg' : 'text-muted'
                    }`}
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-cyan shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
                    {s.t}
                  </li>
                ))}
              </ul>
            </div>
            </div>

            {/* Right: proctoring tablet (reused from Ai-Product/agent-1 frontend).
                Rendered at its full design size (1120×840) and scaled down to fit the
                column so the in-tablet layout never collapses or overlaps. */}
            <div data-reveal="2" className="flex justify-center lg:justify-end">
              <div
                ref={tabletBox}
                className="relative w-full max-w-[680px] overflow-hidden"
                style={{ aspectRatio: `${TABLET_W} / ${TABLET_H}` }}
              >
                <iframe
                  src="/anticheat/index.html"
                  title="AI Proctoring — Live Tablet Demo"
                  allow="camera; microphone; autoplay"
                  loading="lazy"
                  className="absolute left-0 top-0 origin-top-left border-0 bg-transparent"
                  style={{ width: `${TABLET_W}px`, height: `${TABLET_H}px`, transform: `scale(${scale})` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
