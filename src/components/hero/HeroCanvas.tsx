import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { BookOpen, Bot, Cpu, Network, Workflow, Wrench, type LucideIcon } from 'lucide-react'
import { createHeroScene, hasWebGL } from './heroScene'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface Label {
  k: string
  sub: string
  icon: LucideIcon
  to: string
  /** position of the label within the canvas box, in % */
  x: number
  y: number
  side: 'l' | 'r'
}

// index matches the layer order in heroScene (0 bottom → 4 top, 5 = pedestal)
const LABELS: Label[] = [
  { k: 'GPU Cloud', sub: 'Compute foundation', icon: Cpu, to: '/gpu-cloud', x: 80, y: 74, side: 'r' },
  { k: 'Knowledge', sub: 'RAG · your data', icon: BookOpen, to: '/architecture/knowledge', x: 2, y: 58, side: 'l' },
  { k: 'Models', sub: 'Routed per task', icon: Network, to: '/ai-orchestration', x: 4, y: 30, side: 'l' },
  { k: 'AI Agents', sub: 'Delegate · verify', icon: Bot, to: '/ai-agents', x: 80, y: 36, side: 'r' },
  { k: 'Workflows', sub: 'The Studio canvas', icon: Workflow, to: '/workflow-studio', x: 62, y: 6, side: 'r' },
  { k: 'Custom AI', sub: 'Built across the stack', icon: Wrench, to: '/custom-ai-development', x: 8, y: 84, side: 'l' },
]

/** WebGL hero stack with interactive floating labels. Lazy-loaded; static fallback without WebGL. */
export default function HeroCanvas() {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const dotRefs = useRef<(SVGCircleElement | null)[]>([])
  const apiRef = useRef<ReturnType<typeof createHeroScene> | null>(null)
  const reduced = useReducedMotion()
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState<number | null>(null)

  const onAnchors = useCallback((pts: { x: number; y: number; visible: boolean }[]) => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return
    pts.forEach((p, i) => {
      const el = labelRefs.current[i]
      const path = pathRefs.current[i]
      const dot = dotRefs.current[i]
      if (!el || !path || !dot) return
      const r = el.getBoundingClientRect()
      const lx = (LABELS[i].side === 'l' ? r.right : r.left) - box.left
      const ly = r.top + r.height / 2 - box.top
      const mx = (lx + p.x) / 2
      path.setAttribute('d', `M${lx.toFixed(1)} ${ly.toFixed(1)} C${mx.toFixed(1)} ${ly.toFixed(1)} ${mx.toFixed(1)} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      dot.setAttribute('cx', p.x.toFixed(1))
      dot.setAttribute('cy', p.y.toFixed(1))
      path.style.opacity = p.visible ? '' : '0'
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!hasWebGL()) {
      setFailed(true)
      return
    }
    let api: ReturnType<typeof createHeroScene>
    try {
      api = createHeroScene(canvas, { reducedMotion: reduced, compact: window.innerWidth < 768, onAnchors })
    } catch {
      setFailed(true)
      return
    }
    apiRef.current = api
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
      apiRef.current = null
    }
  }, [reduced, onAnchors])

  const hl = (i: number | null) => {
    setActive(i)
    apiRef.current?.setHighlight(i === 5 ? null : i)
  }

  if (failed) return <StaticStack />

  return (
    <div ref={boxRef} className={`absolute inset-0 transition-opacity duration-1000 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <canvas ref={canvasRef} className="block h-full w-full [mask-image:radial-gradient(70%_72%_at_55%_50%,black_62%,transparent_100%)]" aria-hidden="true" />
      <svg className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible sm:block" aria-hidden="true">
        {LABELS.map((l, i) => (
          <g key={l.k}>
            <path
              ref={(el) => {
                pathRefs.current[i] = el
              }}
              fill="none"
              stroke={active === i ? '#1d6a80' : 'rgba(16,42,64,.28)'}
              strokeWidth={active === i ? 1.5 : 1}
              strokeDasharray={active === i ? undefined : '3 4'}
              style={{ transition: 'stroke .3s' }}
            />
            <circle
              ref={(el) => {
                dotRefs.current[i] = el
              }}
              r={active === i ? 4.5 : 3}
              fill={active === i ? '#d5b68a' : '#ffffff'}
              stroke="#1d6a80"
              strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>
      <nav aria-label="Platform layers" className="absolute inset-0 hidden sm:block">
        {LABELS.map((l, i) => {
          const Icon = l.icon
          const on = active === i
          return (
            <Link
              key={l.k}
              to={l.to}
              ref={(el) => {
                labelRefs.current[i] = el
              }}
              onMouseEnter={() => hl(i)}
              onMouseLeave={() => hl(null)}
              onFocus={() => hl(i)}
              onBlur={() => hl(null)}
              className={`glass-chip absolute flex items-center gap-2.5 rounded-xl py-2 pl-2 pr-3.5 transition-[transform,box-shadow] duration-300 ${on ? '-translate-y-0.5 shadow-[0_0_0_2px_#1d6a80]' : ''}`}
              style={{ left: `${l.x}%`, top: `${l.y}%`, animation: reduced ? undefined : `fade-up .8s ${0.9 + i * 0.12}s both cubic-bezier(.16,1,.3,1)` }}
            >
              <span className={`grid size-8 place-items-center rounded-lg transition-colors ${on ? 'bg-[#1d6a80] text-white' : 'bg-[#102a40] text-[#9ad5e5]'}`}>
                <Icon size={15} />
              </span>
              <span className="whitespace-nowrap leading-tight">
                <span className="block text-[13px] font-bold text-[#102a40]">{l.k}</span>
                <span className="block text-[11.5px] text-[#4d6679]">{l.sub}</span>
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

/** Static vector fallback for browsers without WebGL. */
export function StaticStack() {
  const iso = (cx: number, cy: number, w: number) => `M${cx} ${cy - w / 2} L${cx + w} ${cy} L${cx} ${cy + w / 2} L${cx - w} ${cy} Z`
  const fills = ['#17475b', '#cdeef5', '#f1f6f7', '#8fdcd4', '#0f2a40']
  return (
    <svg viewBox="0 0 600 460" className="absolute inset-0 m-auto h-full max-h-[460px] w-full" aria-hidden="true">
      <ellipse cx="300" cy="400" rx="220" ry="46" fill="#0b2034" opacity=".12" />
      {fills.map((f, i) => (
        <path key={i} d={iso(300, 340 - i * 52, 170 - i * 6)} fill={f} stroke="#102a40" strokeOpacity=".15" opacity={i === 1 || i === 3 ? 0.7 : 1} />
      ))}
    </svg>
  )
}
