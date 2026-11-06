import { Section } from '../ui/Section'
import { SectionHeading } from '../ui/SectionHeading'
import { Button } from '../ui/Button'
import { AgentMesh } from '../agents/AgentMesh'
import { MultilingualAgent } from '../agents/MultilingualAgent'
import { LanguagesVisual } from '../agents/LanguagesVisual'

export function AgentsSection({ index = '04' }: { index?: string }) {
  return (
    <Section id="agents" labelledBy="agents-title" className="py-28 md:py-36">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <SectionHeading
            id="agents-title"
            index={index}
            eyebrow="AI agents & multi-agent orchestration"
            title={
              <>
                Complex work, broken down and done by <span className="serif-accent text-gradient">specialists.</span>
              </>
            }
            lead="Coordinate specialised AI agents, delegate tasks, manage execution state and combine their outputs into complete workflows — with people approving what matters."
          />
          <div data-reveal="3" className="lg:justify-self-end">
            <Button to="/ai-agents" variant="secondary">
              How our agents work
            </Button>
          </div>
        </div>
        <div data-reveal="2" className="mt-14">
          <AgentMesh />
        </div>
        <div className="mt-16 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <LanguagesVisual />
          <div>
            <p data-reveal className="eyebrow">
              Built for India’s languages
            </p>
            <h3 data-reveal="1" className="display mt-4 text-[clamp(1.6rem,2.8vw,2.3rem)] text-fg">
              Your customers don’t all write in English.
            </h3>
            <p data-reveal="2" className="mt-4 max-w-xl leading-relaxed text-muted">
              India works in dozens of languages and scripts. Agents can detect the language of a request and answer in it, using the same tools, data and
              approval rules — so a support process doesn’t need a separate system for every language.
            </p>
          </div>
        </div>
        <div data-reveal="2" className="mt-8">
          <MultilingualAgent />
        </div>
      </div>
    </Section>
  )
}
