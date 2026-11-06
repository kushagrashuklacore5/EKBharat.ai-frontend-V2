import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import { FinalCta } from '../components/sections/FinalCta'
import { Jaali } from '../components/ui/Jaali'
import { PhotoReveal } from '../components/ui/PhotoReveal'
import { PRODUCT_VISUALS, type VisualKind } from '../components/visuals/ProductVisuals'
import { useReveal } from '../hooks/useReveal'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { INDUSTRIES } from '../lib/content'
import { SITE } from '../lib/config'
import { LOGO_V2, LOGO_V2_SM } from '../components/ui/Logo'
import type { ImageKey } from '../lib/imageCredits'

/* ───────────────────────── content ───────────────────────── */

const GLANCE: [string, string][] = [
  ['What we are', 'An AI technology and infrastructure company — platform and engineering team in one.'],
  ['What we solve', 'Getting AI out of pilots and into reliable, governed work inside real processes.'],
  ['What we work on', 'GPU compute, multi-model orchestration, AI agents, workflow automation and custom AI.'],
  ['Who we build for', 'Businesses that want outcomes, and developers who want building blocks.'],
]

const FRICTION: { k: string; problem: string; answer: string; to: string }[] = [
  {
    k: 'Compute',
    problem: 'GPUs are expensive to buy, slow to procure and hard to size before you know the workload.',
    answer: 'Partner-powered GPU capacity by the hour, the month or dedicated — sized with you.',
    to: '/gpu-cloud',
  },
  {
    k: 'Models',
    problem: 'Every provider has its own API, pricing and failure modes, and the best model changes by task.',
    answer: 'One gateway that routes each request by task, cost and latency — with fallbacks.',
    to: '/ai-orchestration',
  },
  {
    k: 'Integration',
    problem: 'AI tools live in separate tabs, disconnected from the data and systems work depends on.',
    answer: 'Connectors, agents and knowledge retrieval wired into the systems you already run.',
    to: '/ai-agents',
  },
  {
    k: 'Production',
    problem: 'Demos impress, but few survive contact with real data, permissions, audits and edge cases.',
    answer: 'Engineering discipline: evaluation, guardrails, monitoring and people in the loop.',
    to: '/custom-ai-development',
  },
  {
    k: 'Process',
    problem: 'Multi-step business processes cross teams, documents and approvals — too complex for a chatbot.',
    answer: 'Visual workflows that combine models, agents, rules and human approvals end to end.',
    to: '/workflow-studio',
  },
]

const BUILD: { n: string; t: string; d: string; to: string; cta: string; visual: VisualKind; span: string }[] = [
  {
    n: '01',
    t: 'GPU Cloud & compute',
    d: 'High-performance GPU capacity for inference, fine-tuning and training — provisioned through infrastructure partners and managed by our team.',
    to: '/gpu-cloud',
    cta: 'Explore GPU Cloud',
    visual: 'gpu',
    span: 'sm:col-span-2 lg:col-span-7 lg:row-span-2',
  },
  { n: '02', t: 'AI agents', d: 'Specialised agents that plan, use tools, check each other and hand decisions to people.', to: '/ai-agents', cta: 'How agents work', visual: 'agents', span: 'lg:col-span-5' },
  { n: '03', t: 'Multi-model orchestration', d: 'Route every request to the right model, with policies for cost, speed and data handling.', to: '/ai-orchestration', cta: 'See routing', visual: 'router', span: 'lg:col-span-5' },
  { n: '04', t: 'Workflow Studio', d: 'A visual canvas to automate processes with triggers, models, agents, branches and approvals.', to: '/workflow-studio', cta: 'Open the Studio', visual: 'workflow', span: 'sm:col-span-2 lg:col-span-6' },
  { n: '05', t: 'Custom AI engineering', d: 'Tell us the outcome. We design, build, integrate, deploy and maintain the whole system.', to: '/custom-ai-development', cta: 'Start a project', visual: 'custom', span: 'sm:col-span-2 lg:col-span-6' },
]

const ASCENT = [
  { t: 'Compute', d: 'GPUs and memory that run models' },
  { t: 'Models', d: 'Language, vision and speech models' },
  { t: 'Intelligence', d: 'Retrieval, reasoning and routing' },
  { t: 'Agents', d: 'Specialists that act with tools' },
  { t: 'Workflows', d: 'Processes with approvals and rules' },
  { t: 'Outcomes', d: 'Faster service, fewer errors, lower cost' },
]

const SERVE_PHOTOS: Partial<Record<string, ImageKey>> = {
  education: 'coding-bangalore',
  healthcare: 'mri-jaipur',
  ecommerce: 'retail-bhopal',
  manufacturing: 'mg-plant',
  'enterprise-operations': 'noc-architel',
  'customer-support': 'bpo-dantewada',
}

