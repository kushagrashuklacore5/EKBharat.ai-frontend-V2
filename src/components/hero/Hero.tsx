import { lazy, Suspense, useEffect, useRef } from 'react'
import { Cpu, Network, Sparkles, Workflow } from 'lucide-react'
import { Button } from '../ui/Button'
import { Jaali } from '../ui/Jaali'
import { TriPaths } from '../ui/TriPaths'
import { gsap, prefersReducedMotion } from '../../lib/gsap'

const HeroCanvas = lazy(() => import('./HeroCanvas'))

const PILLARS = [
  { t: 'Infrastructure', icon: Cpu },
  { t: 'Intelligence', icon: Sparkles },
  { t: 'Automation', icon: Workflow },
  { t: 'Orchestration', icon: Network },
]

export function Hero() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('[data-h="eyebrow"]', { y: 10, opacity: 0, duration: 0.9 }, 0.1)
        .from('.line-mask > span', { yPercent: 105, duration: 1.2, stagger: 0.09 }, 0.15)
        .from('[data-h="lead"]', { y: 12, opacity: 0, duration: 0.9 }, 0.6)
        .from('[data-h="cta"] > *', { y: 10, opacity: 0, duration: 0.8, stagger: 0.07 }, 0.75)
        .from('[data-h="pillars"] > *', { y: 8, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.95)
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* atmosphere: misty blue light, soft folds of colour */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="atmos absolute inset-0" />
        <div className="absolute -right-[10%] top-[5%] h-[85%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgba(154,213,229,.55),transparent)]" />
        <div className="absolute -left-[15%] bottom-[-30%] h-[70%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgba(56,166,162,.16),transparent)]" />
        <div className="absolute right-[20%] top-[40%] h-[40%] w-[30%] rounded-full bg-[radial-gradient(closest-side,rgba(213,182,138,.18),transparent)]" />
        <div className="grid-bg absolute inset-0 opacity-60 [mask-image:radial-gradient(55%_55%_at_70%_45%,black,transparent)]" />
        {/* compute infrastructure, seen faintly through a jaali screen (decorative, CC0 — see image credits) */}
        <div className="absolute inset-y-0 right-0 hidden w-[64%] md:block [mask-image:radial-gradient(62%_70%_at_62%_45%,#000_25%,transparent_78%)]">
          <img src="/images/rack-closeup-960.webp" alt="" decoding="async" fetchPriority="low" className="jaali-window mono-photo h-full w-full object-cover opacity-[0.085] blur-[0.6px]" />
        </div>
        <Jaali fade="right" opacity={0.06} size={44} />
        <TriPaths className="absolute inset-x-0 bottom-[6%] hidden h-[48%] w-full opacity-60 md:block" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#d2dee4]" />
      </div>

      <div className="container-x relative grid items-center pb-6 pt-28 lg:min-h-[100svh] lg:grid-cols-[0.95fr_1.05fr] lg:pb-24 lg:pt-24">
        <div className="relative z-10 max-w-[37rem]">
          <p data-h="eyebrow" className="eyebrow">
            India’s AI infrastructure &amp; automation platform
          </p>
          <h1 id="hero-title" className="display mt-6 text-[clamp(2.9rem,5.6vw,5.4rem)] text-fg">
            <span className="line-mask">
              <span>Build intelligent systems.</span>
            </span>
            <span className="line-mask">
              <span className="serif-accent text-gradient pr-2">Orchestrate what</span>
            </span>
            <span className="line-mask">
              <span className="serif-accent text-gradient pr-2">comes next.</span>
            </span>
          </h1>
          <p data-h="lead" className="mt-7 max-w-[33rem] text-[1.125rem] leading-[1.7] text-muted">
            GPU compute, multi-model orchestration, AI agents and a visual workflow studio — one platform that connects infrastructure to
            intelligent automation, with a team that can build the whole system for you.
          </p>
          <div data-h="cta" className="mt-9 flex flex-wrap items-center gap-3">
            <Button to="/workflow-studio">Explore Workflow Studio</Button>
            <Button href="#platform" variant="secondary">
              Explore Platform
            </Button>
          </div>
          <ul data-h="pillars" className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
            {PILLARS.map(({ t, icon: Icon }) => (
              <li key={t} className="flex items-center gap-2 text-[13.5px] font-semibold text-fg-soft">
                <Icon size={16} className="text-cyan" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* 3D stack with interactive floating labels */}
        <div className="relative -mx-[var(--gutter)] mt-8 h-[380px] sm:mx-0 sm:h-[520px] lg:absolute lg:bottom-6 lg:right-0 lg:top-20 lg:mt-0 lg:h-auto lg:w-[56%]">
          <Suspense fallback={null}>
            <HeroCanvas />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
