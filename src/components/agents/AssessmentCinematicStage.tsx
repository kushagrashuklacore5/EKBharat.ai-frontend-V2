import { useEffect, useRef, useState } from 'react'

interface AssessmentCinematicStageProps {
  reducedMotion?: boolean
}

export function AssessmentCinematicStage({ reducedMotion = false }: AssessmentCinematicStageProps) {
  const [floatY, setFloatY] = useState(0)
  const [rotationAngle, setRotationAngle] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Natural 60 FPS organic breathing float (subtle 2px float)
  useEffect(() => {
    if (reducedMotion) return

    let rafId = 0
    const loop = (currentTime: number) => {
      const y = Math.sin((currentTime / 1000) * 1.8) * 2.2
      setFloatY(y)

      if (!isDragging) {
        setRotationAngle((prev) => {
          if (Math.abs(prev) < 0.1) return 0
          return prev * 0.92
        })
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [isDragging, reducedMotion])

  // Mouse tilt handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setMouseOffset({ x: x * 12, y: y * 8 })
  }

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 })
    setIsDragging(false)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStartX(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging) return
    const delta = e.clientX - dragStartX
    setRotationAngle(Math.max(-16, Math.min(16, delta * 0.14)))
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className="relative flex-1 w-full h-full flex flex-col items-center justify-between overflow-hidden select-none cursor-grab active:cursor-grabbing"
    >
      {/* Ambient Radial Glowing Podium Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(circle at 50% 70%, rgba(63, 125, 88, 0.22) 0%, rgba(185, 150, 82, 0.12) 40%, transparent 70%)',
        }}
      />

      {/* Cybernetic Pedestal Base Ring on Floor directly beneath feet */}
      <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 w-80 sm:w-96 h-20 rounded-full border border-emerald-500/30 bg-emerald-500/5 blur-[0.5px] transform -rotate-x-60 shadow-[0_0_50px_rgba(63,125,88,0.25)] flex items-center justify-center z-0">
        <div className="w-56 h-14 rounded-full border border-[#b99652]/35 bg-gradient-to-tr from-[#b99652]/10 to-transparent animate-pulse" />
      </div>

      {/* Main Character Stage - Grounded directly on the pedestal */}
      <div
        className="relative flex-1 w-full flex flex-col items-center justify-end pb-8 sm:pb-10 z-10"
        style={{
          transform: `perspective(1000px) translateY(${floatY}px) rotateY(${rotationAngle + mouseOffset.x * 0.6}deg) rotateX(${-mouseOffset.y * 0.4}deg)`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
        onMouseMove={handleDrag}
      >
        <div className="relative flex flex-col items-center justify-end">
          <picture>
            <source srcSet="/brand/assessment_agent/assessment-character-transparent.webp" type="image/webp" />
            <img
              src="/brand/assessment_agent/assessment-character-transparent.webp"
              alt="AI Assessment Agent — 3D Character"
              className="h-[390px] sm:h-[450px] lg:h-[500px] w-auto object-contain filter drop-shadow-[0_15px_30px_rgba(23,46,66,0.25)] pointer-events-none select-none"
              style={{
                maskImage: 'linear-gradient(to top, transparent 0%, black 8px, black 100%)',
                WebkitMaskImage: 'linear-gradient(to top, transparent 0%, black 8px, black 100%)',
              }}
              loading="eager"
            />
          </picture>

          {/* Authentic 3D Contact Shadow directly under her boots */}
          <div className="w-52 sm:w-60 h-4 rounded-full bg-slate-900/40 blur-md -mt-2 pointer-events-none" />
        </div>
      </div>

      {/* Bottom Telemetry HUD Bar */}
      <div className="relative z-10 flex w-full flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3 text-[12px]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-faint">HUMANOID RIG:</span>
          <span className="font-mono font-medium text-fg">FORWARD KINEMATICS · 60 FPS</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
          <span>ROTATE: DRAG</span>
          <span>·</span>
          <span>SWITCH: ← → ARROWS</span>
        </div>
      </div>
    </div>
  )
}