const VISION: [string, string][] = [
  ['One platform', 'Compute, models, agents and workflows designed to work together — not five tools to integrate.'],
  ['One partner', 'Use the platform yourself or have our team build it; either way, one team is accountable.'],
  ['One India', 'Built for organisations that work across many languages and regions, and the people they serve.'],
]

/* ───────────────────────── page ───────────────────────── */

export default function AboutPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  useEffect(() => {
    document.title = 'About — Ek भारत.AI'
  }, [])

  return (
    <div ref={ref} className="overflow-x-clip">
      {/* A · who we are — editorial opening */}
      <section aria-labelledby="about-title" className="atmos relative isolate overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-36 lg:pt-40">
        <Jaali fade="right" opacity={0.06} size={44} />
        <div className="container-x relative">
          <div aria-hidden="true" data-reveal className="tri-hairline mb-7 w-24" />
          <p data-reveal className="eyebrow">
            About Ek भारत.AI
          </p>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <h1 id="about-title" data-reveal="1" className="display text-[clamp(2.25rem,6.2vw,5.2rem)] leading-[1.02] text-fg">
              We put AI to work — <span className="serif-accent text-gradient">from the GPU to the workflow.</span>
            </h1>
            <p data-reveal="2" className="max-w-md text-[1.05rem] leading-relaxed text-muted lg:pb-3">
              Ek भारत.AI gives businesses and developers the compute, models, agents and automation to build with AI — and an engineering team that
              can build the whole system for you.
            </p>
          </div>

          {/* the brand, presented */}
          <div data-reveal="2" className="relative mt-12 overflow-hidden rounded-[18px] border border-line bg-ink-850/60 px-5 py-10 sm:px-10 sm:py-14">
            <Jaali fade="radial" opacity={0.05} size={36} />
            <img
              src={LOGO_V2}
              srcSet={`${LOGO_V2_SM} 480w, ${LOGO_V2} 1200w`}
              sizes="(min-width: 1024px) 900px, 90vw"
              alt="Ek भारत.AI"
              width={1495}
              height={458}
              className="relative mx-auto block h-auto w-full max-w-[900px]"
            />
          </div>

          {/* at a glance */}
          <dl className="mt-10 grid gap-x-8 gap-y-6 border-t border-line-strong pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {GLANCE.map(([t, d], i) => (
              <div key={t} data-reveal={String(i)}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-sandstone">{t}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-fg-soft">{d}</dd>
              </div>
            ))}
          </dl>
          <p data-reveal="3" className="mt-8 text-[13px] text-faint">
            Ek भारत.AI is owned and operated by {SITE.owner}
          </p>
        </div>
      </section>

      {/* B · the problem — friction → answer */}
      <FrictionSection />

      {/* C · what we build — five capabilities, asymmetric layout */}
      <Section className="py-20 md:py-28">
        <div className="container-x">
          <div className="max-w-3xl">
            <p data-reveal className="eyebrow">
              What we build
            </p>
            <h2 data-reveal="1" className="display mt-5 text-[clamp(1.9rem,4vw,3.2rem)] text-fg">
              Five capabilities, <span className="serif-accent text-fg-soft">one system.</span>
            </h2>
            <p data-reveal="2" className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-muted">
              Use any one on its own, or let them work together. Every capability has its own product page with live demonstrations.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
            {BUILD.map((b, i) => {
              const Visual = PRODUCT_VISUALS[b.visual]
              const big = i === 0
              return (
                <Link
                  key={b.n}
                  to={b.to}
                  data-reveal={String(i % 3)}
                  className={`deep-card surface-dark group relative flex flex-col overflow-hidden rounded-[16px] p-6 transition-transform duration-500 hover:-translate-y-0.5 sm:p-8 ${b.span}`}
                >
                  <div className={`pointer-events-none relative -mx-2 overflow-hidden ${big ? 'mb-6 max-h-[300px] sm:-mx-4 lg:max-h-none' : 'mb-4 max-h-[170px]'}`}>
                    <Visual />
                  </div>
                  <span className="font-mono text-[11px] text-sandstone">{b.n}</span>
                  <h3 className={`mt-2 font-semibold text-fg ${big ? 'text-[1.6rem]' : 'text-[1.2rem]'}`}>{b.t}</h3>
                  <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fg-soft">{b.d}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[13.5px] font-semibold text-cyan transition-colors group-hover:text-fg">
                    {b.cta} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </Section>

      {/* D · how it connects — scroll-driven ascent */}
      <AscentSection />

      {/* E · who we serve — interactive index */}
      <ServeSection />

      {/* F · vision */}
      <Section className="relative overflow-hidden py-20 md:py-28">
        <Jaali fade="left" opacity={0.06} size={44} />
        <div className="container-x relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p data-reveal className="eyebrow">
              Our vision
            </p>
            <p data-reveal="1" lang="hi" className="mt-6 font-[Mukta] text-[clamp(4.5rem,13vw,9rem)] font-extrabold leading-[0.85] tracking-tight text-fg">
              एक
            </p>
            <p data-reveal="2" className="mt-3 font-mono text-[12px] tracking-[0.12em] text-sandstone">
              EK · ONE
            </p>
            <h2 data-reveal="2" className="display mt-8 max-w-xl text-[clamp(1.6rem,3vw,2.4rem)] text-fg">
              Advanced AI should be something every business can build with — not only the few with their own data centres.
            </h2>
            <p data-reveal="3" className="mt-5 max-w-xl leading-relaxed text-muted">
              India already engineers at the frontier, from space missions to digital public infrastructure used by hundreds of millions. We want Indian
              organisations to adopt AI to the same standard: built properly, run reliably and accountable to the people who depend on it.
            </p>
          </div>
          <div>
            <PhotoReveal img="isro-cleanroom" alt="The Chandrayaan-3 lander being prepared in an ISRO clean room" aspect="aspect-[16/10]" sizes="(min-width: 1024px) 55vw, 100vw" />
            <p className="mt-2 text-[12px] text-faint">Used for context only; Ek भारत.AI is not affiliated with ISRO.</p>
            <dl className="mt-8 space-y-5">
              {VISION.map(([t, d], i) => (
                <div key={t} data-reveal={String(i)} className="grid gap-1 border-t border-line-strong pt-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                  <dt className="font-semibold text-fg">{t}</dt>
                  <dd className="text-[14.5px] leading-relaxed text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      {/* G · closing */}
      <FinalCta
        title="Let’s put AI to work in your organisation."
        body="Explore the platform, talk to us about a use case, or tell us what you want built — we’ll tell you honestly where AI helps and where it doesn’t."
      />
    </div>
  )
}

/* ───────────────────────── B · friction ───────────────────────── */

function FrictionSection() {
  const [active, setActive] = useState(0)
  const items = useRef<(HTMLLIElement | null)[]>([])
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: '-45% 0px -45% 0px' },
    )
    items.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])
  return (
    <Section className="surface-dark deep-blend relative overflow-hidden pb-40 pt-40 md:pb-48 md:pt-48">
      <div className="container-x grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p data-reveal className="eyebrow">
            The problem we address
          </p>
          <h2 data-reveal="1" className="display mt-5 text-[clamp(1.9rem,4vw,3.2rem)] text-fg">
            Most AI never leaves the demo.
          </h2>
          <p data-reveal="2" className="mt-5 max-w-md leading-relaxed text-fg-soft">
            Between an impressive prototype and a system people rely on, organisations hit the same five points of friction.
          </p>
          {/* progress rail */}
          <ol aria-hidden="true" className="mt-10 hidden gap-2 lg:flex">
            {FRICTION.map((f, i) => (
              <li key={f.k} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= active ? 'bg-teal' : 'bg-line-strong'}`} />
            ))}
          </ol>
          <p aria-hidden="true" className="mt-3 hidden font-mono text-[11px] text-muted lg:block">
            {String(active + 1).padStart(2, '0')} / 05 · {FRICTION[active].k}
          </p>
        </div>
        <ol className="space-y-4">
          {FRICTION.map((f, i) => {
            const on = i === active
            return (
              <li
                key={f.k}
                data-i={i}
                ref={(el) => {
                  items.current[i] = el
                }}
                className={`rounded-[14px] border p-6 transition-all duration-700 sm:p-8 ${on ? 'border-line-strong bg-ink-850' : 'border-line bg-ink-900/40 lg:opacity-55'}`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] text-sandstone">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="text-[1.25rem] font-semibold text-fg">{f.k}</h3>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-6">
                  <div>
                    <p className="label text-faint">The friction</p>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-fg-soft">{f.problem}</p>
                  </div>
                  <div className="sm:border-l sm:border-line sm:pl-6">
                    <p className="label text-teal">What changes</p>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-fg">{f.answer}</p>
                    <Link to={f.to} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-cyan hover:text-fg">
                      Learn more <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </Section>
  )
}

/* ───────────────────────── D · ascent ───────────────────────── */

function AscentSection() {
  const wrap = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [p, setP] = useState(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = wrap.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setP(Math.min(1, Math.max(0, (window.innerHeight * 0.9 - r.top) / (window.innerHeight * 0.6))))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
    }
  }, [reduced])
  const n = ASCENT.length
  const lit = Math.round(p * n)
  return (
    <Section className="py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-3xl">
          <p data-reveal className="eyebrow">
            How it connects
          </p>
          <h2 data-reveal="1" className="display mt-5 text-[clamp(1.9rem,4vw,3.2rem)] text-fg">
            Every outcome rests on <span className="serif-accent text-fg-soft">the level below it.</span>
          </h2>
          <p data-reveal="2" className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-muted">
            Like the terraces of a stepwell, each layer is built on the one beneath. Scroll to follow a request as it rises from silicon to a business result.
          </p>
        </div>

        {/* desktop: a rising staircase · mobile: a vertical ladder */}
        <div ref={wrap} className="relative mt-14">
          <ol className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 lg:items-end lg:gap-2">
            {ASCENT.map((a, i) => {
              const on = i < lit
              return (
                <li
                  key={a.t}
                  className="relative lg:[height:var(--h)]"
                  style={{ '--h': `${150 + i * 34}px` } as CSSProperties}
                >
                  <div
                    className={`stepwell sandstone-lip flex h-full flex-col justify-end rounded-[10px] p-4 transition-all duration-700 sm:p-5 ${
                      on ? 'bg-[#17475b] text-white' : 'bg-ink-850/70'
                    }`}
                  >
                    <span className={`font-mono text-[10.5px] ${on ? 'text-[#d9bd92]' : 'text-sandstone'}`}>L{String(i + 1).padStart(2, '0')}</span>
                    <p className={`mt-1 text-[16px] font-semibold ${on ? 'text-white' : 'text-fg'}`}>{a.t}</p>
                    <p className={`mt-1 text-[12.5px] leading-snug ${on ? 'text-white/75' : 'text-muted'}`}>{a.d}</p>
                  </div>
                  {/* signal hop to the next level */}
                  {i < n - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute -bottom-2.5 left-6 z-10 size-2 rounded-full transition-all duration-500 sm:hidden lg:-right-[5px] lg:bottom-auto lg:left-auto lg:top-6 lg:block ${
                        on ? 'bg-[#e8913a] shadow-[0_0_0_4px_rgba(232,145,58,.18)]' : 'bg-line-strong'
                      }`}
                    />
                  )}
                </li>
              )
            })}
          </ol>
          <div aria-hidden="true" className="tri-hairline mt-6 transition-[width] duration-700" style={{ width: `${Math.max(8, p * 100)}%` }} />
        </div>
      </div>
    </Section>
  )
}

