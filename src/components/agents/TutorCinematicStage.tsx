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
  const [viewMode, setViewMode] = useState<'standalone' | 'classroom'>('standalone')
  const containerRef = useRef<HTMLDivElement>(null)

  // Continuous idle breathing loop (60 FPS) & smooth return to straight front (0°) when released
  useEffect(() => {
    if (reducedMotion) return

    let rafId = 0

    const loop = (currentTime: number) => {
      // Natural organic breathing float
      const breathingSpeed = isSpeaking ? 2.4 : 1.6
      const breathingAmp = isSpeaking ? 3.8 : 3.0
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
        'Namaste! Please open your mathematics textbook. Today, we will explore key concepts and step-by-step problem solving together. Which chapter would you like to begin with?'
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.98
      utterance.pitch = 1.05

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
        }, 9000)
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
      title="Tap or drag to interact with Teacher"
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
          }%, rgba(159, 28, 54, 0.22) 0%, rgba(245, 158, 11, 0.05) 50%, transparent 75%)`,
        }}
      />

      {/* Floating Speech Caption Bubble when Teacher speaks */}
      {isSpeaking && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-[400px] rounded-2xl border border-amber-400/40 bg-ink-950/95 p-3.5 shadow-[0_0_35px_rgba(245,158,11,0.25)] backdrop-blur-md pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-amber-300 font-semibold">
              Indian School Teacher Speaking
            </span>
            <span className="ml-auto font-mono text-[10px] text-faint">Classroom Tutor</span>
          </div>
          <p className="text-[13px] leading-snug text-fg font-medium">
            &ldquo;Namaste! Please open your mathematics textbook. Today, we will explore key concepts and step-by-step problem solving together. Which chapter would you like to begin with?&rdquo;
          </p>
        </div>
      )}

      {/* Subtle View Mode Toggle */}
      <div className="relative z-30 pt-3 px-4 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-ink-900/80 p-1 backdrop-blur-md shadow-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setViewMode('standalone')
            }}
            className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition-all ${
              viewMode === 'standalone'
                ? 'bg-amber-500 text-ink-950 shadow-xs'
                : 'text-muted hover:text-fg'
            }`}
          >
            Standalone Teacher
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setViewMode('classroom')
            }}
            className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition-all ${
              viewMode === 'classroom'
                ? 'bg-amber-500 text-ink-950 shadow-xs'
                : 'text-muted hover:text-fg'
            }`}
          >
            Hybrid Classroom
          </button>
        </div>
      </div>

      {/* Center Stage Presentation */}
      {viewMode === 'classroom' ? (
        /* Hybrid Classroom & Blackboard View */
        <div className="relative flex-1 w-full flex items-center justify-center p-3 animate-in fade-in duration-300">
          <div className="relative w-full h-[380px] sm:h-[450px] lg:h-[490px] rounded-2xl overflow-hidden border border-amber-500/30 shadow-[0_0_35px_rgba(159,28,54,0.3)]">
            <img
              src="/brand/tutor_standing/tutor_classroom_master.webp"
              alt="Indian AI Tutor teaching with chalk at traditional blackboard with holographic atom and calculus formulas"
              className="w-full h-full object-cover object-center"
            />
            {/* Ambient Layer */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-ink-950/20 pointer-events-none" />
            
            {/* Blackboard Overlay Label */}
            <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-line bg-ink-950/85 px-3 py-1.5 backdrop-blur-md">
              <span className="font-mono text-[10.5px] text-amber-400 font-semibold block">
                Traditional Slate Blackboard &amp; White Chalk
              </span>
              <span className="text-[11.5px] text-muted">
                Calculus, Euler’s Derivations &amp; Holographic 3D Wireframes
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Standalone Teacher Model in Maroon Cotton-Silk Saree (Pure Transparent with No Background Rectangle) */
        <div className="relative flex-1 w-full flex items-end justify-center pb-4 pt-2">
          {/* 3D Kinematic Rig Container */}
          <div
            className="relative flex flex-col items-center justify-end transition-transform duration-75 ease-out"
            style={{
              transform: `perspective(1200px) rotateY(${totalRotateY}deg) rotateX(${totalRotateX}deg) translateY(${floatY}px)`,
            }}
          >
            {/* Holographic Projection Pedestal Floor Ring (Grounds sandals in 3D space) */}
            <div
              className="absolute -bottom-1 w-[260px] sm:w-[320px] h-[38px] rounded-[100%] pointer-events-none transition-all duration-300"
              style={{
                background: isSpeaking
                  ? 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.45) 0%, rgba(159, 28, 54, 0.15) 45%, transparent 75%)'
                  : 'radial-gradient(ellipse at center, rgba(159, 28, 54, 0.45) 0%, rgba(245, 158, 11, 0.12) 45%, transparent 75%)',
                border: isSpeaking
                  ? '1.5px solid rgba(245, 158, 11, 0.6)'
                  : '1.5px solid rgba(159, 28, 54, 0.5)',
                boxShadow: isSpeaking
                  ? '0 0 28px rgba(245, 158, 11, 0.4)'
                  : '0 0 25px rgba(159, 28, 54, 0.35)',
                transform: `translateY(16px) rotateZ(${rotationAngle * 0.25}deg)`,
                filter: 'blur(0.5px)',
              }}
            />

            {/* Sandal Contact Ambient Occlusion Shadow */}
            <div
              className="absolute -bottom-0.5 w-[190px] h-[16px] rounded-[100%] bg-black/75 blur-[4px] pointer-events-none"
              style={{ transform: 'translateY(12px)' }}
            />

            {/* Subtle Floating Educational Hologram Glyphs */}
            <div
              className="absolute -top-4 -right-12 pointer-events-none select-none transition-opacity duration-300"
              style={{ opacity: isSpeaking ? 0.9 : 0.4 }}
            >
              <div className="font-mono text-[10.5px] text-amber-300/80 bg-ink-950/70 border border-amber-400/30 rounded-lg px-2 py-0.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                ∫ f(x) dx = F(x) + C
              </div>
            </div>

            <div
              className="absolute top-24 -left-14 pointer-events-none select-none transition-opacity duration-300"
              style={{ opacity: isSpeaking ? 0.9 : 0.4 }}
            >
              <div className="font-mono text-[10.5px] text-amber-300/80 bg-ink-950/70 border border-amber-400/30 rounded-lg px-2 py-0.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                a² + b² = c²
              </div>
            </div>

            {/* The Indian Female School Teacher Standing Model — PURE TRANSPARENT (NO BACKGROUND RECTANGLE) */}
            <img
              src="/brand/tutor_standing/teacher_maroon_saree.webp"
              alt="Friendly Indian female school teacher in maroon cotton-silk saree holding open mathematics textbook"
              className="relative z-10 w-auto h-[430px] sm:h-[490px] lg:h-[530px] object-contain transition-all duration-200 pointer-events-none"
              style={{
                filter: isSpeaking
                  ? 'drop-shadow(0 0 35px rgba(245, 158, 11, 0.35)) drop-shadow(0 15px 30px rgba(0,0,0,0.6)) brightness(1.03)'
                  : 'drop-shadow(0 0 25px rgba(159, 28, 54, 0.3)) drop-shadow(0 15px 30px rgba(0,0,0,0.6))',
              }}
            />
          </div>
        </div>
      )}

      {/* Subtle minimalist tap hint */}
      {!isSpeaking && (
        <div className="relative z-20 pb-2 flex items-center justify-center pointer-events-none">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-ink-900/60 px-3 py-1 font-mono text-[11px] text-muted backdrop-blur-sm shadow-xs transition-opacity">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            Tap to hear Teacher speak
          </span>
        </div>
      )}
    </div>
  )
}
