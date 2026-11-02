import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import type { JetFrame } from './jetScene'

export interface JetProgress {
  /** overall section progress 0..1 */
  p: number
  /** logo-sequence progress 0..1 */
  lp: number
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

/**
 * Full-stage canvas for the fighter jet that draws the logo ribbon. Three.js is code-split and
 * only loaded when this mounts; rendering runs only while the section is on
 * screen and something is actually visible.
 */
export function JetSky({ progress, sectionRef }: { progress: MutableRefObject<JetProgress>; sectionRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let api: { render(f: JetFrame, dt: number, time: number): void; clear(): void; dispose(): void } | null = null
    let raf = 0
    let visible = false
    let cancelled = false
    let last = performance.now()
    let time = 0
    let cleared = true

    const ribbonFrame = (lp: number): JetFrame['ribbon'] => {
      if (lp < 0.64) return null
      const path = sectionRef.current?.querySelector<SVGPathElement>('path[data-ribcenter]')
      if (!path) return null
      const ctm = path.getScreenCTM()
      if (!ctm) return null
      const cr = canvas.getBoundingClientRect()
      const len = path.getTotalLength()
      const N = 96
      const local: { x: number; y: number }[] = []
      for (let i = 0; i <= N; i++) local.push(path.getPointAtLength((i / N) * len))
      const scr = local.map((pt) => {
        const q = new DOMPoint(pt.x, pt.y).matrixTransform(ctm)
        return [q.x - cr.left, q.y - cr.top] as [number, number]
      })
      const tangentAt = (i: number) => {
        const a = scr[Math.max(0, i - 1)]
        const b = scr[Math.min(N, i + 1)]
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        return [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as [number, number]
      }
      const W = cr.width
      const H = cr.height

      // entry: approach from off-screen left toward the start of the ribbon
      if (lp < 0.72) {
        const pre = range(lp, 0.64, 0.72)
        const e = 1 - Math.pow(1 - pre, 2)
        const [tx, ty] = tangentAt(0)
        return { x: scr[0][0] - (1 - e) * W * 0.55, y: scr[0][1] + (1 - e) * H * 0.12, tx, ty, trail: [], fade: Math.min(1, pre * 3) }
      }
      // exit: climb away up and to the right once the ribbon is complete
      if (lp > 0.94) {
        const ex = range(lp, 0.94, 1)
        const [tx, ty] = tangentAt(N)
        const end = scr[N]
        return {
          x: end[0] + tx * ex * W * 0.6,
          y: end[1] + ty * ex * W * 0.6 - ex * H * 0.15,
          tx,
          ty: ty - 0.2 * ex,
          trail: scr.slice(Math.max(0, N - 18)).reverse(),
          fade: 1 - ex,
        }
      }
      // main pass: the jet IS the ribbon's wipe-front
      const front = parseFloat(path.dataset.front || '0')
      let i = 0
      while (i < N && local[i + 1].x < front) i++
      const a = local[i]
      const b = local[Math.min(N, i + 1)]
      const t = b.x === a.x ? 0 : clamp((front - a.x) / (b.x - a.x))
      const x = scr[i][0] + (scr[Math.min(N, i + 1)][0] - scr[i][0]) * t
      const y = scr[i][1] + (scr[Math.min(N, i + 1)][1] - scr[i][1]) * t
      const [tx, ty] = tangentAt(i)
      return { x, y, tx, ty, trail: [[x, y], ...scr.slice(Math.max(0, i - 18), i + 1).reverse()], fade: 1 }
    }

    const loop = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      time += dt
      const ribbon = ribbonFrame(progress.current.lp)
      if (api && ribbon) {
        api.render({ ribbon }, dt, time)
        cleared = false
      } else if (api && !cleared) {
        api.clear()
        cleared = true
      }
      if (visible) raf = requestAnimationFrame(loop)
    }

    import('./jetScene').then(({ createJetScene }) => {
      if (cancelled) return
      api = createJetScene(canvas)
    })

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      cancelAnimationFrame(raf)
      if (visible) {
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    })
    if (sectionRef.current) io.observe(sectionRef.current)
    return () => {
      cancelled = true
      io.disconnect()
      cancelAnimationFrame(raf)
      api?.dispose()
    }
  }, [progress, sectionRef])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-20 block h-full w-full" aria-hidden="true" />
}
