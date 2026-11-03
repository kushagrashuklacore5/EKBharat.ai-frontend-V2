import { useEffect, useState } from 'react'
import { Bot, Languages, PackageSearch, User } from 'lucide-react'
import { DemoBadge } from '../ui/DemoBadge'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** One agent, one toolset — answering in the customer's own language. Sample content only. */
const LANGS = [
  {
    id: 'en',
    tab: 'English',
    name: 'English',
    font: 'Manrope, sans-serif',
    q: 'Where is my order A-1042? It was due yesterday.',
    a: 'Your order A-1042 was delayed at the courier hub. It is now out for delivery and should reach you by 6 pm today. I’ve sent the tracking link to your phone.',
  },
  {
    id: 'hi',
    tab: 'हिन्दी',
    name: 'Hindi · Devanagari',
    font: 'Mukta, sans-serif',
    q: 'मेरा ऑर्डर A-1042 कहाँ है? यह कल आना था।',
    a: 'आपका ऑर्डर A-1042 कूरियर हब पर देर से निकला। अब यह डिलीवरी के लिए निकल चुका है और आज शाम 6 बजे तक आप तक पहुँच जाएगा। मैंने ट्रैकिंग लिंक आपके फ़ोन पर भेज दिया है।',
  },
  {
    id: 'ta',
    tab: 'தமிழ்',
    name: 'Tamil · Tamil script',
    font: '"Noto Sans Tamil", sans-serif',
    q: 'என் ஆர்டர் A-1042 எங்கே? அது நேற்று வர வேண்டியது.',
    a: 'உங்கள் ஆர்டர் A-1042 கூரியர் மையத்தில் தாமதமானது. இப்போது அது டெலிவரிக்காக அனுப்பப்பட்டுள்ளது, இன்று மாலை 6 மணிக்குள் உங்களை வந்தடையும். கண்காணிப்பு இணைப்பை உங்கள் தொலைபேசிக்கு அனுப்பியுள்ளேன்.',
  },
  {
    id: 'bn',
    tab: 'বাংলা',
    name: 'Bengali · Bengali script',
    font: '"Noto Sans Bengali", sans-serif',
    q: 'আমার অর্ডার A-1042 কোথায়? এটা গতকাল আসার কথা ছিল।',
    a: 'আপনার অর্ডার A-1042 কুরিয়ার হাবে দেরি হয়েছিল। এখন এটি ডেলিভারির জন্য বেরিয়ে গেছে এবং আজ সন্ধ্যা ৬টার মধ্যে আপনার কাছে পৌঁছে যাবে। ট্র্যাকিং লিংক আপনার ফোনে পাঠিয়ে দিয়েছি।',
  },
] as const

export function MultilingualAgent({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto || reduced) return
    const t = window.setInterval(() => setI((v) => (v + 1) % LANGS.length), 5200)
    return () => window.clearInterval(t)
  }, [auto, reduced])
  const L = LANGS[i]
  const pick = (k: number) => {
    setAuto(false)
    setI(k)
  }

  return (
    <div className={`panel relative overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-ink-800 text-cyan">
            <Languages size={18} />
          </span>
          <div>
            <p className="text-[14.5px] font-semibold text-fg">One agent, many languages</p>
            <p className="text-[12.5px] text-muted">Same tools and rules — the reply follows the customer’s language.</p>
          </div>
        </div>
        <div role="tablist" aria-label="Customer language" className="flex flex-wrap gap-1.5">
          {LANGS.map((l, k) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              lang={l.id}
              aria-selected={k === i}
              onClick={() => pick(k)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${k === i ? 'border-fg/40 bg-ink-850 text-fg shadow-[var(--shadow-sm)]' : 'border-line text-muted hover:text-fg-soft'}`}
              style={{ fontFamily: l.font }}
            >
              {l.tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
        {/* conversation */}
        <div key={L.id} className="space-y-4 p-5 motion-safe:animate-[fade-up_.5s_ease-out] sm:p-7" role="tabpanel" aria-live="polite">
          <div className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-800 text-muted">
              <User size={15} />
            </span>
            <p lang={L.id} className="max-w-[34rem] rounded-2xl rounded-tl-sm bg-ink-800 px-4 py-3 text-[15px] leading-relaxed text-fg" style={{ fontFamily: L.font }}>
              {L.q}
            </p>
          </div>
          <div className="flex flex-row-reverse gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#17475b] text-white">
              <Bot size={15} />
            </span>
            <p lang={L.id} className="max-w-[34rem] rounded-2xl rounded-tr-sm border border-line bg-ink-850 px-4 py-3 text-[15px] leading-relaxed text-fg shadow-[var(--shadow-sm)]" style={{ fontFamily: L.font }}>
              {L.a}
            </p>
          </div>
        </div>

        {/* what the agent did */}
        <ol className="space-y-3 border-t border-line p-5 text-[13px] sm:p-7 lg:border-l lg:border-t-0">
          <li className="label text-faint">Agent steps</li>
          <li className="flex gap-3">
            <Languages size={15} className="mt-0.5 shrink-0 text-cyan" />
            <span className="text-fg-soft">
              Language detected: <strong className="font-semibold text-fg">{L.name}</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <PackageSearch size={15} className="mt-0.5 shrink-0 text-cyan" />
            <span className="text-fg-soft">
              <code className="font-mono text-[12px] text-fg">order_lookup("A-1042")</code> → delayed at hub · out for delivery · ETA 18:00
            </span>
          </li>
          <li className="flex gap-3">
            <Bot size={15} className="mt-0.5 shrink-0 text-cyan" />
            <span className="text-fg-soft">Reply drafted in the customer’s language; tracking link sent by SMS</span>
          </li>
          <li className="pt-2">
            <DemoBadge label="Demonstration · sample order and replies" />
          </li>
          <li className="text-[12px] leading-relaxed text-faint">Production deployments should have translations reviewed by native speakers.</li>
        </ol>
      </div>
    </div>
  )
}
