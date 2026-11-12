import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BadgeCheck, CheckCircle2, Loader2, Mail, PencilLine, Play, RefreshCw, RotateCcw, Sparkles, Users, X } from 'lucide-react'
import { DataView } from './DataView'
import { summarize } from './engine/executor'
import { getDef } from './engine/registry'
import { formatInr } from './engine/routing'
import { ApiError, sendWorkflowEmail } from './aiClient'
import type { Execution, Item, Workflow } from './engine/types'

const fmt = (ms: number) => new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

interface Props {
  wf: Workflow
  approvalCurrent: boolean
  errors: number
  running: boolean
  regenerating: boolean
  /** the latest run started from this bar */
  result: Execution | null
  live: Execution | null
  mask: boolean
  onApprove(): void
  onEdit(): void
  onRegenerate(): void
  onRun(live?: boolean): void
  onRetry(): void
  onEmailed(to: string): void
}

/** Review → Approve → Run / Email, for AI-generated workflows. */
export function ApprovalBar(p: Props) {
  const { wf } = p
  const [confirmRun, setConfirmRun] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const approval = wf.meta.approval
  const lead = wf.ai?.purpose === 'lead_generation'
  const runLabel = lead ? 'Generate Leads' : 'Run Workflow'
  const needs = wf.nodes.filter((n) => n.needs?.length)
  const external = useMemo(
    () =>
      wf.nodes
        .map((n) => ({ n, d: getDef(n.type) }))
        .filter(({ d }) => d && d.role === 'main' && (d.availability === 'planned' || d.availability === 'simulated') && d.kind !== 'trigger'),
    [wf.nodes],
  )
  const planned = external.filter(({ d }) => d!.availability === 'planned')

  return (
    <div className="border-b border-line bg-ink-850 px-3 py-3 sm:px-4">
      {/* ── state line ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {approval && p.approvalCurrent ? (
            <BadgeCheck size={20} className="mt-0.5 shrink-0 text-leaf" />
          ) : wf.meta.approvalInvalidatedAt ? (
            <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber" />
          ) : (
            <Sparkles size={18} className="mt-0.5 shrink-0 text-saffron" />
          )}
          <div className="min-w-0">
            {approval && p.approvalCurrent ? (
              <>
                <p className="text-[13.5px] font-bold text-leaf">Approved · {fmt(approval.approvedAt)}</p>
                <p className="text-[12px] text-muted">This exact version is approved. Any change to its steps or settings will require approval again.</p>
              </>
            ) : wf.meta.approvalInvalidatedAt ? (
              <>
                <p className="text-[13.5px] font-bold text-amber">Approval invalidated — the workflow changed after it was approved</p>
                <p className="text-[12px] text-muted">Review your changes and approve again to run or share it.</p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] font-bold text-fg">
                  {wf.ai?.provider === 'groq' ? 'AI-generated draft' : 'Generated draft'} · review it, then approve
                </p>
                <p className="text-[12px] text-muted">
                  Click any step to check or edit its settings.{needs.length ? ` ${needs.length} step${needs.length > 1 ? 's need' : ' needs'} your input (⚠).` : ''}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!(approval && p.approvalCurrent) ? (
            <>
              <button type="button" onClick={p.onEdit} disabled={p.running} className={btnSecondary}>
                <PencilLine size={13} /> Edit workflow
              </button>
              {wf.ai?.provider === 'groq' && (
                <button type="button" onClick={p.onRegenerate} disabled={p.running || p.regenerating} className={btnSecondary}>
                  {p.regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerate
                </button>
              )}
              <button type="button" onClick={p.onApprove} disabled={p.running || p.regenerating} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-leaf px-3.5 text-[13px] font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-45">
                <CheckCircle2 size={14} /> {wf.meta.approvalInvalidatedAt ? 'Approve again' : 'Approve this workflow'}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setConfirmRun(true)} disabled={p.running} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal px-3.5 text-[13px] font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-45">
                {p.running ? <Loader2 size={14} className="animate-spin" /> : lead ? <Users size={14} /> : <Play size={13} fill="currentColor" />} {p.running ? 'Running…' : runLabel}
              </button>
              <button type="button" onClick={() => setEmailOpen(true)} disabled={p.running} className={btnSecondary}>
                <Mail size={13} /> Request workflow via email
              </button>
            </>
          )}
        </div>
      </div>

      {p.errors > 0 && !(approval && p.approvalCurrent) && (
        <p className="mt-2 text-[12px] text-danger">{p.errors} error{p.errors > 1 ? 's' : ''} must be fixed before approval (red ⚠ on the canvas).</p>
      )}

      {/* ── pre-run disclosure ── */}
      {confirmRun && approval && p.approvalCurrent && (
        <div className="mt-3 rounded-lg bg-ink-900 border border-line-strong p-3.5 text-[12.5px] text-fg" role="dialog" aria-label="Run settings">
          <p className="font-bold text-[13px] text-cyan flex items-center gap-1.5">
            <Sparkles size={14} className="text-cyan" /> Choose Execution Mode
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12px] text-fg-soft">
            <li><strong>Live AI Execution:</strong> Calls the backend LLM gateway via Groq for real responses, capturing actual token usage & live INR costs. Shows real error if backend fails.</li>
            <li><strong>Demo Simulation:</strong> Runs deterministically in-browser with simulated outputs clearly labeled.</li>
            {planned.length > 0 && <li>Connectors requiring real credentials ({[...new Set(planned.map(({ d }) => d!.title))].join(', ')}) remain planned.</li>}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmRun(false)
                p.onRun(true)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal px-3 text-[12.5px] font-bold text-white shadow-sm hover:brightness-110"
            >
              <Sparkles size={12} /> Run Live AI Execution
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmRun(false)
                p.onRun(false)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink-750 border border-line px-3 text-[12.5px] font-semibold text-fg hover:text-white"
            >
              <Play size={11} fill="currentColor" /> Run Demo Simulation
            </button>
            <button type="button" onClick={() => setConfirmRun(false)} className="h-8 rounded-md px-3 text-[12.5px] font-semibold text-muted hover:text-fg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── live progress ── */}
      {p.running && p.live && <Progress exec={p.live} wf={wf} />}

      {/* ── results ── */}
      {!p.running && p.result && <RunResults exec={p.result} wf={wf} lead={lead} mask={p.mask} onRetry={p.onRetry} />}

      {emailOpen && approval && p.approvalCurrent && (
        <EmailDialog
          wf={wf}
          onClose={() => setEmailOpen(false)}
          onSent={(to) => {
            p.onEmailed(to)
          }}
        />
      )}
    </div>
  )
}

const btnSecondary =
  'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold text-fg-soft shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:text-fg disabled:opacity-45'

function Progress({ exec, wf }: { exec: Execution; wf: Workflow }) {
  const main = wf.nodes.filter((n) => getDef(n.type)?.role === 'main').length
  const done = Object.values(exec.steps).filter((s) => s.status === 'success').length
  const current = Object.values(exec.steps).find((s) => s.status === 'running' || s.status === 'waiting')
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[12px] font-semibold text-fg-soft">
        <span>{current ? `${current.status === 'waiting' ? 'Waiting for approval' : 'Running'}: ${current.nodeName}` : 'Starting…'}</span>
        <span>
          {done}/{main} steps
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full bg-teal transition-[width] duration-500" style={{ width: `${(done / Math.max(1, main)) * 100}%` }} />
      </div>
    </div>
  )
}

