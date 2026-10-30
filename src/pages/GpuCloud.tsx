import { useRef } from 'react'
import { PageHero, FeatureGrid } from '../components/ui/PageHero'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import { SectionHeading } from '../components/ui/SectionHeading'
import { GpuCatalogue } from '../components/gpu/GpuCatalogue'
import { FinalCta } from '../components/sections/FinalCta'
import { useReveal } from '../hooks/useReveal'

const OFFERS = [
  { t: 'GPU as a Service', d: 'Access GPU compute on demand without buying or maintaining hardware.' },
  { t: 'On-demand instances', d: 'Provision capacity for experiments, batch jobs and spikes; release it when done.' },
  { t: 'Pay-as-you-go', d: 'Usage-based hourly billing for variable workloads.' },
  { t: 'Monthly rentals', d: 'Predictable pricing for steady, always-on workloads.' },
  { t: 'Dedicated GPU infrastructure', d: 'Reserved resources for isolation and consistent performance.' },
  { t: 'Model inference infrastructure', d: 'Serve models behind managed endpoints sized to your traffic.' },
  { t: 'Training & fine-tuning', d: 'Environments prepared for fine-tuning and training runs on your data.' },
  { t: 'AI model deployment', d: 'Package and deploy open-weight or custom models to production.' },
  { t: 'Managed AI hosting', d: 'We operate, monitor and update the deployment for you.' },
]

const HOW = [
  ['Tell us the workload', 'Model size, expected traffic, training data volume and timelines.'],
  ['We size & source capacity', 'Matched to a suitable configuration from our infrastructure partners.'],
  ['Deploy & run', 'Environment set up, model deployed, access configured.'],
  ['Scale or release', 'Adjust capacity as needs change; pay for what you use.'],
]

export default function GpuCloudPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  return (
    <div ref={ref}>
      <PageHero
        visual="gpu"
        docTitle="GPU Cloud"
        accent="#5d7083"
        eyebrow="GPU Cloud · AI infrastructure"
        title={
          <>
            GPU compute, <span className="serif-accent text-gradient">when you need it.</span>
          </>
        }
        lead="Access high-performance computing resources on flexible usage-based pricing without purchasing and maintaining your own GPU hardware. Bharat.Ai provides capacity through third-party GPU infrastructure partners, with setup and management handled by our team."
        actions={
          <>
            <Button to="/build-with-us?type=gpu">Request GPU capacity</Button>
            <Button href="#catalogue" variant="secondary">
              See example configurations
            </Button>
          </>
        }
        aside={
          <div className="border-l-2 border-saffron/70 pl-5">
            <p className="label text-faint">How we provide compute</p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              We are a partner-powered GPU service provider: capacity runs in our partners’ data centres, and Bharat.Ai handles sizing, provisioning, deployment
              and support. Availability and pricing are confirmed per request.
            </p>
          </div>
        }
      />
      <Section className="pb-20">
        <div className="container-x">
          <ol className="grid gap-3 md:grid-cols-4">
            {HOW.map(([t, d], i) => (
              <li key={t} data-reveal={String(i)} className="panel p-6">
                <span className="label text-cyan">Step 0{i + 1}</span>
                <p className="mt-4 text-fg font-semibold">{t}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>
      <Section id="catalogue" className="pb-24">
        <div className="container-x">
          <GpuCatalogue />
        </div>
      </Section>
      <Section className="py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Services" title="From a single GPU to managed AI hosting." />
          <div className="mt-12">
            <FeatureGrid items={OFFERS} />
          </div>
        </div>
      </Section>
      <FinalCta title="Get the compute your models need." body="Share your workload and timeline. We’ll come back with a configuration and a quote based on current partner availability." />
    </div>
  )
}
