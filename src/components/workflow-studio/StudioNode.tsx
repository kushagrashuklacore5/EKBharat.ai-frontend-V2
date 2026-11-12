import { memo, useEffect, useState, type CSSProperties } from 'react'
import { Handle, Position, BaseEdge, EdgeLabelRenderer, NodeResizer, getBezierPath, useUpdateNodeInternals, type NodeProps, type EdgeProps } from '@xyflow/react'
import {
  AlertTriangle, Bot, BookOpen, Braces, Brain, Check, Cpu, Database, GitBranch, Loader2, Pause, Pin, Plug, Plus, Send, Sparkles, Split, Trash2, UserCheck, Wrench, X, Zap, type LucideIcon,
} from 'lucide-react'
import { KIND_META, type NodeKind } from './workflows'
import { getDef } from './engine/registry'
import { modelLabel } from './engine/routing'
import type { StepStatus } from './engine/types'
import { useStudioActions, type FlowEdgeType, type StudioNodeType } from './canvas'

export type { StudioNodeType, FlowEdgeType } from './canvas'
export type RunStatus = StepStatus | 'idle'

export const KIND_ICON: Record<NodeKind, LucideIcon> = {
  trigger: Zap,
  agent: Bot,
  llm: Sparkles,
  knowledge: BookOpen,
  condition: GitBranch,
  database: Database,
  integration: Plug,
  human: UserCheck,
  output: Send,
  parallel: Split,
  data: Braces,
  model: Cpu,
  memory: Brain,
  tool: Wrench,
}

/** Per-function silhouette: start caps, end caps, diamonds, avatars, approval frames. */
function shapeFor(kind: NodeKind): { radius: string; iconShape: 'square' | 'circle' | 'diamond'; frame?: 'dashed' } {
  switch (kind) {
    case 'trigger':
      return { radius: '26px 10px 10px 26px', iconShape: 'circle' }
    case 'output':
      return { radius: '10px 26px 26px 10px', iconShape: 'square' }
    case 'condition':
    case 'parallel':
      return { radius: '10px', iconShape: 'diamond' }
    case 'agent':
      return { radius: '10px', iconShape: 'circle' }
    case 'human':
      return { radius: '10px', iconShape: 'circle', frame: 'dashed' }
    default:
      return { radius: '10px', iconShape: 'square' }
  }
}

const SLOT_LABEL = { model: 'Model', memory: 'Memory', tools: 'Tools' } as const

function NodeIcon({ type, size = 32 }: { type: string; size?: number }) {
  const def = getDef(type)
  const kind = def?.kind ?? 'data'
  const meta = KIND_META[kind]
  const shape = shapeFor(kind)
  if (def?.monogram)
    return (
      <span className="grid shrink-0 place-items-center rounded-[7px] font-mono text-[10px] font-bold text-white" style={{ width: size, height: size, background: def.brand }}>
        {def.monogram}
      </span>
    )
  const Icon = KIND_ICON[kind]
  return (
    <span
      className="grid shrink-0 place-items-center text-white"
      style={{
        width: size,
        height: size,
        background: meta.color,
        borderRadius: shape.iconShape === 'circle' ? 999 : 7,
        transform: shape.iconShape === 'diamond' ? 'rotate(45deg) scale(.86)' : undefined,
        boxShadow: kind === 'agent' ? `0 0 0 3px #fbfcfd, 0 0 0 4.5px ${meta.color}66` : undefined,
      }}
    >
      <Icon size={Math.round(size * 0.47)} style={shape.iconShape === 'diamond' ? { transform: 'rotate(-45deg)' } : undefined} />
    </span>
  )
}
export { NodeIcon }

