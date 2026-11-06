import { Link } from 'react-router'
import { BrandMark, BRAND_NAME } from './BrandMark'

/** Official "B" symbol (transparent PNG cut from the approved logo artwork). */
export const MARK_SRC = '/brand/ekbharat-mark.png' // 228 × 239
/** Approved circuit wordmark (transparent, cropped from the supplied artwork; 1495 × 458 master). */
export const LOGO_V2 = '/brand/ekbharat-logo-v2-1200.webp'
export const LOGO_V2_SM = '/brand/ekbharat-logo-v2-480.webp'

/** The "B" symbol on its own. */
export function LogoMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return <img src={MARK_SRC} alt="" aria-hidden="true" width={Math.round((size * 228) / 239)} height={size} className={`block ${className}`} draggable={false} />
}

/**
 * Logo: the "Ek भारत.AI" wordmark. On dark surfaces it sits on a light tile so
 * the navy lettering stays legible.
 */
export function Logo({ className = '', tone = 'light', compact = false }: { className?: string; tone?: 'light' | 'dark'; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label={`${BRAND_NAME} — home`}
      className={`inline-flex items-center gap-2.5 ${tone === 'dark' ? 'rounded-xl bg-[#ebf3fd] px-3.5 py-2' : ''} ${className}`}
    >
      {tone === 'light' ? (
        // approved circuit-wordmark artwork (top navbar)
        <img
          src={LOGO_V2}
          srcSet={`${LOGO_V2_SM} 480w, ${LOGO_V2} 1200w`}
          sizes="240px"
          alt=""
          width={1495}
          height={458}
          className={`block w-auto ${compact ? 'h-[28px]' : 'h-[38px] sm:h-[46px]'}`}
          draggable={false}
        />
      ) : (
        <BrandMark depth={0} animate={false} className={`${compact ? '!h-[32px]' : '!h-[44px]'} !w-auto -my-1`} />
      )}
    </Link>
  )
}
