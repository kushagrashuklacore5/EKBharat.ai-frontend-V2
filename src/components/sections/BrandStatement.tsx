import { Section } from '../ui/Section'
import { BrandMark } from '../ui/BrandMark'

const VERBS = [
  ['Build', 'Custom AI applications, agents and models — by your team or ours.'],
  ['Connect', 'Your data, systems and model providers, behind one platform.'],
  ['Automate', 'Business processes as visual, observable AI workflows.'],
  ['Orchestrate', 'Agents, models and compute, coordinated and governed.'],
]

/** Brand statement — the home of the AI BHARAT typographic shadow. */
export function BrandStatement() {
  return (
    <Section labelledBy="brand-title" className="bg-ink-900 py-24 md:py-32">
      <div className="container-x">
        <h2 id="brand-title" className="sr-only">
          AI Bharat
        </h2>
        <div data-reveal>
          <BrandMark depth={16} />
        </div>
        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <p data-reveal="1" className="max-w-md text-[1.5rem] font-semibold leading-snug tracking-[-0.02em] text-fg">
            One AI infrastructure &amp; intelligence partner —{' '}
            <span className="serif-accent text-[1.1em] font-normal text-cyan">from silicon to workflow.</span>
          </p>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {VERBS.map(([v, d], i) => (
              <div key={v} data-reveal={String(i + 1)} className="border-t border-line-strong pt-4">
                <dt className="text-[1.05rem] font-bold text-fg">{v}.</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  )
}
