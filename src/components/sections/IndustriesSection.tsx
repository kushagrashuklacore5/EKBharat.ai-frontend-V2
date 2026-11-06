import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { Section } from '../ui/Section'
import { SectionHeading } from '../ui/SectionHeading'
import { INDUSTRIES } from '../../lib/content'
import { IndustryGlyph } from './IndustryGlyph'
import { AiIndustryVisual } from './AiIndustryVisual'

export function IndustryCard({ ind, i }: { ind: (typeof INDUSTRIES)[number]; i: number }) {
  return (
    <Link
      to={`/solutions#${ind.id}`}
      data-reveal={String(i % 4)}
      className="ind-card group relative flex w-[78vw] max-w-[340px] shrink-0 snap-start min-h-[300px] flex-col sm:w-auto sm:max-w-none overflow-hidden rounded-xl border border-line bg-ink-900 p-6 transition-[background-color,box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:bg-ink-850 hover:shadow-[var(--shadow-md)] focus-visible:bg-ink-850"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ background: `${ind.color}22` }}
      />
      <div className="flex items-start justify-between">
        <IndustryGlyph glyph={ind.glyph} color={ind.color} />
        <ArrowUpRight size={18} className="text-faint transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" />
      </div>
      <h3 className="mt-6 text-xl tracking-tight text-fg font-semibold">{ind.name}</h3>
      {/* problem → solution swap */}
      <div className="relative mt-3 flex-1">
        <div className="transition-all duration-500 [@media(hover:hover)]:group-hover:-translate-y-2 [@media(hover:hover)]:group-hover:opacity-0 [@media(hover:hover)]:group-focus-visible:opacity-0">
          <p className="label text-faint">The problem</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{ind.problem}</p>
        </div>
        <div className="mt-4 transition-all duration-500 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-0 [@media(hover:hover)]:mt-0 [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:translate-y-0 [@media(hover:hover)]:group-focus-visible:opacity-100">
          <p className="label" style={{ color: ind.color }}>
            How we solve it
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-fg-soft">{ind.solution}</p>
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-700 group-hover:scale-x-100" style={{ background: ind.color }} />
    </Link>
  )
}

export function IndustriesSection({ index = '08' }: { index?: string }) {
  return (
    <Section id="industries" labelledBy="ind-title" className="py-28 md:py-36">
      <div className="container-x">
        <SectionHeading
          id="ind-title"
          index={index}
          eyebrow="Industry solutions"
          title={
            <>
              Applied AI for <span className="serif-accent text-gradient">real operations.</span>
            </>
          }
          lead="The same platform, shaped around the problems each industry actually has. Explore a card to see how we approach it."
        />
        {/* AI and machine learning applied to each industry — original illustration */}
        <AiIndustryVisual className="mt-14" />
        <div className="-mx-[var(--gutter)] mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {INDUSTRIES.map((ind, i) => (
            <IndustryCard key={ind.id} ind={ind} i={i} />
          ))}
          <Link
            to="/build-with-us"
            data-reveal="3"
            className="group flex w-[78vw] max-w-[340px] shrink-0 snap-start min-h-[300px] flex-col justify-between rounded-xl sm:w-auto sm:max-w-none border border-dashed border-line-strong p-6 transition-colors hover:border-fg-soft/40"
          >
            <span className="label text-faint">Your industry</span>
            <span>
              <span className="block text-xl tracking-tight text-fg font-semibold">Not listed?</span>
              <span className="mt-2 block text-[13.5px] leading-relaxed text-muted">
                Describe your process and we’ll assess where AI can help — and where it can’t.
              </span>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-cyan">
                Start a brief <ArrowUpRight size={14} />
              </span>
            </span>
          </Link>
        </div>
      </div>
    </Section>
  )
}
