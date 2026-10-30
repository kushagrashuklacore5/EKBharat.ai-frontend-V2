import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

interface Props {
  /** 'light' = navy face for light surfaces, 'dark' = ivory face for navy surfaces */
  tone?: 'light' | 'dark'
  className?: string
  /** extrusion depth in viewBox units */
  depth?: number
  animate?: boolean
}

const WORD = 'AI BHARAT'
const FONT = { fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 180, letterSpacing: -3 } as const

/**
 * The AI Bharat typographic shadow.
 * A flat, crisp front face sits on a stepped extrusion that runs along one
 * precise diagonal — blue at the face, easing to teal at depth — finished
 * with a single saffron edge line and a soft directional shadow.
 * The extrusion grows out from behind the face when the mark enters view.
 */
export function BrandMark({ tone = 'light', className = '', depth = 14, animate = true }: Props) {
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

  const face = tone === 'light' ? '#182b3d' : '#eef3f7'
  const near = tone === 'light' ? '#8fb3cb' : '#3f6f8f'
  const far = tone === 'light' ? '#b7d3cf' : '#2c5a63'
  const rim = tone === 'light' ? '#c4852f' : '#e9b56b'
  const shadow = tone === 'light' ? '#182b3d' : '#000000'
  const steps = Array.from({ length: depth }, (_, i) => depth - i) // far → near
  const pad = 6

  return (
    <svg
      ref={svgRef}
      viewBox={`${box.x - pad} ${box.y - pad} ${box.w + depth * 1.6 + pad * 2} ${box.h + depth * 1.6 + pad * 2}`}
      className={`brandmark block w-full overflow-visible ${className}`}
      role="img"
      aria-label="AI Bharat"
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
      <g data-layer style={{ transform: `translate(${open ? depth * 1.5 : 0}px, ${open ? depth * 1.5 : 0}px)` }}>
        <text {...FONT} fill={shadow} fillOpacity={tone === 'light' ? 0.14 : 0.45} filter={`url(#sh-${uid})`}>
          {WORD}
        </text>
      </g>

      {/* saffron edge line at the back of the extrusion */}
      <g data-layer style={{ transform: `translate(${open ? depth : 0}px, ${open ? depth : 0}px)` }}>
        <text {...FONT} fill="none" stroke={rim} strokeWidth={1.6} strokeLinejoin="round">
          {WORD}
        </text>
      </g>

      {/* stepped extrusion */}
      {steps.map((k) => (
        <g key={k} data-layer style={{ transform: `translate(${open ? k : 0}px, ${open ? k : 0}px)`, transitionDelay: `${(depth - k) * 18}ms` }}>
          <text {...FONT} fill={`url(#ex-${uid})`}>
            {WORD}
          </text>
        </g>
      ))}

      {/* flat front face */}
      <text ref={faceRef} {...FONT} fill={face}>
        {WORD}
      </text>
    </svg>
  )
}