/* ───────────────────────── E · who we serve ───────────────────────── */

function ServeSection() {
  const [i, setI] = useState(0)
  const ind = INDUSTRIES[i]
  const photo = SERVE_PHOTOS[ind.id]
  return (
    <Section className="py-20 md:py-28">
      <div className="container-x">
        <p data-reveal className="eyebrow">
          Who we serve
        </p>
        <h2 data-reveal="1" className="display mt-5 max-w-3xl text-[clamp(1.9rem,4vw,3.2rem)] text-fg">
          Organisations with real processes, <span className="serif-accent text-fg-soft">and real constraints.</span>
        </h2>
        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          {/* index */}
          <ul role="tablist" aria-label="Industries" className="border-t border-line-strong">
            {INDUSTRIES.map((x, k) => (
              <li key={x.id} className="border-b border-line">
                <button
                  type="button"
                  role="tab"
                  aria-selected={k === i}
                  onClick={() => setI(k)}
                  onMouseEnter={() => setI(k)}
                  className="group flex w-full items-baseline gap-4 py-3.5 text-left"
                >
                  <span className="w-6 font-mono text-[11px] text-sandstone">{String(k + 1).padStart(2, '0')}</span>
                  <span className={`text-[clamp(1.25rem,2.4vw,1.75rem)] font-semibold tracking-tight transition-colors ${k === i ? 'text-fg' : 'text-faint group-hover:text-fg-soft'}`}>
                    {x.name}
                  </span>
                  <ArrowRight size={16} className={`ml-auto shrink-0 transition-all ${k === i ? 'translate-x-0 text-teal opacity-100' : '-translate-x-2 opacity-0'}`} />
                </button>
              </li>
            ))}
          </ul>
          {/* detail */}
          <div role="tabpanel" aria-live="polite" className="lg:sticky lg:top-28">
            {photo && <PhotoReveal key={photo} img={photo} alt={`${ind.name}: representative photograph`} aspect="aspect-[16/9]" sizes="(min-width: 1024px) 50vw, 100vw" />}
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="label text-faint">The challenge</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-fg-soft">{ind.problem}</p>
              </div>
              <div>
                <p className="label text-teal">Example applications</p>
                <ul className="mt-2 space-y-1.5">
                  {ind.examples.map((e) => (
                    <li key={e} className="flex gap-2 text-[14px] text-fg">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-saffron" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button to={`/solutions#${ind.id}`} variant="secondary">
                {ind.name} solutions
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
