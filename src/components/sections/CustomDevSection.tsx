import { useState, type CSSProperties } from 'react'
import { Section } from '../ui/Section'
import { SectionHeading } from '../ui/SectionHeading'
import { Button } from '../ui/Button'
import { USE_CASES } from '../../lib/content'

const JOURNEY: [string, string][] = [
  ['Idea', 'The process, the decision or the product you want to improve.'],
  ['Data', 'What exists, where it lives and what it can safely be used for.'],
  ['Model', 'Choose, adapt or fine-tune the models that fit the task.'],
  ['Engineering', 'Integrations, agents, workflows, guardrails and tests.'],
  ['Production', 'Deployed, monitored and maintained — with people in control.'],
]

const ART_COLORS =['#2f7fa8', '#2e8d81', '#c4852f', '#2c64a0', '#5867a8', '#5d7083']

export function CustomDevSection({ index = '07' }: { index?: string }) {
  const [open, setOpen] = useState(0)
  return (
    <Section id="custom-ai" labelledBy="custom-title" className="py-28 md:py-36">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <SectionHeading
            id="custom-title"
            index={index}
            eyebrow="Custom AI development"
            title={
              <>
                Prefer it built for you? <span className="serif-accent text-fg-soft">We’ll build it.</span>
              </>
            }
          />
          <div data-reveal="2">
            <p className="text-[1.05rem] leading-relaxed text-fg-soft">
              Tell us what you want to automate, improve or build. Our team will architect, develop, integrate and deploy your AI solution —
              and can maintain it afterwards.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button to="/build-with-us">Describe your project</Button>
              <Button to="/custom-ai-development" variant="secondary">
                Our services
              </Button>
            </div>
          </div>
        </div>

        {/* the build journey, drawn as terraces stepping down into production, over a faded engineering photograph */}
        <div className="relative mt-14">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -inset-y-10 overflow-hidden rounded-[14px] sm:-inset-x-6 [mask-image:radial-gradient(58%_62%_at_66%_50%,#000_18%,transparent_72%)]">
          <img src="/images/robotics-bitm-960.webp" alt="" loading="lazy" decoding="async" className="mono-photo h-full w-full object-cover opacity-[0.18]" />
        </div>
        <ol aria-label="How a custom AI system is built" className="relative grid gap-2 sm:grid-cols-5 sm:items-start">
          {JOURNEY.map(([t, d], i) => (
            <li key={t} data-reveal={String(i)} className="sm:[margin-top:var(--drop)]" style={{ '--drop': `${i * 18}px` } as CSSProperties}>
              <div className="stepwell sandstone-lip h-full rounded-[10px] bg-ink-850/70 px-5 pb-5 pt-4">
                <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-sandstone">0{i + 1}</span>
                <p className="mt-2 text-[15px] font-semibold text-fg">{t}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        </div>

        {/* expanding panels */}
        <div data-reveal="2" className="mt-14 flex flex-col gap-2 lg:h-[420px] lg:flex-row">
          {USE_CASES.map((u, i) => {
            const on = open === i
            const c = ART_COLORS[i]
            return (
              <button
                key={u.id}
                type="button"
                onMouseEnter={() => setOpen(i)}
                onFocus={() => setOpen(i)}
                onClick={() => setOpen(i)}
                aria-expanded={on}
                className={`group relative overflow-hidden rounded-xl border text-left transition-[flex-grow,border-color,background] duration-700 ease-[cubic-bezier(.16,1,.3,1)] lg:min-w-0 ${
                  on ? 'border-transparent bg-ink-850 shadow-[var(--shadow-md)] lg:flex-[4]' : 'border-line bg-ink-900 hover:bg-ink-850 lg:flex-[1]'
                }`}
              >
                {/* art */}
                <svg className="pointer-events-none absolute -right-10 -top-10 size-64 transition-opacity duration-700" style={{ opacity: on ? 0.9 : 0.25 }} viewBox="0 0 200 200" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, k) => (
                    <rect key={k} x={40 + k * 8} y={40 + k * 8} width={120 - k * 16} height={120 - k * 16} rx={14} fill="none" stroke={c} strokeOpacity={0.12 + k * 0.08} transform={`rotate(${k * 7} 100 100)`} />
                  ))}
                </svg>
                <div className="relative flex h-full flex-col p-6">
                  <span className="font-mono text-[12px] font-medium" style={{ color: c }}>
                    0{i + 1}
                  </span>
                  <span
                    className={`mt-3 text-xl font-semibold leading-snug tracking-tight text-fg transition-all duration-500 lg:mt-auto ${
                      on ? '' : 'lg:[writing-mode:vertical-rl] lg:rotate-180 lg:text-[15px] lg:font-semibold lg:text-fg-soft'
                    }`}
                  >
                    {u.title}
                  </span>
                  <span className={`grid transition-all duration-700 ${on ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <span className="overflow-hidden">
                      <span className="block max-w-md text-[14px] leading-relaxed text-fg-soft/85">{u.body}</span>
                      <span className="mt-4 flex flex-wrap gap-1.5">
                        {u.tags.map((t) => (
                          <span key={t} className="rounded-md bg-ink-900 px-2 py-1 text-[12px] font-semibold text-fg-soft">
                            {t}
                          </span>
                        ))}
                      </span>
                    </span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </Section>
  )
}
