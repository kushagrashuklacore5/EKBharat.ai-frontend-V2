import { lazy, Suspense, useEffect, useRef } from 'react'
import { Scene3D } from '../components/visuals/Scene3D'
import { WorkflowVisual } from '../components/visuals/ProductVisuals'
import { PageHero, FeatureGrid } from '../components/ui/PageHero'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import { SectionHeading } from '../components/ui/SectionHeading'
import { FinalCta } from '../components/sections/FinalCta'
import { KIND_META, WORKFLOWS, type NodeKind } from '../components/workflow-studio/workflows'
import { KIND_ICON } from '../components/workflow-studio/StudioNode'
import { WorkflowGenerator } from '../components/workflow-studio/WorkflowGenerator'
import { studioBus } from '../components/workflow-studio/studioBus'
import { useReveal } from '../hooks/useReveal'
import { STUDIO_POINTS, PointList } from '../components/sections/RelocatedBlocks'

const StudioDemo = lazy(() => import('../components/workflow-studio/StudioDemo'))

const NODE_DOCS: { kind: NodeKind; d: string }[] = [
  { kind: 'trigger', d: 'Start runs from webhooks, schedules, emails, form submissions or application events.' },
  { kind: 'llm', d: 'Prompt a model through the gateway, with routing policy, fallbacks and structured output.' },
  { kind: 'agent', d: 'Give an agent a goal, tools and memory; it reasons through multiple steps.' },
  { kind: 'knowledge', d: 'Retrieve relevant passages from indexed documents (RAG) with filters and citations.' },
  { kind: 'condition', d: 'Branch on rules or model outputs; loop over lists of items.' },
  { kind: 'parallel', d: 'Run branches at the same time and merge results when all complete.' },
  { kind: 'human', d: 'Pause for a person to approve, edit or reject before the run continues.' },
  { kind: 'database', d: 'Read and write rows in SQL and NoSQL databases.' },
  { kind: 'integration', d: 'Call REST APIs and connected applications; build custom nodes for internal systems.' },
  { kind: 'output', d: 'Send messages, update records, call webhooks or return a response.' },
]

const CAPABILITIES = [
  { t: 'Visual drag-and-drop builder', d: 'Compose workflows on a canvas: add nodes, connect them, configure each step.' },
  { t: 'AI-assisted workflow generation', d: 'Describe a process in plain language and get a starting workflow to refine. Rule-based today; LLM generation planned.', tag: 'MVP' },
  { t: 'Intelligent model routing', d: 'Route each AI step by quality, cost or latency, with fallbacks and per-step usage in ₹.' },
  { t: 'Multilingual automation', d: 'Detect Hindi, Tamil, English and Hinglish, and reply in the customer’s own language.' },
  { t: 'Trigger & event automation', d: 'Webhooks, schedules and application events start runs automatically.' },
  { t: 'Multi-agent orchestration', d: 'Orchestrator and specialist agents coordinate inside a single workflow.' },
  { t: 'Model routing', d: 'Every LLM node can route by task, cost, latency and availability.' },
  { t: 'Branches, loops & parallel paths', d: 'Express real business logic, not just straight-line chains.' },
  { t: 'Human-in-the-loop approvals', d: 'Insert review steps wherever a person must decide.' },
  { t: 'Templates', d: 'Start from support, lead-gen, recruitment, invoice and research templates.' },
  { t: 'Custom integrations & nodes', d: 'Extend the node library for your own systems.' },
  { t: 'Monitoring & execution history', d: 'Inspect every run, step input and output, error and retry.' },
  { t: 'Managed deployment', d: 'Deploy workflows to managed execution with scaling handled for you.' },
  { t: 'Versioning & environments', d: 'Draft and published versions today; promotion across environments is planned.', tag: 'Early' },
]

/** Capability comparison. Other platforms differ by product and plan, so that column stays deliberately general. */
const COMPARISON: { c: string; us: string; status: 'Demo' | 'Simulated' | 'Planned'; general: string }[] = [
  { c: 'AI-native model routing', us: 'Each AI step routed by quality, cost or latency, with an automatic fallback model', status: 'Simulated', general: 'Usually a model is chosen per step; routing policies vary by tool' },
  { c: 'Cost observability in INR', us: 'Tokens, latency and estimated ₹ cost per step, per model and per run', status: 'Simulated', general: 'Varies; often reported by each model provider separately' },
  { c: 'Indian integrations', us: 'Tally, Zoho, WhatsApp Business, Razorpay, GSTN, e-Invoice IRP, DigiLocker and more', status: 'Planned', general: 'Coverage of India-specific systems varies; often via HTTP or custom nodes' },
  { c: 'Human approvals', us: 'Approve / reject branches, reviewer steps and approval-before-write warnings', status: 'Demo', general: 'Available in many tools in different forms' },
  { c: 'Multilingual support', us: 'Language detection and same-language replies for Hindi, Tamil, English and Hinglish', status: 'Simulated', general: 'Depends on the models and prompts you configure' },
  { c: 'India hosting options', us: 'India-region managed deployment as a configuration option', status: 'Planned', general: 'Depends on vendor regions or self-hosting' },
  { c: 'Enterprise governance', us: 'Audit trail, PII masking, retention controls; roles and credential vault next', status: 'Demo', general: 'Typically tied to enterprise plans' },
]
const STATUS_TONE = { Demo: 'bg-[#e5f1e8] text-leaf', Simulated: 'bg-[#e3f0f6] text-cyan', Planned: 'bg-[#fbf0dc] text-amber' }

