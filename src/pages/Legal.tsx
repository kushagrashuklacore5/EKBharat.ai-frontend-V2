import { useEffect } from 'react'
import { Link } from 'react-router'
import { SITE } from '../lib/config'
import { IMAGES } from '../lib/imageCredits'

export default function LegalPage() {
  useEffect(() => {
    document.title = 'Legal — Ek भारत.AI'
  }, [])
  return (
    <div className="container-x max-w-3xl pb-28 pt-36 md:pt-44">
      <p className="eyebrow">Legal</p>
      <h1 className="display mt-6 text-[clamp(2.2rem,5vw,3.8rem)]">Policies</h1>
      <p className="mt-6 leading-relaxed text-fg-soft">
        Ek भारत.AI is owned by {SITE.owner}. Our formal policies are being finalised and will be published here.
      </p>
      <section id="privacy" className="mt-14 scroll-mt-28 border-t border-line pt-10">
        <h2 className="text-2xl text-fg">Privacy</h2>
        <p className="mt-4 leading-relaxed text-muted">
          This website does not include analytics or advertising trackers; web fonts are loaded from Google Fonts. Forms on this site do not transmit data unless an online submission endpoint has been
          configured; draft answers in the project brief are stored only in your own browser. For any privacy question, please{' '}
          <Link to="/contact" className="text-cyan underline-offset-4 hover:underline">
            contact us
          </Link>
          .
        </p>
      </section>
      <section id="terms" className="mt-12 scroll-mt-28 border-t border-line pt-10">
        <h2 className="text-2xl text-fg">Terms</h2>
        <p className="mt-4 leading-relaxed text-muted">
          Product demonstrations, configurations and prices shown on this website are illustrative and do not constitute an offer. Commercial terms are agreed per
          engagement in writing.
        </p>
      </section>
      <section id="image-credits" className="mt-12 scroll-mt-28 border-t border-line pt-10">
        <h2 className="text-2xl text-fg">Image credits</h2>
        <p className="mt-4 leading-relaxed text-muted">
          Photographs of third-party facilities are representative images. They do not show Ek भारत.AI premises, staff, customers or infrastructure. All other
          visuals on this site, including the 3D hardware and the patterns, are original work.
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {Object.entries(IMAGES).map(([key, img]) => (
            <li key={key} className="grid gap-1 py-4 text-[14px] sm:grid-cols-[1fr_auto] sm:gap-6">
              <div>
                <p className="text-fg">{img.caption}</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  “{img.title}” by {img.author}
                </p>
              </div>
              <p className="text-[13px] sm:text-right">
                <a href={img.licenceUrl} target="_blank" rel="noreferrer" className="text-cyan underline-offset-4 hover:underline">
                  {img.licence}
                </a>
                {' · '}
                <a href={img.source} target="_blank" rel="noreferrer" className="text-cyan underline-offset-4 hover:underline">
                  Source
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
