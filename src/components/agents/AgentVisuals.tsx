import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * 01. Vaani – Voice AI Agent: Waveform & Audio Spectrum Visual
 */
export function VoiceWaveformVisual({ active = false, className = '' }: { active?: boolean; className?: string }) {
  const reduced = useReducedMotion()
  const barHeights = [28, 45, 72, 38, 88, 62, 95, 54, 78, 42, 68, 85, 50, 92, 60, 35, 70, 48, 82, 30]

  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-ink-900/60 p-4 ${className}`}>
      <div className="flex items-center justify-between text-[11px] text-faint font-mono">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block size-2 rounded-full ${active ? 'bg-cyan animate-pulse' : 'bg-cyan/60'}`} />
          VOICE STREAM · 44.1 kHz
        </span>
        <span className="text-cyan font-semibold">240ms LATENCY</span>
      </div>

      <div className="my-3 flex items-center justify-center gap-1.5 h-16 px-2">
        {barHeights.map((h, i) => {
          const delay = (i * 0.08).toFixed(2)
          return (
            <div
              key={i}
              className="w-1.5 rounded-full bg-gradient-to-t from-cyan/30 via-cyan to-teal transition-all"
              style={{
                height: `${h}%`,
                animation: !reduced ? `pulse-wave 1.4s ease-in-out infinite alternate` : undefined,
                animationDelay: `${delay}s`,
                opacity: 0.75 + (i % 3) * 0.1,
              }}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
        <span className="font-mono text-muted">Intent: Query Resolution</span>
        <span className="rounded bg-cyan/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan">Full Duplex</span>
      </div>

      <style>{`
        @keyframes pulse-wave {
          0% { transform: scaleY(0.4); opacity: 0.5; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/**
 * 02. AI Tutor Agent: Knowledge Tree & Socratic Nodes Visual
 */
export function TutorKnowledgeVisual({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-ink-900/60 p-4 ${className}`}>
      <div className="flex items-center justify-between text-[11px] text-faint font-mono">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-[#2c64a0]" />
          SOCRATIC KNOWLEDGE GRAPH
        </span>
        <span className="text-[#2c64a0] font-semibold">CBSE / NCERT</span>
      </div>

      <div className="my-2 relative h-16 w-full flex items-center justify-center">
        <svg viewBox="0 0 280 80" className="w-full h-full" role="img" aria-label="Knowledge branch graph">
          {/* Connecting branches */}
          <path d="M 40 40 C 80 40, 80 20, 120 20" fill="none" stroke="rgba(44, 100, 160, 0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M 40 40 C 80 40, 80 60, 120 60" fill="none" stroke="rgba(44, 100, 160, 0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M 120 20 C 170 20, 180 35, 230 35" fill="none" stroke="rgba(44, 100, 160, 0.6)" strokeWidth="1.5" />
          <path d="M 120 60 C 170 60, 180 45, 230 45" fill="none" stroke="rgba(44, 100, 160, 0.6)" strokeWidth="1.5" />

          {/* Root node */}
          <circle cx="40" cy="40" r="12" fill="var(--color-ink-850)" stroke="#2c64a0" strokeWidth="2" />
          <circle cx="40" cy="40" r="4" fill="#2c64a0" />

          {/* Child 1: Concept */}
          <rect x="100" y="10" width="60" height="20" rx="4" fill="var(--color-ink-850)" stroke="rgba(44, 100, 160, 0.6)" strokeWidth="1" />
          <text x="130" y="24" textAnchor="middle" fill="var(--color-fg)" fontFamily="IBM Plex Mono" fontSize="8.5">Concept</text>

          {/* Child 2: Derivation */}
          <rect x="100" y="50" width="60" height="20" rx="4" fill="var(--color-ink-850)" stroke="rgba(44, 100, 160, 0.6)" strokeWidth="1" />
          <text x="130" y="64" textAnchor="middle" fill="var(--color-fg)" fontFamily="IBM Plex Mono" fontSize="8.5">Stepwise</text>

          {/* Final: Mastery Check */}
          <rect x="205" y="30" width="70" height="20" rx="4" fill="rgba(44, 100, 160, 0.15)" stroke="#2c64a0" strokeWidth="1.5" />
          <text x="240" y="44" textAnchor="middle" fill="#2c64a0" fontFamily="IBM Plex Mono" fontWeight="600" fontSize="8.5">Mastery</text>
        </svg>
      </div>

      <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
        <span className="font-mono text-muted">Pedagogy: Guided Socratic</span>
        <span className="rounded bg-[#2c64a0]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#2c64a0]">Zero-Cheating</span>
      </div>
    </div>
  )
}

/**
 * 03. Cheating Detection Agent: Proctoring Radar & Telemetry Visual
 */
export function CheatingDetectionVisual({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion()

  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-ink-900/60 p-4 ${className}`}>
      <div className="flex items-center justify-between text-[11px] text-faint font-mono">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-[#b84848] animate-ping" />
          INTEGRITY TELEMETRY
        </span>
        <span className="text-[#b84848] font-semibold">SESSION ACTIVE</span>
      </div>

      <div className="my-2 relative h-16 w-full flex items-center justify-around px-2">
        {/* Radar circle */}
        <div className="relative size-14 rounded-full border border-[#b84848]/30 flex items-center justify-center">
          <div className="absolute size-9 rounded-full border border-[#b84848]/20" />
          <div className="size-2 rounded-full bg-[#b84848]" />
          {!reduced && (
            <div
              className="absolute inset-0 rounded-full border-t-2 border-[#b84848]"
              style={{ animation: 'spin 3s linear infinite' }}
            />
          )}
        </div>

        {/* Live signals status */}
        <div className="space-y-1 font-mono text-[10px]">
          <div className="flex items-center gap-2">
            <span className="text-muted">Presence:</span>
            <span className="text-leaf font-semibold">1 Candidate (Verified)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted">Audio Feed:</span>
            <span className="text-leaf font-semibold">Normal (Ambient)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted">Browser Focus:</span>
            <span className="text-leaf font-semibold">Full Screen Lock</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
        <span className="font-mono text-muted">Integrity Index: 99.2%</span>
        <span className="rounded bg-[#b84848]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#b84848]">Human Proctor Sign-Off</span>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/**
 * 04. AI Assessment Agent: Rubric Matrix & Score Visual
 */
export function AssessmentRubricVisual({ className = '' }: { className?: string }) {
  const criteria = [
    { name: 'Conceptual Rigour', score: 94 },
    { name: 'Methodology & Proof', score: 88 },
    { name: 'Citation & Evidence', score: 96 },
  ]

  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-ink-900/60 p-4 ${className}`}>
      <div className="flex items-center justify-between text-[11px] text-faint font-mono">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-[#3f7d58]" />
          RUBRIC EVALUATION MATRIX
        </span>
        <span className="text-[#3f7d58] font-semibold">GRADE: A+ (92.6%)</span>
      </div>

      <div className="my-2 space-y-2 px-1">
        {criteria.map((c, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between font-mono text-[10px]">
              <span className="text-fg-soft">{c.name}</span>
              <span className="text-[#3f7d58] font-semibold">{c.score}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3f7d58]/60 to-[#3f7d58]"
                style={{ width: `${c.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
        <span className="font-mono text-muted">Automated Rubric Feedback</span>
        <span className="rounded bg-[#3f7d58]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#3f7d58]">Teacher Approved</span>
      </div>
    </div>
  )
}

/**
 * 05. Orchestrator Agent: Multi-Agent Network Mesh Visual
 */
export function OrchestratorNetworkVisual({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion()

  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-line bg-ink-900/60 p-4 ${className}`}>
      <div className="flex items-center justify-between text-[11px] text-faint font-mono">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-[#5867a8]" />
          MULTI-AGENT DISPATCH
        </span>
        <span className="text-[#5867a8] font-semibold">4 AGENTS SYNCED</span>
      </div>

      <div className="my-2 relative h-16 w-full flex items-center justify-center">
        <svg viewBox="0 0 280 80" className="w-full h-full" role="img" aria-label="Multi-agent coordination graph">
          {/* Connection lines to central orchestrator */}
          <line x1="140" y1="40" x2="40" y2="25" stroke="rgba(88, 103, 168, 0.45)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="140" y1="40" x2="40" y2="55" stroke="rgba(88, 103, 168, 0.45)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="140" y1="40" x2="240" y2="25" stroke="rgba(88, 103, 168, 0.45)" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="140" y1="40" x2="240" y2="55" stroke="rgba(88, 103, 168, 0.45)" strokeWidth="1.5" strokeDasharray="3 3" />

          {/* Worker agents */}
          <circle cx="40" cy="25" r="9" fill="var(--color-ink-850)" stroke="#2c64a0" strokeWidth="1.5" />
          <circle cx="40" cy="55" r="9" fill="var(--color-ink-850)" stroke="#2a8784" strokeWidth="1.5" />
          <circle cx="240" cy="25" r="9" fill="var(--color-ink-850)" stroke="#3f7d58" strokeWidth="1.5" />
          <circle cx="240" cy="55" r="9" fill="var(--color-ink-850)" stroke="#a9834f" strokeWidth="1.5" />

          {/* Central Orchestrator */}
          <rect x="110" y="24" width="60" height="32" rx="8" fill="var(--color-ink-850)" stroke="#5867a8" strokeWidth="2" />
          <text x="140" y="44" textAnchor="middle" fill="#5867a8" fontFamily="IBM Plex Mono" fontWeight="700" fontSize="9">ORCHESTRATOR</text>

          {/* Packet pulse */}
          {!reduced && (
            <circle r="3" fill="#fff">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M 140 40 L 40 25 M 140 40 L 240 55" />
            </circle>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px]">
        <span className="font-mono text-muted">Execution: Stateful DAG</span>
        <span className="rounded bg-[#5867a8]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#5867a8]">Human Checkpoint</span>
      </div>
    </div>
  )
}
