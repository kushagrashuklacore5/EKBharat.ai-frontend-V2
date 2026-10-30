import { lazy, Suspense, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Button } from '../ui/Button'
import { gsap, prefersReducedMotion } from '../../lib/gsap'

const HeroCanvas = lazy(() => import('./HeroCanvas'))

const CAPS = [
  { label: 'Workflow Studio', to: '/workflow-studio' },
  { label: 'AI Agents', to: '/ai-agents' },
  { label: 'Model Orchestration', to: '/ai-orchestration' },
  { label: 'GPU Cloud', to: '/gpu-cloud' },
  { label: 'Custom AI', to: '/custom-ai-development' },
]

export function Hero() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('[data-h="eyebrow"]', { y: 10, opacity: 0, duration: 0.9 }, 0.1)
        .from('.line-mask > span', { yPercent: 105, duration: 1.1, stagger: 0.08 }, 0.15)
        .from('[data-h="lead"]', { y: 12, opacity: 0, duration: 0.9 }, 0.55)
        .from('[data-h="cta"] > *', { y: 10, opacity: 0, duration: 0.8, stagger: 0.07 }, 0.7)
        .from('[data-h="meta"], [data-h="caps"]', { opacity: 0, duration: 1 }, 0.95)
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* soft, luminous atmosphere */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_75%_35%,#ffffff_0%,rgba(255,255,255,0)_60%),linear-gradient(180deg,#eef2f5_0%,#e9eef2_100%)]" />
        <div className="absolute right-[-10%] top-[-20%] h-[70%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgba(47,127,168,.10),transparent)]" />
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(60%_60%_at_70%_45%,black,transparent)]" />
        <div className="jaali absolute inset-y-0 left-0 hidden w-[40%] opacity-[0.035] md:block [mask-image:linear-gradient(90deg,black,transparent)]" />
      </div>

      <div className="container-x relative grid items-center pb-8 pt-28 lg:min-h-[calc(100svh-64px)] lg:grid-cols-[1fr_1fr] lg:pt-20">
        <div className="relative z-10 max-w-[36rem]">
          <p data-h="eyebrow" className="eyebrow">
            The unified AI platform
          </p>
          <h1 id="hero-title" className="display mt-6 text-[clamp(2.6rem,4.7vw,4.6rem)] text-fg">
            <span className="line-mask">
              <span>Everything you need to</span>
            </span>
            <span className="line-mask">
              <span>
                <span className="serif-accent text-gradient pr-1 text-[1.08em]">build, deploy</span>
              </span>
            </span>
            <span className="line-mask">
              <span>&amp; orchestrate AI.</span>
            </span>
          </h1>
          <p data-h="lead" className="mt-7 max-w-[34rem] text-[1.125rem] leading-[1.7] text-muted">
            From GPU computing and multi-model orchestration to intelligent workflows and enterprise AI systems — build your entire AI
            ecosystem with AI Bharat.
          </p>
          <div data-h="cta" className="mt-9 flex flex-wrap items-center gap-3">
            <Button to="/workflow-studio">Explore Workflow Studio</Button>
            <Button to="/build-with-us" variant="secondary">
              Build Your AI Solution
            </Button>
          </div>
          <p data-h="meta" className="mt-6 text-[13.5px] font-medium text-faint">
            Infrastructure <span className="text-saffron">·</span> Intelligence <span className="text-teal">·</span> Automation
          </p>
        </div>

      </div>

      {/* 3D object: full-bleed right column on desktop, its own band on mobile */}
      <div className="relative h-[340px] sm:h-[460px] lg:absolute lg:bottom-16 lg:right-0 lg:top-0 lg:h-auto lg:w-[54%]">
        <Suspense fallback={null}>
          <HeroCanvas />
        </Suspense>
      </div>

      {/* capability index */}
      <div data-h="caps" className="container-x relative pb-10">
        <nav aria-label="Platform capabilities" className="flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-line pt-5 text-[14px]">
          <span className="mr-3 font-semibold text-fg">The platform</span>
          {CAPS.map((c, i) => (
            <Link key={c.to} to={c.to} className="group inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium text-muted transition-colors hover:text-fg">
              <span className="font-mono text-[11px] text-faint group-hover:text-cyan">0{i + 1}</span>
              {c.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}
