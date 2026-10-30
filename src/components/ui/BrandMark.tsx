import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

interface Props {
  /** 'light' = navy face for light surfaces, 'dark' = ivory face for navy surfaces */
  tone?: 'light' | 'dark'
  className?: string
  /** extrusion depth in viewBox units */
  depth?: number
  animate?: boolean
  /** 0..1 — when set, the extrusion is driven externally (e.g. by scroll) */
  extrude?: number
}

const WORD = 'Bharat.Ai'
const FONT = { fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 180, letterSpacing: -5 } as const

/**
 * The Bharat.Ai typographic shadow.
 * A flat, crisp front face sits on a stepped extrusion that runs along one
 * precise diagonal — blue at the face, easing to teal at depth — finished
 * with a single saffron edge line and a soft directional shadow.
 * The extrusion grows out from behind the face when the mark enters view.
 */
export function BrandMark({ tone = 'light', className = '', depth = 14, animate = true, extrude }: Props) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const faceRef = useRef<SVGTextElement>(null)
  const [open, setOpen] = useState(!animate)
  const [box, setBox] = useState({ x: 0, y: 20, w: 1000, h: 150 })

  // fit the viewBox to the real glyph bounds once the font is ready
  useLayoutEffect(() => {
    const measure = () => {
      const b = faceRef.current?.getBBox()
      if (b && b.width) setBox({ x: b.x, y: b.y, w: b.width, h: b.height })
    }
    measure()
    const fonts = document.fonts
    fonts?.ready.then(measure).catch(() => {})
    fonts?.addEventListener?.('loadingdone', measure)
    const t = window.setTimeout(measure, 800)
    return () => {
      fonts?.removeEventListener?.('loadingdone', measure)
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!animate) return
    const el = svgRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOpen(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [animate])

  const face = tone === 'light' ? '#102a40' : '#eaf1f4'
  const aiFace = tone === 'light' ? '#1d6a80' : '#9ad5e5'
  const near = tone === 'light' ? '#7fa9bd' : '#2b5670'
  const far = tone === 'light' ? '#a9d2cf' : '#1e5961'
  const rim = tone === 'light' ? '#b08a55' : '#d5b68a'
  const shadow = tone === 'light' ? '#102a40' : '#000000'
  const driven = extrude !== undefined
  const e = driven ? Math.max(0, Math.min(1, extrude!)) : open ? 1 : 0
  const steps = Array.from({ length: depth }, (_, i) => depth - i) // far → near
  const pad = 6

  return (
    <svg
      ref={svgRef}
      viewBox={`${box.x - pad} ${box.y - pad} ${box.w + depth * 1.6 + pad * 2} ${box.h + depth * 1.6 + pad * 2}`}
      className={`brandmark block w-full overflow-visible ${className}`}
      role="img"
      aria-label="Bharat.Ai"
    >
      <defs>
        <linearGradient id={`ex-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={near} />
          <stop offset="1" stopColor={far} />
        </linearGradient>
        <filter id={`sh-${uid}`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* soft directional shadow, furthest back */}
      <g data-layer style={{ opacity: e, transform: `translate(${depth * 1.5 * e}px, ${depth * 1.5 * e}px)` }}>
        <text {...FONT} fill={shadow} fillOpacity={tone === 'light' ? 0.14 : 0.45} filter={`url(#sh-${uid})`}>
          {WORD}
        </text>
      </g>

      {/* saffron edge line at the back of the extrusion */}
      <g data-layer style={{ transform: `translate(${depth * e}px, ${depth * e}px)` }}>
        <text {...FONT} fill="none" stroke={rim} strokeWidth={1.6} strokeLinejoin="round">
          {WORD}
        </text>
      </g>

      {/* stepped extrusion */}
      {steps.map((k) => (
        <g key={k} data-layer style={{ transform: `translate(${k * e}px, ${k * e}px)`, transitionDelay: driven ? '0ms' : `${(depth - k) * 18}ms`, transitionDuration: driven ? '0ms' : undefined }}>
          <text {...FONT} fill={`url(#ex-${uid})`}>
            {WORD}
          </text>
        </g>
      ))}

      {/* flat front face */}
      <text ref={faceRef} {...FONT} fill={face}>
        Bharat<tspan fill={rim}>.</tspan>
        <tspan fill={aiFace}>Ai</tspan>
      </text>
    </svg>
  )
}