/** Final output of the run: items from the steps where each path ended. */
function RunResults({ exec, wf, lead, mask, onRetry }: { exec: Execution; wf: Workflow; lead: boolean; mask: boolean; onRetry(): void }) {
  const s = summarize(exec)
  const clean = (i: Item) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== 'notification' && k !== 'tools_called')) as Item
  // where did items stop? (a node output whose items did not continue along any connection)
  const groups = Object.values(exec.steps).flatMap((st) => {
    const def = getDef(st.nodeType)
    if (st.status !== 'success' || def?.role !== 'main' || !st.output) return []
    const node = wf.nodes.find((n) => n.id === st.nodeId)
    const outs = def.outputs(node?.config ?? def.defaults)
    return st.output.outputs.flatMap((list, h) => {
      const handle = outs[h]?.id ?? 'main'
      const continued = wf.edges.some((e) => e.source === st.nodeId && (e.sourceHandle ?? 'main') === handle && (e.targetHandle ?? 'main') === 'main' && exec.edgeItems[e.id])
      if (!list.length || continued) return []
      const stopped = def.kind === 'condition' || handle === 'rejected'
      return [{ node: st.nodeName, label: outs.length > 1 ? outs[h]?.label : '', stopped, items: list.map(clean) }]
    })
  })
  const completed = groups.filter((g) => !g.stopped)
  const stopped = groups.filter((g) => g.stopped)
  const items = completed.flatMap((g) => g.items)
  const failed = exec.status === 'error'
  return (
    <div className="mt-3 rounded-lg bg-ink-900 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[13px] font-bold ${failed ? 'text-danger' : exec.status === 'success' ? 'text-leaf' : 'text-muted'}`}>
          {failed ? 'Run failed' : exec.status === 'canceled' ? 'Run stopped' : lead ? `${items.length} lead record${items.length === 1 ? '' : 's'} produced` : 'Run completed'}
          <span className="ml-2 font-mono text-[11px] font-normal text-muted">
            {Object.values(exec.steps).filter((x) => x.status === 'success').length} steps · {(s.durationMs / 1000).toFixed(1)}s · {s.tokens.toLocaleString('en-IN')} tokens · {formatInr(s.cost)} {!exec.simulated ? '(live tokens)' : '(simulated)'}
          </span>
        </p>
        {!exec.simulated ? (
          <span className="rounded bg-teal/15 border border-teal/30 px-2 py-0.5 text-[10.5px] font-bold text-teal">LIVE AI EXECUTION — Real tokens & responses via Groq</span>
        ) : (
          <span className="rounded bg-[#fbf0dc] px-1.5 py-0.5 text-[10.5px] font-bold text-amber">DEMO DATA — fictional records, simulated AI</span>
        )}
      </div>
      {failed && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-[#f9e4e4] p-2 text-[12.5px] text-[#8a2f2f]">
          <AlertTriangle size={13} /> {exec.haltedAt ? `${exec.steps[exec.haltedAt]?.nodeName}: ${exec.steps[exec.haltedAt]?.error}` : 'The run stopped with an error.'}
          <button type="button" onClick={onRetry} className="ml-auto inline-flex h-7 items-center gap-1 rounded bg-danger px-2.5 text-[12px] font-semibold text-white">
            <RotateCcw size={11} /> Retry from failed step
          </button>
        </div>
      )}
      {completed.map((g) => (
        <div key={g.node + g.label} className="mt-2">
          <p className="mb-1 text-[11.5px] font-semibold text-fg-soft">
            Completed at “{g.node}”{g.label ? ` (${g.label})` : ''} · {g.items.length}
          </p>
          <div className="flex max-h-[240px] flex-col">
            <DataView items={g.items} mask={mask} empty="" />
          </div>
        </div>
      ))}
      {stopped.map((g) => (
        <p key={g.node + g.label} className="mt-2 text-[12px] text-muted">
          {g.items.length} record{g.items.length === 1 ? '' : 's'} stopped at “{g.node}”{g.label ? ` (${g.label})` : ''} — {lead ? 'not qualified in this run' : 'condition not met'}.
        </p>
      ))}
      {!failed && !items.length && !stopped.length && <p className="mt-2 text-[12.5px] text-muted">No records reached the end of the workflow in this run.</p>}
    </div>
  )
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/

