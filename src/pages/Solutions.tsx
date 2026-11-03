import { useRef } from 'react'
import { Scene3D } from '../components/visuals/Scene3D'
import { EnterpriseVisual } from '../components/visuals/ProductVisuals'
import { PageHero } from '../components/ui/PageHero'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import { FinalCta } from '../components/sections/FinalCta'
import { IndustryGlyph } from '../components/sections/IndustryGlyph'
import { PhotoReveal } from '../components/ui/PhotoReveal'
import { INDUSTRIES } from '../lib/content'
import { useReveal } from '../hooks/useReveal'

export default function SolutionsPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  return (
    <div ref={ref}>
      <PageHero
        level="All levels"
        visual={<Scene3D kind="district" label="3D enterprise AI district: an AI core spire connected to hospital, bank, school, warehouse, factory, support centre and office buildings under a governance dome" fallback={<EnterpriseVisual />} />}
        docTitle="Industry Solutions"
        accent="#2e8d81"
        eyebrow="Industry solutions"
        title={
          <>
            AI shaped around <span className="serif-accent text-gradient">your industry’s</span> problems.
          </>
        }
        lead="Every sector has its own documents, rules and bottlenecks. These are the problems we most often help with — each delivered with the same platform, governance and engineering process."
        actions={<Button to="/build-with-us">Describe your use case</Button>}
      />
      <nav aria-label="Industries" className="container-x -mt-6 mb-10 flex flex-wrap gap-2">
        {INDUSTRIES.map((i) => (
          <a key={i.id} href={`#${i.id}`} className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-fg-soft transition-colors hover:border-line-strong hover:text-fg">
            {i.name}
          </a>
        ))}
      </nav>
      <Section className="pb-10">
        <div className="container-x grid gap-6 md:grid-cols-[1.35fr_1fr]">
          <PhotoReveal img="port-logistics" alt="Gantry cranes loading a container ship at Jawaharlal Nehru Port" aspect="aspect-[16/7]" sizes="(min-width: 768px) 58vw, 100vw" />
          <PhotoReveal img="college-lab" alt="Students working at computers in a college lab" aspect="aspect-[16/7] md:aspect-[17/10]" sizes="(min-width: 768px) 42vw, 100vw" position="center 40%" />
        </div>
      </Section>
      <Section className="pb-24">
        <div className="container-x space-y-3">
          {INDUSTRIES.map((ind, k) => (
            <article id={ind.id} key={ind.id} data-reveal className="ind-card panel group scroll-mt-28 overflow-hidden">
              <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[0.9fr_1.1fr_1fr]">
                <div>
                  <IndustryGlyph glyph={ind.glyph} color={ind.color} />
                  <p className="mt-6 font-mono text-[11px] text-faint">{String(k + 1).padStart(2, '0')}</p>
                  <h2 className="mt-1 text-3xl tracking-tight text-fg">{ind.name}</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="label text-faint">The problem</p>
                    <p className="mt-2 leading-relaxed text-fg-soft">{ind.problem}</p>
                  </div>
                  <div>
                    <p className="label" style={{ color: ind.color }}>
                      Our approach
                    </p>
                    <p className="mt-2 leading-relaxed text-fg-soft">{ind.solution}</p>
                  </div>
                </div>
                <div>
                  <p className="label text-faint">Example solutions</p>
                  <ul className="mt-3 space-y-2">
                    {ind.examples.map((e) => (
                      <li key={e} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-[14px] text-fg-soft">
                        <span className="size-1.5 rounded-full" style={{ background: ind.color }} />
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <FinalCta title="Your industry, your process." body="We start by understanding how work happens today — then design AI that fits it." />
    </div>
  )
}
