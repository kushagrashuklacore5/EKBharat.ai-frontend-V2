import type { ReactNode } from 'react'

/** Isometric plane transform: plane (x, y) → screen, scaled by `s`. */
export const isoMatrix = (s = 1) => `matrix(${0.866 * s},${0.5 * s},${-0.866 * s},${0.5 * s},0,0)`

/** Draws children on an isometric plane lifted `z` px above the origin. */
export function Plane({ ox, oy, z = 0, s = 1, children, className, style }: { ox: number; oy: number; z?: number; s?: number; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <g transform={`translate(${ox},${oy - z}) ${isoMatrix(s)}`} className={className} style={style}>
      {children}
    </g>
  )
}

/**
 * An extruded plate: the same rounded rect drawn as a stack of slices
 * (side colour) under a top face — reads as a solid slab in isometric view.
 */
export function Slab({
  ox,
  oy,
  z = 0,
  x,
  y,
  w,
  h,
  t = 10,
  r = 8,
  top,
  side,
  stroke = 'rgba(255,255,255,.14)',
  children,
}: {
  ox: number
  oy: number
  z?: number
  x: number
  y: number
  w: number
  h: number
  t?: number
  r?: number
  top: string
  side: string
  stroke?: string
  children?: ReactNode
}) {
  const slices = Math.max(2, Math.round(t / 2))
  return (
    <g>
      {Array.from({ length: slices }, (_, i) => (
        <Plane key={i} ox={ox} oy={oy} z={z + (t * i) / slices}>
          <rect x={x} y={y} width={w} height={h} rx={r} fill={side} />
        </Plane>
      ))}
      <Plane ox={ox} oy={oy} z={z + t}>
        <rect x={x} y={y} width={w} height={h} rx={r} fill={top} stroke={stroke} strokeWidth="1" />
        {children}
      </Plane>
    </g>
  )
}

/** Soft elliptical contact shadow under an isometric object. */
export function IsoShadow({ cx, cy, rx, ry, opacity = 0.45 }: { cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#020c16" opacity={opacity} filter="url(#v-blur)" />
}

export function VisualDefs() {
  return (
    <defs>
      <filter id="v-blur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
      <filter id="v-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <linearGradient id="v-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e9f1f4" />
        <stop offset=".5" stopColor="#b9cdd6" />
        <stop offset="1" stopColor="#8fa9b6" />
      </linearGradient>
      <linearGradient id="v-petrol" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1f5a70" />
        <stop offset="1" stopColor="#123a50" />
      </linearGradient>
      <linearGradient id="v-teal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7fe0d6" />
        <stop offset="1" stopColor="#38a6a2" />
      </linearGradient>
      <linearGradient id="v-champ" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f0d9b5" />
        <stop offset="1" stopColor="#c9a46e" />
      </linearGradient>
      <pattern id="v-dots" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="#9ad5e5" opacity=".18" />
      </pattern>
    </defs>
  )
}
