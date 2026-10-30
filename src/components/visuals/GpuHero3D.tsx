import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { GpuVisual } from './ProductVisuals'
import { hasWebGL } from '../hero/heroScene'
import { useReducedMotion } from '../../hooks/useReducedMotion'

function Canvas3D({ onFail }: { onFail: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let api: { start(): void; stop(): void; dispose(): void } | null = null
    let cancelled = false
    import('./gpuScene')
      .then(({ createGpuScene }) => {
        if (cancelled) return
        api = createGpuScene(canvas, { reducedMotion: reduced })
        setReady(true)
        const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? api!.start() : api!.stop()))
        io.observe(canvas)
        const prev = api.dispose
        api.dispose = () => {
          io.disconnect()
          prev()
        }
      })
      .catch(onFail)
    return () => {
      cancelled = true
      api?.dispose()
    }
  }, [reduced, onFail])
  return <canvas ref={ref} className={`block h-full w-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
}

const Lazy3D = lazy(async () => ({ default: Canvas3D }))

/** Interactive 3D GPU accelerator for the GPU Cloud header, in the same dark showcase card. */
export function GpuHero3D() {
  const [fallback, setFallback] = useState(false)
  const fail = useCallback(() => setFallback(true), [])
  useEffect(() => {
    if (!hasWebGL()) setFallback(true)
  }, [])
  return (
    <div className="deep-card surface-dark relative overflow-hidden rounded-[20px]">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden="true" />
      {fallback ? (
        <div className="relative px-4 py-8 sm:px-8">
          <GpuVisual />
        </div>
      ) : (
        <div className="relative h-[380px] sm:h-[480px]" role="img" aria-label="3D GPU accelerator: circuit board, processor die, memory stacks and heatsink, separating as you scroll">
          <Suspense fallback={null}>
            <Lazy3D onFail={fail} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
