import { useEffect, useRef, useState } from 'react'
import { Layers, MousePointer2 } from 'lucide-react'
import { GPU_LAYERS } from './gpuLayers'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Jaali } from '../ui/Jaali'

const hasWebGL = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

type Api = Awaited<ReturnType<typeof load>>
const load = async (canvas: HTMLCanvasElement, low: boolean, reduced: boolean) => (await import('./gpuExplorerScene')).createGpuExplorer(canvas, { low, reduced })

/**
 * Interactive exploded view of a data-centre GPU card. Scrolling the section
 * (or the slider) separates the layers; dragging rotates the card; choosing a
 * layer moves the camera to it. Illustrative model, not a specific product.
 */
export function GpuExplorer() {
  const reduced = useReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const api = useRef<Api | null>(null)
  const [explode, setExplode] = useState(0)
  const [manual, setManual] = useState(false)
  const [focus, setFocus] = useState<number | null>(null)
  const [ok] = useState(() => typeof window !== 'undefined' && hasWebGL())

  // lazy-load the scene and render only while visible
  useEffect(() => {
    const el = canvas.current
    if (!el || !ok) return
    let raf = 0
    let visible = false
    let cancelled = false
    const low = window.innerWidth < 900 || (navigator.hardwareConcurrency || 8) <= 4
    const loop = () => {
      api.current?.frame()
      if (visible) raf = requestAnimationFrame(loop)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      cancelAnimationFrame(raf)
      if (visible) {
        if (!api.current)
          load(el, low, reduced).then((a) => {
            if (cancelled) return a.dispose()
            api.current = a
          })
        raf = requestAnimationFrame(loop)
      }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
      cancelAnimationFrame(raf)
      api.current?.dispose()
      api.current = null
    }
  }, [ok, reduced])

  // scroll drives the exploded view until the visitor takes the slider
  useEffect(() => {
    if (manual) return
    const onScroll = () => {
      const el = wrap.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - r.top) / (r.height * 0.9)))
      setExplode(Math.min(1, Math.max(0, (p - 0.15) / 0.45)))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [manual])

  useEffect(() => api.current?.setExplode(explode), [explode])
  useEffect(() => api.current?.setFocus(focus), [focus])
  // the scene may load after the first values were set
  useEffect(() => {
    const t = window.setInterval(() => {
      if (api.current) {
        api.current.setExplode(explode)
        api.current.setFocus(focus)
        window.clearInterval(t)
      }
    }, 200)
    return () => window.clearInterval(t)
  }, [explode, focus])

  // drag to rotate
  const drag = useRef<number | null>(null)
  const onDown = (e: React.PointerEvent) => {
    drag.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (drag.current === null) return
    api.current?.rotate((e.clientX - drag.current) * 0.008)
    drag.current = e.clientX
  }
  const onUp = () => (drag.current = null)

  const pickLayer = (i: number) => {
    setManual(true)
    setExplode(1)
    setFocus(focus === i ? null : i)
  }

  return (
    <div ref={wrap} className="deep-card surface-dark stepwell relative overflow-hidden rounded-[20px]">
      <Jaali fade="radial" opacity={0.05} size={40} ink="#bfe3ea" />
      <div className="relative grid lg:grid-cols-[1.5fr_1fr]">
        <div className="relative">
          {ok ? (
            <canvas
              ref={canvas}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              aria-label="3D GPU card. Drag to rotate."
              role="img"
              className="block h-[380px] w-full cursor-grab touch-pan-y active:cursor-grabbing sm:h-[520px]"
            />
          ) : (
            <p className="grid h-[320px] place-items-center px-8 text-center text-[14px] text-muted">The 3D explorer needs WebGL, which isn’t available in this browser.</p>
          )}
          <p className="pointer-events-none absolute bottom-4 left-5 flex items-center gap-2 text-[12px] text-faint">
            <MousePointer2 size={13} /> Drag to rotate · illustrative model, not a specific product
          </p>
        </div>

        <div className="border-t border-line p-6 sm:p-8 lg:border-l lg:border-t-0">
          <p className="flex items-center gap-2 label text-faint">
            <Layers size={14} /> Inside the accelerator
          </p>
          <label className="mt-5 block text-[12.5px] text-fg-soft">
            <span className="flex justify-between">
              <span>Assembled</span>
              <span>Exploded</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(explode * 100)}
              onChange={(e) => {
                setManual(true)
                setExplode(Number(e.target.value) / 100)
              }}
              className="mt-2 w-full accent-[#5cc3be]"
              aria-label="Exploded view"
            />
          </label>
          <ol className="mt-5 space-y-1">
            {[...GPU_LAYERS].map((l, i) => ({ ...l, i })).reverse().map((l) => (
              <li key={l.name}>
                <button
                  type="button"
                  onClick={() => pickLayer(l.i)}
                  aria-pressed={focus === l.i}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${focus === l.i ? 'bg-ink-800' : 'hover:bg-ink-850'}`}
                >
                  <span className="flex items-baseline gap-3">
                    <span className="w-5 font-mono text-[10.5px] text-sandstone">{String(l.i + 1).padStart(2, '0')}</span>
                    <span className="text-[13.5px] font-semibold text-fg">{l.name}</span>
                  </span>
                  <span className={`grid transition-all duration-500 ${focus === l.i ? 'mt-1 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <span className="overflow-hidden pl-8 text-[12.5px] text-muted">{l.note}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
