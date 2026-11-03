import type { CSSProperties } from 'react'

const FADES = {
  radial: 'radial-gradient(60% 60% at 50% 50%, #000 20%, transparent 75%)',
  top: 'linear-gradient(180deg, #000, transparent 85%)',
  bottom: 'linear-gradient(0deg, #000, transparent 85%)',
  left: 'radial-gradient(70% 85% at 8% 45%, #000 15%, transparent 75%)',
  right: 'radial-gradient(70% 85% at 92% 45%, #000 15%, transparent 75%)',
  none: 'none',
} as const

/**
 * Silicon Jaali texture: an engineered lattice laid over a surface, faded at
 * the edges so it reads as structure rather than decoration.
 */
export function Jaali({
  fade = 'radial',
  size = 40,
  opacity = 0.08,
  className = '',
  ink,
}: {
  fade?: keyof typeof FADES
  size?: number
  opacity?: number
  className?: string
  /** lattice colour (defaults to the surface's text colour) */
  ink?: string
}) {
  const mask = FADES[fade]
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <div className="jaali absolute inset-0" style={{ opacity, '--jaali-size': `${size}px`, ...(ink ? { '--jaali-ink': ink } : {}) } as CSSProperties} />
    </div>
  )
}
