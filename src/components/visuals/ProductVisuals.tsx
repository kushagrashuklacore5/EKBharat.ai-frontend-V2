import { useReducedMotion } from '../../hooks/useReducedMotion'
import { IsoShadow, Plane, Slab, VisualDefs } from './iso'

/*  Purpose-built product visuals. Each is an isometric scene: flat diagrams
    drawn on planes stacked in depth. Motion explains the product (data flow,
    routing, delegation) and is disabled for reduced-motion users.          */

const ICE = '#9ad5e5'
const TEAL = '#5cc3be'
const CHAMP = '#d5b68a'
const AMBER = '#e2a86b'
const LIGHT = '#eaf2f5'

function Frame({ children, label, className = '', vb = '0 0 520 400' }: { children: React.ReactNode; label: string; className?: string; vb?: string }) {
  return (
    <svg viewBox={vb} className={`h-auto w-full overflow-visible ${className}`} role="img" aria-label={label}>
      <VisualDefs />
      {children}
    </svg>
  )
}

/* ───────────────── A · Workflow Studio: a floating dark canvas ───────────────── */
export function WorkflowVisual() {
  const anim = !useReducedMotion()
  const O = { ox: 250, oy: 60 }
  const nodes = [
    { x: 14, y: 22, c: CHAMP, t: 'Trigger' },
    { x: 104, y: 22, c: TEAL, t: 'Agent' },
    { x: 194, y: 22, c: ICE, t: 'LLM' },
    { x: 104, y: 104, c: '#7fa7d9', t: 'Database' },
    { x: 194, y: 104, c: AMBER, t: 'Approval' },
    { x: 150, y: 176, c: LIGHT, t: 'Action' },
  ]
  const edges = ['M84 39 H104', 'M174 39 H194', 'M139 56 V104', 'M229 56 V104', 'M139 138 C139 160 170 160 185 176', 'M229 138 C229 160 210 160 205 176']
  return (
    <Frame label="Workflow Studio canvas with connected agent, model, database, approval and action nodes">
      <IsoShadow cx={260} cy={300} rx={190} ry={44} />
      <Slab {...O} x={0} y={0} w={290} h={226} t={12} r={14} top="#0f2a40" side="#071827">
        <rect x={0} y={0} width={290} height={226} rx={14} fill="url(#v-dots)" />
        {edges.map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke={ICE} strokeOpacity=".35" strokeWidth="2" />
            {anim && (
              <circle r="3.2" fill={i % 2 ? TEAL : ICE}>
                <animateMotion dur={`${1.6 + (i % 3) * 0.3}s`} repeatCount="indefinite" path={d} begin={`${i * 0.25}s`} />
              </circle>
            )}
          </g>
        ))}
        {nodes.map((n) => (
          <rect key={n.t + 's'} x={n.x + 4} y={n.y + 6} width={70} height={34} rx={7} fill="#000" opacity=".35" />
        ))}
      </Slab>
      {/* raised node cards */}
      {nodes.map((n, i) => (
        <g key={n.t} className={anim ? 'v-float' : ''} style={{ animationDelay: `${i * 0.35}s` }}>
        <Plane {...O} z={30}>
          <rect x={n.x} y={n.y} width={70} height={34} rx={7} fill="#f2f6f8" />
          <rect x={n.x} y={n.y} width={6} height={34} rx={3} fill={n.c} />
          <circle cx={n.x + 17} cy={n.y + 17} r={6.5} fill={n.c} />
          <text x={n.x + 28} y={n.y + 15} fontSize="8.5" fontWeight="700" fill="#102a40" fontFamily="Manrope">
            {n.t}
          </text>
          <rect x={n.x + 28} y={n.y + 20} width={30} height={3} rx={1.5} fill="#102a40" opacity=".2" />
        </Plane>
        </g>
      ))}
      {/* run chip */}
      <g transform="translate(372 64)">
        <rect width="104" height="32" rx="8" fill="#f2f6f8" />
        <circle cx="16" cy="16" r="5" fill={TEAL}>
          {anim && <animate attributeName="opacity" values="1;.35;1" dur="1.4s" repeatCount="indefinite" />}
        </circle>
        <text x="28" y="20" fontSize="11" fontWeight="700" fill="#102a40" fontFamily="Manrope">
          Running · 4/6
        </text>
      </g>
    </Frame>
  )
}

