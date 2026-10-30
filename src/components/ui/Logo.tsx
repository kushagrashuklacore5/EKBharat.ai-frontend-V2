import { Link } from 'react-router'

/** Stacked-layer mark: a solid top plane over two offset strata (blue, saffron). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--color-fg)" />
      <path d="M16 6 26 11.5 16 17 6 11.5Z" fill="var(--color-ink-950)" />
      <path d="M6 16 16 21.5 26 16" fill="none" stroke="#7cc4dd" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6 20.5 16 26 26 20.5" fill="none" stroke="#e9b56b" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label="AI Bharat — home">
      <LogoMark />
      <span className="text-[16px] font-extrabold tracking-[-0.01em] text-fg">
        AI <span className="font-semibold text-fg-soft">Bharat</span>
      </span>
    </Link>
  )
}
