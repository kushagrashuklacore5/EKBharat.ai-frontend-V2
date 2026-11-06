import { Link } from 'react-router'
import { Logo } from '../ui/Logo'
import { BrandMark } from '../ui/BrandMark'
import { Jaali } from '../ui/Jaali'
import { SITE } from '../../lib/config'

const COLS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Products',
    links: [
      ['Workflow Studio', '/workflow-studio'],
      ['AI Agents', '/ai-agents'],
      ['AI Orchestration', '/ai-orchestration'],
      ['GPU Cloud', '/gpu-cloud'],
    ],
  },
  {
    title: 'Services',
    links: [
      ['Custom AI Development', '/custom-ai-development'],
      ['Build With Us', '/build-with-us'],
      ['AI Architecture', '/#architecture'],
    ],
  },
  {
    title: 'Solutions',
    links: [
      ['Customer Support', '/solutions#customer-support'],
      ['Finance', '/solutions#finance'],
      ['Healthcare', '/solutions#healthcare'],
      ['All industries', '/solutions'],
    ],
  },
  {
    title: 'Developers',
    links: [
      ['Developer overview', '/developers'],
      ['Documentation', '/developers#documentation'],
      ['Workflow nodes', '/workflow-studio#nodes'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About', '/about'],
      ['Contact', '/contact'],
      ['Privacy', '/legal#privacy'],
      ['Terms', '/legal#terms'],
      ['Image credits', '/legal#image-credits'],
    ],
  },
]

const SOCIAL_LABELS: Record<string, string> = { linkedin: 'LinkedIn', x: 'X', github: 'GitHub', youtube: 'YouTube' }

export function Footer() {
  const socials = Object.entries(SITE.social).filter(([, url]) => url)
  return (
    <footer className="surface-dark relative overflow-hidden" style={{ background: 'radial-gradient(50% 30% at 80% 35%, rgba(56,166,162,.14), transparent 70%), linear-gradient(180deg, #dbe4e9 0px, #9fbfcc 70px, #17475b 190px, #0f2a40 320px, #0b2034 100%)' }}>
      {/* dark Silicon Jaali circuit texture, strongest behind the signature */}
      <Jaali fade="bottom" opacity={0.07} size={46} ink="#bfe3ea" className="top-[200px]" />
      <div className="container-x relative pb-10 pt-48 md:pt-56">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_2fr]">
          <div>
            <Logo tone="dark" />
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-fg-soft">
              Your complete AI infrastructure &amp; intelligence partner — from GPU compute to governed, autonomous AI workflows.
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2" aria-label="Social and contact">
              {socials.map(([k, url]) => (
                <li key={k}>
                  <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-fg-soft hover:text-fg">
                    {SOCIAL_LABELS[k] ?? k}
                  </a>
                </li>
              ))}
              <li>
                <Link to="/contact" className="text-sm font-semibold text-cyan hover:text-fg">
                  Get in touch →
                </Link>
              </li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:grid-cols-5">
            {COLS.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <p className="label text-faint">{c.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map(([label, to]) => (
                    <li key={label}>
                      <Link to={to} className="text-[14px] text-fg-soft transition-colors hover:text-fg">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-24 hidden size-[34rem] opacity-[0.07] mix-blend-luminosity lg:block [mask-image:radial-gradient(closest-side,#000_55%,transparent)]">
          <img src="/images/wafer-12in-960.webp" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
        <div aria-hidden="true" className="tri-hairline mt-20 w-48" />
        <div className="mt-8 opacity-90">
          <BrandMark tone="dark" depth={12} />
        </div>
        <div className="mt-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-[13px] font-medium tracking-[0.02em] text-muted">Build · Connect · Automate · Orchestrate</p>
          <p className="font-serif text-[15px] italic text-sandstone">Indian roots. Global technology standards.</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-[12.5px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ek भारत.AI. All rights reserved.</p>
          <p className="text-muted">
            Owned by {SITE.owner}
            <span className="hidden lg:inline"> · Wafer photo: Peellden, CC BY-SA 3.0</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
