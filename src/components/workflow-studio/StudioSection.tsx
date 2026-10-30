import { lazy } from 'react'
import { Section } from '../ui/Section'
import { SectionHeading } from '../ui/SectionHeading'
import { Button } from '../ui/Button'
import { LazyMount } from '../ui/LazyMount'

const StudioDemo = lazy(() => import('./StudioDemo'))

const POINTS = [
  ['Visual builder', 'Drag nodes, connect them and configure each step — no glue code.'],
  ['AI-native nodes', 'LLM calls, agents, retrieval and model routing are first-class building blocks.'],
  ['Real execution logic', 'Triggers, branches, loops, parallel paths and human approvals.'],
  ['Operate with confidence', 'Execution history, step outputs and managed deployment.'],
]

export function StudioSection({ index = '04' }: { index?: string }) {
  return (
    <Section id="workflow-studio" labelledBy="studio-title" className="surface-dark deep-blend overflow-hidden pb-48 pt-48 md:pb-56 md:pt-56">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_70%,rgba(124,196,221,.10),transparent_70%)]" aria-hidden="true" />
      <div className="container-x relative">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <SectionHeading
            id="studio-title"
            index={index}
            eyebrow="AI Workflow Studio · flagship product"
            title={
              <>
                Design intelligent automation <span className="serif-accent text-gradient">visually.</span>
              </>
            }
            lead="Connect applications, data, models and intelligent agents through a visual workflow builder to automate complex business processes. Try it below — pick a workflow, inspect the nodes and run it."
          />
          <div data-reveal="3" className="flex flex-wrap gap-3 lg:justify-end">
            <Button to="/workflow-studio">Explore Workflow Studio</Button>
          </div>
        </div>

        <div data-reveal="2" className="mt-14">
          <LazyMount minHeight={640}>
            <StudioDemo />
          </LazyMount>
        </div>

        <dl className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(([t, d], i) => (
            <div key={t} data-reveal={String(i)} className="border-t-2 border-line-strong pt-5">
              <dt className="flex items-center gap-2 text-[15px] text-fg">
                <span className="font-mono text-[11px] text-cyan">0{i + 1}</span>
                {t}
              </dt>
              <dd className="mt-2 text-[13.5px] leading-relaxed text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  )
}
