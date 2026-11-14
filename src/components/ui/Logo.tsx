import { Link } from 'react-router'
import { BRAND_NAME } from './BrandMark'

/**
 * Official Ek Bharat.AI logo — the supplied artwork with only its white background
 * made transparent (pixels unchanged). Master 1459 × 260.
 */
export const LOGO_SRC = '/brand/ekbharat-logo-1600.webp'
export const LOGO_SRC_MD = '/brand/ekbharat-logo-800.webp'
export const LOGO_SRC_SM = '/brand/ekbharat-logo-400.webp'
export const LOGO_ASPECT = 1459 / 260
export const LOGO_SRCSET = `${LOGO_SRC_SM} 400w, ${LOGO_SRC_MD} 800w, ${LOGO_SRC} 1459w`

/**
 * Dark-surface signature of the same artwork: the blue lettering lifted to ivory (AI in teal,
 * tagline in mist), the emblem and the orange dot untouched, and the heritage scene painted
 * inside “Bharat” through a mask of those exact letters.
 */
export const LOGO_NIGHT = {
  src: '/brand/ekbharat-logo.png',
  aspect: LOGO_ASPECT,
  face: '/brand/ekbharat-logo-night.png',
  scene: '/brand/ekbharat-logo-bharat-mask.png',
  sceneBox: [528, 22, 1186, 176] as [number, number, number, number],
  px: [1459, 260] as [number, number],
  depthTo: 182 / 260,
}

/** The India-map emblem cut from the same artwork (used for the favicon and 3D chip). 211 × 206 */
export const MARK_SRC = '/brand/ekbharat-mark.png'

/** The emblem on its own. */
export function LogoMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return <img src={MARK_SRC} alt="" aria-hidden="true" width={Math.round((size * 211) / 206)} height={size} className={`block ${className}`} draggable={false} />
}

/** The full logo image at a given CSS height class. */
export function LogoImage({ className = '', sizes = '260px', alt = '' }: { className?: string; sizes?: string; alt?: string }) {
  return <img src={LOGO_SRC} srcSet={LOGO_SRCSET} sizes={sizes} alt={alt} width={1459} height={260} className={`block w-auto ${className}`} draggable={false} />
}

/**
 * Logo link used in the navbar and footer. The artwork has dark-blue lettering, so on
 * dark surfaces it sits on a light tile to stay legible without altering its colours.
 */
export function Logo({ className = '', tone = 'light', compact = false }: { className?: string; tone?: 'light' | 'dark'; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label={`${BRAND_NAME} — home`}
      className={`inline-flex items-center ${tone === 'dark' ? 'rounded-xl bg-white px-3.5 py-2.5' : ''} ${className}`}
    >
      <LogoImage className={compact ? 'h-[26px]' : tone === 'dark' ? 'h-[34px]' : 'h-[32px] sm:h-[40px]'} />
    </Link>
  )
}
