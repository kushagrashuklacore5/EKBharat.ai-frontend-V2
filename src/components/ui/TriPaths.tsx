/**
 * Three thin data paths — saffron, white and green — routed like PCB traces
 * (orthogonal runs with 45° bends) with a small packet travelling along each.
 * Purely decorative; static when reduced motion is requested.
 */
const PATHS = [
  { d: 'M-20 470 H260 L330 400 H620 L690 330 H1240', c: '#e8913a', delay: '0s' },
  { d: 'M-20 500 H300 L370 430 H660 L730 360 H1240', c: '#f6f3ea', delay: '-2s', halo: true },
  { d: 'M-20 530 H340 L410 460 H700 L770 390 H1240', c: '#2f8f53', delay: '-4s' },
]

export function TriPaths({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`pointer-events-none ${className}`} viewBox="0 0 1220 600" preserveAspectRatio="xMidYMid slice" fill="none">
      {PATHS.map((p) => (
        <g key={p.c}>
          {/* the white path gets a faint dark halo so it reads on the light surface */}
          {p.halo && <path d={p.d} stroke="rgb(23 46 66 / 0.18)" strokeWidth="3" />}
          <path d={p.d} stroke={p.c} strokeWidth="1.2" opacity="0.55" />
          <path d={p.d} stroke={p.c} strokeWidth="2.6" strokeLinecap="round" className="tri-flow" style={{ animationDelay: p.delay }} />
        </g>
      ))}
      {/* via pads at the bends */}
      {[
        [330, 400], [690, 330], [370, 430], [730, 360], [410, 460], [770, 390],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill="#e9eef1" stroke="rgb(23 46 66 / 0.35)" strokeWidth="1" />
      ))}
    </svg>
  )
}
