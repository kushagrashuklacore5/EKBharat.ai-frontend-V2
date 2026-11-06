import { useRef } from 'react'
import { GpuHero3D } from '../components/visuals/GpuHero3D'
import { PageHero, FeatureGrid } from '../components/ui/PageHero'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Section'
import { SectionHeading } from '../components/ui/SectionHeading'
import { GpuCatalogue } from '../components/gpu/GpuCatalogue'
import { GpuExplorer } from '../components/gpu/GpuExplorer'
import { PhotoReveal } from '../components/ui/PhotoReveal'
import { FinalCta } from '../components/sections/FinalCta'
import { useReveal } from '../hooks/useReveal'
import { CinematicPhoto } from '../components/ui/CinematicPhoto'
import { GPU_MODES, PointList } from '../components/sections/RelocatedBlocks'

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
        level="L4 · Compute"
        visual={<GpuHero3D />}
        docTitle="GPU Cloud"
        accent="#5d7083"
        eyebrow="GPU Cloud · AI infrastructure"
        title={
          <>
            GPU compute, <span className="serif-accent text-gradient">when you need it.</span>
          </>
        }
        lead="Access high-performance computing resources on flexible usage-based pricing without purchasing and maintaining your own GPU hardware. Ek भारत.AI provides capacity through third-party GPU infrastructure partners, with setup and management handled by our team."
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
              We are a partner-powered GPU service provider: capacity runs in our partners’ data centres, and Ek भारत.AI handles sizing, provisioning, deployment
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
      <Section className="pb-24">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <PhotoReveal img="wafer-researcher" alt="A researcher in a clean-room suit holding a silicon wafer" aspect="aspect-[3/2]" sizes="(min-width: 1024px) 50vw, 100vw" position="center 30%" />
          <div>
            <p data-reveal className="eyebrow">
              From silicon up
            </p>
            <h2 data-reveal="1" className="display mt-5 text-[clamp(1.8rem,3.2vw,2.6rem)] text-fg">
              Every GPU hour starts on a wafer.
            </h2>
            <p data-reveal="2" className="mt-5 leading-relaxed text-muted">
              Accelerators are cut from silicon wafers, packaged with high-bandwidth memory, mounted on dense multi-layer boards and cooled by
              precision-engineered heatsinks. Understanding that stack helps us size, place and run your workloads on the right hardware.
            </p>
          </div>
        </div>
      </Section>
      <Section id="gpu-explorer" className="pb-24">
        <div className="container-x">
          <SectionHeading
            eyebrow="Inside the accelerator"
            title={
              <>
                What a data-centre GPU <span className="serif-accent text-fg-soft">is made of.</span>
              </>
            }
            lead="Scroll or use the slider to separate the card into its layers — from the backplate and multi-layer board to the GPU die, memory, cold plate, heat pipes and heatsink. Choose a layer to look closer."
          />
          <div data-reveal="2" className="mt-12">
            <GpuExplorer />
          </div>
          <CinematicPhoto
            img="grid-fermilab"
            alt="A long aisle between rows of blue-lit server racks in a grid computing centre"
            className="mt-16"
            position="center 45%"
            eyebrow="At data-centre scale"
            title={<>Thousands of accelerators, working as one machine.</>}
            body="Large AI workloads run on clusters like this — GPUs linked by high-speed networks, with power and cooling engineered around them. Our GPU Cloud gives you access to this class of capacity through infrastructure partners, without owning any of it."
          />
        </div>
      </Section>
      <Section id="modes" className="pb-16">
        <div className="container-x">
          <p data-reveal className="eyebrow">
            Ways to use GPU Cloud
          </p>
          <div className="mt-8">
            <PointList items={GPU_MODES} cols="grid-cols-2 lg:grid-cols-6" />
          </div>
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