function EmailDialog({ wf, onClose, onSent }: { wf: Workflow; onClose(): void; onSent(to: string): void }) {
  const ap = wf.meta.approval!
  const snap = ap.snapshot
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<{ s: 'idle' } | { s: 'sending' } | { s: 'sent'; message: string } | { s: 'error'; message: string }>({ s: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  const steps = snap.nodes.filter((n) => getDef(n.type)?.role === 'main').length
  const valid = name.trim().length >= 2 && EMAIL_RE.test(email.trim())

  const send = async () => {
    if (!valid || state.s === 'sending') return
    setState({ s: 'sending' })
    try {
      const r = await sendWorkflowEmail({
        senderName: name.trim(),
        senderEmail: email.trim(),
        senderPhone: phone.trim(),
        note: note.trim(),
        approval: ap,
        workflow: wf,
      })
      setState({ s: 'sent', message: r.message || 'Your workflow request has been sent to the Core5 team.' })
      onSent(email.trim())
    } catch (e) {
      setState({ s: 'error', message: e instanceof ApiError || e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0b2034]/60 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Request approved workflow" onMouseDown={(e) => e.target === e.currentTarget && state.s !== 'sending' && onClose()} onKeyDown={(e) => e.key === 'Escape' && state.s !== 'sending' && onClose()}>
      <div className="surface-light w-full max-w-lg overflow-hidden rounded-[14px] bg-ink-850 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-bold text-fg">
              <Mail size={16} /> Request this approved workflow
            </p>
            <p className="text-[11.5px] text-cyan">Sends directly to Core5 Engineering (<code className="text-[11px] text-cyan">enquiry@core5.co.in</code>)</p>
          </div>
          <button type="button" onClick={onClose} disabled={state.s === 'sending'} aria-label="Close" className="text-muted hover:text-fg disabled:opacity-40">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 rounded-md bg-ink-900 p-3 text-[12.5px]">
            <dt className="text-faint">Workflow</dt>
            <dd className="font-semibold text-fg">{snap.name}</dd>
            <dt className="text-faint">Description</dt>
            <dd className="text-fg-soft">{snap.description}</dd>
            <dt className="text-faint">Size</dt>
            <dd className="text-fg-soft">
              {steps} steps · {snap.nodes.length} nodes · {snap.edges.length} connections
            </dd>
            <dt className="text-faint">Approved</dt>
            <dd className="text-leaf">{fmt(ap.approvedAt)}</dd>
          </dl>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-muted">Your Name *</span>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (state.s === 'error') setState({ s: 'idle' })
                }}
                placeholder="e.g. Vikram Mehta"
                disabled={state.s === 'sending' || state.s === 'sent'}
                className="mt-1 w-full rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-cyan)] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold text-muted">Your Email *</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (state.s === 'error') setState({ s: 'idle' })
                }}
                onKeyDown={(e) => e.key === 'Enter' && void send()}
                placeholder="vikram@company.com"
                disabled={state.s === 'sending' || state.s === 'sent'}
                className="mt-1 w-full rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-cyan)] focus:outline-none"
              />
              {email && !EMAIL_RE.test(email.trim()) && <span className="mt-1 block text-[11px] text-danger">Enter a valid email.</span>}
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] font-semibold text-muted">Phone Number (optional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              disabled={state.s === 'sending' || state.s === 'sent'}
              className="mt-1 w-full rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-cyan)] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold text-muted">Your Requirements / Message (optional)</span>
            <textarea
              value={note}
              maxLength={600}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Tell our team about your deployment timeline or specific questions..."
              disabled={state.s === 'sending' || state.s === 'sent'}
              className="mt-1 w-full resize-y rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:outline-none"
            />
          </label>

          <p className="text-[11.5px] leading-snug text-faint">
            This sends your enquiry along with this approved workflow diagram and configuration directly to <strong className="text-fg-soft">enquiry@core5.co.in</strong>. The Core5 team will review and reply to your email.
          </p>

          {state.s === 'error' && (
            <p className="flex items-start gap-1.5 rounded-md bg-[#f9e4e4] p-2.5 text-[12.5px] text-[#8a2f2f]" role="alert">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {state.message}
            </p>
          )}
          {state.s === 'sent' && (
            <div className="rounded-md bg-[#e5f1e8] p-3 text-[12.5px] text-leaf" role="status">
              <p className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={15} /> Request sent successfully!
              </p>
              <p className="mt-1 text-[12px] text-leaf/90">
                Your request has been delivered to Core5 enquiry team. We will get in touch with you shortly.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={onClose} disabled={state.s === 'sending'} className="h-9 rounded-md px-3 text-[13px] font-semibold text-muted hover:text-fg">
            {state.s === 'sent' ? 'Close' : 'Cancel'}
          </button>
          {state.s !== 'sent' && (
            <button type="button" onClick={() => void send()} disabled={!valid || state.s === 'sending'} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal px-4 text-[13px] font-bold text-white disabled:opacity-45">
              {state.s === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} {state.s === 'sending' ? 'Submitting…' : 'Submit Request to Core5'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
