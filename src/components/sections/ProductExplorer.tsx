import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Section } from '../ui/Section'
import { PRODUCT_VISUALS, type VisualKind } from '../visuals/ProductVisuals'
import { Jaali } from '../ui/Jaali'

interface Product {
  id: string
  visual: VisualKind
  name: string
  kicker: string
  line: string
  points: string[]
  to: string
  cta: string
  /** platform level, read like a stepwell from the surface down */
  level: string
  depth: number
}

export const PRODUCTS: Product[] = [
  {
    id: 'p-studio',
    visual: 'workflow',
    name: 'Workflow Studio',
    kicker: 'Flagship · visual automation',
    line: 'Drag, connect and run AI-native workflows — triggers, agents, models, data and human approvals on one canvas.',
    points: ['Agent, LLM, RAG and database nodes', 'Branches, loops and parallel paths', 'Execution history and managed deployment'],
    to: '/workflow-studio',
    cta: 'Explore Workflow Studio',
    level: 'L1 · Workflows',
    depth: 0,
  },
  {
    id: 'p-agents',
    visual: 'agents',
    name: 'AI Agents',
    kicker: 'Multi-agent orchestration',
    line: 'Specialised agents that plan, delegate, use tools and verify each other — coordinated by an orchestrator you control.',
    points: ['Task delegation and shared context', 'Tool calling with memory', 'Human approval where it matters'],
    to: '/ai-agents',
    cta: 'How our agents work',
    level: 'L2 · Agents',
    depth: 1,
  },
  {
    id: 'p-router',
    visual: 'router',
    name: 'Multi-Model Orchestration',
    kicker: 'One gateway, many models',
    line: 'Route every request to the right model by task, cost, latency and availability — with fallbacks and validated outputs.',
    points: ['Provider abstraction behind one API', 'Policy-based routing', 'Fallbacks and structured outputs'],
    to: '/ai-orchestration',
    cta: 'See model routing',
    level: 'L3 · Models',
    depth: 2,
  },
  {
    id: 'p-gpu',
    visual: 'gpu',
    name: 'GPU Cloud',
    kicker: 'Partner-powered compute',
    line: 'High-performance GPU capacity for inference, fine-tuning and training — without buying or maintaining hardware.',
    points: ['Pay-as-you-go, monthly or dedicated', 'Model hosting and serving', 'Sized and managed by our team'],
    to: '/gpu-cloud',
    cta: 'Explore GPU infrastructure',
    level: 'L4 · Compute',
    depth: 3,
  },
  {
    id: 'p-custom',
    visual: 'custom',
    name: 'Custom AI Development',
    kicker: 'We build it with you',
    line: 'Tell us the outcome. We architect, build, integrate and deploy the complete AI application — and can run it for you.',
    points: ['Assistants, RAG, voice and document AI', 'Integrations with your systems', 'Managed after launch'],
    to: '/custom-ai-development',
    cta: 'Start a project',
    level: 'All levels · built for you',
    depth: 0,
  },
  {
    id: 'p-enterprise',
    visual: 'enterprise',
    name: 'Enterprise AI Solutions',
    kicker: 'Industry systems',
    line: 'Governed AI systems that connect infrastructure, knowledge and applications for real operations in your sector.',
    points: ['Industry-specific solutions', 'Permission-aware knowledge', 'Audit trails and controls'],
    to: '/solutions',
    cta: 'View solutions',
    level: 'All levels · by industry',
    depth: 0,
  },
]

export function ProductExplorer() {
  const [active, setActive] = useState(0)
  const cardRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i))
        })
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    cardRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  const go = (i: number) => cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  return (
    <Section id="platform" labelledBy="platform-title" className="atmos-ice py-28 md:py-36">
      <div className="container-x grid gap-12 lg:grid-cols-[0.8fr_1.6fr] lg:gap-16">
        {/* sticky index */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p data-reveal className="eyebrow">
            Our ecosystem
          </p>
          <h2 id="platform-title" data-reveal="1" className="display mt-5 text-[clamp(2.3rem,4vw,3.6rem)] text-fg">
            Everything you need for the AI lifecycle.
          </h2>
          <p data-reveal="2" className="mt-5 max-w-sm text-[1.0625rem] leading-relaxed text-muted">
            Compute, models, agents, workflows and the team to assemble them — one platform, built to work together.
          </p>
          <ol data-reveal="3" className="mt-10 hidden space-y-1 lg:block" aria-label="Products">
            {PRODUCTS.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={active === i ? 'true' : undefined}
                  style={{ marginLeft: p.depth * 12 }}
                  className={`group flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-left transition-colors duration-500 ${
                    active === i ? 'bg-ink-850 shadow-[var(--shadow-sm)]' : 'hover:bg-ink-850/50'
                  }`}
                >
                  <span className={`w-6 font-mono text-[11px] transition-colors ${active === i ? 'text-sandstone' : 'text-faint'}`}>{p.level.startsWith('L') ? p.level.slice(0, 2) : '··'}</span>
                  <span className={`text-[15px] font-semibold transition-colors ${active === i ? 'text-fg' : 'text-muted group-hover:text-fg-soft'}`}>{p.name}</span>
                  <span className={`ml-auto h-0.5 rounded-full bg-teal transition-all duration-700 ${active === i ? 'w-8 opacity-100' : 'w-0 opacity-0'}`} />
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* dark product showcases */}
        <div className="space-y-6 lg:space-y-10">
          {PRODUCTS.map((p, i) => {
            const Visual = PRODUCT_VISUALS[p.visual]
            const on = active === i
            const flip = i % 2 === 1
            return (
              <article
                key={p.id}
                id={p.id}
                data-i={i}
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className={`deep-card surface-dark relative overflow-hidden rounded-[18px] transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(.16,1,.3,1)] lg:min-h-[560px] ${
                  on ? '' : 'lg:scale-[.975] lg:brightness-[.82] lg:saturate-[.55]'
                }`}
              >
                <Jaali fade={flip ? 'left' : 'right'} opacity={0.05} size={42} ink="#bfe3ea" />
                <div className={`grid h-full items-center gap-2 p-7 lg:min-h-[560px] sm:p-10 xl:grid-cols-[0.95fr_1.25fr] ${flip ? 'xl:[&>*:first-child]:order-2' : ''}`}>
                  <div className="relative z-10">
                    <p className="font-mono text-[12px] text-sandstone">
                      {p.level} <span className="ml-2 font-sans font-semibold text-muted">{p.kicker}</span>
                    </p>
                    <h3 className="display mt-4 text-[clamp(2rem,3.2vw,2.9rem)] !font-normal text-fg">{p.name}</h3>
                    <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-fg-soft">{p.line}</p>
                    <ul className="mt-6 space-y-2.5">
                      {p.points.map((pt) => (
                        <li key={pt} className="flex items-center gap-3 text-[14px] text-fg-soft">
                          <span className="size-1.5 rounded-full bg-saffron" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <Link to={p.to} className="group mt-8 inline-flex items-center gap-2 text-[14.5px] font-semibold text-cyan hover:text-fg">
                      {p.cta} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                  <div className="pointer-events-none relative z-0 -mx-4 mt-14 sm:mx-0 sm:mt-10 xl:-my-6 xl:mt-0 xl:scale-[1.12]">
                    <Visual />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </Section>
  )
}
