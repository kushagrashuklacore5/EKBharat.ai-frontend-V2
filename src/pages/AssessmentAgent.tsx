import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../components/ui/Button'
import { Jaali } from '../components/ui/Jaali'
import { useReveal } from '../hooks/useReveal'
import {
  Clock,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  Lock,
} from 'lucide-react'

const DEMO_TIME_SECONDS = 600 // 10-minute interactive demo session

export default function AssessmentAgentPage() {
  const ref = useRef<HTMLDivElement>(null)
  useReveal(ref)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 10-minute session countdown timer
  const [timeLeft, setTimeLeft] = useState(DEMO_TIME_SECONDS)
  const [isExpired, setIsExpired] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [activeUser, setActiveUser] = useState<{ name: string; role: string } | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    document.title = 'AI Assessment Agent — Ek भारत.AI'
  }, [])

  // Listen for login/logout events from inside the assessment agent iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'AIA_LOGIN_SUCCESS' || e.data?.type === 'AIA_SESSION_ACTIVE') {
        setHasStarted(true)
        if (e.data?.user) {
          setActiveUser(e.data.user)
        }
      } else if (e.data?.type === 'AIA_LOGOUT') {
        setHasStarted(false)
        setActiveUser(null)
        setTimeLeft(DEMO_TIME_SECONDS)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Timer countdown: ONLY ticks when user is signed in (hasStarted === true)
  useEffect(() => {
    if (!hasStarted) return

    if (timeLeft <= 0) {
      setIsExpired(true)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setIsExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasStarted, timeLeft, iframeKey])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleRestartSession = () => {
    fetch('http://localhost:8080/api/demo/reset', { method: 'POST' }).catch(() => {})
    setTimeLeft(DEMO_TIME_SECONDS)
    setIsExpired(false)
    setHasStarted(false)
    setActiveUser(null)
    setIframeKey((k) => k + 1)
  }

  return (
    <div ref={ref}>
      <section className="atmos relative flex min-h-screen flex-col justify-start overflow-hidden pb-12 pt-20 md:pt-24">
        {/* Ambient Ek Bharat lighting */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(55% 45% at 50% 12%, rgba(185,150,82,0.12) 0%, rgba(58,144,170,0.14) 40%, transparent 75%)',
            }}
          />
          <div className="grid-bg absolute inset-0 opacity-35 [mask-image:radial-gradient(75%_75%_at_50%_35%,black,transparent)]" />
        </div>
        <Jaali fade="top" opacity={0.035} size={44} />

        <div className="relative w-full max-w-[1520px] mx-auto px-4 sm:px-6">
          {/* Top Compact Navigation & Title Row */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <Link
                to="/ai-agents"
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-line bg-ink-850 px-3.5 py-2 text-sm font-semibold text-fg-soft hover:bg-ink-800 hover:text-fg transition shadow-2xs"
              >
                <ArrowLeft size={15} className="shrink-0" />
                <span>Back to 3D Showcase</span>
              </Link>
              <div className="flex items-center gap-2 font-mono text-xs sm:text-sm text-muted">
                <span className="flex size-2 rounded-full bg-cyan animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <span className="font-semibold text-fg">Agent 04</span>
                <span className="text-line-strong">·</span>
                <span>Academic Assessment &amp; Evaluation Studio</span>
              </div>
            </div>

            {/* Feature Badges in Header */}
            <div className="hidden lg:flex items-center gap-2.5 font-mono text-xs text-muted">
              <span className="rounded-full bg-ink-850 px-3 py-1 border border-line text-fg-soft">
                ✓ Rubric Scoring
              </span>
              <span className="rounded-full bg-ink-850 px-3 py-1 border border-line text-fg-soft">
                ✓ Bloom&apos;s Taxonomy
              </span>
              <span className="rounded-full bg-ink-850 px-3 py-1 border border-line text-fg-soft">
                ✓ Anti-Tamper
              </span>
            </div>
          </div>

          {/* Crisp, Bold Display Title & Subtitle */}
          <div className="text-center max-w-4xl mx-auto mb-6">
            <h1 className="text-3xl sm:text-4xl lg:text-[2.9rem] font-bold tracking-tight text-fg leading-[1.12]">
              <span className="text-gradient">AI Assessment Agent</span>
              <br />
              Precision Rubric Evaluation Studio
            </h1>
            <p className="mt-3 text-sm sm:text-base lg:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
              Autonomous rubric-grounded grading, automated curriculum test generation, and anti-tamper student autosave.
            </p>
          </div>

          {/* Clean Wide MacBook Showcase with Live Embedded Portal */}
          <div id="demo-section" className="relative w-full mx-auto max-w-[1440px]">
            {/* Clean Isolated MacBook Showcase with Podium Glow */}
            <div className="relative w-full rounded-2xl">
              {/* Podium Ambient Glow behind the Laptop */}
              <div
                className="pointer-events-none absolute -inset-x-8 top-1/6 -bottom-4 opacity-75 blur-3xl -z-10"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(185,150,82,0.18) 0%, rgba(58,144,170,0.14) 40%, transparent 70%)',
                }}
              />

              {/* Isolated Laptop Frame */}
              <img
                src="/images/macbook-frame.png"
                alt="AI Assessment Agent — Live MacBook Showcase"
                className="w-full h-auto block select-none pointer-events-none filter drop-shadow-[0_25px_60px_rgba(23,46,66,0.18)]"
              />

              {/* Live Interactive Portal Screen Overlay (Directly inside Laptop Screen Bezels) */}
              <div
                className="absolute overflow-hidden bg-[#faf8f5] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)] flex flex-col"
                style={{
                  top: '3.85%',
                  left: '11.7%',
                  width: '76.6%',
                  height: '73.08%',
                  borderRadius: '4px 4px 0 0',
                }}
              >
                {/* Authentic macOS / Safari Browser Bar integrated on laptop display */}
                <div className="h-7 sm:h-8 bg-[#f3efe6] border-b border-[#e2d5b5] px-2.5 sm:px-3 flex items-center justify-between shrink-0 select-none">
                  {/* Traffic light window controls */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <span className="size-2 sm:size-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
                    <span className="size-2 sm:size-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
                    <span className="size-2 sm:size-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]" />
                  </div>

                  {/* Sleek Address Pill */}
                  <div className="flex items-center gap-1.5 bg-white/90 border border-[#e2d5b5] rounded-md px-2.5 py-0.5 text-[10px] sm:text-[11px] font-mono text-[#55697a] shadow-2xs max-w-xs sm:max-w-sm w-full justify-center">
                    <Lock size={10} className="text-[#b99652]" />
                    <span className="text-[#172e42] font-semibold">studio.ekbharat.ai</span>
                    <span className="text-[#b99652] hidden md:inline">/assessment</span>
                    <span className="text-[#d9ccb0]">·</span>
                    <span className="flex items-center gap-1 text-[9.5px] text-emerald-600 font-sans font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live AI Studio
                    </span>
                  </div>

                  {/* Right Window Status & Controls: 10-Min Timer starts on login */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex items-center gap-1 rounded border border-[#e5d8b8] bg-[#faf5ea] px-1.5 sm:px-2 py-0.5 font-mono text-[9.5px] sm:text-[10px] font-medium text-[#9a6f22]"
                      title={hasStarted ? '10-minute session active' : '10-minute timer will start when you sign in'}
                    >
                      <Clock
                        size={10}
                        className={`shrink-0 ${hasStarted && timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-[#9a6f22]'}`}
                      />
                      <span className={hasStarted && timeLeft < 60 ? 'text-rose-500 animate-pulse font-bold' : ''}>
                        {formatTime(timeLeft)}
                      </span>
                      {!hasStarted && (
                        <span className="text-[9px] text-[#b99652] font-sans font-normal hidden sm:inline">
                          (Starts on sign-in)
                        </span>
                      )}
                      {hasStarted && activeUser && (
                        <span className="text-[9px] text-emerald-600 font-sans font-semibold hidden md:inline">
                          ● Active
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleRestartSession}
                      title="Reset Session & Sandbox"
                      className="text-[#8a9aa7] hover:text-[#172e42] transition p-0.5 cursor-pointer"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                </div>

                {/* Live Assessment Sandbox Iframe Container */}
                <div className="flex-1 w-full relative overflow-hidden">
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    src="http://localhost:8080"
                    title="AI Assessment Agent — Live Portal"
                    className="w-full h-full border-0 bg-transparent"
                    loading="lazy"
                  />

                  {/* Expired Timer Blur Lock Overlay */}
                  {isExpired && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#faf8f5]/95 p-4 text-center backdrop-blur-md transition-all">
                      <div className="grid size-10 place-items-center rounded-xl border border-[#d9ccb0] bg-[#faf5ea] text-[#9a6f22]">
                        <Clock size={20} />
                      </div>
                      <h3 className="mt-3 text-base sm:text-lg font-bold text-[#172e42]">
                        Demo Session Completed (10:00)
                      </h3>
                      <p className="mt-1 max-w-xs text-xs text-[#617482]">
                        To protect AI API quotas and ensure equal availability, each interactive demo is
                        10 minutes.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <Button onClick={handleRestartSession} variant="primary" size="md">
                          <RefreshCw size={12} className="mr-1" />
                          Restart Session
                        </Button>
                        <Button to="/contact" variant="secondary" size="md">
                          <Sparkles size={12} className="mr-1 text-[#b99652]" />
                          Request Access
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
