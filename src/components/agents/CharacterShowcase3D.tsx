import { useEffect, useRef, useState } from 'react'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  GraduationCap,
  ShieldAlert,
  FileCheck2,
  Network,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { AGENTS_DATA, type AgentSpec } from './agentsData'
import { createCharacterScene, hasWebGL, type CharacterSceneApi } from './character3dScene'
import { VaaniAudioEngine, type SpeechState, type AudioTelemetry } from './vaaniAudioEngine'
import { VaaniCinematicStage } from './VaaniCinematicStage'
import { TutorCinematicStage } from './TutorCinematicStage'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Button } from '../ui/Button'
import { AgentModal } from './AgentModal'
import {
  CheatingDetectionVisual,
  AssessmentRubricVisual,
  OrchestratorNetworkVisual,
} from './AgentVisuals'

const ICONS = {
  vaani: Mic,
  tutor: GraduationCap,
  'cheating-detection': ShieldAlert,
  assessment: FileCheck2,
  orchestrator: Network,
}

export function CharacterShowcase3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioEngineRef = useRef<VaaniAudioEngine | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('vaani')
  const [sceneApi, setSceneApi] = useState<CharacterSceneApi | null>(null)
  const [webGlAvailable, setWebGlAvailable] = useState<boolean>(true)
  const [modalAgent, setModalAgent] = useState<AgentSpec | null>(null)
  const [modalTab, setModalTab] = useState<'demo' | 'overview'>('demo')
  const [vaaniState, setVaaniState] = useState<SpeechState>('idle')
  const [vaaniViewMode] = useState<'cinematic' | '3d'>('cinematic')
  const [telemetry, setTelemetry] = useState<AudioTelemetry>({
    isMicActive: false,
    isSpeaking: false,
    decibels: 0,
    peakFrequency: 0,
    waveform: [0.2, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4, 0.2],
  })
  const [micError, setMicError] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()

  const currentAgent = AGENTS_DATA.find((a) => a.id === selectedAgentId) || AGENTS_DATA[0]
  const currentIndex = AGENTS_DATA.findIndex((a) => a.id === selectedAgentId)

  // Initialize Audio Engine
  useEffect(() => {
    const engine = new VaaniAudioEngine((newState) => {
      setVaaniState(newState)
      sceneApi?.setVaaniState(newState)
    })
    audioEngineRef.current = engine

    return () => {
      engine.dispose()
    }
  }, [sceneApi])

  // Polling loop for audio telemetry -> feeds into 3D scene
  useEffect(() => {
    let raf = 0
    const poll = () => {
      if (audioEngineRef.current && sceneApi) {
        const t = audioEngineRef.current.getTelemetry()
        setTelemetry(t)
        sceneApi.updateAudioTelemetry(t)
      }
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(raf)
  }, [sceneApi])

  // Initialize Three.js 3D character scene
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (!hasWebGL()) {
      setWebGlAvailable(false)
      return
    }

    try {
      const api = createCharacterScene(canvas, {
        reducedMotion,
        initialAgentId: selectedAgentId,
      })
      setSceneApi(api)

      const observer = new IntersectionObserver(([entry]) => {
        api.setVisible(entry.isIntersecting)
      })
      observer.observe(canvas)

      return () => {
        observer.disconnect()
        api.dispose()
      }
    } catch (e) {
      console.warn('Could not initialize 3D scene:', e)
      setWebGlAvailable(false)
    }
  }, [reducedMotion])

  // Update scene when selected agent changes
  useEffect(() => {
    if (sceneApi) {
      sceneApi.selectAgent(selectedAgentId)
    }
  }, [selectedAgentId, sceneApi])

  // Keyboard navigation for character selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalAgent) return
      if (e.key === 'ArrowRight') {
        const nextIdx = (currentIndex + 1) % AGENTS_DATA.length
        setSelectedAgentId(AGENTS_DATA[nextIdx].id)
      } else if (e.key === 'ArrowLeft') {
        const prevIdx = (currentIndex - 1 + AGENTS_DATA.length) % AGENTS_DATA.length
        setSelectedAgentId(AGENTS_DATA[prevIdx].id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, modalAgent])

  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % AGENTS_DATA.length
    setSelectedAgentId(AGENTS_DATA[nextIdx].id)
  }

  const handlePrev = () => {
    const prevIdx = (currentIndex - 1 + AGENTS_DATA.length) % AGENTS_DATA.length
    setSelectedAgentId(AGENTS_DATA[prevIdx].id)
  }

  // Animation State switcher
  const handleSetState = (newState: SpeechState) => {
    if (audioEngineRef.current) {
      if (newState !== 'listening') audioEngineRef.current.stopListening()
      if (newState !== 'speaking') audioEngineRef.current.stopSpeaking()
      audioEngineRef.current.setState(newState)
    }
    setVaaniState(newState)
    sceneApi?.setVaaniState(newState)
  }

  // Live Microphone trigger
  const handleToggleMic = async () => {
    if (!audioEngineRef.current) return
    setMicError(null)

    if (telemetry.isMicActive) {
      audioEngineRef.current.stopListening()
    } else {
      const granted = await audioEngineRef.current.startListening()
      if (!granted) {
        setMicError('Microphone permission not granted. Running in interactive demonstration mode.')
      }
    }
  }

  // Live Speech Synthesis trigger - speaks full greeting on touch/click
  const handleTriggerSpeech = () => {
    if (!audioEngineRef.current) return
    if (telemetry.isSpeaking) return
    const speechText =
      'Hi, my name is Vaani. I am your AI Voice Assistant from Ek Bharat AI. How can I help you today?'
    audioEngineRef.current.speak(speechText)
  }

  const handleOpenDemo = (agent: AgentSpec) => {
    setModalTab('demo')
    setModalAgent(agent)
  }

  const handleOpenOverview = (agent: AgentSpec) => {
    setModalTab('overview')
    setModalAgent(agent)
  }

  return (
    <section id="agents-portfolio" className="relative py-16 md:py-24 overflow-hidden">
      <div className="container-x">
        {/* Section Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-cyan">
                Interactive 3D Showcase
              </span>
              <span className="text-line-strong">·</span>
              <span className="font-mono text-[11px] text-faint">Vaani Reference Prototype</span>
            </div>
            <h2 className="display mt-2 text-[clamp(1.8rem,3.2vw,2.75rem)] text-fg">
              Meet <span className="serif-accent text-gradient">VAANI</span> &amp; Our 3D Agents.
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              Explore VAANI, our voice AI personality engineered with continuous humanoid kinematics,
              sub-300ms turn latency, and four real-time conversational animation states.
            </p>
          </div>

          {/* Quick cycle controls */}
          <div className="flex items-center gap-2 self-start md:self-end">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous agent"
              className="grid size-10 place-items-center rounded-xl border border-line bg-ink-850 text-fg transition-colors hover:border-line-strong hover:bg-ink-800"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-mono text-[12px] text-faint px-1">
              0{currentIndex + 1} / 0{AGENTS_DATA.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next agent"
              className="grid size-10 place-items-center rounded-xl border border-line bg-ink-850 text-fg transition-colors hover:border-line-strong hover:bg-ink-800"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Main 3D Showcase Stage */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          {/* 3D Character Viewport */}
          <div className="panel relative flex h-[540px] sm:h-[600px] lg:h-[660px] w-full flex-col justify-between overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-ink-850/95 to-ink-900/95 p-5 shadow-[var(--shadow-md)]">
            {/* Ambient radial glow */}
            <div
              className="absolute inset-0 opacity-40 transition-all duration-700 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 60%, rgba(${currentAgent.accentRgb}, 0.22), transparent 70%)`,
              }}
            />

            {currentAgent.id === 'vaani' && vaaniViewMode === 'cinematic' ? (
              <VaaniCinematicStage
                state={vaaniState}
                onStateChange={handleSetState}
                telemetry={telemetry}
                onToggleMic={handleToggleMic}
                onTriggerSpeech={handleTriggerSpeech}
                micError={micError}
                reducedMotion={reducedMotion}
              />
            ) : currentAgent.id === 'tutor' ? (
              <TutorCinematicStage reducedMotion={reducedMotion} />
            ) : (
              <>
                {/* 3D Canvas */}
                <div className="relative flex-1 w-full flex items-center justify-center">
                  {webGlAvailable ? (
                    <canvas
                      ref={canvasRef}
                      className="h-full w-full touch-pan-y outline-none cursor-grab active:cursor-grabbing"
                      aria-label={`${currentAgent.name} 3D interactive model`}
                    />
                  ) : (
                    <div className="w-full max-w-md p-6">
                      {currentAgent.id === 'cheating-detection' && <CheatingDetectionVisual />}
                      {currentAgent.id === 'assessment' && <AssessmentRubricVisual />}
                      {currentAgent.id === 'orchestrator' && <OrchestratorNetworkVisual />}
                    </div>
                  )}
                </div>

                {/* Vaani Live State Switcher (when in 3D Mesh mode) */}
                {currentAgent.id === 'vaani' && (
                  <div className="relative z-10 my-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-ink-850/90 p-2.5 backdrop-blur-md">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-faint uppercase mr-1">Kinematic State:</span>
                      {(['idle', 'listening', 'speaking', 'thinking'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleSetState(st)}
                          className={`rounded-lg px-2.5 py-1 font-mono text-[11.5px] font-semibold capitalize transition-all ${
                            vaaniState === st
                              ? 'bg-cyan text-white shadow-xs'
                              : 'text-muted hover:text-fg hover:bg-ink-800'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleToggleMic}
                        title="Speak to Vaani using your browser microphone"
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11.5px] font-semibold transition-all ${
                          telemetry.isMicActive
                            ? 'border-leaf bg-leaf/20 text-leaf animate-pulse'
                            : 'border-line text-fg hover:bg-ink-800'
                        }`}
                      >
                        {telemetry.isMicActive ? <Mic size={13} /> : <MicOff size={13} />}
                        <span>{telemetry.isMicActive ? 'Listening (Mic Active)' : 'Speak (Mic)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerSpeech}
                        title="Hear Vaani respond with speech synthesis"
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11.5px] font-semibold transition-all ${
                          telemetry.isSpeaking
                            ? 'border-saffron bg-saffron/20 text-saffron'
                            : 'border-line text-fg hover:bg-ink-800'
                        }`}
                      >
                        {telemetry.isSpeaking ? <Volume2 size={13} /> : <VolumeX size={13} />}
                        <span>{telemetry.isSpeaking ? 'Speaking...' : 'Hear Voice'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {micError && (
                  <p className="relative z-10 text-[11.5px] text-saffron font-medium">{micError}</p>
                )}

                {/* Bottom Telemetry HUD */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3 text-[12px]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-faint">HUMANOID RIG:</span>
                    <span className="font-mono font-medium text-fg">FORWARD KINEMATICS · 60 FPS</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                    <span>ROTATE: CURSOR</span>
                    <span>·</span>
                    <span>SWITCH: ← → ARROWS</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Selected Agent Dossier / Profile */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-faint">
                  {currentAgent.number}
                </span>
                <span className="h-4 w-px bg-line-strong" />
                <span
                  className="rounded-full px-3 py-0.5 font-mono text-[11.5px] font-semibold"
                  style={{
                    backgroundColor: `rgba(${currentAgent.accentRgb}, 0.12)`,
                    color: currentAgent.accent,
                  }}
                >
                  {currentAgent.category}
                </span>
              </div>

              <h3 className="display text-3xl font-bold tracking-tight text-fg">
                {currentAgent.name}
              </h3>

              <p className="text-[15.5px] leading-relaxed text-fg-soft">
                {currentAgent.tagline}
              </p>

              {/* Purpose points */}
              <div className="rounded-2xl border border-line bg-ink-850 p-5 space-y-3">
                <p className="label text-faint">Architectural Purpose</p>
                <ul className="space-y-2 text-[13.5px] text-fg-soft">
                  {currentAgent.purpose.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 shrink-0"
                        style={{ color: currentAgent.accent }}
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Specs Pills */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {currentAgent.specs.slice(0, 4).map((s, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-line bg-ink-900/50 p-3"
                  >
                    <p className="font-mono text-[10px] text-faint uppercase">{s.label}</p>
                    <p className="mt-0.5 font-mono text-[12px] font-semibold text-fg">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => handleOpenDemo(currentAgent)}
                arrow
              >
                Try Interactive Demo
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleOpenOverview(currentAgent)}
              >
                Explore Capabilities
              </Button>
            </div>
          </div>
        </div>

        {/* Character Selection Roster Bar */}
        <div className="mt-12 space-y-3">
          <div className="flex items-center justify-between">
            <span className="label text-faint">Select Character</span>
            <span className="font-mono text-[11px] text-muted">
              Click to inspect 3D avatar
            </span>
          </div>

          <div
            role="tablist"
            aria-label="3D AI Agent Character Selection"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
          >
            {AGENTS_DATA.map((agent) => {
              const isSelected = agent.id === selectedAgentId
              const Icon = ICONS[agent.id]

              return (
                <button
                  key={agent.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${
                    isSelected
                      ? 'border-line-strong bg-ink-850 shadow-[var(--shadow-md)] scale-[1.02]'
                      : 'border-line bg-ink-900/60 opacity-75 hover:opacity-100 hover:border-line-strong hover:bg-ink-850'
                  }`}
                  style={{
                    boxShadow: isSelected
                      ? `0 0 24px -6px rgba(${agent.accentRgb}, 0.35)`
                      : undefined,
                  }}
                >
                  {/* Top indicator */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-faint">
                      {agent.number}
                    </span>
                    <span
                      className="grid size-7 place-items-center rounded-lg border transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: `rgba(${agent.accentRgb}, 0.12)`,
                        borderColor: isSelected ? agent.accent : 'transparent',
                        color: agent.accent,
                      }}
                    >
                      <Icon size={14} />
                    </span>
                  </div>

                  {/* Character Name & Badge */}
                  <div className="mt-4">
                    <p className="text-[13.5px] font-bold text-fg leading-snug">
                      {agent.name.split(' – ')[0]}
                    </p>
                    <p className="font-mono text-[10.5px] text-faint mt-0.5 line-clamp-1">
                      {agent.badge}
                    </p>
                  </div>

                  {/* Active highlight bar */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 transition-all"
                    style={{
                      backgroundColor: isSelected ? agent.accent : 'transparent',
                    }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Interactive Agent Modal */}
      <AgentModal
        agent={modalAgent}
        initialTab={modalTab}
        onClose={() => setModalAgent(null)}
      />
    </section>
  )
}
