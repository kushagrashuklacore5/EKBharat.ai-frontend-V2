import { LanguagesVisual } from '../agents/LanguagesVisual'

/**
 * Content blocks that used to live only on the homepage. The homepage is now an
 * overview; these keep every detail available on the relevant product page.
 */

export const STUDIO_POINTS: [string, string][] = [
  ['Visual builder', 'Drag nodes, connect them and configure each step — no glue code.'],
  ['AI-native nodes', 'LLM calls, agents, retrieval and model routing are first-class building blocks.'],
  ['Real execution logic', 'Triggers, branches, loops, parallel paths and human approvals.'],
  ['Operate with confidence', 'Execution history, step outputs and managed deployment.'],
]

export const ORCH_TERMS: [string, string][] = [
  ['Provider abstraction', 'One API for many model providers and self-hosted models.'],
  ['Task-specific selection', 'Each request type can use the model that suits it.'],
  ['Cost & latency control', 'Policies decide when cheaper or faster models are good enough.'],
  ['Fallback strategies', 'Requests move to an alternative when a provider fails.'],
  ['Structured outputs', 'Responses are validated against a schema before use.'],
]

export const GPU_MODES: [string, string][] = [
  ['Pay-as-you-go', 'Hourly compute for experiments, batch jobs and spiky workloads.'],
  ['Monthly plans', 'Predictable capacity for steady production traffic.'],
  ['Dedicated GPUs', 'Reserved resources for isolation and consistent performance.'],
  ['Inference', 'Serve open-weight or fine-tuned models behind managed endpoints.'],
  ['Fine-tuning', 'Adapt base models to your domain data.'],
  ['Training', 'Run longer training workloads without buying hardware.'],
]

/** numbered definition list used by all three blocks */
export function PointList({ items, cols = 'sm:grid-cols-2 lg:grid-cols-4' }: { items: [string, string][]; cols?: string }) {
  return (
    <dl className={`grid gap-x-8 gap-y-6 ${cols}`}>
      {items.map(([t, d], i) => (
        <div key={t} data-reveal={String(i % 4)} className="border-t-2 border-line-strong pt-4">
          <dt className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <span className="font-mono text-[11px] text-cyan">0{i + 1}</span>
            {t}
          </dt>
          <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{d}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "Built for India's languages" — illustration + explanation */
export function LanguagesBlock() {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
      <LanguagesVisual />
      <div>
        <p data-reveal className="eyebrow">
          Built for India’s languages
        </p>
        <h3 data-reveal="1" className="display mt-4 text-[clamp(1.6rem,2.8vw,2.3rem)] text-fg">
          Your customers don’t all write in English.
        </h3>
        <p data-reveal="2" className="mt-4 max-w-xl leading-relaxed text-muted">
          India works in dozens of languages and scripts. Agents can detect the language of a request and answer in it, using the same tools, data and
          approval rules — so a support process doesn’t need a separate system for every language.
        </p>
      </div>
    </div>
  )
}