const openTemplate = (id: string) => {
  studioBus.emit({ kind: 'template', id })
  document.getElementById('studio-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function WorkflowStudioPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)

  useEffect(() => {
    // When visiting Workflow Studio, smoothly focus and reveal the demo studio
    const timer = setTimeout(() => {
      const demo = document.getElementById('demo')
      if (demo) {
        demo.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div ref={ref}>
      <PageHero
        level="L1 · Workflows"
        visual={<Scene3D kind="workflow" label="3D Workflow Studio canvas: trigger, agent, knowledge, database, LLM, condition, approval and action nodes connected by data paths, running in sequence" fallback={<WorkflowVisual />} />}
        docTitle="AI Workflow Studio"
        eyebrow="Flagship product · AI Workflow Studio"
        title={
          <>
            The visual builder for <span className="serif-accent text-gradient">AI‑native</span> automation.
          </>
        }
        lead="Connect applications, data, models and intelligent agents through a visual workflow builder to automate complex business processes — then deploy and monitor them on managed infrastructure."
        actions={
          <>
            <Button href="#demo">Try the live demo</Button>
            <Button to="/build-with-us?type=workflow-studio" variant="secondary">
              Request early access
            </Button>
          </>
        }
        aside={
          <div className="border-l-2 border-saffron/70 pl-5">
            <p className="label text-faint">Product status</p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Workflow Studio is in active development. In the demo below, workflow logic, branching and data run for real in your browser; AI models and
              connectors use clearly labelled simulation adapters, and nothing leaves your device. Capabilities marked “Planned” are on the roadmap.
            </p>
          </div>
        }
      />

      <Section id="demo" className="scroll-mt-20 md:scroll-mt-24 pb-24">
        <div className="container-x max-w-[1580px] 2xl:max-w-[1740px]">
          <WorkflowGenerator />
          <div id="studio-canvas" className="mt-6 scroll-mt-24">
            <Suspense fallback={<div className="animate-pulse rounded-[20px] border border-line bg-ink-900 min-h-[820px]" />}>
              <StudioDemo />
            </Suspense>
          </div>
        </div>
      </Section>

      <Section className="pb-8">
        <div className="container-x">
          <PointList items={STUDIO_POINTS} />
        </div>
      </Section>
      <Section className="py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Capabilities" title="Everything a production workflow needs." />
          <div className="mt-12">
            <FeatureGrid items={CAPABILITIES} cols={4} />
          </div>
        </div>
      </Section>

      <Section id="nodes" className="py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Node library" title="Building blocks, designed for AI." lead="Each node is a typed, configurable step. Combine them to express anything from a simple notification to a supervised multi-agent process." />
          <ul className="mt-10 grid grid-cols-2 gap-2.5 sm:mt-12 sm:gap-3 lg:grid-cols-5">
            {NODE_DOCS.map((n, i) => {
              const Icon = KIND_ICON[n.kind]
              const m = KIND_META[n.kind]
              return (
                <li key={n.kind} data-reveal={String(i % 5)} className="panel p-4 sm:p-5">
                  <span className="grid size-9 place-items-center rounded-xl" style={{ background: `${m.color}1a`, color: m.color }}>
                    <Icon size={16} />
                  </span>
                  <p className="mt-4 text-fg font-semibold">{m.label}</p>
                  <p className="mt-1.5 text-[12px] leading-snug text-muted sm:text-[13px] sm:leading-relaxed">{n.d}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </Section>

      <Section className="py-24">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading eyebrow="Templates" title="Start from a proven pattern." lead="Templates encode common processes. Open one on the canvas above, then adapt it to your systems instead of starting from a blank one." />
          <ul data-reveal="2" className="grid content-start gap-2 sm:grid-cols-2">
            {WORKFLOWS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => openTemplate(t.id)}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5 text-left text-[14px] text-fg-soft transition-colors hover:border-line-strong hover:bg-ink-900 hover:text-fg"
                >
                  {t.name}
                  <span className="shrink-0 font-mono text-[10px] text-faint group-hover:text-cyan">open on canvas →</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="py-24">
        <div className="container-x">
          <SectionHeading
            eyebrow="Comparison"
            title="Built for AI-native, India-first automation."
            lead="How Workflow Studio approaches the capabilities Indian enterprises ask about most. The status column shows what you can try in the demo today."
          />
          <div data-reveal="2" className="mt-12 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="bg-ink-900 text-[12px] font-bold text-faint">
                  <th scope="col" className="px-4 py-3">Capability</th>
                  <th scope="col" className="px-4 py-3 text-fg">Ek भारत.AI Workflow Studio</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">General-purpose automation tools</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((r) => (
                  <tr key={r.c} className="border-t border-line align-top">
                    <th scope="row" className="px-4 py-3.5 font-semibold text-fg">{r.c}</th>
                    <td className="px-4 py-3.5 text-fg-soft">{r.us}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${STATUS_TONE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{r.general}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-faint">
            Demo = works in the interactive demo · Simulated = shown with a labelled simulation adapter · Planned = on the roadmap. Other platforms’ capabilities vary by product,
            plan and configuration — check their documentation.
          </p>
        </div>
      </Section>

      <FinalCta
        title="Ready to automate your business workflows?"
        body="Join early access, or tell us the process you want to automate and our team will build it on Workflow Studio for you."
        cta={{ label: 'Get Early Access', to: '/build-with-us?type=workflow-studio' }}
      />
    </div>
  )
}
