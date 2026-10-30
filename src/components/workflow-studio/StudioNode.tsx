import { memo, type CSSProperties } from 'react'
import { Handle, Position, BaseEdge, EdgeLabelRenderer, getBezierPath, type NodeProps, type EdgeProps, type Node, type Edge } from '@xyflow/react'
import { Bot, BookOpen, Check, Database, GitBranch, Loader2, Pause, Plug, Send, Sparkles, Split, UserCheck, X, Zap, type LucideIcon } from 'lucide-react'
import { KIND_META, type NodeKind, type StudioNodeData } from './workflows'

export type RunStatus = 'idle' | 'queued' | 'running' | 'done' | 'waiting' | 'skipped' | 'rejected'

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
}

export type StudioNodeType = Node<StudioNodeData & { status?: RunStatus }, 'studio'>

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

function StudioNodeImpl({ data, selected }: NodeProps<StudioNodeType>) {
  const meta = KIND_META[data.kind]
  const Icon = KIND_ICON[data.kind]
  const status = data.status ?? 'idle'
  const shape = shapeFor(data.kind)
  const running = status === 'running'
  const waiting = status === 'waiting'
  const skipped = status === 'skipped'
  const ring = selected || running || waiting
  const style: CSSProperties = {
    borderRadius: shape.radius,
    opacity: skipped ? 0.45 : 1,
    boxShadow: ring
      ? `0 0 0 2px ${meta.color}, 0 0 0 6px ${meta.color}33, 0 14px 30px -12px rgba(0,0,0,.55)`
      : '0 12px 26px -14px rgba(0,0,0,.6)',
    outline: shape.frame === 'dashed' && !ring ? `1.5px dashed ${meta.color}` : undefined,
    outlineOffset: 3,
  }
  return (
    <div className="relative w-[212px] bg-[#fbfcfd] transition-[box-shadow,opacity] duration-300" style={style}>
      {data.kind !== 'trigger' && <Handle type="target" position={Position.Left} />}
      <div className={`flex items-center gap-3 py-3 ${data.kind === 'trigger' ? 'pl-3.5 pr-3' : 'px-3'}`}>
        <span
          className="grid size-8 shrink-0 place-items-center text-white"
          style={{
            background: meta.color,
            borderRadius: shape.iconShape === 'circle' ? 999 : 7,
            transform: shape.iconShape === 'diamond' ? 'rotate(45deg) scale(.86)' : undefined,
            boxShadow: data.kind === 'agent' ? `0 0 0 3px #fbfcfd, 0 0 0 4.5px ${meta.color}66` : undefined,
          }}
        >
          <Icon size={15} style={shape.iconShape === 'diamond' ? { transform: 'rotate(-45deg)' } : undefined} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-[#182b3d]">{data.title}</p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-[#5d7083]">{data.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[#182b3d]/[.07] px-3 py-1.5">
        <span className="text-[10.5px] font-bold" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <StatusPill status={status} />
      </div>
      {running && (
        <span
          className="absolute inset-x-4 bottom-0 h-[2px] rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`, backgroundSize: '200% 100%', animation: 'shimmer 1.1s linear infinite' }}
        />
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function StatusPill({ status }: { status: RunStatus }) {
  const map: Record<RunStatus, { t: string; c: string; bg: string }> = {
    idle: { t: 'Ready', c: '#8495a6', bg: 'transparent' },
    queued: { t: 'Queued', c: '#5d7083', bg: '#eef2f5' },
    running: { t: 'Running', c: '#2f7fa8', bg: '#e3f0f6' },
    done: { t: 'Done', c: '#3f7d51', bg: '#e5f1e8' },
    waiting: { t: 'Awaiting', c: '#9a6a17', bg: '#fbf0dc' },
    skipped: { t: 'Skipped', c: '#8495a6', bg: '#eef2f5' },
    rejected: { t: 'Rejected', c: '#b04040', bg: '#f9e4e4' },
  }
  const s = map[status]
  return (
    <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: s.c, background: s.bg }}>
      {status === 'running' && <Loader2 size={10} className="animate-spin" />}
      {status === 'done' && <Check size={10} strokeWidth={3} />}
      {status === 'waiting' && <Pause size={10} />}
      {status === 'rejected' && <X size={10} />}
      {status === 'idle' && <span className="size-1.5 rounded-full bg-[#b5c2ce]" />}
      {s.t}
    </span>
  )
}

export const StudioNode = memo(StudioNodeImpl)

export type FlowEdgeType = Edge<{ state?: 'idle' | 'active' | 'done' | 'skipped'; color?: string }, 'flow'>

export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label, selected }: EdgeProps<FlowEdgeType>) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const state = data?.state ?? 'idle'
  const color = data?.color ?? '#7cc4dd'
  const stroke = state === 'active' || state === 'done' ? color : selected ? '#7cc4dd' : '#5b7189'
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: state === 'active' ? 2.25 : 1.75,
          opacity: state === 'skipped' ? 0.3 : 1,
          strokeDasharray: state === 'skipped' ? '5 5' : undefined,
          transition: 'stroke .4s, opacity .4s',
        }}
      />
      {state === 'active' && (
        <circle r="4.5" fill="#ffffff" stroke={color} strokeWidth="2.5">
          <animateMotion dur="0.9s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-md bg-[#2a4157] px-1.5 py-0.5 text-[10.5px] font-bold text-[#dfe8ef]"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, opacity: state === 'skipped' ? 0.4 : 1 }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