/* ───────────────── B · AI Agents: orchestrator + specialists ───────────────── */
export function AgentsVisual() {
  const anim = !useReducedMotion()
  const O = { ox: 260, oy: 150 }
  const c = { x: 0, y: 0 }
  const agents = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    return { x: Math.cos(a) * 118, y: Math.sin(a) * 118, col: [ICE, TEAL, CHAMP, '#7fa7d9', AMBER][i], name: ['Research', 'Analysis', 'Verify', 'Tools', 'Report'][i] }
  })
  return (
    <Frame label="An orchestrator agent connected to five specialised agents" vb="85 30 350 285">
      <IsoShadow cx={260} cy={250} rx={200} ry={60} opacity={0.35} />
      <Plane {...O}>
        {[70, 118, 150].map((r, i) => (
          <circle key={r} cx={0} cy={0} r={r} fill="none" stroke={ICE} strokeOpacity={0.12 + i * 0.05} strokeDasharray={i === 1 ? '3 6' : undefined} />
        ))}
        {agents.map((a, i) => (
          <g key={i}>
            <line x1={c.x} y1={c.y} x2={a.x} y2={a.y} stroke={a.col} strokeOpacity=".45" strokeWidth="1.6" />
            {anim && (
              <circle r="3.4" fill={a.col}>
                <animateMotion dur="2.2s" begin={`${i * 0.44}s`} repeatCount="indefinite" path={`M0 0 L${a.x} ${a.y}`} keyPoints={i % 2 ? '0;1' : '1;0'} keyTimes="0;1" />
              </circle>
            )}
          </g>
        ))}
      </Plane>
      {/* specialist modules */}
      {agents.map((a, i) => (
        <g key={a.name} className={anim ? 'v-float' : ''} style={{ animationDelay: `${i * 0.4}s` }}>
          <Slab {...O} z={8} x={a.x - 22} y={a.y - 22} w={44} h={44} t={10} r={10} top="#18405a" side="#0a2236">
            <rect x={a.x - 14} y={a.y - 14} width={28} height={28} rx={8} fill={a.col} opacity=".9" />
            <circle cx={a.x + 15} cy={a.y - 15} r={3.5} fill={i === 2 ? CHAMP : '#8cc39b'}>
              {anim && <animate attributeName="opacity" values="1;.2;1" dur={`${1.2 + i * 0.2}s`} repeatCount="indefinite" />}
            </circle>
          </Slab>
        </g>
      ))}
      {/* orchestrator core — a stepped column */}
      {[0, 1, 2, 3].map((k) => (
        <Slab key={k} {...O} z={10 + k * 16} x={-40 + k * 4} y={-40 + k * 4} w={80 - k * 8} h={80 - k * 8} t={12} r={22 - k * 3} top={k === 3 ? '#e9f1f4' : k % 2 ? '#1f5a70' : '#15334c'} side="#0a2236">
          {k === 3 && (
            <>
              <circle cx={0} cy={0} r={14} fill={TEAL} />
              <circle cx={0} cy={0} r={22} fill="none" stroke={TEAL} strokeOpacity=".5">
                {anim && <animate attributeName="r" values="18;30;18" dur="2.4s" repeatCount="indefinite" />}
              </circle>
            </>
          )}
        </Slab>
      ))}
      {agents.map((a, i) => {
        const sx = 260 + (a.x - a.y) * 0.866
        const sy = 150 + (a.x + a.y) * 0.5 - 52
        return (
          <text key={i} x={sx} y={sy} textAnchor="middle" fontSize="11" fontWeight="700" fill="#cfe2ea" fontFamily="Manrope">
            {a.name}
          </text>
        )
      })}
    </Frame>
  )
}

