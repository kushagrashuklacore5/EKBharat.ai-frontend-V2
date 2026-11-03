import { useMemo, useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { DemoBadge } from '../ui/DemoBadge'

type Pool = 'frontier' | 'compact' | 'code' | 'open'
type Task = 'classify' | 'reason' | 'code' | 'sensitive'
type Policy = 'quality' | 'balanced' | 'cost' | 'latency'

const POOLS: Record<Pool, { name: string; via: string; color: string; q: number; s: number; c: number }> = {
  frontier: { name: 'Large reasoning model', via: 'Hosted provider A', color: '#2c64a0', q: 4, s: 2, c: 1 },
  compact: { name: 'Fast compact model', via: 'Hosted provider B', color: '#2f7fa8', q: 2, s: 4, c: 4 },
  code: { name: 'Code-specialised model', via: 'Hosted provider C', color: '#5867a8', q: 3, s: 3, c: 3 },
  open: { name: 'Open-weight model', via: 'Self-hosted · GPU Cloud', color: '#2e8d81', q: 3, s: 3, c: 3 },
}

const TASKS: { id: Task; label: string; example: string }[] = [
  { id: 'classify', label: 'Classify a ticket', example: '“Route this support email to the right team.”' },
  { id: 'reason', label: 'Analyse a contract', example: '“Summarise obligations and risks in this agreement.”' },
  { id: 'code', label: 'Generate SQL', example: '“Write a query for monthly revenue by region.”' },
  { id: 'sensitive', label: 'Summarise patient notes', example: '“Summarise this discharge note for the care team.”' },
]

const POLICIES: { id: Policy; label: string }[] = [
  { id: 'quality', label: 'Quality first' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'cost', label: 'Cost first' },
  { id: 'latency', label: 'Latency first' },
]

function decide(task: Task, policy: Policy): { primary: Pool; fallback: Pool; why: string } {
  if (task === 'sensitive')
    return { primary: 'open', fallback: 'open', why: 'A data-handling rule restricts this request to models running in an approved, self-hosted environment — regardless of the cost or speed preference. Fallback is a second replica of the same deployment.' }
  if (task === 'classify') {
    if (policy === 'quality') return { primary: 'frontier', fallback: 'compact', why: 'Quality-first sends even simple labelling to the strongest model; the compact model is the fallback.' }
    return { primary: 'compact', fallback: 'open', why: 'Classification is a short, well-defined task — a fast compact model is usually sufficient and far cheaper per request.' }
  }
  if (task === 'code') {
    if (policy === 'cost' || policy === 'latency') return { primary: 'compact', fallback: 'code', why: 'For cost or speed, a compact model drafts the query; output is validated, and the code model takes over if validation fails.' }
    return { primary: 'code', fallback: 'frontier', why: 'A code-specialised model is selected for structured query generation; the reasoning model is the fallback.' }
  }
  if (policy === 'cost') return { primary: 'open', fallback: 'frontier', why: 'Cost-first routes long documents to the self-hosted open-weight model, keeping the larger hosted model as fallback.' }
  if (policy === 'latency') return { primary: 'compact', fallback: 'frontier', why: 'Latency-first favours the fastest model; complex outputs that fail validation escalate to the reasoning model.' }
  return { primary: 'frontier', fallback: 'open', why: 'Multi-step legal reasoning benefits from the strongest model; the open-weight model is the fallback.' }
}

const POOL_ORDER: Pool[] = ['frontier', 'compact', 'code', 'open']
const PY = [70, 160, 250, 340]

/**
 * Radial view of the same routing decision. Geometry borrows the 24 evenly
 * spaced spokes of a chakra as an engineering grid: the policy engine is the
 * hub, each model pool sits on a spoke, and the chosen route lights up.
 */
const SPOKE: Record<Pool, number> = { frontier: -60, compact: -20, code: 20, open: 60 }
function RadialRoute({ served, failed, color, policy }: { served: Pool; failed: Pool | null; color: string; policy: string }) {
  const cx = 300
  const cy = 300
  const pt = (deg: number, r: number) => [cx + Math.cos((deg * Math.PI) / 180) * r, cy + Math.sin((deg * Math.PI) / 180) * r] as const
  return (
    <svg viewBox="0 0 760 600" className="w-full" role="img" aria-label={`Request routed to ${POOLS[served].name}`}>
      {/* 24-spoke grid */}
      {Array.from({ length: 24 }, (_, i) => {
        const [x1, y1] = pt(i * 15, 66)
        const [x2, y2] = pt(i * 15, 250)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(24,43,61,.07)" />
      })}
      <circle cx={cx} cy={cy} r={250} fill="none" stroke="rgba(24,43,61,.10)" strokeDasharray="2 6" />
      <circle cx={cx} cy={cy} r={160} fill="none" stroke="rgba(24,43,61,.07)" />
      {/* incoming request on the left spoke */}
      <path d={`M150 ${cy} H${cx - 62}`} stroke={color} strokeWidth="1.6" />
      <g>
        <rect x={10} y={cy - 30} width={140} height={60} rx={12} fill="var(--color-ink-850)" stroke="rgba(24,43,61,.25)" />
        <text x={24} y={cy - 4} fill="var(--color-fg)" fontFamily="Manrope" fontWeight="700" fontSize="13.5">Your application</text>
        <text x={24} y={cy + 13} fill="var(--color-muted)" fontFamily="Manrope" fontWeight="500" fontSize="10.5">one API call · gateway</text>
      </g>
      {/* routes to each pool */}
      {POOL_ORDER.map((p) => {
        const a = SPOKE[p]
        const [hx, hy] = pt(a, 62)
        const [ex, ey] = pt(a, 232)
        const on = p === served
        const bad = p === failed
        return (
          <g key={p}>
            <line x1={hx} y1={hy} x2={ex} y2={ey} stroke={on ? POOLS[p].color : bad ? '#c04a4a' : 'rgba(24,43,61,.16)'} strokeWidth={on ? 2 : 1} strokeDasharray={bad ? '4 4' : undefined} style={{ transition: 'stroke .4s' }} />
            {on && (
              <circle r="4.5" fill="#fff" style={{ filter: `drop-shadow(0 2px 3px ${POOLS[p].color})` }}>
                <animateMotion dur="1.3s" repeatCount="indefinite" path={`M150 ${cy} L${cx - 62} ${cy} L${hx} ${hy} L${ex} ${ey}`} />
              </circle>
            )}
            <g opacity={on ? 1 : bad ? 0.85 : 0.72} style={{ transition: 'opacity .4s' }}>
              <rect x={ex} y={ey - 28} width={196} height={56} rx={12} fill="var(--color-ink-850)" stroke={on ? POOLS[p].color : bad ? '#c04a4a' : 'rgba(24,43,61,.2)'} />
              <text x={ex + 14} y={ey - 6} fill="var(--color-fg)" fontFamily="Manrope" fontWeight="700" fontSize="13">{POOLS[p].name}</text>
              <text x={ex + 14} y={ey + 11} fill={bad ? '#c04a4a' : 'var(--color-muted)'} fontFamily="Manrope" fontWeight="500" fontSize="10.5">
                {bad ? 'unavailable → fallback' : POOLS[p].via}
              </text>
            </g>
          </g>
        )
      })}
      {/* hub: the policy engine */}
      <circle cx={cx} cy={cy} r={62} fill="var(--color-ink-850)" stroke={color} strokeWidth="1.5" style={{ transition: 'stroke .4s' }} />
      {Array.from({ length: 24 }, (_, i) => {
        const [x1, y1] = pt(i * 15 + 7.5, 52)
        const [x2, y2] = pt(i * 15 + 7.5, 60)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity=".35" />
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--color-fg)" fontFamily="Manrope" fontWeight="700" fontSize="12.5">Policy engine</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="var(--color-muted)" fontFamily="Manrope" fontWeight="500" fontSize="10.5">{policy}</text>
      <text x={20} y={585} fill="var(--color-faint)" fontFamily="Manrope" fontWeight="500" fontSize="10.5">
        Outputs are validated against a schema before they are returned.
      </text>
    </svg>
  )
}

export function ModelRouter() {
  const [task, setTask] = useState<Task>('reason')
  const [policy, setPolicy] = useState<Policy>('balanced')
  const [outage, setOutage] = useState(false)
  const [view, setView] = useState<'radial' | 'pipeline'>('radial')
  const d = useMemo(() => decide(task, policy), [task, policy])
  const served: Pool = outage ? d.fallback : d.primary
  const color = POOLS[served].color

  return (
    <div className="panel overflow-hidden">
      {/* controls */}
      <div className="grid gap-6 border-b border-line p-5 sm:p-7 lg:grid-cols-[1.4fr_1fr_auto] lg:items-end">
        <fieldset>
          <legend className="label text-faint">1 · Request</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {TASKS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={task === t.id}
                onClick={() => setTask(t.id)}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${task === t.id ? 'border-fg/40 bg-ink-850 shadow-[var(--shadow-sm)] text-fg' : 'border-line text-muted hover:text-fg-soft'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label text-faint">2 · Routing policy</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {POLICIES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={policy === p.id}
                onClick={() => setPolicy(p.id)}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${policy === p.id ? 'border-fg/40 bg-ink-850 shadow-[var(--shadow-sm)] text-fg' : 'border-line text-muted hover:text-fg-soft'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex cursor-pointer items-center gap-3 text-[12.5px] text-fg-soft">
          <span className="relative inline-flex">
            <input type="checkbox" className="peer sr-only" checked={outage} onChange={(e) => setOutage(e.target.checked)} />
            <span className="h-6 w-11 rounded-full border border-line-strong bg-ink-800 transition-colors peer-checked:border-danger/50 peer-checked:bg-danger/20 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-cyan" />
            <span className="absolute left-1 top-1 size-4 rounded-full bg-fg-soft transition-transform peer-checked:translate-x-5 peer-checked:bg-danger" />
          </span>
          Simulate primary outage
        </label>
      </div>

      <div className="grid lg:grid-cols-[1.7fr_1fr]">
        {/* route diagram */}
        <div className="relative border-b border-line p-4 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex justify-end gap-1" role="group" aria-label="Diagram view">
            {(['radial', 'pipeline'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors ${view === v ? 'bg-ink-800 text-fg' : 'text-faint hover:text-fg-soft'}`}
              >
                {v}
              </button>
            ))}
          </div>
          {view === 'radial' ? (
            <RadialRoute served={served} failed={outage && d.primary !== d.fallback ? d.primary : null} color={color} policy={POLICIES.find((p) => p.id === policy)!.label.toLowerCase()} />
          ) : (
          <svg viewBox="0 0 900 410" className="w-full" role="img" aria-label={`Request routed to ${POOLS[served].name}`}>
            {/* app → gateway → policy */}
            <Box x={20} y={175} w={130} label="Your application" sub="one API call" />
            <Box x={200} y={175} w={150} label="Model Gateway" sub="auth · format · meter" accent="#2f7fa8" />
            <Box x={400} y={175} w={130} label="Policy engine" sub={POLICIES.find((p) => p.id === policy)!.label.toLowerCase()} accent={color} />
            <line x1={150} y1={205} x2={200} y2={205} stroke={color} strokeWidth="1.5" />
            <line x1={350} y1={205} x2={400} y2={205} stroke={color} strokeWidth="1.5" />
            {/* pools */}
            {POOL_ORDER.map((p, i) => {
              const isServed = p === served
              const isFailed = outage && p === d.primary && d.primary !== d.fallback
              const path = `M530 205 C 580 205, 570 ${PY[i]}, 610 ${PY[i]}`
              const back = `M790 ${PY[i]} C 820 ${PY[i]}, 810 205, 840 205`
              return (
                <g key={p}>
                  <path d={path} fill="none" stroke={isServed ? POOLS[p].color : isFailed ? '#c04a4a' : 'rgba(24,43,61,.14)'} strokeWidth={isServed ? 1.8 : 1} strokeDasharray={isFailed ? '4 4' : undefined} style={{ transition: 'stroke .4s' }} />
                  <path d={back} fill="none" stroke={isServed ? POOLS[p].color : 'rgba(24,43,61,.1)'} strokeWidth={isServed ? 1.8 : 1} style={{ transition: 'stroke .4s' }} />
                  {isServed && (
                    <circle r="4" fill="#fff" style={{ filter: `drop-shadow(0 2px 3px ${POOLS[p].color})` }}>
                      <animateMotion dur="1.4s" repeatCount="indefinite" path={`M150 205 L530 205 ${path.replace('M530 205', '')} L790 ${PY[i]} ${back.replace(`M790 ${PY[i]}`, '')}`} />
                    </circle>
                  )}
                  <g opacity={isServed ? 1 : isFailed ? 0.85 : 0.72} style={{ transition: 'opacity .4s' }}>
                    <rect x={610} y={PY[i] - 30} width={180} height={60} rx={12} fill="var(--color-ink-850)" stroke={isServed ? POOLS[p].color : isFailed ? '#c04a4a' : 'rgba(24,43,61,.2)'} />
                    <text x={624} y={PY[i] - 7} fill="var(--color-fg)" fontFamily="Manrope" fontWeight="700" fontSize="13.5">
                      {POOLS[p].name}
                    </text>
                    <text x={624} y={PY[i] + 10} fill="var(--color-muted)" fontFamily="Manrope" fontWeight="500" fontSize="10.5">
                      {POOLS[p].via}
                    </text>
                    {isFailed && (
                      <text x={624} y={PY[i] + 23} fill="#c04a4a" fontFamily="Manrope" fontWeight="600" fontSize="10">
                        unavailable → fallback
                      </text>
                    )}
                    {!isFailed && (
                      <g>
                        {[0, 1, 2, 3].map((k) => (
                          <rect key={k} x={624 + k * 9} y={PY[i] + 18} width="6" height="4" rx="1" fill={POOLS[p].color} opacity={k < POOLS[p].q ? 0.9 : 0.2} />
                        ))}
                        {[0, 1, 2, 3].map((k) => (
                          <rect key={k} x={672 + k * 9} y={PY[i] + 18} width="6" height="4" rx="1" fill="#a8731c" opacity={k < POOLS[p].s ? 0.9 : 0.2} />
                        ))}
                        {[0, 1, 2, 3].map((k) => (
                          <rect key={k} x={720 + k * 9} y={PY[i] + 18} width="6" height="4" rx="1" fill="#4b8a5c" opacity={k < POOLS[p].c ? 0.9 : 0.2} />
                        ))}
                      </g>
                    )}
                  </g>
                </g>
              )
            })}
            <Box x={840} y={175} w={0} label="" sub="" />
            <g>
              <rect x={812} y={225} width={80} height={44} rx={10} fill="var(--color-ink-850)" stroke={color} />
              <text x={852} y={244} textAnchor="middle" fill="var(--color-fg)" fontFamily="Manrope" fontWeight="700" fontSize="11.5">
                Validate
              </text>
              <text x={852} y={259} textAnchor="middle" fill="var(--color-muted)" fontFamily="Manrope" fontSize="9.5">
                schema ✓
              </text>
              <line x1={852} y1={205} x2={852} y2={225} stroke={color} strokeWidth="1.5" />
            </g>
            <text x={20} y={395} fill="var(--color-faint)" fontFamily="Manrope" fontWeight="500" fontSize="10.5">
              bars: quality · speed · cost-efficiency (relative, illustrative)
            </text>
          </svg>
          )}
        </div>

        {/* decision explanation */}
        <div className="p-6 sm:p-7" aria-live="polite">
          <DemoBadge label="Illustrative routing" />
          <p className="mt-5 text-[13px] text-muted">{TASKS.find((t) => t.id === task)!.example}</p>
          <p className="mt-5 label text-faint">Routed to</p>
          <p className="mt-2 text-2xl font-medium tracking-tight" style={{ color }}>
            {POOLS[served].name}
          </p>
          <p className="text-[13px] text-muted">{POOLS[served].via}</p>
          <p className="mt-5 text-[14px] leading-relaxed text-fg-soft">{d.why}</p>
          {outage && (
            <p className="mt-4 flex gap-2 rounded-xl border border-danger/25 bg-danger/[0.06] p-3 text-[13px] leading-relaxed text-fg-soft">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
              {d.primary === d.fallback
                ? 'The primary replica is unavailable; the request moves to another replica inside the same approved environment.'
                : `${POOLS[d.primary].name} is unavailable. The gateway retries on ${POOLS[d.fallback].name} without the application changing anything.`}
            </p>
          )}
          {task === 'sensitive' && (
            <p className="mt-4 flex gap-2 text-[13px] text-fg-soft">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal" /> Governance policy applied before routing.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Box({ x, y, w, label, sub, accent }: { x: number; y: number; w: number; label: string; sub: string; accent?: string }) {
  if (!w) return null
  return (
    <g>
      <rect x={x} y={y} width={w} height={60} rx={12} fill="var(--color-ink-850)" stroke={accent ?? 'rgba(24,43,61,.25)'} style={{ transition: 'stroke .4s' }} />
      <text x={x + 14} y={y + 26} fill="var(--color-fg)" fontFamily="Manrope" fontWeight="700" fontSize="13.5">
        {label}
      </text>
      <text x={x + 14} y={y + 43} fill="var(--color-muted)" fontFamily="Manrope" fontWeight="500" fontSize="10.5">
        {sub}
      </text>
    </g>
  )
}
