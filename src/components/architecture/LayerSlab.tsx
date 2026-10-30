import type { CSSProperties } from 'react'
import type { ArchitectureLayer, LayerId } from '../../lib/layers'

/** Surface artwork etched onto each slab — each one hints at what the layer does. */
export function LayerPattern({ id, color }: { id: LayerId; color: string }) {
  const s = { stroke: color, fill: 'none', strokeWidth: 1 } as const
  switch (id) {
    case 'orchestration': {
      // hub & spokes — an orchestrator delegating to agents
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2
        return [150 + Math.cos(a) * 82, 150 + Math.sin(a) * 82]
      })
      return (
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
          <circle cx="150" cy="150" r="82" {...s} strokeOpacity=".25" strokeDasharray="2 6" />
          {pts.map(([x, y], i) => (
            <g key={i}>
              <line x1="150" y1="150" x2={x} y2={y} {...s} strokeOpacity=".5" />
              <rect x={x - 9} y={y - 9} width="18" height="18" rx="4" {...s} fill={color} fillOpacity=".12" />
            </g>
          ))}
          <circle cx="150" cy="150" r="20" {...s} fill={color} fillOpacity=".25" />
          <circle cx="150" cy="150" r="34" {...s} strokeOpacity=".35" />
        </svg>
      )
    }
    case 'intelligence':
      // many model lanes converging through a gateway
      return (
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M40 ${60 + i * 30} C 120 ${60 + i * 30}, 130 150, 190 150`} {...s} strokeOpacity={i === 3 ? 0.9 : 0.35} />
          ))}
          <rect x="190" y="126" width="60" height="48" rx="8" {...s} fill={color} fillOpacity=".14" />
          <line x1="250" y1="150" x2="275" y2="150" {...s} />
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={i} cx="40" cy={60 + i * 30} r="4" fill={color} fillOpacity=".7" />
          ))}
        </svg>
      )
    case 'governance':
      // nested policy boundaries
      return (
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
          {[110, 82, 54].map((r, i) => (
            <rect key={r} x={150 - r} y={150 - r} width={r * 2} height={r * 2} rx={14 - i * 3} {...s} strokeOpacity={0.3 + i * 0.25} strokeDasharray={i === 0 ? '4 5' : undefined} />
          ))}
          <path d="M150 122 l22 9 v18 c0 14 -10 24 -22 29 c-12 -5 -22 -15 -22 -29 v-18z" {...s} fill={color} fillOpacity=".18" />
          <path d="M140 150 l7 7 l14 -14" {...s} />
        </svg>
      )
    case 'knowledge':
      // clustered embeddings with a retrieval radius
      return (
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
          {Array.from({ length: 64 }, (_, i) => {
            const x = 40 + (i % 8) * 31
            const y = 40 + Math.floor(i / 8) * 31
            const near = Math.hypot(x - 165, y - 135) < 60
            return <circle key={i} cx={x} cy={y} r={near ? 4 : 2.2} fill={color} fillOpacity={near ? 0.9 : 0.3} />
          })}
          <circle cx="165" cy="135" r="60" {...s} strokeOpacity=".7" strokeDasharray="3 4" />
          <circle cx="165" cy="135" r="6" fill={color} />
        </svg>
      )
    case 'data':
      // streams from fragmented sources merged into a clean pipe
      return (
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
          {[50, 110, 190, 250].map((y, i) => (
            <g key={y}>
              <rect x="28" y={y - 12} width="34" height="24" rx="5" {...s} fill={color} fillOpacity=".12" />
              <path d={`M62 ${y} C 140 ${y}, 140 150, 200 150`} {...s} strokeOpacity={0.4 + i * 0.1} />
            </g>
          ))}
          <path d="M200 150 H272" {...s} strokeWidth="6" strokeOpacity=".35" />
          <path d="M200 150 H272" {...s} strokeWidth="1.5" />
        </svg>
      )
    case 'compute':
      // accelerator die grid
      return (
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
          <rect x="60" y="60" width="180" height="180" rx="10" {...s} strokeOpacity=".6" />
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={74 + (i % 4) * 40} y={74 + Math.floor(i / 4) * 40} width="32" height="32" rx="3" {...s} fill={color} fillOpacity={i % 5 === 0 ? 0.32 : 0.08} strokeOpacity=".5" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i} strokeOpacity=".4">
              <line x1={78 + i * 18} y1="60" x2={78 + i * 18} y2="44" {...s} />
              <line x1={78 + i * 18} y1="240" x2={78 + i * 18} y2="256" {...s} />
              <line x1="60" y1={78 + i * 18} x2="44" y2={78 + i * 18} {...s} />
              <line x1="240" y1={78 + i * 18} x2="256" y2={78 + i * 18} {...s} />
            </g>
          ))}
        </svg>
      )
  }
}

interface SlabProps {
  layer: ArchitectureLayer
  size: number
  depth?: number
  state?: 'idle' | 'active' | 'dim'
  className?: string
  style?: CSSProperties
  faceStyle?: CSSProperties
  showLabel?: boolean
}

/**
 * One extruded architectural slab. It lives inside a `preserve-3d` parent.
 * Opacity / filters are applied per face (never on the 3D container) so the
 * extrusion is not flattened by the browser.
 */
export function LayerSlab({ layer, size, depth = 14, state = 'idle', className = '', style, faceStyle, showLabel = true }: SlabProps) {
  const active = state === 'active'
  const dim = state === 'dim'
  const faceFx: CSSProperties = {
    opacity: `calc(var(--fade, 1) * ${dim ? 0.3 : 1})` as unknown as number,
    filter: dim ? 'blur(1.2px) saturate(.6)' : 'none',
    transition: 'opacity .5s, filter .5s',
  }
  return (
    <div className={`absolute left-0 top-0 [transform-style:preserve-3d] ${className}`} style={{ width: size, height: size, ...style }}>
      {/* top surface — porcelain with a tinted wash */}
      <div
        className="absolute inset-0 overflow-hidden rounded-[12px]"
        style={{
          ...faceFx,
          background: `linear-gradient(140deg, #ffffff 0%, #f7f9fb 45%, ${layer.accent}${active ? '2e' : '14'} 100%)`,
          border: `1px solid ${active ? layer.accent : 'rgba(24,43,61,.12)'}`,
          boxShadow: active
            ? `0 0 0 3px ${layer.accent}22, 0 40px 60px -30px ${layer.accent}88`
            : '0 30px 50px -34px rgba(24,43,61,.45)',
          transition: 'opacity .5s, filter .5s, border-color .4s, box-shadow .5s',
          ...faceStyle,
        }}
      >
        <div className="grid-bg absolute inset-0" />
        <div className="absolute inset-[6%]" style={{ opacity: active ? 1 : 0.62, transition: 'opacity .4s' }}>
          <LayerPattern id={layer.id} color={layer.accent} />
        </div>
        {showLabel && (
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-[11px] font-bold" style={{ color: layer.accent }}>
            <span className="font-mono">{layer.index}</span>
            <span className="text-right">{layer.short}</span>
          </div>
        )}
      </div>
      {/* extruded edges (visible sides for the isometric view) */}
      <div
        className="absolute bottom-0 left-[8px] right-[8px] origin-bottom"
        style={{
          ...faceFx,
          height: depth,
          transform: 'rotateX(90deg)',
          background: `linear-gradient(180deg, ${active ? layer.accent : '#c9d5df'}, ${active ? layer.accent + 'aa' : '#aebdcb'})`,
        }}
      />
      <div
        className="absolute bottom-[8px] left-0 top-[8px] origin-left"
        style={{
          ...faceFx,
          width: depth,
          transform: 'rotateY(90deg)',
          background: `linear-gradient(90deg, ${active ? layer.accent + 'cc' : '#b8c6d3'}, ${active ? layer.accent : '#d5dee6'})`,
        }}
      />
    </div>
  )
}
