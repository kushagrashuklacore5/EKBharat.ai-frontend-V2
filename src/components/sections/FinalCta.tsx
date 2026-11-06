import { Section } from '../ui/Section'
import { Button } from '../ui/Button'
import { Jaali } from '../ui/Jaali'

interface Props {
  title?: string
  body?: string
}

export function FinalCta({
  title = 'Your Next AI System Starts Here.',
  body = 'Whether you need computing power, intelligent automation or a complete enterprise AI ecosystem, let’s build it together.',
}: Props) {
  return (
    <Section labelledBy="cta-title" className="overflow-hidden bg-ink-900 py-20 md:py-36">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(40%_50%_at_50%_55%,rgba(69,211,230,.12),transparent_70%)]" />
        {/* a stepwell seen from above: terraces stepping down to the centre */}
        <svg className="absolute left-1/2 top-1/2 h-[150%] -translate-x-1/2 -translate-y-1/2 opacity-50" viewBox="-200 -200 400 400">
          {[196, 168, 140, 112, 84, 56].map((s, i) => (
            <rect
              key={s}
              x={-s}
              y={-s}
              width={s * 2}
              height={s * 2}
              rx={3}
              fill={i % 2 ? 'rgb(23 46 66 / 0.025)' : 'none'}
              stroke={i === 2 ? '#a8835a' : '#7f9bb0'}
              strokeOpacity={i === 2 ? 0.35 : 0.16 + i * 0.03}
            />
          ))}
          {/* stair flights on the four sides */}
          {[0, 90, 180, 270].map((r) => (
            <g key={r} transform={`rotate(${r})`} stroke="#7f9bb0" strokeOpacity="0.18">
              {Array.from({ length: 9 }, (_, k) => (
                <line key={k} x1={-14} x2={14} y1={-60 - k * 15} y2={-60 - k * 15} />
              ))}
            </g>
          ))}
        </svg>
        <Jaali fade="radial" opacity={0.05} size={40} />
      </div>
      <div className="container-x relative text-center">
        <div aria-hidden="true" data-reveal className="tri-hairline mx-auto mb-8 w-32" />
        <p data-reveal className="eyebrow justify-center">
          Start building
        </p>
        <h2 id="cta-title" data-reveal="1" className="display mx-auto mt-6 max-w-4xl text-[clamp(2.6rem,6.4vw,5.6rem)]">
          {title}
        </h2>
        <p data-reveal="2" className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-fg-soft">
          {body}
        </p>
        <div data-reveal="3" className="mt-10 flex flex-wrap justify-center gap-3">
          <Button to="/build-with-us">Start Building with Ek भारत.AI</Button>
          <Button to="/contact" variant="secondary">
            Discuss Your Project
          </Button>
        </div>
      </div>
    </Section>
  )
}
