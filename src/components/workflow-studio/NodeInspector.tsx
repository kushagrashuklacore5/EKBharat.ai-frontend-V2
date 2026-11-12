import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Maximize2, Pin, PinOff, Play, RotateCcw, Send, Trash2, X } from 'lucide-react'
import { DataView } from './DataView'
import { NodeIcon } from './StudioNode'
import { KIND_META } from './workflows'
import { getDef, type Issue, type ParamField } from './engine/registry'
import { formatInr, modelById, modelLabel, STRATEGIES } from './engine/routing'
import { maskPii, safeJson } from './engine/data'
import type { ExecutionStep, NodeConfiguration, NodeSettings, ParamValue } from './engine/types'
import type { StudioNodeType } from './canvas'

interface Props {
  node: StudioNodeType
  step?: ExecutionStep
  issues: Issue[]
  readOnly: boolean
  running: boolean
  mask: boolean
  layout: 'panel' | 'modal'
  onSave(patch: { name: string; config: NodeConfiguration; settings: NodeSettings }): void
  onExecuteStep(): void
  onRetry?(): void
  onPin(pin: boolean): void
  onDelete(): void
  onOpenFull?(): void
  onClose?(): void
}

type Tab = 'parameters' | 'input' | 'output'

export function NodeInspector(p: Props) {
  const { node, step } = p
  const def = getDef(node.data.type)
  const [name, setName] = useState(node.data.name)
  const [config, setConfig] = useState<NodeConfiguration>(node.data.config)
  const [settings, setSettings] = useState<NodeSettings>(node.data.settings ?? {})
  const [touched, setTouched] = useState(false)
  const [tab, setTab] = useState<Tab>(step?.output ? 'output' : 'parameters')
  const [handle, setHandle] = useState(0)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendMsg, setSendMsg] = useState('')
  const [leadModalOpen, setLeadModalOpen] = useState(false)

  // follow external changes (undo/redo, other edits) while there are no unsaved edits
  useEffect(() => {
    if (touched) return
    setName(node.data.name)
    setConfig(node.data.config)
    setSettings(node.data.settings ?? {})
  }, [node.data, touched])
  useEffect(() => {
    if ((step?.output || step?.status === 'error') && p.layout === 'panel') setTab((t) => (t === 'parameters' && !touched ? 'output' : t))
  }, [step?.output, step?.status, p.layout, touched])

  const fieldErrors = useMemo(() => {
    const out: Record<string, string> = {}
    def?.params.forEach((f) => {
      if (!visible(f, config)) return
      const v = config[f.key]
      if (f.required && (v === undefined || String(v).trim() === '')) out[f.key] = 'Required'
      else if (f.type === 'json' && String(v ?? '').trim()) {
        const r = safeJson(String(v))
        if (!r.ok) out[f.key] = 'Invalid JSON'
      } else if (f.type === 'number' && v !== '' && v !== undefined) {
        const n = Number(v)
        if (!Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) out[f.key] = `Enter ${f.min ?? ''}–${f.max ?? ''}`
      }
    })
    if (!name.trim()) out.__name = 'Required'
    return out
  }, [def, config, name])

  if (!def) return <p className="p-4 text-[13px] text-danger">Unknown node type “{node.data.type}”.</p>
  const meta = KIND_META[def.kind]
  const outputs = def.outputs(node.data.config)
  const canSave = touched && !Object.keys(fieldErrors).length
  const set = (k: string, v: ParamValue) => {
    setConfig((c) => ({ ...c, [k]: v }))
    setTouched(true)
  }
  const reset = () => {
    setName(node.data.name)
    setConfig(node.data.config)
    setSettings(node.data.settings ?? {})
    setTouched(false)
  }
  const save = () => {
    if (!canSave) return
    p.onSave({ name: name.trim(), config, settings })
    setTouched(false)
  }
  const inputFields = Object.keys(step?.input.items[0] ?? {}).filter((k) => !k.startsWith('_'))
  const ro = p.readOnly || p.running

  // ── sections ──
  const params = (
    <div className="space-y-3.5">
      <Field label="Node name" error={fieldErrors.__name}>
        <input value={name} disabled={ro} onChange={(e) => (setName(e.target.value), setTouched(true))} className={inputCls} />
      </Field>
      {def.params.filter((f) => visible(f, config)).map((f) => (
        <Field key={f.key} label={f.label} required={f.required} error={fieldErrors[f.key]} help={f.help} expr={f.expr}>
          <ParamInput field={f} value={config[f.key] ?? def.defaults[f.key] ?? ''} disabled={ro} onChange={(v) => set(f.key, v)} />
          {f.expr && !ro && inputFields.length > 0 && (f.type === 'text' || f.type === 'textarea') && (
            <div className="mt-1 flex flex-wrap gap-1">
              {inputFields.slice(0, 8).map((k) => (
                <button key={k} type="button" onClick={() => set(f.key, `${String(config[f.key] ?? '')}{{ $json.${k} }}`)} className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] text-cyan hover:bg-ink-700" title={`Insert {{ $json.${k} }}`}>
                  + {k}
                </button>
              ))}
            </div>
          )}
        </Field>
      ))}
      {def.role === 'main' && def.kind !== 'trigger' && (
        <details className="rounded-md bg-ink-900 px-2.5 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-semibold text-muted">Settings · retries & failure simulation</summary>
          <div className="mt-2 space-y-2">
            <Toggle label="Retry on fail" checked={!!settings.retryOnFail} disabled={ro} onChange={(v) => (setSettings((s) => ({ ...s, retryOnFail: v, maxTries: s.maxTries ?? 2 })), setTouched(true))} />
            {settings.retryOnFail && (
              <label className="flex items-center justify-between gap-2 text-muted">
                Max tries
                <input type="number" min={2} max={5} value={settings.maxTries ?? 2} disabled={ro} onChange={(e) => (setSettings((s) => ({ ...s, maxTries: Number(e.target.value) })), setTouched(true))} className={`${inputCls} !w-16`} />
              </label>
            )}
            <Toggle label="Continue on fail" checked={!!settings.continueOnFail} disabled={ro} onChange={(v) => (setSettings((s) => ({ ...s, continueOnFail: v })), setTouched(true))} />
            <label className="block text-muted">
              Simulate failure <span className="rounded bg-[#fbf0dc] px-1 text-[10px] font-bold text-amber">DEMO</span>
              <select value={settings.simulateFailure ?? 'off'} disabled={ro} onChange={(e) => (setSettings((s) => ({ ...s, simulateFailure: e.target.value as NodeSettings['simulateFailure'] })), setTouched(true))} className={`${inputCls} mt-1`}>
                <option value="off">Off</option>
                <option value="once">Transient — fails first attempt{['agent', 'llm'].includes(def.kind) ? ' (provider outage → fallback model)' : ''}</option>
                <option value="always">Persistent — always fails</option>
              </select>
            </label>
          </div>
        </details>
      )}
      {!ro && (
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={save} disabled={!canSave} className="inline-flex h-8 items-center rounded-md bg-teal px-3 text-[12.5px] font-semibold text-white disabled:opacity-40">
            Save changes
          </button>
          <button type="button" onClick={reset} disabled={!touched} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-muted hover:text-fg disabled:opacity-40">
            <RotateCcw size={12} /> Discard
          </button>
          <button
            type="button"
            onClick={() => (setConfig({ ...def.defaults }), setTouched(true))}
            className="ml-auto text-[11.5px] font-semibold text-faint hover:text-fg"
            title="Replace all parameters with this node type's defaults (not saved until you press Save)"
          >
            Defaults
          </button>
        </div>
      )}
      {touched && Object.keys(fieldErrors).length > 0 && <p className="text-[11.5px] text-danger">Fix the highlighted fields to save.</p>}
    </div>
  )

  const input = (
    <DataView
      items={step ? step.input.items : null}
      mask={p.mask}
      empty={
        !def.hasInput ? (
          'Trigger nodes have no input. Their output is the event (test payload) that starts the run.'
        ) : (
          <>
            No input yet. <b>Execute step</b> runs the previous nodes and this one.
          </>
        )
      }
    />
  )

  const outItems = step?.output?.outputs[handle] ?? null
  const output = (
    <div className="flex min-h-0 flex-col gap-2">
      {step && <StepMeta step={step} />}
      {step?.error && (
        <div className="rounded-md bg-[#f9e4e4] p-2.5 text-[12px] text-[#8a2f2f]">
          <p className="flex items-center gap-1.5 font-bold">
            <AlertTriangle size={12} /> {step.status === 'error' ? 'Node failed' : 'Error'}
          </p>
          <p className="mt-1 font-mono text-[11px]">{p.mask ? maskPii(step.error) : step.error}</p>
          {step.status === 'error' && p.onRetry && !p.running && (
            <button type="button" onClick={p.onRetry} className="mt-2 inline-flex h-7 items-center gap-1 rounded bg-danger px-2.5 text-[12px] font-semibold text-white">
              <RotateCcw size={11} /> Retry from this node
            </button>
          )}
        </div>
      )}
      {step?.routing && <RoutingCard step={step} />}
      {outputs.length > 1 && step?.output && (
        <div className="flex flex-wrap gap-1">
          {outputs.map((o, i) => (
            <button key={o.id} type="button" onClick={() => setHandle(i)} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${handle === i ? 'bg-fg text-ink-950' : 'bg-ink-900 text-muted'}`}>
              {o.label} · {step.output!.outputs[i]?.length ?? 0}
            </button>
          ))}
        </div>
      )}
      {step?.status === 'success' && outItems && outItems.length > 0 && (
        <div className="rounded-lg border border-teal/40 bg-teal/10 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-fg flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-leaf shrink-0" />
                <span>Approved Data / Lead Ready</span>
              </p>
              <p className="text-[11px] text-muted truncate">
                {outItems.length} record{outItems.length > 1 ? 's' : ''} available to send to Core5
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLeadModalOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-teal px-3 text-[11.5px] font-bold text-white shadow-sm hover:brightness-110 shrink-0 transition"
              title="Send this approved lead to enquiry@core5.co.in"
            >
              {sendState === 'sent' ? (
                <>
                  <CheckCircle2 size={11} /> Sent to Core5
                </>
              ) : (
                <>
                  <Send size={11} /> Send Lead to Enquiry
                </>
              )}
            </button>
          </div>
          {sendState === 'sent' && (
            <p className="mt-1.5 text-[11px] font-semibold text-leaf flex items-center gap-1">
              <CheckCircle2 size={12} className="shrink-0" /> {sendMsg}
            </p>
          )}
          {sendState === 'error' && (
            <p className="mt-1.5 text-[11px] text-danger flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" /> {sendMsg}
            </p>
          )}
        </div>
      )}
      <DataView
        items={step?.output ? outItems : node.data.pinned ?? null}
        mask={p.mask}
        empty={step?.status === 'skipped' ? 'Branch not taken in this run — no items reached this node.' : 'Run the workflow or press Execute step to see output.'}
        toolbar={
          !p.readOnly && def.role === 'main' ? (
            node.data.pinned ? (
              <button type="button" onClick={() => p.onPin(false)} className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-[#7a6aa8] hover:bg-ink-900" title="Unpin data">
                <PinOff size={12} /> Unpin
              </button>
            ) : (
              step?.output?.outputs[0]?.length ? (
                <button type="button" onClick={() => p.onPin(true)} className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-muted hover:bg-ink-900 hover:text-fg" title="Pin this output: future runs reuse it instead of executing the node">
                  <Pin size={12} /> Pin
                </button>
              ) : null
            )
          ) : null
        }
      />
      {node.data.pinned && <p className="text-[11px] text-[#7a6aa8]">Pinned data is used instead of executing this node.</p>}
    </div>
  )

  const header = (
    <div className="flex items-start gap-2.5">
      <NodeIcon type={node.data.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-fg">{node.data.name}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-bold" style={{ color: meta.color }}>
            {def.title}
          </span>
          <AvailabilityBadge a={def.availability} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {def.role === 'main' && (
          <button type="button" onClick={p.onExecuteStep} disabled={p.running || p.readOnly} className="inline-flex h-7 items-center gap-1 rounded-md bg-ink-900 px-2 text-[11.5px] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-cyan)] disabled:opacity-40" title="Run this node (and the previous nodes it needs)">
            <Play size={10} fill="currentColor" /> Execute step
          </button>
        )}
        {p.onOpenFull && (
          <button type="button" onClick={p.onOpenFull} className="grid size-7 place-items-center rounded-md text-muted hover:bg-ink-900 hover:text-fg" title="Open full view (double-click a node)" aria-label="Open full node view">
            <Maximize2 size={13} />
          </button>
        )}
        {p.onClose && (
          <button type="button" onClick={p.onClose} className="grid size-7 place-items-center rounded-md text-muted hover:bg-ink-900 hover:text-fg" aria-label="Close node view">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  )

  const criticalErrors = p.issues.filter((i) => i.level === 'error')
  const warnings = p.issues.filter((i) => i.level !== 'error')

  const issuesBox = p.issues.length > 0 && (
    <ul className="space-y-1 rounded-md bg-[#fbf0dc] p-2 text-[11.5px] text-[#7a5414]">
      {p.issues.map((i) => (
        <li key={i.message} className="flex gap-1.5">
          <AlertTriangle size={11} className={`mt-0.5 shrink-0 ${i.level === 'error' ? 'text-danger' : ''}`} /> {i.message}
        </li>
      ))}
    </ul>
  )

  const criticalBox = criticalErrors.length > 0 && (
    <ul className="space-y-1 rounded-md bg-[#fde8e8] p-2 text-[11.5px] text-danger">
      {criticalErrors.map((i) => (
        <li key={i.message} className="flex gap-1.5">
          <AlertTriangle size={11} className="mt-0.5 shrink-0 text-danger" /> {i.message}
        </li>
      ))}
    </ul>
  )

  const footer = !p.readOnly && (
    <button type="button" onClick={p.onDelete} disabled={p.running} className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-danger disabled:opacity-40">
      <Trash2 size={12} /> Remove node
    </button>
  )

  if (p.layout === 'modal') {
    const showInput = def.role === 'main'
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-line p-4">{header}</div>
        <div className={`grid min-h-0 flex-1 gap-0 overflow-y-auto md:overflow-hidden ${showInput ? 'md:grid-cols-[1fr_1.1fr_1fr]' : 'md:grid-cols-[1fr_1fr]'}`}>
          {showInput && <Column title="Input">{input}</Column>}
          <Column title="Parameters" className="bg-ink-850">
            {issuesBox}
            <div className={p.issues.length ? 'mt-3' : ''}>{params}</div>
            <div className="mt-5">{footer}</div>
          </Column>
          <Column title="Output">{output}</Column>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      {header}
      {/* Show only critical errors on top if any; non-blocking warnings stay in Parameters tab */}
      {criticalBox && <div className="mt-3">{criticalBox}</div>}
      {tab === 'parameters' && !criticalBox && warnings.length > 0 && (
        <div className="mt-3">{issuesBox}</div>
      )}
      <div role="tablist" aria-label="Node sections" className="mt-3 flex gap-4 border-b border-line">
        {(['parameters', 'input', 'output'] as Tab[])
          .filter((t) => def.role === 'main' || t === 'parameters')
          .map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`relative pb-2 text-[12.5px] font-semibold capitalize ${tab === t ? 'text-fg' : 'text-muted hover:text-fg-soft'}`}>
              {t}
              {t === 'parameters' && touched && <span className="ml-1 inline-block size-1.5 rounded-full bg-amber align-middle" aria-label="unsaved" />}
              {t === 'output' && step?.status === 'error' && <span className="ml-1 inline-block size-1.5 rounded-full bg-danger align-middle" />}
              <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal ${tab === t ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
      </div>
      <div className="mt-3">{tab === 'parameters' ? params : tab === 'input' ? <div className="h-[260px]">{input}</div> : output}</div>
      <div className="mt-4">{footer}</div>

      {leadModalOpen && outItems && outItems[0] && (
        <SendLeadDialog
          workflowName={node.data.name || 'Workflow Studio'}
          nodeName={node.data.name}
          lead={outItems[0] as Record<string, unknown>}
          onClose={() => setLeadModalOpen(false)}
          onSent={(msg) => {
            setSendState('sent')
            setSendMsg(msg)
          }}
        />
      )}
    </div>
  )
}

function SendLeadDialog({
  workflowName,
  nodeName,
  lead,
  onClose,
  onSent,
}: {
  workflowName: string
  nodeName: string
  lead: Record<string, unknown>
  onClose(): void
  onSent(msg: string): void
}) {
  const initialEmail = String(lead.email || lead.from || lead.sender || '').trim()
  const initialName = String(lead.name || lead.customer || lead.contact || '').trim()
  const initialPhone = String(lead.phone || lead.mobile || '').trim()

  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const valid = name.trim().length >= 2 || email.trim().length >= 4

  const submit = async () => {
    if (!valid || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('http://localhost:5501/api/leads/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowName,
          nodeName,
          lead,
          senderName: name.trim(),
          senderEmail: email.trim(),
          senderPhone: phone.trim(),
          note: note.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to dispatch lead')
      onSent(data.message || 'Lead successfully dispatched to enquiry@core5.co.in!')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0b2034]/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}>
      <div className="surface-light w-full max-w-lg overflow-hidden rounded-[14px] bg-ink-850 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-bold text-fg">
              <Send size={15} /> Send Lead to Core5 Enquiry
            </p>
            <p className="text-[11.5px] text-cyan">Delivers directly to <code className="text-cyan">enquiry@core5.co.in</code></p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} className="text-muted hover:text-fg disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-semibold text-muted">Client / Sender Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                disabled={sending}
                className="mt-1 w-full rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold text-muted">Client Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@company.com"
                disabled={sending}
                className="mt-1 w-full rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] font-semibold text-muted">Phone Number (optional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              disabled={sending}
              className="mt-1 w-full rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold text-muted">Remarks / Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Approved by Finance Manager. Ready for review."
              disabled={sending}
              className="mt-1 w-full resize-y rounded-md bg-ink-900 px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:outline-none"
            />
          </label>

          <div className="rounded-md bg-ink-900 p-2.5 text-[11px] font-mono text-muted max-h-28 overflow-y-auto border border-line">
            <span className="text-cyan font-bold block mb-1">Approved Record Preview:</span>
            <pre className="whitespace-pre-wrap">{JSON.stringify(lead, null, 2)}</pre>
          </div>

          {error && (
            <p className="flex items-start gap-1.5 rounded-md bg-[#f9e4e4] p-2.5 text-[12px] text-[#8a2f2f]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={onClose} disabled={sending} className="h-9 rounded-md px-3 text-[13px] font-semibold text-muted hover:text-fg">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || sending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal px-4 text-[13px] font-bold text-white shadow hover:brightness-110 disabled:opacity-45"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {sending ? 'Dispatching…' : 'Send to enquiry@core5.co.in'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Column({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-h-[260px] flex-col border-b border-line p-4 md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r last:border-r-0 ${className}`} aria-label={title}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">{title}</p>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

const inputCls =
  'w-full rounded-md bg-ink-900 px-2.5 py-1.5 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-cyan)] focus:outline-none disabled:opacity-60'

function visible(f: ParamField, config: NodeConfiguration) {
  if (!f.showIf) return true
  const cur = config[f.showIf.key] ?? false
  return Array.isArray(f.showIf.equals) ? f.showIf.equals.includes(cur) : cur === f.showIf.equals
}

function Field({ label, required, error, help, expr, children }: { label: string; required?: boolean; error?: string; help?: string; expr?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        {label}
        {required && <span className="text-danger">*</span>}
        {expr && <span className="rounded bg-ink-900 px-1 font-mono text-[9.5px] text-cyan" title="Supports expressions like {{ $json.field }}">{'{{ }}'}</span>}
        {error && <span className="ml-auto text-[11px] font-semibold text-danger">{error}</span>}
      </p>
      <div className={error ? '[&_input]:shadow-[inset_0_0_0_1.5px_var(--color-danger)] [&_textarea]:shadow-[inset_0_0_0_1.5px_var(--color-danger)]' : ''}>{children}</div>
      {help && <p className="mt-1 text-[11px] leading-snug text-faint">{help}</p>}
    </div>
  )
}

function ParamInput({ field, value, disabled, onChange }: { field: ParamField; value: ParamValue; disabled: boolean; onChange(v: ParamValue): void }) {
  switch (field.type) {
    case 'select':
      return (
        <select value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'toggle':
      return <Toggle label="" checked={value === true} disabled={disabled} onChange={onChange} />
    case 'number':
      return <input type="number" value={String(value)} min={field.min} max={field.max} disabled={disabled} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} />
    case 'textarea':
      return <textarea value={String(value)} rows={3} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y`} />
    case 'json':
    case 'code':
      return <textarea value={String(value)} rows={field.type === 'code' ? 5 : 6} spellCheck={false} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y font-mono text-[11.5px] leading-relaxed`} />
    default:
      return <input value={String(value)} placeholder={field.placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} />
  }
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange(v: boolean): void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-muted">
      {label}
      <button type="button" role="switch" aria-checked={checked} aria-label={label || 'Toggle'} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-teal' : 'bg-ink-600'}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}
export { Toggle }

export function AvailabilityBadge({ a }: { a: 'builtin' | 'simulated' | 'planned' }) {
  const m = {
    builtin: { t: 'Runs in browser', c: 'text-leaf bg-[#e5f1e8]', tip: 'Real logic executed in this demo' },
    simulated: { t: 'Demo adapter', c: 'text-cyan bg-[#e3f0f6]', tip: 'A simulation adapter returns sample data in this demo' },
    planned: { t: 'Planned connector', c: 'text-amber bg-[#fbf0dc]', tip: 'Connector on the roadmap; the demo returns sample data' },
  }[a]
  return (
    <span className={`rounded px-1 py-px text-[9.5px] font-bold ${m.c}`} title={m.tip}>
      {m.t}
    </span>
  )
}

function StepMeta({ step }: { step: ExecutionStep }) {
  const dur = step.startedAt && step.finishedAt ? step.finishedAt - step.startedAt : undefined
  const tone = step.status === 'success' ? 'text-leaf' : step.status === 'error' || step.status === 'rejected' ? 'text-danger' : 'text-muted'
  return (
    <dl className="grid grid-cols-3 gap-1.5 text-[11px]">
      <Meta k="Status" v={<span className={`font-bold capitalize ${tone}`}>{step.status}</span>} />
      <Meta k="Duration" v={dur !== undefined ? `${(dur / 1000).toFixed(2)}s` : '—'} />
      <Meta k="Items" v={step.output ? step.output.outputs.map((o) => o.length).join(' / ') : '—'} />
      {step.startedAt && <Meta k="Started" v={new Date(step.startedAt).toLocaleTimeString()} />}
      {step.attempts > 1 && <Meta k="Attempts" v={String(step.attempts)} />}
      {step.pinned && <Meta k="Source" v="Pinned" />}
      {step.notes?.map((n) => <p key={n} className="col-span-3 text-[11px] text-faint">{n}</p>)}
    </dl>
  )
}

function Meta({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="rounded bg-ink-900 px-2 py-1">
      <dt className="text-[10px] text-faint">{k}</dt>
      <dd className="truncate font-mono text-fg">{v}</dd>
    </div>
  )
}

/** Model-routing decision and usage for an AI step. */
export function RoutingCard({ step }: { step: ExecutionStep }) {
  const r = step.routing!
  const u = step.usage
  const used = u?.model ?? r.selected
  return (
    <div className="rounded-md bg-[#e3f0f6] p-2.5 text-[12px] text-[#1f3d55]">
      <p className="flex items-center justify-between font-bold">
        <span>Model routing</span>
        <span className="rounded bg-white/70 px-1 text-[9.5px] font-bold text-cyan">{u?.source === 'backend' ? 'GATEWAY' : 'SIMULATED'}</span>
      </p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-[#4d6679]">Selected</dt>
        <dd className="font-semibold">
          {modelLabel(used)} <span className="font-normal text-[#4d6679]">· {modelById(used)?.provider}</span>
          {r.usedFallback && <span className="ml-1 rounded bg-[#fbf0dc] px-1 text-[10px] font-bold text-amber">fallback used</span>}
        </dd>
        {r.usedFallback && (
          <>
            <dt className="text-[#4d6679]">First choice</dt>
            <dd>{modelLabel(r.selected)} (failed)</dd>
          </>
        )}
        <dt className="text-[#4d6679]">Strategy</dt>
        <dd>{STRATEGIES.find((s) => s.id === r.strategy)?.label}</dd>
        <dt className="text-[#4d6679]">Language</dt>
        <dd>{r.language}</dd>
        <dt className="text-[#4d6679]">Reason</dt>
        <dd className="leading-snug">{r.reason.split(' · ').slice(1).join(' · ') || r.reason}</dd>
        {u && (
          <>
            <dt className="text-[#4d6679]">Tokens</dt>
            <dd className="font-mono">
              {(u.inputTokens + u.outputTokens).toLocaleString('en-IN')} <span className="text-[#4d6679]">({u.inputTokens} in · {u.outputTokens} out)</span>
            </dd>
            <dt className="text-[#4d6679]">Latency</dt>
            <dd className="font-mono">{u.latencyMs.toLocaleString('en-IN')} ms</dd>
            <dt className="text-[#4d6679]">Est. cost</dt>
            <dd className="font-mono">{formatInr(u.costInr)}</dd>
          </>
        )}
        <dt className="text-[#4d6679]">Fallback</dt>
        <dd>{r.usedFallback ? '—' : r.fallback ? modelLabel(r.fallback) : 'none'}</dd>
      </dl>
      {u?.source !== 'backend' && <p className="mt-1.5 text-[10.5px] leading-snug text-[#4d6679]">Deterministic simulation with illustrative demo rates — not provider billing.</p>}
    </div>
  )
}
