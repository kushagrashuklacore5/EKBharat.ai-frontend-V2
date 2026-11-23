import { useEffect, useRef, useState, useCallback } from 'react'
import type { SpeechState, AudioTelemetry } from './vaaniAudioEngine'

interface VaaniCinematicStageProps {
  state: SpeechState
  onStateChange?: (state: SpeechState) => void
  telemetry: AudioTelemetry
  onToggleMic?: () => void
  onTriggerSpeech: () => void
  micError?: string | null
  reducedMotion?: boolean
}

// Animated full-body character (transparent WebP; same asset shown across every rotation bin)
const VAANI_GIF = '/brand/vaani_character.webp'

// Clean, crisp HTML industry chips (replaces the blurry labels that were baked into the GIF).
// Each has a small horizontal offset to echo the original staggered arrangement.
const INDUSTRY_LABELS: { text: string; indent: number }[] = [
  { text: 'Real estate', indent: 0 },
  { text: 'Healthcare', indent: 34 },
  { text: 'E-commerce', indent: 8 },
  { text: 'Restaurants', indent: 46 },
  { text: 'Lead generation', indent: 22 },
  { text: 'Education', indent: 0 },
  { text: 'Collections', indent: 40 },
]
const TURNAROUND_ANGLES = {
  front: VAANI_GIF,
  frontRight: VAANI_GIF,
  profileRight: VAANI_GIF,
  back: VAANI_GIF,
  profileLeft: VAANI_GIF,
  frontLeft: VAANI_GIF,
}

