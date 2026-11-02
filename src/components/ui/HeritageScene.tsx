/**
 * Heritage scene painted inside the letters of भारत (an SVG <pattern> used as
 * the text fill, so it is clipped exactly by the real glyph outlines).
 *
 * Matches the approved reference: warm saffron sky in the upper half, a soft
 * white haze across the middle, a lush tree line with India Gate, and a green
 * lawn with a central avenue in the lower part.
 *
 * Drawn in a box 100 units tall and `w` units wide, scaled uniformly, so the
 * monument is never stretched.
 */
export function HeritageScene({
  id,
  x,
  y,
  width,
  height,
  pad = 30,
  gateAt = 0.42,
}: {
  id: string
  x: number
  y: number
  width: number
  height: number
  pad?: number
  gateAt?: number
}) {
  const s = height / 100
  const W = width / s
  const cx = (pad + gateAt * (width - 2 * pad)) / s
  const g = (k: string) => `${id}-${k}`
  const HORIZON = 66

  // two rows of rounded trees; the back row is lighter (aerial perspective)
  const rows = [
    { base: HORIZON - 1, step: 4.6, r: [3.6, 5.2], cols: ['#7fae74', '#8dbb80'], gap: 9 },
    { base: HORIZON + 1.5, step: 5.8, r: [4.2, 6.4], cols: ['#2f7d34', '#3d9140', '#4a9c45'], gap: 8 },
  ]
  const trees = rows.flatMap((row, ri) => {
    const out: { x: number; y: number; r: number; c: string }[] = []
    for (let tx = 1 + ri * 2.3; tx < W; tx += row.step) {
      if (Math.abs(tx - cx) < row.gap) continue
      const k = Math.sin(tx * 2.17 + ri) * 0.5 + 0.5
      const r = row.r[0] + k * (row.r[1] - row.r[0])
      out.push({ x: tx, y: row.base - r * 0.85, r, c: row.cols[Math.floor(k * row.cols.length) % row.cols.length] })
    }
    return out
  })

  return (
    <pattern id={id} patternUnits="userSpaceOnUse" x={x} y={y} width={width} height={height}>
      <defs>
        <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ef8a33" />
          <stop offset=".34" stopColor="#f5a65a" />
          <stop offset=".52" stopColor="#fadbb3" />
          <stop offset=".68" stopColor="#fff7ee" />
          <stop offset="1" stopColor="#fdf9f1" />
        </linearGradient>
        <radialGradient id={g('sun')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('lawn')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#86c25a" />
          <stop offset=".5" stopColor="#5ea83e" />
          <stop offset="1" stopColor="#3b8a31" />
        </linearGradient>
        <linearGradient id={g('stone')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b97a45" />
          <stop offset=".45" stopColor="#e3ad78" />
          <stop offset="1" stopColor="#a96c3c" />
        </linearGradient>
        <linearGradient id={g('haze')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset=".5" stopColor="#ffffff" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={`scale(${s})`}>
        {/* sky */}
        <rect width={W} height={HORIZON + 2} fill={`url(#${g('sky')})`} />
        <circle cx={cx} cy={HORIZON - 22} r="30" fill={`url(#${g('sun')})`} />
        {/* distant misty treeline */}
        <path d={`M0 ${HORIZON - 6} Q${W * 0.2} ${HORIZON - 11} ${W * 0.4} ${HORIZON - 7} T${W * 0.8} ${HORIZON - 8} T${W} ${HORIZON - 7} V${HORIZON + 2} H0Z`} fill="#b9d3b0" opacity=".7" />
        {/* soft white haze band across the middle */}
        <rect y={HORIZON - 30} width={W} height="22" fill={`url(#${g('haze')})`} />
        {/* lawn */}
        <rect y={HORIZON} width={W} height={100 - HORIZON} fill={`url(#${g('lawn')})`} />
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} y={HORIZON + 2 + i * 3.2} width={W} height="1.2" fill="#ffffff" opacity=".07" />
        ))}
        {/* central avenue */}
        <path d={`M${cx - 1.6} ${HORIZON} L${cx + 1.6} ${HORIZON} L${cx + 7} 100 L${cx - 7} 100Z`} fill="#ecd3a4" opacity=".9" />
        {/* trees */}
        {trees.map((t, i) => (
          <g key={i}>
            <rect x={t.x - 0.45} y={t.y + t.r * 0.6} width=".9" height={t.r * 0.7} fill="#5c4630" />
            <circle cx={t.x} cy={t.y} r={t.r} fill={t.c} />
            <circle cx={t.x - t.r * 0.32} cy={t.y - t.r * 0.32} r={t.r * 0.48} fill="#ffffff" opacity=".13" />
          </g>
        ))}
        {/* India Gate */}
        <g transform={`translate(${cx} ${HORIZON + 1}) scale(0.62)`}>
          <rect x="-13" y="-2.5" width="26" height="2.5" fill="#8f5a31" />
          <rect x="-11" y="-31" width="7.5" height="28.5" fill={`url(#${g('stone')})`} />
          <rect x="3.5" y="-31" width="7.5" height="28.5" fill={`url(#${g('stone')})`} />
          <path d="M-3.5 -2.5 V-20 A3.5 4 0 0 1 3.5 -20 V-2.5 Z" fill="#fff4e4" opacity=".55" />
          <rect x="-3.5" y="-31" width="7" height="7.5" fill={`url(#${g('stone')})`} />
          <rect x="-12" y="-33.2" width="24" height="2.2" fill="#d09461" />
          <rect x="-9" y="-38" width="18" height="4.8" fill={`url(#${g('stone')})`} />
          <rect x="-5.2" y="-40.6" width="10.4" height="2.6" fill="#d09461" />
          <path d="M-3.4 -40.6 Q0 -45.5 3.4 -40.6 Z" fill="#b97a45" />
          <rect x="-11" y="-31" width="1.1" height="28.5" fill="#ffe7c6" opacity=".6" />
          <rect x="3.5" y="-31" width="1.1" height="28.5" fill="#ffe7c6" opacity=".6" />
        </g>
      </g>
    </pattern>
  )
}
