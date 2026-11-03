import { useEffect, useRef, useState } from 'react'
import { IMAGES, imageSrc, type ImageKey } from '../../lib/imageCredits'
import { Jaali } from './Jaali'

/**
 * A licensed photograph that opens out from behind a jaali screen as it
 * scrolls into view, with its caption and credit always attached.
 */
export function PhotoReveal({
  img,
  alt,
  className = '',
  aspect = 'aspect-[16/10]',
  mono = false,
  sizes = '(min-width: 1024px) 50vw, 100vw',
  position = 'center',
}: {
  img: ImageKey
  alt: string
  className?: string
  aspect?: string
  mono?: boolean
  sizes?: string
  position?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setInView(true), io.disconnect()), { rootMargin: '0px 0px -12% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const meta = IMAGES[img]
  const { src, srcSet } = imageSrc(img)
  return (
    <figure className={className}>
      <div ref={ref} data-in={inView} className={`photo-reveal relative overflow-hidden bg-ink-800 ${aspect}`}>
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${mono ? 'mono-photo' : ''}`}
          style={{ objectPosition: position }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b2034]/45 via-transparent to-transparent" aria-hidden="true" />
        <div className="jaali-veil absolute inset-0">
          <Jaali fade="none" opacity={0.9} size={34} ink="#dbe4e9" />
        </div>
      </div>
      <figcaption className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11.5px] leading-snug text-faint">
        <span>
          {meta.representative && <span className="font-semibold text-muted">Representative image · </span>}
          {meta.caption}
        </span>
        <a href={meta.source} target="_blank" rel="noreferrer" className="font-mono text-[10.5px] hover:text-fg">
          {meta.author} · {meta.licence}
        </a>
      </figcaption>
    </figure>
  )
}
