import { ArrowRight, Sparkles, Mic, GraduationCap, ShieldAlert, FileCheck2, Network } from 'lucide-react'
import type { AgentSpec } from './agentsData'
import {
  VoiceWaveformVisual,
  TutorKnowledgeVisual,
  CheatingDetectionVisual,
  AssessmentRubricVisual,
  OrchestratorNetworkVisual,
} from './AgentVisuals'

interface Props {
  agent: AgentSpec
  onExplore: (agent: AgentSpec) => void
  onTryDemo: (agent: AgentSpec) => void
}

const ICONS = {
  vaani: Mic,
  tutor: GraduationCap,
  'cheating-detection': ShieldAlert,
  assessment: FileCheck2,
  orchestrator: Network,
}

export function AgentCard({ agent, onExplore, onTryDemo }: Props) {
  const Icon = ICONS[agent.id]

  return (
    <article
      className="panel group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-ink-850 p-6 sm:p-7 shadow-[var(--shadow-sm)] transition-all duration-300 hover:border-line-strong hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
      style={{
        // Subtle accent hover aura
        backgroundImage: `radial-gradient(ellipse 80% 50% at 50% -20%, rgba(${agent.accentRgb}, 0.08), transparent 70%)`,
      }}
    >
      {/* Top Bar: Number, Category Tag & Icon */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-semibold text-faint">
              {agent.number}
            </span>
            <span className="text-line-strong">/</span>
            <span
              className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide"
              style={{
                backgroundColor: `rgba(${agent.accentRgb}, 0.12)`,
                color: agent.accent,
              }}
            >
              {agent.badge}
            </span>
          </div>

          <span
            className="grid size-9 place-items-center rounded-xl border border-line transition-transform duration-300 group-hover:scale-105"
            style={{
              backgroundColor: `rgba(${agent.accentRgb}, 0.08)`,
              color: agent.accent,
            }}
          >
            <Icon size={18} />
          </span>
        </div>

        {/* Title & Description */}
        <div className="mt-5 space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-fg transition-colors group-hover:text-cyan">
            {agent.name}
          </h3>
          <p className="font-mono text-[11px] text-faint uppercase tracking-wider">
            {agent.category}
          </p>
          <p className="text-[14px] leading-relaxed text-fg-soft line-clamp-3">
            {agent.shortDesc}
          </p>
        </div>

        {/* Visual Component Embedded in the Card */}
        <div className="mt-5">
          {agent.id === 'vaani' && <VoiceWaveformVisual />}
          {agent.id === 'tutor' && <TutorKnowledgeVisual />}
          {agent.id === 'cheating-detection' && <CheatingDetectionVisual />}
          {agent.id === 'assessment' && <AssessmentRubricVisual />}
          {agent.id === 'orchestrator' && <OrchestratorNetworkVisual />}
        </div>
      </div>

      {/* Action CTAs */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-line/70 pt-4">
        <button
          type="button"
          onClick={() => onTryDemo(agent)}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-cyan transition-colors hover:text-fg"
        >
          <Sparkles size={14} className="shrink-0" />
          <span>Try Demo</span>
        </button>

        <button
          type="button"
          onClick={() => onExplore(agent)}
          className="group/btn inline-flex items-center gap-1 text-[13.5px] font-semibold text-fg-soft transition-colors hover:text-fg"
        >
          <span>Explore Agent</span>
          <ArrowRight
            size={14}
            className="transition-transform duration-200 group-hover/btn:translate-x-0.5"
          />
        </button>
      </div>
    </article>
  )
}
