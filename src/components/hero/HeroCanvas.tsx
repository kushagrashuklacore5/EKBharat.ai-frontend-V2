import { useEffect, useRef, useState } from 'react'
import { createHeroScene, hasWebGL } from './heroScene'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const LABELS = [
  { k: 'GPU compute', v: 'partner-powered foundation', c: '#5d7083' },
  { k: 'Models', v: 'routed per task', c: '#2f7fa8' },
  { k: 'Agents', v: 'delegate · verify', c: '#2e8d81' },
  { k: 'Workflows', v: 'trigger → action', c: '#c4852f' },
  { k: 'Data & knowledge', v: 'RAG · integrations', c: '#2c64a0' },
]

/** WebGL hero object. Loaded lazily; pauses off-screen; static fallback without WebGL. */
export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])
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
    let api: ReturnType<typeof createHeroScene>
    try {
      api = createHeroScene(canvas, { reducedMotion: reduced, compact: window.innerWidth < 768, labels: labelRefs.current })
    } catch {
      setFailed(true)
      return
    }
    setReady(true)
    let visible = true
    const sync = () => (visible && !document.hidden ? api.start() : api.stop())
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      sync()
    })
    io.observe(canvas)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      api.dispose()
    }
  }, [reduced])

  if (failed) return <StaticPlatform />

  return (
    <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
        {LABELS.map((l, i) => (
          <div
            key={l.k}
            ref={(el) => {
              labelRefs.current[i] = el
            }}
            className="absolute left-0 top-0 opacity-0 will-change-transform"
          >
            <div className="ml-5 -mt-4 flex items-center gap-2 whitespace-nowrap">
              <span className="h-px w-5" style={{ background: l.c }} />
              <span className="rounded-md bg-ink-850/90 px-2.5 py-1.5 text-[12px] shadow-[var(--shadow-md)] backdrop-blur-sm">
                <span className="font-bold text-fg">{l.k}</span>
                <span className="ml-1.5 text-muted">{l.v}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Static vector fallback — the same stratified platform and modules, isometric. */
export function StaticPlatform() {
  const iso = (cx: number, cy: number, w: number) => `M${cx} ${cy - w / 2} L${cx + w} ${cy} L${cx} ${cy + w / 2} L${cx - w} ${cy} Z`
  return (
    <svg viewBox="0 0 600 460" className="absolute inset-0 m-auto h-full max-h-[460px] w-full" aria-hidden="true">
      <ellipse cx="300" cy="380" rx="230" ry="50" fill="#182b3d" opacity=".08" />
      {[
        [330, 150, '#cfdbe5'],
        [305, 165, '#e3eaf0'],
        [280, 180, '#ffffff'],
      ].map(([cy, w, f], i) => (
        <path key={i} d={iso(300, Number(cy), Number(w))} fill={String(f)} stroke="#182b3d" strokeOpacity=".12" />
      ))}
      {[
        [120, 120, '#2f7fa8'],
        [480, 140, '#2e8d81'],
        [140, 300, '#c4852f'],
        [470, 290, '#2c64a0'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <path d={`M300 280 Q ${(300 + Number(x)) / 2} ${Number(y) + 60} ${x} ${y}`} fill="none" stroke="#8fa5b8" strokeWidth="2" />
          <path d={iso(Number(x), Number(y), 46)} fill="#ffffff" stroke="#182b3d" strokeOpacity=".12" />
          <path d={iso(Number(x), Number(y) - 4, 30)} fill={String(c)} />
        </g>
      ))}
    </svg>
  )
}
