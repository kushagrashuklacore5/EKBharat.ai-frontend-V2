import { Link } from 'react-router'
import { BrandMark, BRAND_NAME } from './BrandMark'

/** Official "B" symbol (transparent PNG cut from the approved logo artwork). */
export const MARK_SRC = '/brand/ekbharat-mark.png' // 228 × 239

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
      <BrandMark depth={0} animate={false} className={`${compact ? '!h-[32px]' : '!h-[44px]'} !w-auto -my-1`} />
    </Link>
  )
}
