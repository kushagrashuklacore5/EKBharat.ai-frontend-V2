import type { ReactNode } from 'react'
import { imageSrc, type ImageKey } from '../../lib/imageCredits'
import { Jaali } from './Jaali'

/**
 * Full-width storytelling photograph with copy laid over a navy gradient.
 * Used sparingly, for the one moment on a page where a real place matters.
 */
export function CinematicPhoto({
  img,
  alt,
  eyebrow,
  title,
  body,
  position = 'center',
  className = '',
}: {
  img: ImageKey
  alt: string
  eyebrow: string
  title: ReactNode
  body?: ReactNode
  position?: string
  className?: string
}) {
  const { src, srcSet } = imageSrc(img)
  return (
    <figure className={`surface-dark relative isolate overflow-hidden rounded-[14px] ${className}`}>
      <img src={src} srcSet={srcSet} sizes="100vw" alt={alt} loading="lazy" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ objectPosition: position }} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,32,52,.94)_0%,rgba(11,32,52,.82)_45%,rgba(11,32,52,.2)_78%,transparent)]" />
      <Jaali fade="left" opacity={0.06} size={40} ink="#bfe3ea" className="-z-10" />
      <div className="flex min-h-[420px] flex-col justify-end p-7 sm:min-h-[520px] sm:p-12">
        <div className="max-w-xl">
          <div aria-hidden="true" className="tri-hairline mb-6 w-20" />
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display mt-4 text-[clamp(1.9rem,3.6vw,3rem)] text-fg">{title}</h2>
          {body && <p className="mt-4 text-[15px] leading-relaxed text-fg-soft">{body}</p>}
        </div>
      </div>
    </figure>
  )
}
