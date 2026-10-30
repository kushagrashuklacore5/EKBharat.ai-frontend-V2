import { useEffect, useRef, useState } from 'react'
import { GpuVisual } from './ProductVisuals'
import { hasWebGL } from '../hero/heroScene'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * Interactive 3D GPU accelerator for the GPU Cloud header.
 * No container: the transparent scene floats directly on the page background.
 * Three.js is code-split and loaded only when this component mounts.
 */
export function GpuHero3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [fallback, setFallback] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!hasWebGL()) {
      setFallback(true)
      return
    }
    let api: { setVisible(v: boolean): void; dispose(): void } | null = null
    let io: IntersectionObserver | null = null
    let cancelled = false
    const onVis = () => api?.setVisible(!document.hidden)
    import('./gpuScene')
      .then(({ createGpuScene }) => {
        if (cancelled) return
        api = createGpuScene(canvas, { reducedMotion: reduced })
        setReady(true)
        io = new IntersectionObserver(([e]) => api?.setVisible(e.isIntersecting))
        io.observe(canvas)
        document.addEventListener('visibilitychange', onVis)
      })
      .catch(() => setFallback(true))
    return () => {
      cancelled = true
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      api?.dispose()
    }
  }, [reduced])

  // gentle counter-parallax so the GPU stays in view while its scroll story plays (desktop only)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || reduced) return
    const mq = window.matchMedia('(min-width: 1024px)')
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        let shift = mq.matches ? Math.min(window.scrollY, 640) * 0.42 : 0
        // never push the canvas past its section's clipping edge
        const sec = el.closest('section')
        if (sec && shift) {
          const prev = parseFloat(el.dataset.shift || '0') || 0
          const room = sec.getBoundingClientRect().bottom - (el.getBoundingClientRect().bottom - prev)
          shift = Math.max(0, Math.min(shift, room - 4))
        }
        el.dataset.shift = String(shift)
        el.style.transform = shift ? `translate3d(0, ${shift.toFixed(1)}px, 0)` : ''
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    mq.addEventListener('change', on)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
      mq.removeEventListener('change', on)
    }
  }, [reduced, fallback])

  if (fallback) return <GpuVisual />

  return (
    <div
      ref={wrapRef}
      className="relative -mx-[var(--gutter)] will-change-transform h-[400px] sm:mx-0 sm:h-[500px] lg:-mr-10 lg:h-[540px]"
      role="img"
      aria-label="3D GPU compute accelerator: board, processor, memory modules and cooling assembly. It separates into its components as you scroll."
    >
      <canvas
        ref={canvasRef}
        className={`block h-full w-full touch-pan-y [mask-image:radial-gradient(62%_64%_at_52%_50%,black_70%,transparent_100%)] transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
    </div>
  )
}
