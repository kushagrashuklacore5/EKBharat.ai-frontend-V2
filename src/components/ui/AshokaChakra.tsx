/**
 * Ashoka Chakra — 24 evenly spaced spokes, traditional navy blue.
 * Drawn around (0, 0) with radius `r`, for use inside another SVG.
 */
export function AshokaChakra({ r, color = '#0b2a78', spin = true }: { r: number; color?: string; spin?: boolean }) {
  const ring = r * 0.085
  const inner = r - ring * 0.5
  const hub = r * 0.16
  const spokes = Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2)
  return (
    <g className={spin ? 'chakra-spin' : undefined}>
      {/* outer rim */}
      <circle r={r - ring / 2} fill="none" stroke={color} strokeWidth={ring} />
      {/* spokes: slim, tapered toward the rim, widest a third of the way out */}
      {spokes.map((a) => {
        const s = r * 0.045
        const mid = inner * 0.32
        const pts = [
          [hub * 0.9, 0],
          [mid, -s],
          [inner, 0],
          [mid, s],
        ]
          .map(([x, y]) => `${(x * Math.cos(a) - y * Math.sin(a)).toFixed(2)},${(x * Math.sin(a) + y * Math.cos(a)).toFixed(2)}`)
          .join(' ')
        return <polygon key={a} points={pts} fill={color} />
      })}
      {/* small scallops on the rim between spokes */}
      {spokes.map((a) => {
        const b = a + Math.PI / 24
        return <circle key={`d${a}`} cx={(inner - ring * 0.25) * Math.cos(b)} cy={(inner - ring * 0.25) * Math.sin(b)} r={r * 0.028} fill={color} />
      })}
      {/* hub */}
      <circle r={hub} fill={color} />
      <circle r={hub * 0.45} fill="#ffffff" fillOpacity={0.9} />
    </g>
  )
}