export function VaaniCinematicStage({
  state,
  telemetry,
  onTriggerSpeech,
  reducedMotion = false,
}: VaaniCinematicStageProps) {
  // 3D rotation angle in degrees (starts at 0° - straight front view)
  const [rotationAngle, setRotationAngle] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStartX, setDragStartX] = useState<number>(0)
  const [dragStartAngle, setDragStartAngle] = useState<number>(0)
  const [hasDragged, setHasDragged] = useState<boolean>(false)
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 })
  const [floatY, setFloatY] = useState(0)
  // True while Vaani's hand is open/presenting in the looping animation -> reveal the sector cards
  const [handOpen, setHandOpen] = useState(false)
  const loopStartRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Preload all 360 turnaround angle images for instantaneous smooth rotation
  useEffect(() => {
    Object.values(TURNAROUND_ANGLES).forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [])

  // Reveal the sector cards exactly when her hand opens in the loop.
  // The WebP loop is 30 frames x 100ms = 3000ms; palm opens from frame 15.
  useEffect(() => {
    if (reducedMotion) {
      setHandOpen(true)
      return
    }
    const FRAME_MS = 100
    const TOTAL_MS = 30 * FRAME_MS
    const OPEN_FROM_FRAME = 15
    let rafId = 0
    const tick = () => {
      const elapsed = performance.now() - loopStartRef.current
      const frame = Math.floor(((elapsed % TOTAL_MS) + TOTAL_MS) % TOTAL_MS / FRAME_MS)
      setHandOpen(frame >= OPEN_FROM_FRAME)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [reducedMotion])

  // Continuous idle breathing loop (60 FPS) & smooth return to straight front (0°) when released
  useEffect(() => {
    if (reducedMotion) return

    let rafId = 0

    const loop = (currentTime: number) => {
      // Natural organic breathing float (slightly more dynamic cadence when speaking)
      const breathingSpeed = state === 'speaking' ? 2.6 : 1.8
      const breathingAmp = state === 'speaking' ? 4.2 : 3.5
      const y = Math.sin((currentTime / 1000) * breathingSpeed) * breathingAmp
      setFloatY(y)

      // Only rotates on touch/drag. When not dragging, smoothly springs back straight to 0°
      if (!isDragging) {
        setRotationAngle((prev) => {
          if (Math.abs(prev) < 0.15) return 0
          return prev * 0.90
        })
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [isDragging, reducedMotion, state])

  // Interactive mouse / touch drag-to-rotate handlers
  const handleDragStart = (clientX: number) => {
    setIsDragging(true)
    setDragStartX(clientX)
    setDragStartAngle(rotationAngle)
    setHasDragged(false)
  }

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return
    const deltaX = clientX - dragStartX
    if (Math.abs(deltaX) > 6) {
      setHasDragged(true)
    }
    // 0.45 degree sensitivity per pixel
    const newAngle = (dragStartAngle + deltaX * 0.45 + 3600) % 360
    setRotationAngle(newAngle)
  }, [isDragging, dragStartX, dragStartAngle])

  const handleDragEnd = () => {
    if (isDragging && !hasDragged) {
      // Simple tap or click -> speak immediately!
      onTriggerSpeech()
    }
    setIsDragging(false)
  }

  // Mouse 3D perspective parallax tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleDragMove(e.clientX)
      return
    }
    if (reducedMotion || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setMouseOffset({ x: x * 8, y: y * 5 })
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      handleDragStart(e.touches[0].clientX)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      handleDragMove(e.touches[0].clientX)
    }
  }

  // Direct click / tap trigger for instant voice response
  const handleStageClick = () => {
    if (!hasDragged) {
      onTriggerSpeech()
    }
  }

  // Map 360 degrees to appropriate turnaround angle texture & sub-angle offset
  const normalizedAngle = ((rotationAngle % 360) + 360) % 360

  let currentPoseSrc = TURNAROUND_ANGLES.front
  let subAngleOffset = 0 // continuous tilt inside the active angle bin

  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    // 0°: Front
    currentPoseSrc = TURNAROUND_ANGLES.front
    subAngleOffset = normalizedAngle >= 337.5 ? normalizedAngle - 360 : normalizedAngle
  } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    // 45°: 3/4 Front-Right
    currentPoseSrc = TURNAROUND_ANGLES.frontRight
    subAngleOffset = normalizedAngle - 45
  } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    // 90°: Profile Right
    currentPoseSrc = TURNAROUND_ANGLES.profileRight
    subAngleOffset = normalizedAngle - 90
  } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    // 135°: 3/4 Back-Right
    currentPoseSrc = TURNAROUND_ANGLES.back
    subAngleOffset = (normalizedAngle - 135) * 0.6
  } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    // 180°: Back
    currentPoseSrc = TURNAROUND_ANGLES.back
    subAngleOffset = normalizedAngle - 180
  } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    // 225°: 3/4 Back-Left
    currentPoseSrc = TURNAROUND_ANGLES.back
    subAngleOffset = (normalizedAngle - 225) * 0.6
  } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    // 270°: Profile Left
    currentPoseSrc = TURNAROUND_ANGLES.profileLeft
    subAngleOffset = normalizedAngle - 270
  } else {
    // 315°: 3/4 Front-Left
    currentPoseSrc = TURNAROUND_ANGLES.frontLeft
    subAngleOffset = normalizedAngle - 315
  }

  // Combined rotation: continuous sub-angle tilt + mouse parallax
  const totalRotateY = subAngleOffset * 0.75 + mouseOffset.x
  const totalRotateX = -mouseOffset.y

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => handleDragStart(e.clientX)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={() => setIsDragging(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleDragEnd}
      onClick={handleStageClick}
      title="Tap or drag to interact with Vaani"
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-pointer'
      }`}
    >
      {/* Ambient Radial Lighting on 3D Stage (NO bounding box behind model) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle at ${50 + mouseOffset.x * 2}% ${
            50 + mouseOffset.y * 2
          }%, rgba(34, 211, 238, 0.16) 0%, rgba(6, 182, 212, 0.04) 45%, transparent 75%)`,
        }}
      />

      {/* Sector cards — spring out of her open palm when the hand-open pose plays */}
      <div className="pointer-events-none absolute left-3 top-10 z-20 flex flex-col gap-2 sm:left-5 sm:top-12">
        {INDUSTRY_LABELS.map((label, i) => (
          <div
            key={label.text}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan/35 bg-ink-950/70 px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md"
            style={{
              marginLeft: `${label.indent}px`,
              opacity: handOpen ? 1 : 0,
              transform: handOpen
                ? 'translateX(0) scale(1)'
                : 'translateX(-22px) scale(0.82)',
              transition:
                'opacity 360ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
              transitionDelay: handOpen ? `${i * 65}ms` : '0ms',
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="whitespace-nowrap font-mono text-[11px] font-semibold text-fg sm:text-[12px]">
              {label.text}
            </span>
          </div>
        ))}
      </div>

      {/* Floating Speech Caption Bubble when Vaani speaks */}
      {state === 'speaking' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-[360px] rounded-2xl border border-cyan/40 bg-ink-950/90 p-3 shadow-[0_0_30px_rgba(34,211,238,0.25)] backdrop-blur-md pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-cyan" />
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-cyan font-semibold">
              Vaani Speaking
            </span>
          </div>
          <p className="text-[13px] leading-snug text-fg font-medium">
            &ldquo;Hi, my name is Vaani. I am your AI Voice Assistant from Ek Bharat AI. How can I help you today?&rdquo;
          </p>
        </div>
      )}

      {/* Center Stage: WHOLE BODY STANDING 3D TURNTABLE MODEL (NO BACKGROUND RECTANGLE) */}
      <div className="relative flex-1 w-full flex items-end justify-center pb-4 pt-2">
        {/* 3D Turntable Kinematic Rig Container */}
        <div
          className="relative flex flex-col items-center justify-end transition-transform duration-75 ease-out"
          style={{
            transform: `perspective(1200px) rotateY(${totalRotateY}deg) rotateX(${totalRotateX}deg) translateY(${floatY}px)`,
          }}
        >
          {/* Holographic Projection Pedestal Floor Ring (Grounds boots in 3D space) */}
          <div
            className="absolute -bottom-1 w-[260px] sm:w-[320px] h-[38px] rounded-[100%] pointer-events-none transition-all duration-300"
            style={{
              background:
                state === 'speaking'
                  ? 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.45) 0%, rgba(245, 158, 11, 0.12) 45%, transparent 75%)'
                  : 'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.45) 0%, rgba(6, 182, 212, 0.14) 45%, transparent 75%)',
              border:
                state === 'speaking'
                  ? '1.5px solid rgba(245, 158, 11, 0.5)'
                  : '1.5px solid rgba(34, 211, 238, 0.45)',
              boxShadow:
                state === 'speaking'
                  ? '0 0 25px rgba(245, 158, 11, 0.35)'
                  : '0 0 25px rgba(34, 211, 238, 0.35)',
              transform: `translateY(16px) rotateZ(${normalizedAngle * 0.25}deg)`,
              filter: 'blur(0.5px)',
            }}
          />

          {/* Boot Contact Ambient Occlusion Shadow */}
          <div
            className="absolute -bottom-0.5 w-[190px] h-[16px] rounded-[100%] bg-black/75 blur-[4px] pointer-events-none"
            style={{ transform: 'translateY(12px)' }}
          />

          {/* Acoustic Telemetry Ring emitting from Headset (when facing forward) */}
          {(normalizedAngle < 90 || normalizedAngle > 270) && (
            <div
              className="absolute pointer-events-none transition-all duration-300 rounded-full"
              style={{
                top: '6%',
                right: normalizedAngle > 180 ? '60%' : '37%',
                width: telemetry.decibels > 0 ? `${70 + telemetry.decibels * 1.6}px` : '56px',
                height: telemetry.decibels > 0 ? `${70 + telemetry.decibels * 1.6}px` : '56px',
                transform: 'translate(50%, -50%)',
                background: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0) 70%)',
                border:
                  telemetry.decibels > 0
                    ? '1.5px solid rgba(34, 211, 238, 0.7)'
                    : '1px solid rgba(34, 211, 238, 0.2)',
                opacity: state === 'speaking' ? 0.95 : 0.4,
              }}
            />
          )}

          {/* The Standing Model — PURE TRANSPARENT (NO BACKGROUND RECTANGLE) */}
          <img
            src={currentPoseSrc}
            alt="Vaani - Whole Body Voice AI Assistant in 3D Turntable"
            onLoad={() => {
              // Align the card-reveal timer with the moment the WebP begins its loop
              loopStartRef.current = performance.now()
            }}
            className="relative z-10 w-auto h-[430px] sm:h-[490px] lg:h-[530px] object-contain transition-all duration-200 pointer-events-none"
            style={{
              filter:
                state === 'speaking'
                  ? 'drop-shadow(0 0 35px rgba(34, 211, 238, 0.35)) drop-shadow(0 15px 30px rgba(0,0,0,0.6)) brightness(1.03)'
                  : 'drop-shadow(0 0 25px rgba(34, 211, 238, 0.22)) drop-shadow(0 15px 30px rgba(0,0,0,0.6))',
            }}
          />
        </div>
      </div>

      {/* Subtle minimalist tap hint (discreet, unobtrusive) */}
      {state !== 'speaking' && (
        <div className="relative z-20 pb-3 flex items-center justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-ink-900/60 px-3 py-1 font-mono text-[11px] text-muted backdrop-blur-sm shadow-xs transition-opacity">
            <span className="size-1.5 rounded-full bg-cyan animate-pulse" />
            Tap to talk to Vaani
          </span>
        </div>
      )}
    </div>
  )
}
