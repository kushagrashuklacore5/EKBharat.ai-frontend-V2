import { hash } from './data'
import type { AiTask, Item, ModelInfo, ModelRoutingResult, RoutingStrategy } from './types'

/**
 * Model catalogue used by the router.
 * Scores and INR rates are ILLUSTRATIVE DEMO VALUES for the simulation adapter —
 * they are not provider list prices and never represent actual billing.
 */
export const MODELS: ModelInfo[] = [
  { id: 'gemini-flash', label: 'Gemini Flash', provider: 'Google', quality: 3, speed: 5, indic: 3, inrPerMInput: 25, inrPerMOutput: 100, baseLatencyMs: 350, msPerToken: 4 },
  { id: 'gemini-pro', label: 'Gemini Pro', provider: 'Google', quality: 4.5, speed: 3, indic: 3, inrPerMInput: 110, inrPerMOutput: 880, baseLatencyMs: 700, msPerToken: 10 },
  { id: 'claude-sonnet', label: 'Claude Sonnet', provider: 'Anthropic', quality: 5, speed: 3, indic: 3, inrPerMInput: 260, inrPerMOutput: 1300, baseLatencyMs: 800, msPerToken: 11 },
  { id: 'claude-haiku', label: 'Claude Haiku', provider: 'Anthropic', quality: 3.5, speed: 4.5, indic: 2.5, inrPerMInput: 85, inrPerMOutput: 420, baseLatencyMs: 400, msPerToken: 5 },
  { id: 'sarvam-m', label: 'Sarvam-M', provider: 'Sarvam', quality: 3, speed: 4, indic: 5, inrPerMInput: 30, inrPerMOutput: 90, baseLatencyMs: 450, msPerToken: 6 },
]

export const modelById = (id: string) => MODELS.find((m) => m.id === id)
export const modelLabel = (id: string) => modelById(id)?.label ?? id

export const STRATEGIES: { id: RoutingStrategy; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Balanced', hint: 'Weighs quality, latency and cost equally' },
  { id: 'quality', label: 'Quality First', hint: 'Best answer quality the task needs' },
  { id: 'cost', label: 'Cost Optimized', hint: 'Cheapest model that meets the quality floor' },
  { id: 'latency', label: 'Latency Optimized', hint: 'Fastest model that meets the quality floor' },
]

export const TASKS: { id: AiTask; label: string; minQuality: number; outTokens: number }[] = [
  { id: 'classify', label: 'Classification', minQuality: 2.5, outTokens: 40 },
  { id: 'extract', label: 'Extraction', minQuality: 3, outTokens: 180 },
  { id: 'reason', label: 'Multi-step reasoning', minQuality: 4, outTokens: 420 },
  { id: 'generate', label: 'Generation', minQuality: 3, outTokens: 300 },
  { id: 'chat', label: 'Conversation', minQuality: 3, outTokens: 220 },
  { id: 'embed', label: 'Embeddings', minQuality: 1, outTokens: 0 },
]

const HINGLISH = /\b(mujhe|chahiye|kitna|kya|hai|hain|nahi|kaise|aap|mera|meri|batao|kripya|bhai|paisa|daam|keemat|madad)\b/i

/** Detect the dominant language of free text: script first, then common Hinglish markers. */
export function detectLanguage(text: string): 'Hindi' | 'Tamil' | 'Hinglish' | 'English' {
  if (/[ऀ-ॿ]/.test(text)) return 'Hindi'
  if (/[஀-௿]/.test(text)) return 'Tamil'
  if (HINGLISH.test(text)) return 'Hinglish'
  return 'English'
}

const WEIGHTS: Record<RoutingStrategy, { q: number; s: number; c: number }> = {
  quality: { q: 0.75, s: 0.1, c: 0.15 },
  cost: { q: 0.2, s: 0.15, c: 0.65 },
  latency: { q: 0.2, s: 0.65, c: 0.15 },
  balanced: { q: 0.36, s: 0.3, c: 0.34 },
}

