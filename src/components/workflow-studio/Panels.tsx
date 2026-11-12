import { useEffect, useRef, useState } from 'react'
import { Check, CircleDot, Loader2, Pause, Send, ShieldCheck, Trash2, X } from 'lucide-react'
import { summarize } from './engine/executor'
import { formatInr, modelLabel, provider } from './engine/routing'
import { maskPii } from './engine/data'
import { LOCAL_ACTOR } from './engine/store'
import { Toggle } from './NodeInspector'
import type { AuditEvent, Execution, GovernanceSettings, StepStatus } from './engine/types'

const fmtTime = (t: number) => new Date(t).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })
const STATUS_TONE: Record<Execution['status'], string> = { success: 'text-leaf', error: 'text-danger', canceled: 'text-muted', running: 'text-cyan', waiting: 'text-amber' }

/** Totals, model-wise and node-wise cost for one execution. */
export function RunSummary({ exec }: { exec: Execution }) {
  const s = summarize(exec)
  return (
    <div className="rounded-md bg-ink-900 p-3 text-[12px]">
      <div className="grid grid-cols-3 gap-2">
        <Stat k="Duration" v={`${(s.durationMs / 1000).toFixed(1)}s`} />
        <Stat k="Tokens" v={s.tokens.toLocaleString('en-IN')} />
        <Stat k="Est. cost" v={formatInr(s.cost)} />
      </div>
      {s.byModel.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-bold text-faint">By model</p>
          <ul className="mt-1 space-y-0.5">
            {s.byModel.map((m) => (
              <li key={m.model} className="flex justify-between gap-2 font-mono text-[11px]">
                <span className="truncate text-fg-soft">
                  {modelLabel(m.model)} <span className="text-faint">×{m.calls}</span>
                </span>
                <span className="text-muted">
                  {m.tokens.toLocaleString('en-IN')} tok · {formatInr(m.cost)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] font-bold text-faint">By node</p>
          <ul className="mt-1 space-y-0.5">
            {exec.usage.map((u) => (
              <li key={u.nodeId} className="flex justify-between gap-2 font-mono text-[11px]">
                <span className="truncate text-fg-soft">{u.nodeName}</span>
                <span className="shrink-0 text-muted">
                  {u.latencyMs}ms · {formatInr(u.costInr)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-[10.5px] leading-snug text-faint">
        {exec.simulated ? 'AI metrics come from the deterministic simulation adapter using illustrative demo rates — not provider billing.' : 'AI metrics reported by the model gateway.'}
      </p>
    </div>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10.5px] text-faint">{k}</p>
      <p className="font-mono text-[13px] font-semibold text-fg">{v}</p>
    </div>
  )
}

export function ExecutionsPanel({ executions, viewingId, onOpen, onClear }: { executions: Execution[]; viewingId: string | null; onOpen(id: string | null): void; onClear(): void }) {
  const focus = executions.find((e) => e.id === viewingId) ?? executions[0]
  return (
    <div className="p-4">
      {focus && (
        <>
          <p className="mb-2 flex items-center justify-between text-[12px] font-bold text-faint">
            <span>{viewingId ? 'Selected execution' : 'Latest execution'}</span>
            <span className={`capitalize ${STATUS_TONE[focus.status]}`}>{focus.status}</span>
          </p>
          <RunSummary exec={focus} />
        </>
      )}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[12px] font-bold text-faint">Execution history</p>
        {executions.length > 0 && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted hover:text-danger">
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>
      {!executions.length && <p className="mt-2 text-[12.5px] text-muted">No runs yet — press Run workflow.</p>}
      <ul className="mt-2 space-y-1.5">
        {executions.map((e) => {
          const s = summarize(e)
          const sel = e.id === viewingId
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onOpen(sel ? null : e.id)}
                className={`w-full rounded-md px-2.5 py-2 text-left text-[11.5px] transition-colors ${sel ? 'bg-fg text-ink-950' : 'bg-ink-900 hover:bg-ink-800'}`}
                aria-pressed={sel}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono font-semibold">#{e.id.slice(3, 11)}</span>
                  <span className={`font-semibold capitalize ${sel ? '' : STATUS_TONE[e.status]}`}>{e.status}</span>
                </span>
                <span className={`mt-0.5 block truncate ${sel ? 'opacity-80' : 'text-muted'}`}>{e.workflowName}</span>
                <span className={`mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10.5px] ${sel ? 'opacity-80' : 'text-faint'}`}>
                  <span>{fmtTime(e.startedAt)}</span>
                  <span>{e.finishedAt ? `→ ${new Date(e.finishedAt).toLocaleTimeString('en-IN')}` : ''}</span>
                  <span>{(s.durationMs / 1000).toFixed(1)}s</span>
                  <span>{s.tokens.toLocaleString('en-IN')} tok</span>
                  <span>{formatInr(s.cost)}</span>
                  <span>
                    {e.triggerType} · {e.mode}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-[10.5px] leading-snug text-faint">Saved in this browser only (last 25 runs). Not shared, not backed up — a server-side history store is pending.</p>
    </div>
  )
}

export function GovernancePanel({ gov, onChange, audit }: { gov: GovernanceSettings; onChange(g: GovernanceSettings): void; audit: AuditEvent[] }) {
  return (
    <div className="p-4 text-[12.5px]">
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-faint">
        <ShieldCheck size={13} /> Governance
      </p>
      <dl className="mt-2 divide-y divide-line rounded-md bg-ink-900">
        <Row k="Identity" v={LOCAL_ACTOR} />
        <Row k="Role" v="Owner (local demo — no access control)" />
        <Row k="Credentials" v="None stored in the browser. Managed credential vault: pending backend." />
        <Row k="Model access" v={provider.simulated ? 'Simulation adapter (no API keys)' : 'Server-side model gateway'} />
        <Row k="Deployment region" v="Not configured. India-region hosting is a planned option — no hosting claim is made by this demo." />
        <Row k="Data location" v="This browser’s local storage only." />
      </dl>
      <p className="mt-4 text-[12px] font-bold text-faint">DPDP-minded controls</p>
      <div className="mt-2 space-y-2 rounded-md bg-ink-900 p-2.5">
        <Toggle label="Mask personal data (email, phone, GSTIN, PAN) in data views" checked={gov.maskPii} onChange={(v) => onChange({ ...gov, maskPii: v })} />
        <Toggle label="Warn when a write action has no human approval upstream" checked={gov.requireApprovalForWrites} onChange={(v) => onChange({ ...gov, requireApprovalForWrites: v })} />
        <label className="flex items-center justify-between gap-2 text-muted">
          Keep execution history for
          <select value={gov.retentionDays} onChange={(e) => onChange({ ...gov, retentionDays: Number(e.target.value) })} className="rounded-md bg-ink-850 px-2 py-1 text-[12px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)]">
            {[1, 7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} day{d > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-faint">Controls that help with DPDP Act obligations. This is not a compliance certification.</p>

      <p className="mt-4 text-[12px] font-bold text-faint">Audit trail</p>
      {!audit.length && <p className="mt-1 text-muted">No events yet.</p>}
      <ol className="mt-1.5 max-h-[260px] space-y-1 overflow-y-auto">
        {audit.map((a) => (
          <li key={a.id} className="rounded bg-ink-900 px-2 py-1.5 text-[11.5px]">
            <span className="flex justify-between gap-2">
              <span className="font-mono font-semibold text-cyan">{a.action}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-faint">{fmtTime(a.at)}</span>
            </span>
            <span className="block text-fg-soft">{gov.maskPii ? maskPii(a.detail) : a.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2 px-2.5 py-1.5">
      <dt className="text-[11.5px] text-faint">{k}</dt>
      <dd className="text-[11.5px] leading-snug text-fg-soft">{v}</dd>
    </div>
  )
}

export interface ChatMsg {
  id: string
  role: 'user' | 'bot' | 'system'
  text: string
  meta?: string
}

const SUGGESTIONS = ['Mujhe pricing chahiye.', 'मुझे डेमो चाहिए', 'எனக்கு விலை விவரம் வேண்டும்', 'I was charged twice for my order.']

/** Test chat playground: each message triggers the workflow's Chat Trigger and shows live progress. */
export function ChatPanel({
  messages,
  onSend,
  busy,
  live,
  hasChatTrigger,
  onOpenChatTemplate,
  onClear,
  mask,
}: {
  messages: ChatMsg[]
  onSend(text: string): void
  busy: boolean
  live: Execution | null
  hasChatTrigger: boolean
  onOpenChatTemplate(): void
  onClear(): void
  mask: boolean
}) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, live])
  const send = (t: string) => {
    if (!t.trim() || busy || !hasChatTrigger) return
    onSend(t.trim())
    setText('')
  }
  const steps = live ? Object.values(live.steps).filter((s) => s.status !== 'queued' || live.status === 'running') : []
  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-[12px] font-bold text-faint">Test chat · Hindi · English · Tamil</p>
        <span className="flex items-center gap-2">
          {provider.simulated && <span className="rounded bg-[#fbf0dc] px-1.5 py-0.5 text-[10px] font-bold text-amber">DEMO MODE</span>}
          {messages.length > 0 && (
            <button type="button" onClick={onClear} className="text-[11px] font-semibold text-muted hover:text-fg" aria-label="Clear chat">
              <X size={13} />
            </button>
          )}
        </span>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3" aria-live="polite">
        {!hasChatTrigger && (
          <div className="rounded-md bg-ink-900 p-3 text-[12.5px] text-muted">
            This workflow has no Chat Trigger.
            <button type="button" onClick={onOpenChatTemplate} className="mt-2 block font-semibold text-cyan hover:underline">
              Open “Multilingual Lead Qualification” →
            </button>
          </div>
        )}
        {hasChatTrigger && !messages.length && <p className="text-[12.5px] text-muted">Send a message to trigger the workflow. Replies come from the workflow’s “Respond to Chat” node.</p>}
        {messages.map((m) =>
          m.role === 'system' ? (
            <p key={m.id} className="text-center font-mono text-[10.5px] text-faint">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.role === 'user' ? 'rounded-br-sm bg-teal text-white' : 'rounded-bl-sm bg-ink-900 text-fg'}`}>
                {mask ? maskPii(m.text) : m.text}
                {m.meta && <span className={`mt-1 block font-mono text-[10px] ${m.role === 'user' ? 'text-white/75' : 'text-faint'}`}>{m.meta}</span>}
              </div>
            </div>
          ),
        )}
        {busy && live && (
          <ol className="space-y-0.5 rounded-md bg-ink-900 p-2.5 font-mono text-[11px]">
            {steps.map((s) => (
              <li key={s.nodeId} className="flex items-center gap-1.5">
                <StepIcon s={s.status} />
                <span className={s.status === 'skipped' ? 'text-faint line-through' : 'text-fg-soft'}>{s.nodeName}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="border-t border-line p-3">
        {hasChatTrigger && (
          <div className="mb-2 flex flex-wrap gap-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => send(s)} className="rounded-full bg-ink-900 px-2 py-0.5 text-[11.5px] text-fg-soft hover:bg-ink-700 disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send(text)
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!hasChatTrigger}
            placeholder={hasChatTrigger ? 'Type in Hindi, English or Tamil…' : 'Needs a Chat Trigger'}
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] placeholder:text-faint focus:shadow-[inset_0_0_0_1.5px_var(--color-cyan)] focus:outline-none disabled:opacity-50"
          />
          <button type="submit" disabled={busy || !text.trim() || !hasChatTrigger} className="grid size-9 place-items-center rounded-md bg-teal text-white disabled:opacity-40" aria-label="Send">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </div>
  )
}

export function StepIcon({ s }: { s: StepStatus }) {
  if (s === 'running') return <Loader2 size={11} className="animate-spin text-cyan" />
  if (s === 'success') return <Check size={11} className="text-leaf" strokeWidth={3} />
  if (s === 'waiting') return <Pause size={11} className="text-amber" />
  if (s === 'error' || s === 'rejected') return <X size={11} className="text-danger" />
  return <CircleDot size={11} className="text-faint" />
}
