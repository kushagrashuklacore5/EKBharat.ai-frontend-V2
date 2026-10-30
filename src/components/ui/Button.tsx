import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'icon'
type Size = 'md' | 'lg'

const base =
  'group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.005em] transition-[background-color,color,border-color,box-shadow,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45'

const sizes: Record<Size, string> = {
  md: 'h-10 rounded-lg px-4 text-[14px]',
  lg: 'h-12 rounded-[10px] px-5 text-[15px]',
}

const variants: Record<Variant, string> = {
  // navy on light surfaces, ivory on dark ones (tokens flip automatically)
  primary: 'bg-fg text-ink-950 shadow-[0_1px_0_rgb(255_255_255/.12)_inset,0_6px_16px_-8px_rgb(24_43_61/.55)] hover:bg-electric hover:text-white',
  secondary: 'bg-ink-850 text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1px_var(--color-fg)]',
  tertiary: 'px-1.5 text-cyan hover:text-fg underline-offset-[6px] hover:underline decoration-1',
  destructive: 'bg-danger text-white hover:brightness-110',
  icon: 'size-10 rounded-lg !px-0 text-fg-soft hover:bg-ink-700/60 hover:text-fg',
}

interface Props {
  to?: string
  href?: string
  onClick?: () => void
  children: ReactNode
  variant?: Variant
  size?: Size
  arrow?: boolean
  loading?: boolean
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  'aria-label'?: string
}

export function Button({
  to,
  href,
  onClick,
  children,
  variant = 'primary',
  size = 'lg',
  arrow = variant === 'primary' || variant === 'tertiary',
  loading,
  className = '',
  type = 'button',
  disabled,
  ...rest
}: Props) {
  const cls = `${base} ${variant === 'tertiary' ? 'h-10 text-[14.5px]' : variant === 'icon' ? '' : sizes[size]} ${variants[variant]} ${className}`
  const content = (
    <>
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      <span>{children}</span>
      {arrow && !loading && <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover/btn:translate-x-0.5" />}
    </>
  )
  if (to)
    return (
      <Link to={to} className={cls} aria-label={rest['aria-label']}>
        {content}
      </Link>
    )
  if (href)
    return (
      <a href={href} className={cls} aria-label={rest['aria-label']}>
        {content}
      </a>
    )
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} className={cls} aria-label={rest['aria-label']}>
      {content}
    </button>
  )
}