const LABEL: Record<RoutingStrategy, string> = { quality: 'Quality First', cost: 'Cost Optimized', latency: 'Latency Optimized', balanced: 'Balanced' }

/**
 * Pick a model for a task. Deterministic: same inputs → same choice.
 * `pinned` forces a model (e.g. an explicit Chat Model sub-node); the router still picks a fallback.
 */
export function route(opts: { strategy: RoutingStrategy; task: AiTask; text: string; pinned?: string; allowed?: string[] }): ModelRoutingResult {
  const { strategy, task } = opts
  const language = detectLanguage(opts.text)
  const indic = language !== 'English'
  const floor = TASKS.find((t) => t.id === task)?.minQuality ?? 3
  const pool = MODELS.filter((m) => !opts.allowed?.length || opts.allowed.includes(m.id))
  const maxCost = Math.max(...pool.map((m) => m.inrPerMInput + m.inrPerMOutput))
  const w = WEIGHTS[strategy]
  const scored = pool
    .map((m) => {
      const costScore = 1 - (m.inrPerMInput + m.inrPerMOutput) / maxCost
      let score = w.q * (m.quality / 5) + w.s * (m.speed / 5) + w.c * costScore
      if (indic) score = score * 0.7 + 0.3 * (m.indic / 5)
      if (m.quality < floor) score -= 1 // below the task's quality floor
      return { id: m.id, score: Math.round(score * 1000) / 1000 }
    })
    .sort((a, b) => b.score - a.score)

  const selected = opts.pinned && modelById(opts.pinned) ? opts.pinned : scored[0].id
  const fallback = scored.find((c) => c.id !== selected && modelById(c.id)!.provider !== modelById(selected)!.provider)?.id ?? scored.find((c) => c.id !== selected)?.id ?? null
  const m = modelById(selected)!
  const taskLabel = TASKS.find((t) => t.id === task)?.label.toLowerCase() ?? task

  let reason: string
  if (opts.pinned) reason = `Pinned by the connected Chat Model node. Router chose a fallback from a different provider.`
  else if (indic && m.indic >= 5) reason = `${language} input detected — strongest Indic-language support at a low rate.`
  else if (strategy === 'cost') reason = `Lowest ₹/token that clears the quality floor for ${taskLabel}.`
  else if (strategy === 'latency') reason = `Fastest response that clears the quality floor for ${taskLabel}.`
  else if (strategy === 'quality') reason = `Highest-quality model for ${taskLabel}.`
  else reason = m.speed >= 4.5 ? `Low-latency task with sufficient quality for ${taskLabel}.` : `Best overall trade-off of quality, latency and cost for ${taskLabel}.`

  return { strategy, task, language, selected, fallback, reason: `${LABEL[strategy]} · ${reason}`, usedFallback: false, candidates: scored }
}

export interface CompletionRequest {
  model: string
  task: AiTask
  prompt: string
  input: Item[]
  nodeName: string
  /** content generator used by the simulation adapter */
  simulate: () => Item[]
  signal?: AbortSignal
  /** demo-only: make this call fail as if the provider were unavailable */
  forceFail?: boolean
}

export interface CompletionResult {
  items: Item[]
  inputTokens: number
  outputTokens: number
  latencyMs: number
  costInr: number
  source: 'simulated' | 'backend'
}

/** Provider abstraction. The UI and engine never talk to a model vendor directly. */
export interface ModelProvider {
  readonly id: string
  readonly simulated: boolean
  complete(req: CompletionRequest): Promise<CompletionResult>
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number) {
  const m = modelById(modelId)
  if (!m) return 0
  return (inputTokens * m.inrPerMInput + outputTokens * m.inrPerMOutput) / 1e6
}

/**
 * Deterministic simulation adapter. Metrics are derived from the request size and model
 * profile so repeated runs give identical numbers. Clearly labelled as simulated in the UI.
 */
