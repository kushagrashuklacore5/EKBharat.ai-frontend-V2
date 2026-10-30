import { useId } from 'react'
import { Link } from 'react-router'

type Tone = 'light' | 'dark' | 'mono'

/**
 * Bharat.Ai symbol — a "B" assembled from three computational strata on a
 * spine. The strata step out (top bowl · waist · larger lower bowl) to draw
 * the letter, each ending in a network node; a fine link joins the nodes,
 * and the foundation node is champagne. Works as a flat vector at 16px.
 */
export function LogoMark({ size = 30, tone = 'light' }: { size?: number; tone?: Tone }) {
  const id = useId().replace(/:/g, '')
  const mono = tone === 'mono'
  const spine = mono ? 'currentColor' : tone === 'dark' ? '#eaf1f4' : '#102a40'
  const node = mono ? 'currentColor' : tone === 'dark' ? '#0b2034' : '#ebeff0'
  const accent = mono ? 'currentColor' : '#d5b68a'
  const fill = mono ? 'currentColor' : `url(#lg-${id})`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {!mono && (
        <defs>
          <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={tone === 'dark' ? '#9ad5e5' : '#17475b'} />
            <stop offset="1" stopColor={tone === 'dark' ? '#5cc3be' : '#38a6a2'} />
          </linearGradient>
        </defs>
      )}
      {/* spine */}
      <rect x="5" y="4" width="7" height="32" rx="2.2" fill={spine} />
      {/* strata */}
      <path d="M13 4 H25 a6 6 0 0 1 0 12 H13 Z" fill={fill} opacity={mono ? 0.85 : 1} />
      <path d="M13 17.5 H22 a2.5 2.5 0 0 1 0 5 H13 Z" fill={spine} opacity={mono ? 0.55 : 0.85} />
      <path d="M13 24 H27.5 a6 6 0 0 1 0 12 H13 Z" fill={fill} />
      {/* nodes + link */}
      <path d="M25.5 10 L22 20 L27.5 30" fill="none" stroke={node} strokeWidth="1.2" strokeLinecap="round" opacity=".9" />
      <circle cx="25.5" cy="10" r="2.1" fill={node} />
      <circle cx="22" cy="20" r="1.5" fill={tone === 'dark' ? '#0b2034' : '#ebeff0'} />
      <circle cx="27.5" cy="30" r="2.4" fill={accent} />
    </svg>
  )
}

/** Wordmark: "Bharat" + champagne point + "Ai". */
export function Wordmark({ tone = 'light', className = '' }: { tone?: Tone; className?: string }) {
  const main = tone === 'dark' ? 'text-[#eaf1f4]' : tone === 'mono' ? '' : 'text-[#102a40]'
  const ai = tone === 'dark' ? 'text-[#9ad5e5]' : tone === 'mono' ? '' : 'text-[#1d6a80]'
  return (
    <span className={`inline-flex items-baseline font-sans text-[17px] font-extrabold tracking-[-0.025em] ${main} ${className}`}>
      Bharat
      <span className={`mx-[1px] inline-block size-[5px] translate-y-[-1px] rounded-[1.5px] ${tone === 'mono' ? 'bg-current' : 'bg-[#c9a46e]'}`} aria-hidden="true" />
      <span className={ai}>Ai</span>
    </span>
  )
}

/** Horizontal lockup (default) or compact symbol-only version. */
export function Logo({ className = '', tone = 'light', compact = false }: { className?: string; tone?: Tone; compact?: boolean }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Bharat.Ai — home">
      <LogoMark tone={tone} />
      {!compact && <Wordmark tone={tone} />}
    </Link>
  )
}
