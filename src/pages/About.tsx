import { useRef } from 'react'
import { PageHero } from '../components/ui/PageHero'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import { SectionHeading } from '../components/ui/SectionHeading'
import { PillarsSection } from '../components/sections/PillarsSection'
import { FinalCta } from '../components/sections/FinalCta'
import { useReveal } from '../hooks/useReveal'
import { Jaali } from '../components/ui/Jaali'
import { PhotoReveal } from '../components/ui/PhotoReveal'
import { StepwellStack } from '../components/ui/StepwellStack'
import { SITE } from '../lib/config'

const EK: [string, string][] = [
  ['One platform', 'Compute, models, agents and workflows in a single system — instead of separate tools that each need their own integration.'],
  ['One partner', 'Use the platform yourself, or have our team design, build and maintain the whole solution. Either way, one team is accountable.'],
  ['One India', 'Built for organisations that work across many languages, regions and ways of doing business, and for the people they serve.'],
]

const STACK = [
  { k: 'L1', title: 'Workflows', body: 'Business processes, approvals and integrations', tag: 'Workflow Studio' },
  { k: 'L2', title: 'AI agents', body: 'Specialists that plan, act and hand over to people', tag: 'AI Agents' },
  { k: 'L3', title: 'Models', body: 'The right model per task, routed by policy', tag: 'Orchestration' },
  { k: 'L4', title: 'GPU infrastructure', body: 'Partner-powered compute for training and inference', tag: 'GPU Cloud' },
  { k: 'L5', title: 'Silicon', body: 'Accelerators and memory at the foundation of it all' },
]

const BELIEFS = [
  ['Useful over impressive', 'We measure AI by the work it removes and the decisions it improves, not by demos.'],
  ['Honest about limits', 'We tell customers when a simpler approach — or no AI at all — is the better answer.'],
  ['People stay accountable', 'Automation should keep humans in control of the decisions that matter.'],
  ['Open to your stack', 'Our platform is built to integrate with the models, systems and clouds you already use.'],
]

export default function AboutPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  return (
    <div ref={ref}>
      <PageHero
        docTitle="About"
        accent="#c4852f"
        eyebrow="About Ek भारत.AI"
        title={
          <>
            An AI infrastructure & intelligence partner, <span className="serif-accent text-gradient">built in India.</span>
          </>
        }
        lead="Ek भारत.AI brings together the pieces organisations need to put AI to work: compute, models, agents, workflows — and the engineering team to assemble them into systems that run reliably."
        actions={
          <>
            <Button to="/contact">Get in touch</Button>
            <Button to="/build-with-us" variant="secondary">
              Start a project
            </Button>
          </>
        }
      />
      <Section className="pb-24">
        <div className="container-x grid gap-14 lg:grid-cols-2">
          <div data-reveal className="space-y-5 text-[1.05rem] leading-relaxed text-fg-soft">
            <p>
              Most organisations don’t need another chatbot. They need AI that connects to their data and systems, follows their rules, and does useful work
              inside real processes.
            </p>
            <p>
              Ek भारत.AI is a hybrid AI-as-a-Service company. Developers and teams can use our platform — Workflow Studio, agents, multi-model orchestration and
              partner-powered GPU Cloud — to build for themselves. Businesses that prefer a complete solution can engage our team to design, build, deploy and
              maintain it.
            </p>
          </div>
          <div data-reveal="1" className="panel p-8">
            <p className="label text-faint">Ownership</p>
            <p className="mt-4 text-2xl tracking-tight text-fg font-semibold">{SITE.owner}</p>
            <p className="mt-3 leading-relaxed text-muted">
              Ek भारत.AI is owned and operated by Core5 Systems and Services Pvt. Ltd., which provides the engineering, delivery and support behind the platform and
              its services.
            </p>
          </div>
        </div>
      </Section>
      {/* the meaning of "Ek" */}
      <Section className="relative overflow-hidden py-24 md:py-32">
        <Jaali fade="left" opacity={0.06} size={44} />
        <div className="container-x relative grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p data-reveal className="eyebrow">
              Why “Ek”
            </p>
            <p data-reveal="1" lang="hi" className="mt-6 font-[Mukta] text-[clamp(5rem,13vw,10rem)] font-extrabold leading-[0.85] tracking-tight text-fg">
              एक
            </p>
            <p data-reveal="2" className="mt-4 font-mono text-[12px] tracking-[0.12em] text-sandstone">
              EK · ONE
            </p>
            <div aria-hidden="true" className="tri-hairline mt-8 w-40" />
            <PhotoReveal img="infosys-mysore" alt="Colonnaded buildings and gardens on a technology campus in Mysuru" aspect="aspect-[4/3]" className="mt-10 max-w-[24rem]" sizes="24rem" />
          </div>
          <div className="space-y-8">
            {EK.map(([t, d], i) => (
              <div key={t} data-reveal={String(i + 1)} className="grid gap-2 border-t border-line-strong pt-5 sm:grid-cols-[11rem_1fr] sm:gap-8">
                <h3 className="text-[1.15rem] font-semibold text-fg">{t}</h3>
                <p className="leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* one stack, descending like a stepwell */}
      <Section className="py-20 md:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <SectionHeading
            eyebrow="One stack"
            title={
              <>
                From silicon to workflow, <span className="serif-accent text-fg-soft">one descent.</span>
              </>
            }
            lead="We think about AI the way a stepwell is built: level by level, each one resting on the one below. Work enters at the top as a business process and is carried down to the compute that powers it."
          />
          <StepwellStack compact levels={STACK} />
        </div>
      </Section>

      {/* India's engineering context — a representative, credited image */}
      <Section className="py-20 md:py-28">
        <div className="container-x grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <PhotoReveal img="isro-cleanroom" alt="The Chandrayaan-3 lander being prepared in an ISRO clean room" sizes="(min-width: 1024px) 55vw, 100vw" />
          <div>
            <p data-reveal className="eyebrow">
              Engineering ambition
            </p>
            <h2 data-reveal="1" className="display mt-5 text-[clamp(1.8rem,3.2vw,2.6rem)] text-fg">
              India already engineers at the frontier.
            </h2>
            <p data-reveal="2" className="mt-5 leading-relaxed text-muted">
              From space missions to digital public infrastructure used by hundreds of millions of people, Indian engineering has shown what careful,
              ambitious work can achieve. We want Indian organisations to bring the same standard to how they adopt AI: built properly, run reliably and
              accountable to the people who depend on it.
            </p>
            <p data-reveal="3" className="mt-4 text-[13px] leading-relaxed text-faint">
              The photograph shows ISRO’s Chandrayaan-3 lander and is used for context only; Ek भारत.AI is not affiliated with ISRO.
            </p>
          </div>
        </div>
      </Section>

      <Section className="py-24">
        <div className="container-x">
          <SectionHeading eyebrow="What we believe" title="How we approach AI work." />
          <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2">
            {BELIEFS.map(([t, d], i) => (
              <div key={t} data-reveal={String(i)} className="border-t-2 border-line-strong pt-5">
                <span className="font-mono text-[11px] text-saffron">0{i + 1}</span>
                <h3 className="mt-4 text-xl text-fg font-semibold">{t}</h3>
                <p className="mt-2 leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <PillarsSection index="" />
      <FinalCta />
    </div>
  )
}
