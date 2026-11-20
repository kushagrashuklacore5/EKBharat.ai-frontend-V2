import { useEffect, useRef, useState, useCallback } from 'react'

interface TutorCinematicStageProps {
  reducedMotion?: boolean
}

export function TutorCinematicStage({ reducedMotion = false }: TutorCinematicStageProps) {
  // 3D rotation angle in degrees (starts at 0° - straight front view)
  const [rotationAngle, setRotationAngle] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStartX, setDragStartX] = useState<number>(0)
  const [dragStartAngle, setDragStartAngle] = useState<number>(0)
  const [hasDragged, setHasDragged] = useState<boolean>(false)
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 })
  const [floatY, setFloatY] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Continuous idle breathing loop (60 FPS) & smooth return to straight front (0°) when released
  useEffect(() => {
    if (reducedMotion) return

    let rafId = 0

    const loop = (currentTime: number) => {
      // Natural organic breathing float
      const breathingSpeed = isSpeaking ? 2.5 : 1.7
      const breathingAmp = isSpeaking ? 4.0 : 3.2
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
  }, [isDragging, reducedMotion, isSpeaking])

  // Interactive mouse / touch drag-to-rotate handlers
  const handleDragStart = (clientX: number) => {
    setIsDragging(true)
    setDragStartX(clientX)
    setDragStartAngle(rotationAngle)
    setHasDragged(false)
  }

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return
      const deltaX = clientX - dragStartX
      if (Math.abs(deltaX) > 6) {
        setHasDragged(true)
      }
      // Elastic resistance drag rotation
      const newAngle = dragStartAngle + deltaX * 0.4
      setRotationAngle(Math.max(-45, Math.min(45, newAngle)))
    },
    [isDragging, dragStartX, dragStartAngle]
  )

  const speakGreeting = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    try {
      window.speechSynthesis.cancel()

      const text =
        'Hello! I am your AI Tutor from Ek Bharat AI. What topic, concept, or problem would you like to learn today?'
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.98
      utterance.pitch = 1.08

      const voices = window.speechSynthesis.getVoices()
      const preferredVoice =
        voices.find(
          (v) =>
            (v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('hi')) &&
            (v.name.toLowerCase().includes('female') ||
              v.name.toLowerCase().includes('natural') ||
              v.name.toLowerCase().includes('heera') ||
              v.name.toLowerCase().includes('neerja') ||
              v.name.toLowerCase().includes('google'))
        ) ||
        voices.find((v) => v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('hi')) ||
        voices.find(
          (v) =>
            v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('eva') ||
            v.name.toLowerCase().includes('female')
        ) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'))

      if (preferredVoice) {
        utterance.voice = preferredVoice
        utterance.lang = preferredVoice.lang
      } else {
        utterance.lang = 'en-IN'
      }

      setIsSpeaking(true)

      let safetyTimer: ReturnType<typeof setTimeout> | null = null

      utterance.onstart = () => {
        setIsSpeaking(true)
        safetyTimer = setTimeout(() => {
          setIsSpeaking(false)
        }, 8000)
      }

      utterance.onend = () => {
        if (safetyTimer) clearTimeout(safetyTimer)
        setIsSpeaking(false)
      }

      utterance.onerror = () => {
        if (safetyTimer) clearTimeout(safetyTimer)
        setIsSpeaking(false)
      }

      setTimeout(() => {
        window.speechSynthesis.speak(utterance)
      }, 30)
    } catch {
      setIsSpeaking(false)
    }
  }, [])

  const handleDragEnd = () => {
    if (isDragging && !hasDragged) {
      speakGreeting()
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

  const handleStageClick = () => {
    if (!hasDragged) {
      speakGreeting()
    }
  }

  // Combined rotation: angle + mouse parallax
  const totalRotateY = rotationAngle * 0.8 + mouseOffset.x
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
      title="Tap or drag to interact with AI Tutor"
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-pointer'
      }`}
    >
      {/* Ambient Educational Radial Lighting on 3D Stage (NO bounding box behind model) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle at ${50 + mouseOffset.x * 2}% ${
            50 + mouseOffset.y * 2
          }%, rgba(44, 100, 160, 0.22) 0%, rgba(34, 211, 238, 0.05) 50%, transparent 75%)`,
        }}
      />

      {/* Floating Speech Caption Bubble when AI Tutor speaks */}
      {isSpeaking && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-[370px] rounded-2xl border border-cyan/40 bg-ink-950/90 p-3 shadow-[0_0_30px_rgba(34,211,238,0.25)] backdrop-blur-md pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-cyan" />
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-cyan font-semibold">
              AI Tutor Speaking
            </span>
          </div>
          <p className="text-[13px] leading-snug text-fg font-medium">
            &ldquo;Hello! I am your AI Tutor from Ek Bharat AI. What topic, concept, or problem would you like to learn today?&rdquo;
          </p>
        </div>
      )}

      {/* Center Stage: WHOLE BODY STANDING 3D MODEL (NO BACKGROUND RECTANGLE) */}
      <div className="relative flex-1 w-full flex items-end justify-center pb-4 pt-2">
        {/* 3D Kinematic Rig Container */}
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
              background: isSpeaking
                ? 'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.45) 0%, rgba(44, 100, 160, 0.15) 45%, transparent 75%)'
                : 'radial-gradient(ellipse at center, rgba(44, 100, 160, 0.45) 0%, rgba(34, 211, 238, 0.12) 45%, transparent 75%)',
              border: isSpeaking
                ? '1.5px solid rgba(34, 211, 238, 0.6)'
                : '1.5px solid rgba(44, 100, 160, 0.5)',
              boxShadow: isSpeaking
                ? '0 0 28px rgba(34, 211, 238, 0.4)'
                : '0 0 25px rgba(44, 100, 160, 0.35)',
              transform: `translateY(16px) rotateZ(${rotationAngle * 0.25}deg)`,
              filter: 'blur(0.5px)',
            }}
          />

          {/* Boot Contact Ambient Occlusion Shadow */}
          <div
            className="absolute -bottom-0.5 w-[190px] h-[16px] rounded-[100%] bg-black/75 blur-[4px] pointer-events-none"
            style={{ transform: 'translateY(12px)' }}
          />

          {/* Subtle Floating Educational Hologram Glyphs */}
          <div
            className="absolute -top-4 -right-12 pointer-events-none select-none transition-opacity duration-300"
            style={{ opacity: isSpeaking ? 0.9 : 0.4 }}
          >
            <div className="font-mono text-[10.5px] text-cyan/70 bg-ink-950/70 border border-cyan/30 rounded-lg px-2 py-0.5 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              a² + b² = c²
            </div>
          </div>

          <div
            className="absolute top-24 -left-14 pointer-events-none select-none transition-opacity duration-300"
            style={{ opacity: isSpeaking ? 0.9 : 0.4 }}
          >
            <div className="font-mono text-[10.5px] text-cyan/70 bg-ink-950/70 border border-cyan/30 rounded-lg px-2 py-0.5 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              ∇ · E = ρ / ε₀
            </div>
          </div>

          {/* Headset Telemetry Ring */}
          <div
            className="absolute pointer-events-none transition-all duration-300 rounded-full"
            style={{
              top: '8%',
              right: '37%',
              width: isSpeaking ? '68px' : '54px',
              height: isSpeaking ? '68px' : '54px',
              transform: 'translate(50%, -50%)',
              background: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0) 70%)',
              border: isSpeaking
                ? '1.5px solid rgba(34, 211, 238, 0.7)'
                : '1px solid rgba(34, 211, 238, 0.25)',
              opacity: isSpeaking ? 0.95 : 0.45,
            }}
          />

          {/* The AI Tutor Standing Model — PURE TRANSPARENT (NO BACKGROUND RECTANGLE) */}
          <img
            src="/brand/tutor_standing/tutor_standing_hero.webp"
            alt="AI Tutor - Whole Body Academic Mentor in 3D Showcase"
            className="relative z-10 w-auto h-[430px] sm:h-[490px] lg:h-[530px] object-contain transition-all duration-200 pointer-events-none"
            style={{
              filter: isSpeaking
                ? 'drop-shadow(0 0 35px rgba(34, 211, 238, 0.35)) drop-shadow(0 15px 30px rgba(0,0,0,0.6)) brightness(1.03)'
                : 'drop-shadow(0 0 25px rgba(44, 100, 160, 0.3)) drop-shadow(0 15px 30px rgba(0,0,0,0.6))',
            }}
          />
        </div>
      </div>

      {/* Subtle minimalist tap hint (discreet, unobtrusive) */}
      {!isSpeaking && (
        <div className="relative z-20 pb-3 flex items-center justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-ink-900/60 px-3 py-1 font-mono text-[11px] text-muted backdrop-blur-sm shadow-xs transition-opacity">
            <span className="size-1.5 rounded-full bg-cyan animate-pulse" />
            Tap to talk to AI Tutor
          </span>
        </div>
      )}
    </div>
  )
}
