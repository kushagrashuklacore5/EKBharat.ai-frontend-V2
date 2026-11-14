# AI Gateway — Provider-Independent AI Layer

Phase 0 · 2026-11-13 · Status: **architecture decision (adopted)**, implementation in Phase 1

## 1. Decision

The platform is independent of any single LLM provider. All AI access goes through one
internal **AI Gateway** with a provider-neutral interface. Provider SDKs exist **only**
inside provider adapters. No provider is a permanent dependency or an architectural default;
which provider and model serve a task is **configuration**, chosen per environment, tenant
and task from evaluation results.

## 2. Hard rules (enforced, not advisory)

| # | Rule | Enforcement |
|---|---|---|
| G1 | Agents, workflows, domain services and UI never import a vendor SDK | Lint rule (`no-restricted-imports`) + dependency-boundary check in CI: vendor packages may appear only in `packages/ai-adapters/<provider>` |
| G2 | Provider/model selection changes need **no** code change | Routing lives in versioned configuration; a CI test swaps providers for one task using config only |
| G3 | API keys never reach the browser, logs, traces, prompts or error messages | Secrets loaded server-side from the secret manager; log redaction middleware; test that greps captured logs for key patterns |
| G4 | No capability is assumed universal | Capability registry checked before every call; unsupported → explicit `CapabilityNotSupported` error, never a silent downgrade |
| G5 | Fallback only to a model that supports the task's required capabilities **and** satisfies the task's data policy | Fallback planner filters candidates through both checks before routing |
| G6 | Every AI operation is metered and traceable | One `ai_operations` record per call (see § 8) |

## 3. Layering

```
 Agents / workflows / domain services
        │  (task name + typed input + output schema — nothing provider-specific)
        ▼
 ┌──────────────────── AI Gateway (packages/ai) ────────────────────┐
 │ Task registry ─ Router ─ Policy check ─ Capability check          │
 │ Prompt registry (versioned) ─ Validation ─ Retries ─ Fallback     │
 │ Budgets ─ Metering ─ Tracing ─ Redaction                          │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │  normalized request / response types
        ┌──────────┬─────────────┼─────────────┬──────────────┐
        ▼          ▼             ▼             ▼              ▼
   OpenAI      Anthropic      xAI Grok     Google Gemini   Self-hosted
   adapter     adapter        adapter      adapter         adapter (OpenAI-compatible
                                                           servers e.g. vLLM/Ollama, or native)
 (packages/ai-adapters/* — the ONLY place vendor SDKs are imported)
```

Adding a provider = adding one adapter package + registry entries + passing the conformance
suite (§ 10). No agent or workflow file changes.

## 4. Provider-neutral interface (TypeScript, illustrative)

```ts
// packages/ai/src/gateway.ts — what agents and workflows see
interface AiGateway {
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>
  stream(req: GenerateRequest<string>): AsyncIterable<StreamEvent>
  runTools<T>(req: ToolLoopRequest<T>): Promise<ToolLoopResult<T>>
  embed(req: EmbedRequest): Promise<EmbedResult>
}

interface GenerateRequest<T> {
  task: TaskName                 // e.g. 'resume.extract' — routing key, never a model id
  tenantId: string
  input: TaskInput               // instructions are resolved from the prompt registry by task
  untrusted?: UntrustedContent[] // resumes, candidate text: always delimited as data
  attachments?: Attachment[]     // images/PDFs; requires 'vision' or 'documents' capability
  output?: OutputSchema<T>       // zod/JSON schema; requires 'structured_output' or validated fallback
  budget?: { maxOutputTokens?: number; deadlineMs?: number; maxCostMinor?: number }
  idempotencyKey: string
}

interface GenerateResult<T> {
  status: 'ok' | 'refused' | 'invalid_output' | 'needs_human' | 'failed'
  data?: T                       // present only when schema-valid
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number }
  cost: { amountMinor: number; currency: string; priceTableVersion: string }
  route: { provider: string; model: string; attempt: number; fallbackFrom?: string }
  promptVersion: string
  latencyMs: number
  operationId: string            // links to ai_operations row and trace
}
```

Adapters implement a lower-level, still neutral contract:

```ts
interface ProviderAdapter {
  id: ProviderId
  capabilities(model: string): CapabilitySet          // from the registry, validated at startup
  complete(req: NormalizedRequest): Promise<NormalizedResponse>
  stream(req: NormalizedRequest): AsyncIterable<NormalizedStreamEvent>
  embed?(req: NormalizedEmbedRequest): Promise<NormalizedEmbedResponse>
  mapError(e: unknown): GatewayError                   // rate_limit | timeout | auth | invalid_request
                                                       // | refused | overloaded | unknown
}
```

Normalized response content is a list of neutral blocks: `text`, `tool_call`
(`{id, name, arguments}`), `refusal`, plus `finishReason` ∈ `stop | length | tool_calls |
refused | content_filter | error`. Each adapter translates its vendor's stop reasons,
tool-call shapes and error codes into these. Vendor-only response fields are kept in an
opaque `providerMetadata` bag that domain code must not read.

## 5. Capability registry

A versioned data file (`packages/ai/registry/models.yaml`), not code:

```yaml
- provider: <provider-id>
  model: <exact model id>
  status: active            # active | deprecated | blocked
  context_window: <tokens>
  max_output_tokens: <tokens>
  capabilities:
    text: true
    streaming: true
    structured_output: native | prompt_validated | none
    tool_calling: native | none
    parallel_tool_calls: true | false
    forced_tool_choice: true | false
    vision: true | false
    documents_pdf: true | false
    embeddings: false
    prompt_caching: true | false
  data_policy:
    hosting_region: <region(s)>
    zero_retention_available: true | false
    training_on_inputs: false
    contract_ref: <DPA id>
  pricing: { input_per_mtok_minor: ..., output_per_mtok_minor: ..., currency: USD, table_version: ... }
  verified: { by: conformance-suite, on: <date>, adapter_version: ... }
```

Rules:
- Entries are **verified by the conformance suite** against the real API before activation;
  documentation claims alone are not enough.
- `structured_output: prompt_validated` means the model has no native schema mode; the gateway
  instructs JSON output and validates — this is a distinct, weaker capability, recorded as such.
- Capabilities that differ by model (not just provider) are recorded per model.

## 6. Task registry and routing

Each recruitment task declares what it **needs**, not who serves it:

```yaml
# packages/ai/registry/tasks.yaml
resume.extract:
  requires: [structured_output, documents_pdf?]   # '?' = optional, used when available
  data_class: candidate_pii
  prompt: resume-extract@v3
  eval_suite: resume-intelligence
screening.evaluate:
  requires: [structured_output]
  data_class: candidate_pii
  prompt: screening-evaluate@v5
  eval_suite: screening
interview.next_question:
  requires: [streaming]
  data_class: candidate_pii
ops.parse_intent:
  requires: [structured_output]
  data_class: candidate_pii
search.embed:
  requires: [embeddings]
  data_class: candidate_pii
```

Routing configuration is separate and per environment / tenant:

```yaml
# config/ai-routing/<env>.yaml   (tenant overrides stored in tenant_configs)
routes:
  resume.extract:     { primary: { provider: P1, model: M1 }, fallbacks: [ { provider: P2, model: M2 } ] }
  screening.evaluate: { primary: { provider: P2, model: M3 }, fallbacks: [] }
  search.embed:       { primary: { provider: P4, model: E1 } }
```

