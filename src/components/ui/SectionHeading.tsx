import type { ReactNode } from 'react'

interface Props {
  index?: string
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  align?: 'left' | 'center'
  size?: 'lg' | 'md'
  className?: string
  id?: string
}

export function SectionHeading({ eyebrow, title, lead, align = 'left', size = 'lg', className = '', id }: Props) {
  const center = align === 'center'
  return (
    <header className={`${center ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}>
      <p data-reveal className={`eyebrow ${center ? 'justify-center' : ''}`}>
        {eyebrow}
      </p>
      <h2
        id={id}
        data-reveal="1"
        className={`display mt-5 text-fg ${size === 'lg' ? 'text-[clamp(2.1rem,4.4vw,3.6rem)]' : 'text-[clamp(1.8rem,3.2vw,2.6rem)]'}`}
      >
        {title}
      </h2>
      {lead && (
        <p data-reveal="2" className={`mt-5 max-w-2xl text-[1.0625rem] leading-[1.7] text-muted ${center ? 'mx-auto' : ''}`}>
          {lead}
        </p>
      )}
    </header>
  )
}