export class SimulatedProvider implements ModelProvider {
  readonly id = 'simulated'
  readonly simulated = true
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const m = modelById(req.model)
    if (!m) throw new Error(`Unknown model "${req.model}"`)
    const payload = req.prompt + JSON.stringify(req.input)
    const inputTokens = Math.max(12, Math.ceil(payload.length / 4))
    const base = TASKS.find((t) => t.id === req.task)?.outTokens ?? 200
    const outputTokens = base ? base + (hash(payload + m.id) % 60) : 0
    const latencyMs = Math.round(m.baseLatencyMs + outputTokens * m.msPerToken + inputTokens * 0.05)
    // the demo waits a scaled-down fraction of the simulated latency
    await wait(Math.min(1400, 280 + latencyMs * 0.35), req.signal)
    if (req.forceFail) throw new Error(`${m.label}: provider unavailable (simulated 503)`)
    return { items: req.simulate(), inputTokens, outputTokens, latencyMs, costInr: estimateCost(m.id, inputTokens, outputTokens), source: 'simulated' }
  }
}

/**
 * Backend adapter for live LLM completions via /api/models/complete.
 * In LIVE mode, it connects to the secure server endpoint. If the provider fails,
 * it throws an execution error and never silently falls back to simulated data.
 */
export class BackendProvider implements ModelProvider {
  readonly id = 'backend'
  readonly simulated = false
  constructor(private endpoint: string) {}
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (req.forceFail) {
      throw new Error(`${req.model}: provider unavailable (injected failure)`)
    }
    const url = this.endpoint.startsWith('http')
      ? this.endpoint
      : (typeof window !== 'undefined' && window.location?.origin
          ? `${window.location.origin}${this.endpoint}`
          : `http://localhost:5501${this.endpoint}`)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: req.model, task: req.task, prompt: req.prompt, input: req.input, node: req.nodeName }),
        signal: req.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new DOMException('Aborted', 'AbortError')
      }
      throw new Error(`Failed to reach model execution gateway (${url}). Is the backend server running?`)
    }

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(errBody.message || `Model execution gateway error (HTTP ${res.status})`)
    }

    const body = (await res.json()) as {
      items: Item[]
      usage: { inputTokens: number; outputTokens: number; latencyMs: number; costInr: number }
      source?: 'backend'
    }

    if (!body || !Array.isArray(body.items)) {
      throw new Error('Model execution gateway returned an invalid response shape.')
    }

    return {
      items: body.items,
      inputTokens: body.usage?.inputTokens ?? 0,
      outputTokens: body.usage?.outputTokens ?? 0,
      latencyMs: body.usage?.latencyMs ?? 0,
      costInr: body.usage?.costInr ?? 0,
      source: 'backend',
    }
  }
}

// optional chaining keeps the engine importable outside Vite (tests, a future server runtime)
const ENDPOINT = (import.meta.env?.VITE_STUDIO_MODEL_GATEWAY as string | undefined) ?? '/api/models/complete'

export const backendProvider = new BackendProvider(ENDPOINT)
export const simulatedProvider = new SimulatedProvider()

let activeExecutionType: 'live' | 'demo' = 'live'

export function setExecutionType(type: 'live' | 'demo') {
  activeExecutionType = type
}

export function getExecutionType() {
  return activeExecutionType
}

/** The active provider: BackendProvider when in LIVE mode, SimulatedProvider in DEMO mode. */
export const provider: ModelProvider = {
  get id() {
    return activeExecutionType === 'live' ? backendProvider.id : simulatedProvider.id
  },
  get simulated() {
    return activeExecutionType !== 'live'
  },
  async complete(req: CompletionRequest) {
    if (activeExecutionType === 'live') {
      // In LIVE mode: NEVER silently fall back to simulated responses
      return await backendProvider.complete(req)
    }
    return await simulatedProvider.complete(req)
  },
}

export function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export const formatInr = (v: number) => (v < 0.01 ? `₹${v.toFixed(4)}` : v < 1 ? `₹${v.toFixed(3)}` : `₹${v.toFixed(2)}`)