At startup and on every config change the gateway **validates** each route: the model exists
in the registry, is `active`, has every `requires` capability, and its `data_policy` satisfies
the task's `data_class` and the tenant's policy (e.g. "India-hosted only", "zero retention
required"). Invalid configuration is rejected — the service refuses to load it rather than
failing at request time.

A route change is only promoted after the task's eval suite passes on the new model
(see testing doc); the eval result id is recorded on the routing config version.

## 7. Fallback

Order of operations on failure of the primary:
1. Retry the **same** route for transient errors (rate limit, timeout, overloaded) with
   bounded exponential backoff.
2. Move to the next configured fallback **only if** it passes capability and data-policy
   checks (re-checked at call time, since tenant policy may have changed).
3. Never fall back on `invalid_request` or auth errors (those are bugs/config errors) or on a
   refusal for policy reasons unless the task explicitly allows it.
4. If nothing eligible remains → `needs_human`; the workflow's manual path takes over.

Outputs are tagged with the route that produced them, and evaluations record which model was
used, so a fallback never silently changes how a candidate was assessed.

## 8. Observability and metering

Table `ai_operations` (extends `agent_executions` in the database design):

| Column | Notes |
|---|---|
| tenant_id, operation_id, task, workflow_step_id | Correlation |
| provider, model, adapter_version, prompt_version, routing_config_version | Reproducibility |
| attempt, fallback_from | Fallback trail |
| status, finish_reason, error_class | Normalized |
| input_tokens, output_tokens, cached_input_tokens | From provider usage |
| cost_minor, currency, price_table_version | Computed from registry pricing |
| latency_ms, time_to_first_token_ms | Streaming measured separately |
| input_hash, output (or reference) | Full payloads stored with access control and the AI-log retention period |
| trace_id | OpenTelemetry |

Dashboards per tenant and per task: cost, latency p50/p95, error and fallback rates, refusal
rate, schema-failure rate. Alerts on spikes.

## 9. Credentials

- Provider keys live in the cloud secret manager; loaded only by the worker/API process that
  hosts the adapters. Never in the database in plain text, never in config files, never in
  the frontend bundle, never in prompts.
- Optional per-tenant "bring your own key": stored encrypted (envelope encryption), decrypted
  only inside the adapter call, never returned by any API.
- Redaction: a logging middleware removes known key formats and `Authorization` headers; the
  adapter error mapper strips request headers from errors before they propagate.
- Rotation: keys can be rotated without deploys; adapters fetch them with a short cache TTL.

## 10. Adapter conformance suite

Every adapter + model combination must pass before its registry entry is marked `active`:

| Test | Checks |
|---|---|
| Text generation | Basic completion; usage reported |
| Structured output | Valid object for 3 schemas incl. nested arrays and enums; invalid outputs surface as `invalid_output` |
| Tool calling | Single and multiple tool calls; arguments parsed and validated; tool results round-trip |
| Streaming | Ordered deltas; final usage; mid-stream error handling |
| Vision / documents | Only if declared |
| Embeddings | Dimensions, determinism tolerance — only if declared |
| Error mapping | Simulated 401, 429, 5xx, timeout map to the right `GatewayError` |
| Refusal mapping | Provider refusal/content-filter maps to `refused` |
| Secret hygiene | No key material in thrown errors or captured logs |

The suite runs against live APIs nightly (small budget) and against recorded fixtures in every PR.

## 11. Self-hosted / open-source models

Supported through an adapter for OpenAI-compatible inference servers (e.g. vLLM, Ollama,
TGI) and, where needed, native adapters. Registry entries for self-hosted models carry their
own `data_policy` (e.g. hosted in our India region, no external transfer) — useful for tenants
that require data never to leave our infrastructure. Capability claims are verified by the
conformance suite like any other model; many self-hosted models will declare
`structured_output: prompt_validated` and `tool_calling: none` and will therefore be routable
only to tasks that do not require those.

## 12. Provider-specific features

Features like prompt caching, batch APIs, reasoning-effort controls or server-side tools stay
inside adapters as **optional optimisations** exposed through neutral hints
(`hints: { cacheablePrefix: true, batchEligible: true, reasoning: 'low'|'medium'|'high' }`).
An adapter that cannot honour a hint ignores it and records that it did. No task may depend on
a hint for correctness.

## 13. Acceptance criteria (Phase 1)

| # | Criterion |
|---|---|
| AG-1 | The Job Requirements task (`job.draft_requirements`) runs end to end with **two different providers**, switched by editing routing configuration only; the diff between the two runs touches no file outside `config/ai-routing/` |
| AG-2 | Both runs pass the same eval suite thresholds and produce schema-valid output |
| AG-3 | CI dependency-boundary check fails if any vendor SDK is imported outside `packages/ai-adapters/*` |
| AG-4 | A route pointing a task at a model lacking a required capability, or violating the task's data policy, is rejected at config load |
| AG-5 | Fallback triggers on simulated rate-limit/outage of the primary and never selects an ineligible model (tested) |
| AG-6 | Every call writes an `ai_operations` row with provider, model, prompt version, tokens, cost, latency, status |
| AG-7 | Captured logs and error payloads from the conformance suite contain no API key material |
| AG-8 | At least two adapters pass the full conformance suite; a third adapter can be added by implementing `ProviderAdapter` only |

Which two providers are used for the AG-1 demonstration is a configuration choice for
Phase 1 (decision D-5), not an architectural one.
