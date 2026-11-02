import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AshokaChakra } from './AshokaChakra'
import { HeritageScene } from './HeritageScene'

interface Props {
  /** 'light' = navy face for light surfaces, 'dark' = ivory face for navy surfaces */
  tone?: 'light' | 'dark'
  className?: string
  /** extrusion depth in viewBox units */
  depth?: number
  animate?: boolean
  /** 0..1 — when set, the extrusion is driven externally (e.g. by scroll) */
  extrude?: number
  /** 0..1 — draws the tricolour ribbon across the wordmark (left → right) */
  ribbon?: number
  /** 0..1 — fades/scales in the rotating Ashoka Chakra behind भारत (animation only) */
  chakra?: number
  /** 'soft' = light, refined tricolour (large wordmark); 'full' = full-strength colours */
  ribbonTone?: 'soft' | 'full'
}

export const BRAND_NAME = 'Ek भारत.AI'
const HINDI = 'भारत'
const FONT = { fontFamily: 'Manrope, Mukta, sans-serif', fontWeight: 800, fontSize: 180, letterSpacing: -5 } as const

/** Ribbon stripes, top → bottom. */
const BANDS = [
  { full: '#f39a1e', soft: '#f2b46a', softOpacity: 0.7 },
  { full: '#ffffff', soft: '#ffffff', softOpacity: 0.9 },
  { full: '#1f8a3c', soft: '#5aa56e', softOpacity: 0.7 },
]
/**
 * Ribbon centreline as one cubic Bézier in wordmark units:
 * u = 0 at the left of the E, 1 at the right of the I; v = 0 at cap height, 1 on the baseline.
 * It dips under “Ek”, sweeps up through “भारत” and settles just above the “AI”.
 */