function StudioNodeImpl({ id, data, selected }: NodeProps<StudioNodeType>) {
  const def = getDef(data.type)
  const actions = useStudioActions()
  const updateInternals = useUpdateNodeInternals()
  const kind = def?.kind ?? 'data'
  const meta = KIND_META[kind]
  const status: RunStatus = data.status ?? 'idle'
  const shape = shapeFor(kind)
  const outputs = def?.outputs(data.config) ?? []
  const slots = def?.slots ?? []
  const outKey = outputs.map((o) => o.id).join('|')
  // handles change when Switch cases change
  useEffect(() => updateInternals(id), [id, outKey, updateInternals])

  const running = status === 'running'
  const waiting = status === 'waiting'
  const failed = status === 'error'
  const skipped = status === 'skipped' || status === 'canceled'
  const errors = (data.issues ?? []).filter((i) => i.level === 'error')
  const warnings = data.issues ?? []
  const ring = selected || running || waiting || failed
  const ringColor = failed ? '#c04a4a' : meta.color
  const style: CSSProperties = {
    borderRadius: shape.radius,
    opacity: skipped ? 0.45 : 1,
    boxShadow: ring ? `0 0 0 2px ${ringColor}, 0 0 0 6px ${ringColor}33, 0 14px 30px -12px rgba(0,0,0,.55)` : '0 12px 26px -14px rgba(0,0,0,.6)',
    outline: shape.frame === 'dashed' && !ring ? `1.5px dashed ${meta.color}` : undefined,
    outlineOffset: 3,
    minHeight: outputs.length > 2 ? 30 + outputs.length * 20 : undefined,
  }
  const multi = outputs.length > 1

  return (
    <div className={`group/node relative bg-[#fbfcfd] transition-[box-shadow,opacity] duration-300 ${multi ? 'w-[232px]' : 'w-[212px]'}`} style={style} onDoubleClick={() => actions?.open(id)}>
      {def?.hasInput && <Handle type="target" position={Position.Left} id="main" />}
      <div className={`flex items-center gap-3 py-3 ${kind === 'trigger' ? 'pl-3.5' : 'pl-3'} ${multi ? 'pr-14' : 'pr-3'}`}>
        <NodeIcon type={data.type} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-[#182b3d]">{data.name}</p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-[#5d7083]">{data.usedModel ? `via ${modelLabel(data.usedModel)}` : def?.subtitle}</p>
        </div>
      </div>

      {slots.length > 0 && data.slotInfo && (
        <div className="space-y-0.5 border-t border-[#182b3d]/[.07] px-3 py-1.5 text-[10.5px] leading-tight text-[#5d7083]">
          <p className="truncate">
            <span className="font-bold text-[#2c64a0]">Model</span> {data.slotInfo.model ?? <span className="text-[#b84848]">not connected</span>}
          </p>
          {data.slotInfo.memory && (
            <p className="truncate">
              <span className="font-bold text-[#7a6aa8]">Memory</span> {data.slotInfo.memory}
            </p>
          )}
          {data.slotInfo.tools.length > 0 && (
            <p className="truncate">
              <span className="font-bold text-[#5d7083]">Tools</span> {data.slotInfo.tools.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[#182b3d]/[.07] px-3 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[10.5px] font-bold" style={{ color: meta.color }}>
          {meta.label}
          {def?.availability === 'planned' && <span className="rounded bg-[#eef2f5] px-1 text-[9.5px] font-semibold text-[#5d7083]">Planned</span>}
          {data.pinned && <Pin size={10} className="text-[#7a6aa8]" aria-label="Pinned data" />}
        </span>
        <span className="flex items-center gap-1.5">
          {data.durationMs !== undefined && status === 'success' && <span className="font-mono text-[9.5px] text-[#8495a6]">{(data.durationMs / 1000).toFixed(1)}s</span>}
          <StatusPill status={status} />
        </span>
      </div>

      {warnings.length > 0 && status === 'idle' && (
        <span
          className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full text-white shadow"
          style={{ background: errors.length ? '#b84848' : '#a8731c' }}
          title={warnings.map((w) => `• ${w.message}`).join('\n')}
          aria-label={`${warnings.length} issue${warnings.length > 1 ? 's' : ''}: ${warnings.map((w) => w.message).join(' ')}`}
        >
          <AlertTriangle size={11} />
        </span>
      )}

      {running && (
        <span
          className="absolute inset-x-4 bottom-0 h-[2px] rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`, backgroundSize: '200% 100%', animation: 'shimmer 1.1s linear infinite' }}
        />
      )}

      {outputs.map((o, i) => {
        const top = multi ? `${((i + 1) / (outputs.length + 1)) * 100}%` : '50%'
        return (
          <div key={o.id}>
            <Handle type="source" position={Position.Right} id={o.id} style={{ top }} />
            {multi && (
              <span className="pointer-events-none absolute right-2.5 -translate-y-1/2 font-mono text-[9.5px] font-semibold text-[#5d7083]" style={{ top }}>
                {o.label}
              </span>
            )}
            {actions && !actions.readOnly && (
              <button
                type="button"
                className="nodrag absolute grid size-[18px] -translate-y-1/2 place-items-center rounded-full bg-white text-[#2a4157] opacity-0 shadow ring-1 ring-[#182b3d]/15 transition-opacity hover:bg-[#e3f0f6] focus-visible:opacity-100 group-hover/node:opacity-100"
                style={{ top, right: -30 }}
                onClick={(e) => {
                  e.stopPropagation()
                  actions.addFrom(id, o.id)
                }}
                title={`Add a node after ${o.label || 'this step'}`}
                aria-label={`Add node after ${data.name}${o.label ? ` (${o.label})` : ''}`}
              >
                <Plus size={11} strokeWidth={2.6} />
              </button>
            )}
          </div>
        )
      })}

      {slots.map((s, i) => {
        const left = `${((i + 1) / (slots.length + 1)) * 100}%`
        return (
          <div key={s}>
            <Handle type="target" position={Position.Bottom} id={s} className="!rounded-[3px] !bg-[#dfe8ef]" style={{ left }} />
            <span className="pointer-events-none absolute top-full mt-1.5 -translate-x-1/2 text-[9.5px] font-bold uppercase tracking-wide text-[#9fb4c6]" style={{ left }}>
              {SLOT_LABEL[s]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SubNodeImpl({ data, selected, id }: NodeProps<StudioNodeType>) {
  const def = getDef(data.type)
  const actions = useStudioActions()
  const meta = KIND_META[def?.kind ?? 'model']
  const issues = data.issues ?? []
  const detail =
    data.type === 'sub.model'
      ? data.config.model === 'auto'
        ? `Auto · ${String(data.config.strategy ?? 'balanced')}`
        : modelLabel(String(data.config.model))
      : data.type === 'sub.tool'
        ? String(data.config.action ?? '')
        : `${String(data.config.window ?? '')} messages`
  return (
    <div
      className="relative flex w-[156px] items-center gap-2 rounded-full bg-[#fbfcfd] py-1.5 pl-1.5 pr-3"
      style={{ boxShadow: selected ? `0 0 0 2px ${meta.color}, 0 0 0 5px ${meta.color}33` : '0 8px 18px -10px rgba(0,0,0,.6)' }}
      onDoubleClick={() => actions?.open(id)}
    >
      <Handle type="source" position={Position.Top} id="sub" className="!rounded-[3px]" />
      <NodeIcon type={data.type} size={24} />
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] font-bold leading-tight text-[#182b3d]">{data.name}</span>
        <span className="block truncate text-[10px] leading-tight text-[#5d7083]">{detail}</span>
      </span>
      {issues.length > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-[#a8731c] text-white" title={issues.map((i) => i.message).join('\n')}>
          <AlertTriangle size={9} />
        </span>
      )}
    </div>
  )
}

function NoteNodeImpl({ id, data, selected }: NodeProps<StudioNodeType>) {
  const actions = useStudioActions()
  return (
    <div className="h-full w-full rounded-lg bg-[#fbf3e4]/95 p-2.5 shadow-[0_10px_24px_-14px_rgba(0,0,0,.6)] ring-1 ring-[#a8731c]/25">
      <NodeResizer isVisible={selected && !actions?.readOnly} minWidth={160} minHeight={90} color="#a8731c" />
      <textarea
        className="nodrag nowheel h-full w-full resize-none bg-transparent text-[12.5px] leading-snug text-[#4a3b1c] placeholder:text-[#a08a5c] focus:outline-none"
        value={data.note ?? ''}
        placeholder="Write a note…"
        readOnly={actions?.readOnly}
        aria-label="Sticky note"
        onChange={(e) => actions?.updateNote(id, e.target.value)}
      />
    </div>
  )
}

function StatusPill({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { t: string; c: string; bg: string }> = {
    idle: { t: 'Ready', c: '#8495a6', bg: 'transparent' },
    queued: { t: 'Queued', c: '#5d7083', bg: '#eef2f5' },
    running: { t: 'Running', c: '#2f7fa8', bg: '#e3f0f6' },
    success: { t: 'Done', c: '#3f7d51', bg: '#e5f1e8' },
    waiting: { t: 'Awaiting', c: '#9a6a17', bg: '#fbf0dc' },
    skipped: { t: 'Skipped', c: '#8495a6', bg: '#eef2f5' },
    canceled: { t: 'Stopped', c: '#8495a6', bg: '#eef2f5' },
    rejected: { t: 'Rejected', c: '#b04040', bg: '#f9e4e4' },
    error: { t: 'Failed', c: '#b04040', bg: '#f9e4e4' },
  }
  const s = map[status]
  return (
    <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: s.c, background: s.bg }}>
      {status === 'running' && <Loader2 size={10} className="animate-spin" />}
      {status === 'success' && <Check size={10} strokeWidth={3} />}
      {status === 'waiting' && <Pause size={10} />}
      {(status === 'rejected' || status === 'error') && <X size={10} />}
      {status === 'idle' && <span className="size-1.5 rounded-full bg-[#b5c2ce]" />}
      {s.t}
    </span>
  )
}

export const StudioNode = memo(StudioNodeImpl)
export const SubNode = memo(SubNodeImpl)
export const NoteNode = memo(NoteNodeImpl)

export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label, selected }: EdgeProps<FlowEdgeType>) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const actions = useStudioActions()
  const [hover, setHover] = useState(false)
  const state = data?.state ?? 'idle'
  const sub = !!data?.sub
  const color = state === 'done' ? '#8cc39b' : '#7cc4dd'
  const stroke = state === 'active' || state === 'done' ? color : selected ? '#7cc4dd' : sub ? '#6f86a0' : '#5b7189'
  const showTools = !sub && (hover || selected) && actions && !actions.readOnly
  return (
    <g onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={24}
        style={{
          stroke,
          strokeWidth: state === 'active' ? 2.25 : sub ? 1.25 : 1.75,
          opacity: state === 'skipped' ? 0.3 : 1,
          strokeDasharray: state === 'skipped' || sub ? '5 5' : undefined,
          transition: 'stroke .4s, opacity .4s',
        }}
      />
      {state === 'active' && (
        <circle r="4.5" fill="#ffffff" stroke={color} strokeWidth="2.5">
          <animateMotion dur="0.9s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex items-center gap-1"
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, pointerEvents: showTools ? 'all' : 'none' }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {label && (
            <span className="rounded-md bg-[#2a4157] px-1.5 py-0.5 text-[10.5px] font-bold text-[#dfe8ef]" style={{ opacity: state === 'skipped' ? 0.4 : 1 }}>
              {label}
            </span>
          )}
          {data?.items !== undefined && (
            <span className="rounded-md bg-[#e5f1e8] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#3f7d51]">
              {data.items} item{data.items === 1 ? '' : 's'}
            </span>
          )}
          {showTools && (
            <>
              <button type="button" onClick={() => actions.insertOnEdge(id)} className="grid size-5 place-items-center rounded bg-white text-[#2a4157] shadow hover:bg-[#e3f0f6]" title="Insert a node here" aria-label="Insert node on connection">
                <Plus size={11} strokeWidth={2.6} />
              </button>
              <button type="button" onClick={() => actions.deleteEdge(id)} className="grid size-5 place-items-center rounded bg-white text-[#b04040] shadow hover:bg-[#f9e4e4]" title="Delete connection" aria-label="Delete connection">
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  )
}
