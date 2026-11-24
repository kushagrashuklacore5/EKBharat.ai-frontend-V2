import { useEffect, useState } from 'react'
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  User,
  Bot,
  Volume2,
  VolumeX,
  GraduationCap,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import type { AgentSpec } from './agentsData'
import { DemoBadge } from '../ui/DemoBadge'
import { Button } from '../ui/Button'
import {
  VoiceWaveformVisual,
  TutorKnowledgeVisual,
  CheatingDetectionVisual,
  AssessmentRubricVisual,
  OrchestratorNetworkVisual,
} from './AgentVisuals'

interface Props {
  agent: AgentSpec | null
  onClose: () => void
  initialTab?: 'demo' | 'overview'
}

export function AgentModal({ agent, onClose, initialTab = 'demo' }: Props) {
  const [activeTab, setActiveTab] = useState<'demo' | 'overview'>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [agent, initialTab])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (agent) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [agent])

  if (!agent) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        className={`relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl border border-line-strong bg-ink-850 shadow-[var(--shadow-lg)] text-fg transition-all ${
          agent.id === 'assessment' && activeTab === 'demo'
            ? 'max-w-6xl h-[92vh]'
            : 'max-w-4xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-7">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-faint">
                AGENT {agent.number}
              </span>
              <span className="text-line-strong">·</span>
              <span
                className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium"
                style={{
                  backgroundColor: `rgba(${agent.accentRgb}, 0.12)`,
                  color: agent.accent,
                }}
              >
                {agent.category}
              </span>
            </div>
            <h2 id="agent-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-fg">
              {agent.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-ink-800 hover:text-fg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 border-b border-line bg-ink-900/60 px-5 sm:px-7">
          <button
            type="button"
            onClick={() => setActiveTab('demo')}
            className={`border-b-2 py-3 text-[13.5px] font-semibold transition-colors ${
              activeTab === 'demo'
                ? 'border-cyan text-fg'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            Interactive Demo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`border-b-2 py-3 text-[13.5px] font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'border-cyan text-fg'
                : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            Capabilities &amp; Architecture
          </button>
        </div>

        {/* Body content */}
        <div
          className={`overflow-y-auto space-y-6 flex-1 ${
            agent.id === 'assessment' && activeTab === 'demo' ? 'p-3 sm:p-5' : 'p-5 sm:p-7'
          }`}
        >
          {activeTab === 'demo' ? (
            <div>
              {agent.id === 'vaani' && <VaaniInteractiveDemo />}
              {agent.id === 'tutor' && <TutorInteractiveDemo />}
              {agent.id === 'cheating-detection' && <CheatingInteractiveDemo />}
              {agent.id === 'assessment' && <AssessmentInteractiveDemo />}
              {agent.id === 'orchestrator' && <OrchestratorInteractiveDemo />}
            </div>
          ) : (
            <AgentOverviewContent agent={agent} />
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ink-900/50 px-5 py-3.5 sm:px-7">
          <DemoBadge label="Demonstration environment · Enterprise integrations deploy on private clouds" />
          <div className="flex items-center gap-2">
            <Button
              to={`/build-with-us?type=agents&agent=${agent.id}`}
              size="md"
              variant="primary"
            >
              Deploy This Agent
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 01. Vaani Voice Agent Interactive Demo
 */
function VaaniInteractiveDemo() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [lang, setLang] = useState<'bilingual' | 'hindi' | 'english'>('bilingual')
  const [muted, setMuted] = useState(false)

  const dialogues = {
    bilingual: [
      { speaker: 'Customer', text: 'Namaste, mera broadband connection subah se disconnected hai. Emergency work chal raha hai.', time: '00:03' },
      { speaker: 'Vaani', text: 'Namaste! Main aapki connectivity turant check karti hoon. Kya main aapka registered mobile number ya account ID confirm kar sakti hoon?', time: '00:07' },
      { speaker: 'Customer', text: 'Haan, registered number 98201 44521 hai.', time: '00:11' },
      { speaker: 'Vaani', text: 'Shukriya. Main dekh sakti hoon ki aapke sector mein feeder maintenance chal raha hai. Connectivity 45 minutes mein restore ho jayegi. Ek backup 5G boost voucher aapke phone par send kar diya gaya hai.', time: '00:19' },
    ],
    hindi: [
      { speaker: 'Customer', text: 'नमस्ते, मेरा ब्रॉडबैंड कनेक्शन सुबह से काम नहीं कर रहा है। कृपया सहायता करें।', time: '00:03' },
      { speaker: 'Vaani', text: 'नमस्ते! मैं तुरंत आपके कनेक्शन की स्थिति जांच रही हूँ। क्या आप अपना पंजीकृत मोबाइल नंबर बता सकते हैं?', time: '00:07' },
      { speaker: 'Customer', text: 'हाँ, मेरा नंबर 98201 44521 है।', time: '00:11' },
      { speaker: 'Vaani', text: 'धन्यवाद। आपके क्षेत्र में फाइबर मेंटेनेंस चल रहा है। 45 मिनट में सेवा सामान्य हो जाएगी।', time: '00:18' },
    ],
    english: [
      { speaker: 'Customer', text: 'Hello, my fiber connection has been down since morning. I have an urgent meeting.', time: '00:03' },
      { speaker: 'Vaani', text: 'Hello! I understand the urgency. Let me check the circuit status right away. Could you please confirm your registered account number?', time: '00:08' },
      { speaker: 'Customer', text: 'Sure, it is 98201 44521.', time: '00:12' },
      { speaker: 'Vaani', text: 'Thank you. I have verified your line. A planned hub upgrade is underway in your grid. Service will be restored within 45 minutes. A temporary mobile data booster has been credited to your line.', time: '00:20' },
    ],
  }

  const activeTranscript = dialogues[lang]

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentTurn((prev) => {
        if (prev >= activeTranscript.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 3800)
    return () => clearInterval(interval)
  }, [isPlaying, activeTranscript.length])

  return (
    <div className="space-y-6">
      {/* Simulation player banner */}
      <div className="rounded-xl border border-line bg-ink-900/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (currentTurn >= activeTranscript.length - 1) setCurrentTurn(0)
                setIsPlaying(!isPlaying)
              }}
              className="grid size-12 place-items-center rounded-xl bg-cyan text-white shadow-md transition-transform hover:scale-105 active:scale-95"
              aria-label={isPlaying ? 'Pause conversation' : 'Start conversation'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <div>
              <p className="text-[14.5px] font-semibold text-fg">
                {isPlaying ? 'Live Voice Session Active' : 'Voice Interaction Simulation'}
              </p>
              <p className="text-[12.5px] text-muted">
                {isPlaying
                  ? `Turn ${currentTurn + 1} of ${activeTranscript.length} · Streaming duplex audio`
                  : 'Click play to simulate conversational voice interaction'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line bg-ink-850 p-1 text-[12px] font-medium">
              {(['bilingual', 'hindi', 'english'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLang(l)
                    setCurrentTurn(0)
                    setIsPlaying(false)
                  }}
                  className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                    lang === l ? 'bg-cyan text-white shadow-xs' : 'text-muted hover:text-fg'
                  }`}
                >
                  {l === 'bilingual' ? 'Hinglish' : l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className="rounded-lg border border-line p-2 text-muted hover:text-fg"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentTurn(0)
                setIsPlaying(false)
              }}
              className="rounded-lg border border-line p-2 text-muted hover:text-fg"
              aria-label="Restart conversation"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Audio waveform & Avatar */}
        <div className="mt-5 flex items-center gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-cyan/40 bg-ink-950 shadow-md">
            <img
              src={
                !isPlaying
                  ? '/brand/vaani_frames/frame_0.webp'
                  : activeTranscript[currentTurn]?.speaker === 'Vaani'
                  ? '/brand/vaani_frames/frame_3.webp'
                  : '/brand/vaani_frames/frame_1.webp'
              }
              alt="Vaani gesture"
              className="h-full w-full object-cover transition-all duration-300"
            />
            {isPlaying && (
              <span
                className={`absolute bottom-1 right-1 size-2.5 rounded-full border border-ink-950 ${
                  activeTranscript[currentTurn]?.speaker === 'Vaani'
                    ? 'bg-saffron animate-ping'
                    : 'bg-leaf animate-pulse'
                }`}
              />
            )}
          </div>
          <div className="flex-1">
            <VoiceWaveformVisual active={isPlaying} />
          </div>
        </div>
      </div>

      {/* Real-time transcript */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="label text-faint">Live Synchronized Transcript</h4>
          <span className="font-mono text-[11px] text-cyan">ASR: 98.7% Accuracy</span>
        </div>

        <div className="space-y-2.5 rounded-xl border border-line bg-ink-900/40 p-4">
          {activeTranscript.map((turn, i) => {
            const isCur = i === currentTurn
            const isPast = i <= currentTurn
            const isCustomer = turn.speaker === 'Customer'

            return (
              <div
                key={i}
                className={`flex gap-3 rounded-xl p-3 transition-all ${
                  isCur
                    ? 'border border-cyan/40 bg-ink-850 shadow-sm'
                    : isPast
                    ? 'opacity-85'
                    : 'opacity-35'
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    isCustomer ? 'bg-ink-800 text-fg' : 'bg-cyan text-white'
                  }`}
                >
                  {isCustomer ? <User size={14} /> : <Bot size={14} />}
                </span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="font-semibold text-fg">
                      {turn.speaker}{' '}
                      {!isCustomer && (
                        <span className="ml-1 text-[10px] font-normal text-cyan">
                          (Vaani AI)
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-faint">{turn.time}</span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-fg-soft">{turn.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * 02. AI Tutor Agent Interactive Demo
 */
function TutorInteractiveDemo() {
  const PRESETS = [
    {
      topic: 'Physics · Archimedes’ Principle',
      q: 'Why does an iron nail sink in water, while a huge steel ship floats?',
      steps: [
        {
          stage: 'Conceptual Intuition',
          text: 'It is all about buoyant force and average density, not weight alone! An iron nail has high density with negligible water displacement. A ship is hollow, displacing an immense volume of water.',
        },
        {
          stage: 'Socratic Guiding Question',
          text: 'If the upward buoyant force equals the weight of the displaced liquid (Archimedes’ Law), what happens to the average density of the ship when air pockets are inside the hull?',
        },
        {
          stage: 'Stepwise Derivation',
          text: 'Average Density = Total Mass / Total Volume. Because the hull encapsulates a vast air volume, Avg Density (Ship) < Density (Water: 1000 kg/m³). Thus buoyant force exceeds total weight.',
        },
        {
          stage: 'Comprehension Check',
          text: 'Quick quiz: What happens if water leaks into the hollow compartments of the ship? How does this change the average density and buoyant balance?',
        },
      ],
    },
    {
      topic: 'Mathematics · Quadratic Formula',
      q: 'Can you show me the step-by-step derivation of the quadratic formula from ax² + bx + c = 0?',
      steps: [
        {
          stage: 'Setting Up',
          text: 'We begin with ax² + bx + c = 0 (where a ≠ 0). Divide the entire equation by a: x² + (b/a)x + (c/a) = 0.',
        },
        {
          stage: 'Completing the Square',
          text: 'Move the constant term to the right: x² + (b/a)x = -c/a. Add (b/2a)² to both sides to form a perfect square binomial.',
        },
        {
          stage: 'Factorization',
          text: '(x + b/2a)² = (b² - 4ac) / 4a². Notice how the discriminant (b² - 4ac) naturally appears here!',
        },
        {
          stage: 'Solving for x',
          text: 'Take the square root of both sides: x + b/2a = ±√(b² - 4ac) / 2a. Subtract b/2a to get x = (-b ± √(b² - 4ac)) / 2a.',
        },
      ],
    },
  ]

  const [selectedIdx, setSelectedIdx] = useState(0)
  const current = PRESETS[selectedIdx]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="label text-faint">Select a Curated Educational Query</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIdx(i)}
              className={`rounded-xl border p-3.5 text-left transition-all ${
                selectedIdx === i
                  ? 'border-[#2c64a0] bg-ink-850 shadow-sm'
                  : 'border-line bg-ink-900/50 hover:bg-ink-900'
              }`}
            >
              <p className="font-mono text-[11px] text-[#2c64a0] font-semibold">{p.topic}</p>
              <p className="mt-1 text-[13px] font-medium text-fg line-clamp-2">{p.q}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-ink-900/70 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#2c64a0] text-white">
              <GraduationCap size={15} />
            </span>
            <span className="text-[13.5px] font-bold text-fg">Socratic Tutor Walkthrough</span>
          </div>
          <span className="font-mono text-[11px] text-[#2c64a0] font-semibold">
            Pedagogy: Conceptual Inquiry
          </span>
        </div>

        {/* Question bubble */}
        <div className="rounded-xl bg-ink-800 p-3.5 border border-line/60">
          <p className="label text-faint text-[10.5px]">Student Query</p>
          <p className="mt-1 text-[14px] font-medium text-fg">{current.q}</p>
        </div>

        {/* Steps */}
        <div className="space-y-3 pt-2">
          {current.steps.map((st, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2c64a0]/15 font-mono text-[11px] font-bold text-[#2c64a0]">
                {i + 1}
              </span>
              <div className="space-y-1">
                <p className="font-mono text-[11px] font-bold text-[#2c64a0] uppercase tracking-wide">
                  {st.stage}
                </p>
                <p className="text-[13.5px] leading-relaxed text-fg-soft">{st.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[12px] text-muted">
          <span>Aligned with NCERT Class 9-12 curriculum specifications.</span>
          <span className="font-mono text-[#2c64a0] font-semibold">Zero Rote-Cheating</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 03. Cheating Detection Agent Interactive Demo
 */
function CheatingInteractiveDemo() {
  const [scenario, setScenario] = useState<'clean' | 'person' | 'browser'>('clean')

  const scenarios = {
    clean: {
      title: 'Candidate Normal (No Anomalies)',
      risk: 'Low (Clean)',
      riskColor: 'text-leaf',
      riskBg: 'bg-leaf/10 border-leaf/30',
      telemetry: [
        { time: '10:00:15', event: 'Biometric Face Verification', detail: 'Single primary face verified against institutional ID.', flag: false },
        { time: '10:02:40', event: 'Gaze & Head Pose', detail: 'Head oriented towards primary viewport (yaw ±4°).', flag: false },
        { time: '10:05:10', event: 'Audio Environment', detail: 'Acoustic background: 24 dB (within permissible baseline).', flag: false },
        { time: '10:07:30', event: 'Input Cadence', detail: 'Typing keystroke biometrics consistent with human pacing.', flag: false },
      ],
      recommendation: 'Auto-Approved: No integrity violations detected.',
    },
    person: {
      title: 'Multi-Face / Unauthorized Presence',
      risk: 'Elevated (Proctor Review Required)',
      riskColor: 'text-amber',
      riskBg: 'bg-amber/10 border-amber/30',
      telemetry: [
        { time: '10:01:22', event: 'Primary Face Check', detail: 'Candidate in active viewport.', flag: false },
        { time: '10:04:15', event: 'Vision Telemetry', detail: 'Second face detected in background periphery (Confidence: 94%).', flag: true },
        { time: '10:04:18', event: 'Acoustic Sensor', detail: 'Low-frequency secondary whisper detected on microphone channel.', flag: true },
        { time: '10:04:25', event: 'System Action', detail: 'Event snapshot queued for proctor review. Candidate prompted to adjust camera.', flag: true },
      ],
      recommendation: 'Flagged for Human Review: Verify second face in snapshot timeline.',
    },
    browser: {
      title: 'Window Blur & Rapid Clipboard Paste',
      risk: 'High (Integrity Anomaly)',
      riskColor: 'text-danger',
      riskBg: 'bg-danger/10 border-danger/30',
      telemetry: [
        { time: '10:03:00', event: 'Browser Sandbox Lock', detail: 'Full-screen mode established.', flag: false },
        { time: '10:06:12', event: 'Window Blur Event', detail: 'Focus shifted away from exam tab (Duration: 5.4 seconds).', flag: true },
        { time: '10:06:18', event: 'Clipboard Anomaly', detail: '1,240 characters pasted into essay box within 120 milliseconds.', flag: true },
        { time: '10:06:20', event: 'Integrity Marker', detail: 'Disallowed external application switch logged in audit trail.', flag: true },
      ],
      recommendation: 'Escalated: Proctor notified for immediate intervention or verbal check.',
    },
  }

  const cur = scenarios[scenario]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="label text-faint">Select a Proctoring Telemetry Scenario</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['clean', 'person', 'browser'] as const).map((sc) => (
            <button
              key={sc}
              type="button"
              onClick={() => setScenario(sc)}
              className={`rounded-xl border p-3 text-left transition-all ${
                scenario === sc
                  ? 'border-[#b84848] bg-ink-850 shadow-sm'
                  : 'border-line bg-ink-900/50 hover:bg-ink-900'
              }`}
            >
              <p className="font-mono text-[11px] font-semibold text-[#b84848] uppercase">{sc} scenario</p>
              <p className="mt-1 text-[12.5px] font-medium text-fg">{scenarios[sc].title}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-ink-900/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-[#b84848]" />
            <h4 className="text-[14px] font-bold text-fg">Proctoring Telemetry Inspector</h4>
          </div>
          <div className={`rounded-full border px-3 py-1 font-mono text-[11px] font-bold ${cur.riskBg} ${cur.riskColor}`}>
            Risk Level: {cur.risk}
          </div>
        </div>

        {/* Telemetry log list */}
        <div className="space-y-2">
          {cur.telemetry.map((t, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 rounded-lg border p-2.5 text-[12.5px] ${
                t.flag
                  ? 'border-[#b84848]/30 bg-[#b84848]/10 text-fg'
                  : 'border-line/60 bg-ink-850/60 text-fg-soft'
              }`}
            >
              <span className="font-mono text-[11px] text-faint pt-0.5">{t.time}</span>
              <div className="flex-1">
                <span className="font-semibold text-fg">{t.event}: </span>
                <span>{t.detail}</span>
              </div>
              {t.flag && (
                <span className="rounded bg-[#b84848] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  FLAGGED
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Human proctor notice */}
        <div className="rounded-lg border border-line bg-ink-850 p-3 flex items-center justify-between text-[12.5px]">
          <span className="text-fg-soft font-medium">{cur.recommendation}</span>
          <span className="font-mono text-[11px] text-muted">Review Queue ID: #PR-8842</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 04. AI Assessment Agent Interactive Demo (Direct Portal Launcher)
 */
function AssessmentInteractiveDemo() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-line bg-ink-900/60">
      <div className="grid size-14 place-items-center rounded-2xl border border-cyan/30 bg-cyan/10 text-cyan mb-4 shadow-lg shadow-cyan/10">
        <Sparkles size={28} />
      </div>
      <h3 className="text-xl font-bold text-fg">AI Assessment &amp; Grading Studio</h3>
      <p className="mt-2 max-w-md text-sm text-muted">
        The interactive assessment demo runs in an immersive dedicated sandbox with real-time AI question generation, rubric scoring, and anti-tamper student autosave.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button to="/ai-assessment-agent" variant="primary" size="lg" arrow>
          Launch Interactive Studio
        </Button>
      </div>
    </div>
  )
}

/**
 * 05. Orchestrator Agent Interactive Demo
 */
function OrchestratorInteractiveDemo() {
  const [step, setStep] = useState(0)

  const steps = [
    {
      agent: 'Orchestrator Agent',
      role: 'Coordinator & Planner',
      action: 'Decomposing Goal: "Generate Comprehensive Indian Renewable Energy Market Brief"',
      status: 'Created 4 execution subtasks in DAG with dependency graph.',
      color: '#5867a8',
    },
    {
      agent: 'Research Agent',
      role: 'Specialist: Information Gathering',
      action: 'Invoking tools: web_search("MNRE solar capacity 2026"), read_financial_reports()',
      status: 'Indexed 18 primary government datasets and solar tariff trends into shared context.',
      color: '#2c64a0',
    },
    {
      agent: 'Analysis Agent',
      role: 'Specialist: Quantitative Computation',
      action: 'Invoking tools: compute_cagr(), compare_grid_parity_tables()',
      status: 'Computed LCOE parity across solar, wind, and battery storage solutions.',
      color: '#2a8784',
    },
    {
      agent: 'Verification Agent',
      role: 'Specialist: Audit & Fact Checking',
      action: 'Validating claims against official MNRE and CEA gazettes',
      status: '100% of 14 assertions cite active gazette sources. Zero hallucinations flagged.',
      color: '#3f7d58',
    },
    {
      agent: 'Human Approval Gate',
      role: 'Reviewer Checkpoint',
      action: 'Pausing workflow execution for executive sign-off',
      status: 'Draft and evidence trail presented to reviewer. Approved without revisions.',
      color: '#c4852f',
    },
    {
      agent: 'Orchestrator Agent',
      role: 'Execution Finalization',
      action: 'Assembling final briefing dossier and persisting run trace',
      status: 'Deliverable completed in 4.8 seconds. Output logged to institutional repository.',
      color: '#5867a8',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-ink-900/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h4 className="text-[14px] font-bold text-fg">Multi-Agent Workflow Execution</h4>
            <p className="text-[12px] text-muted">
              Goal: Generate Comprehensive Indian Renewable Energy Market Brief
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="md"
              variant="secondary"
              onClick={() => setStep((s) => (s + 1) % steps.length)}
            >
              Step {step + 1} of {steps.length} → Next
            </Button>
            <Button
              to="/workflow-studio"
              size="md"
              variant="tertiary"
            >
              Open in Studio <ExternalLink size={13} className="ml-1" />
            </Button>
          </div>
        </div>

        {/* Step progress timeline */}
        <div className="grid gap-2">
          {steps.map((st, i) => {
            const isCur = i === step
            const isDone = i < step

            return (
              <div
                key={i}
                onClick={() => setStep(i)}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  isCur
                    ? 'border-[#5867a8] bg-ink-850 shadow-sm'
                    : isDone
                    ? 'border-line/60 bg-ink-900/40 opacity-90'
                    : 'border-transparent bg-transparent opacity-45'
                }`}
              >
                <div className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: st.color }}
                    />
                    <span className="font-bold text-fg">{st.agent}</span>
                    <span className="text-muted">· {st.role}</span>
                  </div>
                  <span className="font-mono text-[11px] text-faint">0{i + 1}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] font-medium text-fg-soft">{st.action}</p>
                {isCur && (
                  <p className="mt-1 font-mono text-[12px] text-cyan">{st.status}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Capabilities & Architecture Tab Content
 */
function AgentOverviewContent({ agent }: { agent: AgentSpec }) {
  return (
    <div className="space-y-8">
      {/* Visual Header */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-fg">Agent Purpose &amp; Domain</h3>
          <p className="text-[14.5px] leading-relaxed text-fg-soft">{agent.tagline}</p>
          <div className="space-y-2 pt-2">
            <h4 className="label text-faint">Core Objectives</h4>
            <ul className="space-y-2 text-[13.5px] text-fg-soft">
              {agent.purpose.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-cyan" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Visual card */}
        <div>
          {agent.id === 'vaani' && <VoiceWaveformVisual className="h-full" />}
          {agent.id === 'tutor' && <TutorKnowledgeVisual className="h-full" />}
          {agent.id === 'cheating-detection' && <CheatingDetectionVisual className="h-full" />}
          {agent.id === 'assessment' && <AssessmentRubricVisual className="h-full" />}
          {agent.id === 'orchestrator' && <OrchestratorNetworkVisual className="h-full" />}
        </div>
      </div>

      {/* Capabilities Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-fg">Key Production Capabilities</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {agent.capabilities.map((cap, i) => (
            <div key={i} className="rounded-xl border border-line bg-ink-900/60 p-4 space-y-1">
              <h4 className="text-[14px] font-semibold text-fg">{cap.title}</h4>
              <p className="text-[13px] leading-relaxed text-muted">{cap.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Specifications Table */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-fg">Technical Specifications</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {agent.specs.map((s, i) => (
            <div key={i} className="rounded-xl border border-line bg-ink-900/40 p-3 space-y-1">
              <p className="label text-faint text-[10.5px]">{s.label}</p>
              <p className="font-mono text-[12px] font-semibold text-fg">{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
