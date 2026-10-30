import { useEffect, useRef, useState, type ReactNode } from 'react'
import { hasWebGL } from '../hero/heroScene'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { SceneApi } from './stage3d'

type Loader = () => Promise<(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) => SceneApi>

const LOADERS: Record<'workflow' | 'agents', Loader> = {
  workflow: () => import('./workflowScene').then((m) => m.createWorkflowScene),
  agents: () => import('./agentsScene').then((m) => m.createAgentsScene),
}

/**
 * Container-free 3D product scene for inner-page headers.
 * Transparent canvas on the page background, lazy-loaded, paused off-screen,
 * desktop counter-parallax clamped to the section edge, SVG fallback.
 */
export function Scene3D({ kind, label, fallback }: { kind: keyof typeof LOADERS; label: string; fallback: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!hasWebGL()) {
      setFailed(true)
      return
    }
    let api: SceneApi | null = null
    let io: IntersectionObserver | null = null
    let cancelled = false
    const onVis = () => api?.setVisible(!document.hidden)
    LOADERS[kind]()
      .then((create) => {
        if (cancelled) return
        api = create(canvas, { reducedMotion: reduced })
        setReady(true)
        io = new IntersectionObserver(([e]) => api?.setVisible(e.isIntersecting))
        io.observe(canvas)
        document.addEventListener('visibilitychange', onVis)
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      api?.dispose()
    }
  }, [kind, reduced])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || reduced) return
    const mq = window.matchMedia('(min-width: 1024px)')
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        let shift = mq.matches ? Math.min(window.scrollY, 640) * 0.42 : 0
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
  }, [reduced, failed])

  if (failed) return <>{fallback}</>

  return (
    <div ref={wrapRef} className="relative -mx-[var(--gutter)] h-[400px] will-change-transform sm:mx-0 sm:h-[500px] lg:-mr-10 lg:h-[540px]" role="img" aria-label={label}>
      <canvas
        ref={canvasRef}
        className={`block h-full w-full touch-pan-y [mask-image:radial-gradient(62%_64%_at_52%_50%,black_70%,transparent_100%)] transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
    </div>
  )
}
