import { useEffect, useRef } from 'react'
import { Button } from '../components/ui/Button'
import { Jaali } from '../components/ui/Jaali'
import { useReveal } from '../hooks/useReveal'

const STATS = [
  { t: '10K+ calls handled', strong: true },
  { t: 'No manual dialing' },
  { t: '3x lead follow-up rate' },
  { t: 'Real-time CRM sync' },
]

export default function CallingAgentsPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  useEffect(() => {
    document.title = 'AI Calling Agents — Ek भारत.AI'
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
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
            <div className="max-w-2xl">
            <div data-reveal aria-hidden="true" className="tri-hairline mb-7 w-24" />
            <p data-reveal className="eyebrow">
              AI agents · voice automation
            </p>

            <h1 data-reveal="1" className="display mt-6 text-[clamp(2.6rem,5.2vw,4.8rem)] leading-[1.03] text-fg">
              <span className="text-gradient">AI Calling Agents</span>
              <br />
              That Actually Close Deals
            </h1>

            <p data-reveal="2" className="mt-6 max-w-xl text-[1.1rem] leading-relaxed text-muted">
              Not basic call bots — AI agents that manage tasks, nurture leads, and drive conversions
              on every call. High-performance voice automation for modern revenue teams.
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

            {/* Right: Vaani phone live-demo (reused from Ai-Product/static/index.html) */}
            <div data-reveal="2" className="flex justify-center lg:justify-end">
              <iframe
                src="/vaani-demo.html"
                title="Vaani — Live Voice Demo"
                allow="microphone; autoplay"
                loading="lazy"
                className="h-[720px] w-[360px] max-w-full overflow-hidden rounded-[46px] border-0 bg-transparent"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
