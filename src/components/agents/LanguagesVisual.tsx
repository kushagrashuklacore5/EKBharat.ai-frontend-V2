import { Jaali } from '../ui/Jaali'

/**
 * Original illustration (not a photograph): customer messages in several Indian
 * languages and scripts converge on one agent, which answers each in kind.
 */
const MSGS = [
  { t: 'मेरा ऑर्डर कहाँ है?', lang: 'hi', font: 'Mukta, sans-serif', x: 6, y: 10 },
  { t: 'என் ஆர்டர் எங்கே?', lang: 'ta', font: '"Noto Sans Tamil", sans-serif', x: 3, y: 36 },
  { t: 'আমার অর্ডার কোথায়?', lang: 'bn', font: '"Noto Sans Bengali", sans-serif', x: 8, y: 62 },
  { t: 'Where is my order?', lang: 'en', font: 'Manrope, sans-serif', x: 12, y: 84 },
]
const SCRIPTS = ['अ', 'அ', 'অ', 'A', 'ಅ', 'అ', 'ਅ', 'ଅ']

export function LanguagesVisual({ className = '' }: { className?: string }) {
  return (
    <figure className={className}>
      <div className="deep-card surface-dark stepwell relative aspect-[4/3] overflow-hidden rounded-[14px]">
        <Jaali fade="radial" opacity={0.06} size={36} ink="#bfe3ea" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(40%_50%_at_74%_50%,rgba(92,195,190,.22),transparent_70%)]" />

        {/* connecting paths from each message to the agent */}
        <svg aria-hidden="true" viewBox="0 0 400 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {MSGS.map((m, i) => {
            const y = 300 * (m.y / 100) + 14
            const d = `M${400 * (m.x / 100) + 70} ${y} C 230 ${y}, 240 150, 292 150`
            return (
              <g key={m.lang}>
                <path d={d} fill="none" stroke="#9ad5e5" strokeOpacity="0.25" strokeWidth="1" />
                <path d={d} fill="none" stroke={i === 2 ? '#e8913a' : '#5cc3be'} strokeWidth="2" strokeLinecap="round" className="tri-flow" style={{ animationDelay: `${-i * 1.4}s` }} />
              </g>
            )
          })}
        </svg>

        {/* incoming messages */}
        {MSGS.map((m) => (
          <p
            key={m.lang}
            lang={m.lang}
            className="absolute rounded-xl rounded-bl-sm bg-[#eaf1f4] px-3 py-1.5 text-[clamp(10px,2.6vw,13px)] font-semibold text-[#17475b] shadow-[0_8px_18px_-10px_rgba(0,0,0,.6)]"
            style={{ left: `${m.x}%`, top: `${m.y}%`, fontFamily: m.font }}
          >
            {m.t}
          </p>
        ))}

        {/* the agent */}
        <div className="absolute right-[8%] top-1/2 grid size-[26%] -translate-y-1/2 place-items-center">
          <div className="absolute inset-0 rounded-full border border-[#9ad5e5]/30" />
          <div className="absolute inset-[14%] rounded-full border border-dashed border-[#9ad5e5]/40 [animation:chakra-spin_40s_linear_infinite] motion-reduce:animate-none" />
          {/* orbiting script glyphs */}
          {SCRIPTS.map((g, i) => {
            const a = (i / SCRIPTS.length) * Math.PI * 2
            return (
              <span
                key={g}
                aria-hidden="true"
                className="absolute text-[clamp(9px,2vw,12px)] font-semibold text-[#9ad5e5]/80"
                style={{ left: `${50 + Math.cos(a) * 46}%`, top: `${50 + Math.sin(a) * 46}%`, transform: 'translate(-50%,-50%)', fontFamily: 'Mukta, "Noto Sans Tamil", "Noto Sans Bengali", sans-serif' }}
              >
                {g}
              </span>
            )
          })}
          <div className="relative grid size-[52%] place-items-center rounded-2xl bg-[#17475b] shadow-[0_0_0_6px_rgba(92,195,190,.15),0_14px_30px_-12px_rgba(0,0,0,.7)]">
            <span className="text-center font-mono text-[clamp(8px,1.7vw,11px)] font-semibold leading-tight text-white">
              AI
              <br />
              agent
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="tri-hairline absolute bottom-4 left-5 w-20" />
      </div>
    </figure>
  )
}