/* ───────────────── C · GPU Cloud: stacked accelerator boards ───────────────── */
export function GpuVisual() {
  const anim = !useReducedMotion()
  const O = { ox: 260, oy: 150 }
  return (
    <Frame label="A stack of GPU accelerator boards with data flowing between them" vb="60 -10 400 330">
      <IsoShadow cx={260} cy={290} rx={185} ry={48} />
      {/* pedestal */}
      <Slab {...O} z={-10} x={-120} y={-90} w={240} h={180} t={14} r={18} top="#163a52" side="#081a2b" />
      {[0, 1, 2, 3].map((k) => (
        <Slab key={k} {...O} z={14 + k * 44} x={-100} y={-74} w={200} h={148} t={9} r={10} top={k === 3 ? '#eaf2f5' : '#1b4760'} side="url(#v-metal)" stroke="rgba(255,255,255,.25)">
          {/* heatsink fins */}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={-88 + i * 9} y1={-62} x2={-88 + i * 9} y2={62} stroke={k === 3 ? '#9fb6c4' : '#2d6680'} strokeWidth="2.4" strokeLinecap="round" />
          ))}
          {/* die */}
          <rect x={10} y={-34} width={68} height={68} rx={8} fill={k === 3 ? '#102a40' : '#0e2b3e'} />
          <rect x={22} y={-22} width={44} height={44} rx={5} fill={k === 3 ? TEAL : '#2a8784'} opacity={k === 3 ? 1 : 0.7}>
            {anim && <animate attributeName="opacity" values=".55;1;.55" dur="2s" begin={`${k * 0.3}s`} repeatCount="indefinite" />}
          </rect>
          {/* champagne edge connector */}
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={-90 + i * 12} y={66} width={7} height={5} rx={1} fill={CHAMP} />
          ))}
        </Slab>
      ))}
      {/* data lanes rising through the stack */}
      {[-40, 0, 40].map((dx, i) => (
        <g key={dx}>
          <line x1={330 + dx} y1={250} x2={330 + dx} y2={110} stroke={ICE} strokeOpacity=".25" strokeDasharray="2 5" />
          {anim && (
            <circle cx={330 + dx} r="3.2" fill={i === 1 ? CHAMP : ICE}>
              <animate attributeName="cy" values="250;110" dur={`${1.8 + i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;1;0" dur={`${1.8 + i * 0.4}s`} repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}
    </Frame>
  )
}

/* ───────────────── D · Multi-model orchestration: a routing core ───────────────── */
export function RouterVisual() {
  const anim = !useReducedMotion()
  const O = { ox: 260, oy: 150 }
  const models = [
    { x: -128, y: -52, t: 'Reasoning', c: ICE },
    { x: 48, y: -128, t: 'Fast', c: TEAL },
    { x: 80, y: 48, t: 'Code', c: '#7fa7d9' },
    { x: -52, y: 84, t: 'Open-weight', c: CHAMP },
  ]
  const n = models.length
  return (
    <Frame label="A routing core distributing requests to four model types" vb="60 0 400 300">
      <IsoShadow cx={260} cy={270} rx={210} ry={60} opacity={0.35} />
      <Plane {...O}>
        {/* incoming request */}
        <path d="M40 190 L22 40" stroke={CHAMP} strokeOpacity=".5" strokeWidth="2" strokeDasharray="4 5" />
        {anim && (
          <circle r="4" fill={CHAMP}>
            <animateMotion dur="1.6s" repeatCount="indefinite" path="M40 190 L22 40" />
          </circle>
        )}
        {models.map((m, i) => {
          const d = `M0 0 L${m.x + 30} ${m.y + 22}`
          const begin = `${i * 1.2}s`
          return (
            <g key={m.t}>
              <path d={d} stroke={m.c} strokeWidth="2.5" strokeOpacity=".18" />
              {anim ? (
                <path d={d} stroke={m.c} strokeWidth="2.5" strokeOpacity="0">
                  <animate attributeName="stroke-opacity" values="0;.95;.95;0;0" keyTimes="0;.05;.22;.27;1" dur={`${n * 1.2}s`} begin={begin} repeatCount="indefinite" />
                </path>
              ) : (
                i === 0 && <path d={d} stroke={m.c} strokeWidth="2.5" />
              )}
              {anim && (
                <circle r="3.6" fill={m.c} opacity="0">
                  <animateMotion dur={`${n * 1.2}s`} begin={begin} repeatCount="indefinite" path={d} keyPoints="0;1;1" keyTimes="0;.22;1" calcMode="linear" />
                  <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.03;.2;.24;1" dur={`${n * 1.2}s`} begin={begin} repeatCount="indefinite" />
                </circle>
              )}
            </g>
          )
        })}
      </Plane>
      {models.map((m, i) => (
        <g key={m.t} className={anim ? 'v-float' : ''} style={{ animationDelay: `${i * 0.5}s` }}>
          <Slab {...O} z={6} x={m.x} y={m.y} w={60} h={44} t={10} r={9} top="#18405a" side="#0a2236">
            <rect x={m.x + 8} y={m.y + 8} width={44} height={6} rx={3} fill={m.c} />
            <rect x={m.x + 8} y={m.y + 19} width={30} height={4} rx={2} fill={LIGHT} opacity=".35" />
            <rect x={m.x + 8} y={m.y + 28} width={36} height={4} rx={2} fill={LIGHT} opacity=".2" />
          </Slab>
        </g>
      ))}
      {/* routing core */}
      {[0, 1, 2].map((k) => (
        <Slab key={k} {...O} z={8 + k * 14} x={-36 + k * 6} y={-36 + k * 6} w={72 - k * 12} h={72 - k * 12} t={11} r={36 - k * 6} top={k === 2 ? '#eaf2f5' : '#1f5a70'} side="#0a2236">
          {k === 2 && <circle cx={0} cy={0} r={10} fill={TEAL} />}
        </Slab>
      ))}
      {models.map((m) => {
        const px = m.x + 30
        const py = m.y + 22
        return (
          <text key={m.t} x={260 + (px - py) * 0.866} y={150 + (px + py) * 0.5 - 40} textAnchor="middle" fontSize="11" fontWeight="700" fill="#cfe2ea" fontFamily="Manrope">
            {m.t}
          </text>
        )
      })}
    </Frame>
  )
}

/* ───────────────── E · Custom AI: application panels assembling ───────────────── */
export function AssemblyVisual() {
  const anim = !useReducedMotion()
  const O = { ox: 250, oy: 120 }
  return (
    <Frame label="Interface, data and integration panels assembling into one AI application" vb="50 -40 420 370">
      <IsoShadow cx={260} cy={300} rx={180} ry={46} />
      {/* base: deployment plate */}
      <Slab {...O} z={0} x={-30} y={-10} w={250} h={190} t={10} r={14} top="#15334c" side="#081a2b">
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx={-6 + i * 52} cy={168} r={4} fill={i === 2 ? CHAMP : TEAL} opacity=".8" />
        ))}
      </Slab>
      {/* data panel */}
      <g className={anim ? 'v-assemble' : ''} style={{ animationDelay: '0s' }}>
        <Slab {...O} z={44} x={-10} y={10} w={200} h={140} t={6} r={10} top="#1f5a70" side="#0e2b3e">
          {Array.from({ length: 5 }, (_, i) => (
            <g key={i}>
              <rect x={6} y={26 + i * 22} width={60} height={8} rx={3} fill={LIGHT} opacity=".35" />
              <rect x={76} y={26 + i * 22} width={96} height={8} rx={3} fill={ICE} opacity={0.25 + (i % 3) * 0.2} />
            </g>
          ))}
        </Slab>
      </g>
      {/* chat / UI panel */}
      <g className={anim ? 'v-assemble' : ''} style={{ animationDelay: '.25s' }}>
        <Slab {...O} z={92} x={10} y={30} w={170} h={110} t={6} r={10} top="#eaf2f5" side="#9fb6c4" stroke="rgba(255,255,255,.6)">
          <rect x={22} y={44} width={90} height={18} rx={9} fill="#c9dce4" />
          <rect x={70} y={70} width={96} height={18} rx={9} fill={TEAL} />
          <rect x={22} y={96} width={110} height={18} rx={9} fill="#c9dce4" />
          <circle cx={160} cy={46} r={6} fill={CHAMP} />
        </Slab>
      </g>
      {/* integration chip */}
      <g className={anim ? 'v-assemble' : ''} style={{ animationDelay: '.5s' }}>
        <Slab {...O} z={130} x={150} y={-20} w={60} h={50} t={8} r={10} top={CHAMP} side="#9a7c4f">
          <path d="M165 -5 h30 M165 5 h20 M165 15 h26" stroke="#102a40" strokeWidth="3" strokeLinecap="round" />
        </Slab>
      </g>
      {/* connectors */}
      {[[380, 140, 380, 250], [150, 120, 150, 240]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ICE} strokeOpacity=".3" strokeDasharray="3 5" />
      ))}
    </Frame>
  )
}

/* ───────────────── F · Enterprise solutions: layered intelligence system ───────────────── */
export function EnterpriseVisual() {
  const anim = !useReducedMotion()
  const O = { ox: 260, oy: 140 }
  const tiers = [
    { z: 0, top: '#15334c', label: 'Infrastructure', c: '#7fa7d9' },
    { z: 58, top: '#1f5a70', label: 'Knowledge', c: TEAL },
    { z: 116, top: '#eaf2f5', label: 'Applications', c: CHAMP },
  ]
  return (
    <Frame label="Enterprise AI system in three tiers: infrastructure, knowledge and applications" vb="40 -30 440 360">
      <IsoShadow cx={260} cy={300} rx={190} ry={50} />
      {tiers.map((t, k) => (
        <g key={t.label} className={anim ? 'v-float' : ''} style={{ animationDelay: `${k * 0.6}s` }}>
          <Slab {...O} z={t.z} x={-110} y={-80} w={220} h={160} t={10} r={14} top={t.top} side="#0a2236" stroke="rgba(255,255,255,.2)">
            {k === 0 &&
              Array.from({ length: 12 }, (_, i) => (
                <rect key={i} x={-96 + (i % 4) * 50} y={-66 + Math.floor(i / 4) * 46} width={40} height={36} rx={5} fill="#1f5a70" stroke={i === 5 ? ICE : 'none'} />
              ))}
            {k === 1 &&
              Array.from({ length: 30 }, (_, i) => {
                const x = -92 + (i % 6) * 36
                const y = -60 + Math.floor(i / 6) * 28
                const near = Math.hypot(x - 10, y + 6) < 52
                return <circle key={i} cx={x} cy={y} r={near ? 5 : 3} fill={near ? TEAL : ICE} opacity={near ? 1 : 0.35} />
              })}
            {k === 2 &&
              [0, 1, 2].map((i) => (
                <g key={i}>
                  <rect x={-96 + i * 66} y={-62} width={58} height={110} rx={8} fill="#ffffff" stroke="#c9dce4" />
                  <rect x={-90 + i * 66} y={-54} width={46} height={8} rx={4} fill={[TEAL, '#1f5a70', CHAMP][i]} />
                  <rect x={-90 + i * 66} y={-38} width={40} height={4} rx={2} fill="#9fb6c4" />
                  <rect x={-90 + i * 66} y={-30} width={30} height={4} rx={2} fill="#9fb6c4" />
                </g>
              ))}
          </Slab>
        </g>
      ))}
      {/* vertical links */}
      {[200, 320].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={265} x2={x} y2={95} stroke={ICE} strokeOpacity=".3" strokeDasharray="2 5" />
          {anim && (
            <circle cx={x} r="3.2" fill={i ? CHAMP : ICE}>
              <animate attributeName="cy" values="265;95" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}
      {tiers.map((t, k) => (
        <text key={t.label} x={455} y={262 - k * 58} textAnchor="end" fontSize="11.5" fontWeight="700" fill="#cfe2ea" fontFamily="Manrope">
          {t.label}
        </text>
      ))}
    </Frame>
  )
}

export const PRODUCT_VISUALS = {
  workflow: WorkflowVisual,
  agents: AgentsVisual,
  gpu: GpuVisual,
  router: RouterVisual,
  custom: AssemblyVisual,
  enterprise: EnterpriseVisual,
}
export type VisualKind = keyof typeof PRODUCT_VISUALS