const CURVE: [number, number][] = [
  [-0.035, 1.1],
  [0.25, 1.62],
  [0.7, -0.62],
  [1.01, -0.46],
]
const STRIPE = 0.13 // stripe thickness, in cap heights
/** optical spacing around the Devanagari word (font units) */
const GAP_BEFORE = 10
/** Mukta ExtraBold — stroke weight matched to the Latin letters, as in the reference */
const HINDI_WEIGHT = 800
const GAP_AFTER = 8
const SAMPLES = 72

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Catmull-Rom through points → cubic Bézier segments (smooth, no kinks). */
function smoothPath(p: [number, number][]) {
  let d = ''
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[Math.min(p.length - 1, i + 2)]
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

/**
 * The Ek भारत.AI wordmark with its typographic shadow.
 * A flat, crisp front face sits on a stepped extrusion that runs along one
 * precise diagonal, with a soft directional shadow. भारत is set in a proper
 * Devanagari face (Mukta), scaled so its headline sits on the cap height of
 * the Latin letters, and filled with the tricolour.
 */
export function BrandMark({ tone = 'light', className = '', depth = 14, animate = true, extrude, ribbon, ribbonTone = 'soft', chakra }: Props) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const faceRef = useRef<SVGTextElement>(null)
  const [open, setOpen] = useState(!animate)
  const [box, setBox] = useState({ x: 0, y: 20, w: 1000, h: 150 })
  /** Devanagari scale + vertical extents (from font metrics, not layout) */
  const [hindi, setHindi] = useState({ scale: 1, top: -FONT.fontSize * 0.72, bottom: 0 })
  /** laid-out positions: wordmark ink box, end of “Ek”, start of भारत */
  const [ink, setInk] = useState<{ l: number; r: number; cap: number; ekEnd: number; hiStart: number; hiEnd: number } | null>(null)

  const measureLayout = useCallback(() => {
    const el = faceRef.current
    if (!el) return
    try {
      const b = el.getBBox()
      if (!b.width) return
      setBox({ x: b.x, y: b.y, w: b.width, h: b.height })
      const g = document.createElement('canvas').getContext('2d')!
      g.font = `${FONT.fontWeight} ${FONT.fontSize}px Manrope, sans-serif`
      const cap = g.measureText('E').actualBoundingBoxAscent || FONT.fontSize * 0.72
      const first = el.getExtentOfChar(0)
      const last = el.getExtentOfChar(el.getNumberOfChars() - 1)
      const k = el.getExtentOfChar(1)
      const bh = el.getExtentOfChar(3)
      const ht = el.getExtentOfChar(6)
      setInk({ l: first.x, r: last.x + last.width, cap, ekEnd: k.x + k.width, hiStart: bh.x, hiEnd: ht.x + ht.width })
    } catch {
      /* not laid out yet */
    }
  }, [])

  // font metrics → Devanagari scale (headline on the Latin cap height)
  useLayoutEffect(() => {
    const fit = () => {
      try {
        const g = document.createElement('canvas').getContext('2d')!
        g.font = `${FONT.fontWeight} ${FONT.fontSize}px Manrope, sans-serif`
        const cap = g.measureText('E').actualBoundingBoxAscent || FONT.fontSize * 0.72
        g.font = `${HINDI_WEIGHT} ${FONT.fontSize}px Mukta, sans-serif`
        const m = g.measureText(HINDI)
        const asc = m.actualBoundingBoxAscent
        if (!asc) return
        const scale = Math.min(1.08, Math.max(0.92, cap / asc))
        setHindi({ scale, top: -asc * scale, bottom: (m.actualBoundingBoxDescent || 0) * scale })
      } catch {
        /* keep defaults */
      }
      measureLayout()
    }
    fit()
    const fonts = document.fonts
    fonts?.ready.then(fit).catch(() => {})
    fonts?.addEventListener?.('loadingdone', fit)
    const t = window.setTimeout(fit, 800)
    return () => {
      fonts?.removeEventListener?.('loadingdone', fit)
      window.clearTimeout(t)
    }
  }, [measureLayout])

  // re-measure layout once the Devanagari scale has been applied
  useLayoutEffect(() => {
    measureLayout()
  }, [hindi.scale, measureLayout])

  useEffect(() => {
    if (!animate) return
    const el = svgRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(true)
      return
    }
    const io = new IntersectionObserver(
      ([en]) => {
        if (en.isIntersecting) {
          setOpen(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [animate])

  const hindiSize = FONT.fontSize * hindi.scale
  // identical character runs in every layer so all layers line up exactly
  const word = (dot?: string, ai?: string, tri?: boolean, hideHindi?: boolean) => (
    <>
      Ek{' '}
      <tspan
        letterSpacing="0"
        fontSize={hindiSize}
        fontWeight={HINDI_WEIGHT}
        dx={GAP_BEFORE}
        {...(tri ? { fill: ink ? `url(#scene-${uid})` : `url(#tri-${uid})` } : {})}
        {...(hideHindi ? { fill: 'none', stroke: 'none' } : {})}
      >
        {HINDI}
      </tspan>
      <tspan fill={dot} dx={GAP_AFTER}>
        .
      </tspan>
      <tspan fill={ai}>AI</tspan>
    </>
  )

  const face = tone === 'light' ? '#0f2747' : '#eaf1f4'
  const aiFace = tone === 'light' ? '#167f8c' : '#5fc6c9'
  const near = tone === 'light' ? '#7fa9bd' : '#2b5670'
  const far = tone === 'light' ? '#a9d2cf' : '#1e5961'
  const rim = tone === 'light' ? '#b08a55' : '#d5b68a'
  const shadow = tone === 'light' ? '#102a40' : '#000000'
  const driven = extrude !== undefined
  const e = driven ? Math.max(0, Math.min(1, extrude!)) : open ? 1 : 0
  const steps = Array.from({ length: depth }, (_, i) => depth - i) // far → near
  const pad = 6
  const rib = ribbon === undefined ? null : clamp01(ribbon)
  const soft = ribbonTone === 'soft'

  // ── ribbon geometry: one smooth centreline, three parallel stripes, tapered ends ──
  let bandPaths: string[] = []
  let ribTop = 0
  let ribBot = 0
  let centreline = ''
  if (ink && rib !== null) {
    const W = ink.r - ink.l
    const toXY = (u: number, v: number): [number, number] => [ink.l + u * W, -ink.cap + v * ink.cap]
    const P = CURVE.map(([u, v]) => toXY(u, v))
    const at = (t: number) => {
      const a = (1 - t) ** 3
      const b = 3 * (1 - t) ** 2 * t
      const c = 3 * (1 - t) * t * t
      const d = t ** 3
      return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]
    }
    const tan = (t: number) => {
      const a = 3 * (1 - t) ** 2
      const b = 6 * (1 - t) * t
      const c = 3 * t * t
      const x = a * (P[1][0] - P[0][0]) + b * (P[2][0] - P[1][0]) + c * (P[3][0] - P[2][0])
      const y = a * (P[1][1] - P[0][1]) + b * (P[2][1] - P[1][1]) + c * (P[3][1] - P[2][1])
      const l = Math.hypot(x, y) || 1
      return [x / l, y / l]
    }
    const w = STRIPE * ink.cap
    const edge = (t: number, off: number): [number, number] => {
      const [x, y] = at(t)
      const [tx, ty] = tan(t)
      const nx = ty // normal pointing up-left (above the curve)
      const ny = -tx
      const taper = smoothstep(0, 0.12, t) * (1 - smoothstep(0.9, 1, t)) // polished pointed ends
      return [x + nx * off * w * taper, y + ny * off * w * taper]
    }
    const ts = Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES)
    // stripe offsets (in stripe widths, positive = above the centreline)
    const offs: [number, number][] = [
      [1.5, 0.5],
      [0.5, -0.5],
      [-0.5, -1.5],
    ]
    bandPaths = offs.map(([o1, o2]) => {
      const top = ts.map((t) => edge(t, o1))
      const bot = ts.map((t) => edge(t, o2)).reverse()
      return `M${top[0][0].toFixed(2)} ${top[0][1].toFixed(2)}${smoothPath(top)}L${bot[0][0].toFixed(2)} ${bot[0][1].toFixed(2)}${smoothPath(bot)}Z`
    })
    const c = ts.map((t) => at(t) as [number, number])
    centreline = `M${c[0][0].toFixed(2)} ${c[0][1].toFixed(2)}${smoothPath(c)}`
    const ys = ts.flatMap((t) => [edge(t, 1.5)[1], edge(t, -1.5)[1]])
    ribTop = Math.min(...ys)
    ribBot = Math.max(...ys)
  }
  const extraTop = rib !== null && ink ? Math.max(0, box.y - ribTop + 4) : 0
  const extraBot = rib !== null && ink ? Math.max(0, ribBot - (box.y + box.h) + 4) : 0
  const ribLeft = ink ? ink.l - (ink.r - ink.l) * 0.06 : 0
  const ribWidth = ink ? (ink.r - ink.l) * 1.12 : 0

  const bands = (
    <>
      {bandPaths.map((d, i) => (
        <path key={i} d={d} fill={soft ? BANDS[i].soft : BANDS[i].full} fillOpacity={soft ? BANDS[i].softOpacity : 1} />
      ))}
    </>
  )

  return (
    <svg
      ref={svgRef}
      viewBox={`${box.x - pad} ${box.y - pad - extraTop} ${box.w + depth * 1.6 + pad * 2} ${box.h + depth * 1.6 + pad * 2 + extraTop + extraBot}`}
      className={`brandmark block w-full overflow-visible ${className}`}
      role="img"
      aria-label={BRAND_NAME}
    >
      <defs>
        <linearGradient id={`ex-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={near} />
          <stop offset="1" stopColor={far} />
        </linearGradient>
        {/* भारत in the tricolour: saffron · white · green, top to bottom */}
        {/* heritage scene painted inside भारत (falls back to the tricolour gradient until measured) */}
        {ink && (
          <HeritageScene
            id={`scene-${uid}`}
            x={ink.hiStart - 30}
            y={hindi.top - 8}
            width={ink.hiEnd - ink.hiStart + 60}
            height={hindi.bottom - hindi.top + 16}
          />
        )}
        <linearGradient id={`tri-${uid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={hindi.top} y2={hindi.bottom}>
          <stop offset="0" stopColor="#f6a24e" />
          <stop offset=".3" stopColor="#f9c58a" />
          <stop offset=".44" stopColor="#ffffff" />
          <stop offset=".58" stopColor="#ffffff" />
          <stop offset=".72" stopColor="#7cc28c" />
          <stop offset="1" stopColor="#4f9d63" />
        </linearGradient>
        {ink && rib !== null && (
          <>
            <clipPath id={`rc-${uid}`}>
              <rect x={ribLeft} y={ribTop - 20} width={ribWidth * rib} height={ribBot - ribTop + 40} />
            </clipPath>
            {/* the ribbon passes in front of “Ek”, then fades softly behind भारत */}
            <linearGradient id={`rfg-${uid}`} gradientUnits="userSpaceOnUse" x1={ink.ekEnd} x2={(ink.ekEnd + ink.hiStart) / 2 + 6} y1="0" y2="0">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`rf-${uid}`} maskUnits="userSpaceOnUse" x={ribLeft} y={ribTop - 20} width={ribWidth} height={ribBot - ribTop + 40}>
              <rect x={ribLeft} y={ribTop - 20} width={ribWidth} height={ribBot - ribTop + 40} fill={`url(#rfg-${uid})`} />
            </mask>
          </>
        )}
        <filter id={`hs-${uid}`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation={depth === 0 ? 3 : 2.2} />
        </filter>
        <filter id={`sh-${uid}`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {depth > 0 && (
        <>
          {/* soft directional shadow, furthest back */}
          <g data-layer style={{ opacity: e, transform: `translate(${depth * 1.5 * e}px, ${depth * 1.5 * e}px)` }}>
            <text {...FONT} fill={shadow} fillOpacity={tone === 'light' ? 0.14 : 0.45} filter={`url(#sh-${uid})`}>
              {word(undefined, undefined, false, true)}
            </text>
          </g>
          {/* saffron edge line at the back of the extrusion */}
          <g data-layer style={{ transform: `translate(${depth * e}px, ${depth * e}px)` }}>
            <text {...FONT} fill="none" stroke={rim} strokeWidth={1.6} strokeLinejoin="round">
              {word(undefined, undefined, false, true)}
            </text>
          </g>
        </>
      )}

      {/* Ashoka Chakra: separate animation layer, behind and slightly above भारत */}
      {ink && chakra !== undefined && chakra > 0 && (
        <g
          transform={`translate(${((ink.hiStart + ink.hiEnd) / 2).toFixed(1)} ${(-ink.cap * 0.92).toFixed(1)}) scale(${(0.82 + 0.18 * chakra).toFixed(3)})`}
          opacity={0.32 * chakra}
          aria-hidden="true"
        >
          <AshokaChakra r={ink.cap * 0.62} color={tone === 'light' ? '#0b2a78' : '#9fb8ff'} />
        </g>
      )}

      {/* stepped extrusion (matching stroke seals glyph-join seams) */}
      {steps.map((k) => (
        <g key={k} data-layer style={{ transform: `translate(${k * e}px, ${k * e}px)`, transitionDelay: driven ? '0ms' : `${(depth - k) * 18}ms`, transitionDuration: driven ? '0ms' : undefined }}>
          <text {...FONT} fill={`url(#ex-${uid})`} stroke={`url(#ex-${uid})`} strokeWidth={1.6} strokeLinejoin="round">
            {word(undefined, undefined, false, true)}
          </text>
        </g>
      ))}

      {/* tricolour ribbon, behind the letter faces */}
      {ink && rib !== null && rib > 0 && <g clipPath={`url(#rc-${uid})`}>{bands}</g>}

      {/* soft lift shadow under भारत only — no hard outline */}
      <text {...FONT} fill="none" aria-hidden="true" filter={`url(#hs-${uid})`} transform="translate(1.5 3)">
        <tspan>Ek </tspan>
        <tspan letterSpacing="0" fontSize={hindiSize} fontWeight={HINDI_WEIGHT} dx={GAP_BEFORE} fill={shadow} fillOpacity={tone === 'light' ? 0.22 : 0.5}>
          {HINDI}
        </tspan>
        <tspan dx={GAP_AFTER}>.AI</tspan>
      </text>

      {/* flat front face */}
      <text ref={faceRef} {...FONT} fill={face}>
        {word('#f37a1f', aiFace, true)}
      </text>

      {/* invisible centreline + current wipe front (used by the fighter-jet sequence to fly the ribbon) */}
      {centreline && rib !== null && <path data-ribcenter="" data-front={(ribLeft + ribWidth * rib).toFixed(2)} d={centreline} fill="none" stroke="none" />}

      {/* the ribbon in front of “Ek” */}
      {ink && rib !== null && rib > 0 && (
        <g mask={`url(#rf-${uid})`} clipPath={`url(#rc-${uid})`}>
          {bands}
        </g>
      )}
    </svg>
  )
}
