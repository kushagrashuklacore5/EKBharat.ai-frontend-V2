import { useState } from 'react'
import { AGENTS_DATA, type AgentSpec } from './agentsData'
import { AgentCard } from './AgentCard'
import { AgentModal } from './AgentModal'
import { SectionHeading } from '../ui/SectionHeading'

const CATEGORIES = [
  'All Agents',
  'Customer Experience',
  'Education',
  'Multi-Agent Orchestration',
] as const

type Category = (typeof CATEGORIES)[number]

export function AgentShowcase() {
  const [activeCategory, setActiveCategory] = useState<Category>('All Agents')
  const [selectedAgent, setSelectedAgent] = useState<AgentSpec | null>(null)
  const [modalTab, setModalTab] = useState<'demo' | 'overview'>('demo')

  const filteredAgents = AGENTS_DATA.filter((agent) => {
    if (activeCategory === 'All Agents') return true
    if (activeCategory === 'Customer Experience')
      return agent.category.includes('Customer Experience')
    if (activeCategory === 'Education')
      return agent.category.includes('Education')
    if (activeCategory === 'Multi-Agent Orchestration')
      return agent.category.includes('Multi-Agent')
    return true
  })

  const handleExplore = (agent: AgentSpec) => {
    setSelectedAgent(agent)
    setModalTab('overview')
  }

  const handleTryDemo = (agent: AgentSpec) => {
    setSelectedAgent(agent)
    setModalTab('demo')
  }

  return (
    <section id="agents-portfolio" className="relative pt-12 pb-20">
      <div className="container-x space-y-10">
        {/* Section Heading & Category Filter */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow="Agent Portfolio · 5 Production Agents"
            title={
              <>
                Autonomous &amp; supervised agents for{' '}
                <span className="serif-accent text-gradient">high-impact work.</span>
              </>
            }
            lead="Explore our five specialized agents engineered for conversational voice customer care, academic integrity, personalized education, automated assessment, and multi-agent coordination."
          />

          {/* Category Filter Pills */}
          <div
            role="tablist"
            aria-label="Filter agents by category"
            className="flex flex-wrap gap-2 self-start md:self-end"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                  activeCategory === cat
                    ? 'border-line-strong bg-ink-850 text-fg shadow-[var(--shadow-sm)]'
                    : 'border-line text-muted hover:text-fg'
                }`}
              >
                {cat}
                {cat === 'All Agents' && (
                  <span className="ml-1.5 font-mono text-[11px] text-faint">
                    ({AGENTS_DATA.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scalable Agents Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <div key={agent.id} data-reveal>
              <AgentCard
                agent={agent}
                onExplore={handleExplore}
                onTryDemo={handleTryDemo}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Modal / Demo Experience */}
      <AgentModal
        agent={selectedAgent}
        initialTab={modalTab}
        onClose={() => setSelectedAgent(null)}
      />
    </section>
  )
}
