# System Architecture

Phase 0 · 2026-11-13 · Status: recommendation, pending approval of decisions D-1…D-9

## 1. Starting point (verified repository audit)

| Area | Current state |
|---|---|
| Repository | `AI-Bharat-Frontend` / `EKBharat.ai-frontend-V2` — marketing website only |
| Stack | Vite 8, React 19, TypeScript 7, Tailwind 4, React Router 7, Three.js, GSAP, @xyflow/react |
| Backend | **None** |
| Authentication / authorization | **None** |
| Database / data models | **None** (static content in `src/lib/content.ts`) |
| Integrations | None live. Forms post to `SITE.formEndpoint`, which is empty — submissions complete locally only |
| Tests | **None** (no test runner, no lint script) |
| CI / deployment config | **None** in repo |
| Reusable for this product | Brand design tokens (`src/styles/index.css`), UI primitives (Button, Section, PageHero), the Workflow Studio canvas pattern (@xyflow/react) for a future workflow editor |

**Conclusion:** there is no existing backend to reuse. The platform needs a new
service, but it should reuse the website's language (TypeScript), design tokens and
UI conventions so one team can work across both.

## 2. Guiding principles

1. **Deterministic core, AI at the edges.** Workflow state, permissions, scheduling
   maths, approvals and notifications are ordinary code. AI is used only where reading,
   interpreting or adapting language adds measurable value.
2. **AI proposes, the system verifies, humans approve consequential steps.**
3. **Every AI call is typed in and typed out** (schemas on both sides), versioned and logged.
4. **Tenant isolation is enforced by the database**, not just application code.
5. **Boring, proven infrastructure** over novel frameworks.

## 3. Recommended architecture

```
                ┌──────────────── Web app (React, TS) ────────────────┐
                │ recruiter console · interviewer view · candidate    │
                │ portal · tenant admin                               │
                └───────────────────────┬─────────────────────────────┘
                                        │ HTTPS (OIDC session / signed candidate links)
                ┌───────────────────────▼─────────────────────────────┐
                │ API service (TypeScript, Node 24)                    │
                │  • AuthN (OIDC) + AuthZ (RBAC policy layer)          │
                │  • Domain services + state machines (validated)      │
                │  • Writes domain change + outbox event in ONE txn    │
                └──────┬──────────────────────────┬───────────────────┘
                       │                          │
         ┌─────────────▼─────────┐   ┌────────────▼──────────────┐
         │ PostgreSQL            │   │ Object storage (S3-compat)│
         │  RLS per tenant       │   │  resumes, documents       │
         │  outbox, audit log    │   │  (encrypted, AV-scanned)  │
         │  pgvector (search)    │   └───────────────────────────┘
         └─────────────┬─────────┘
                       │ durable jobs / workflow steps
         ┌─────────────▼──────────────────────────────────────────┐
         │ Workflow workers                                        │
         │  • Durable workflow runner (D-3)                        │
         │  • Agent runtime: tool runner + permission gate         │
         │  • Integration adapters (email, calendar, e-sign)       │
         └─────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────▼──────────────┐     ┌─────────────────────────────┐
         │ AI Gateway (packages/ai)   │────▶│ Provider adapters           │
         │  neutral interface, router,│     │ OpenAI · Anthropic · xAI ·  │
         │  capability + task registry│     │ Google · self-hosted        │
         │  validation, fallback, cost│     │ (chosen by config, D-5)     │
         │  prompt registry, logging  │     └─────────────────────────────┘
         └────────────────────────────┘     ┌─────────────────────────────┐
                                            │ Code sandbox (Phase 4, D-7) │
                                            │ isolated, no network        │
                                            └─────────────────────────────┘
```

### 3.1 Components

| Component | Responsibility | Notes |
|---|---|---|
| Web app | All UIs; no business rules beyond display | Separate app from the marketing site; shares design tokens |
| API service | Validation, authorization, state transitions, queries | Single deployable to start (modular monolith), split later only with evidence |
| PostgreSQL | System of record, audit log, outbox, job queue (if D-3 = Postgres), vector search | Row-level security keyed on `tenant_id` |
| Object storage | Original files | Never sent to a model raw without sanitisation (see security doc) |
| Workflow workers | Execute long-running, retryable steps | Each step idempotent and resumable |
| Agent runtime | Runs an agent with an allow-listed toolset for one task | Every tool call passes the permission gate and is logged |
| AI Gateway | One provider-neutral interface for all AI calls | Pluggable adapters; capability registry; task-level routing by config — see `AI_GATEWAY.md` |
| Code sandbox | Runs candidate code for assessments | Phase 4; build-vs-buy decision D-7 |

### 3.2 Why a modular monolith first

One service and one database are simpler to secure, test and operate for a small team.
Internal module boundaries (`requisitions`, `applications`, `interviews`, `offers`,
`onboarding`, `ai`) keep the option to split later. Microservices now would multiply
failure modes without a proven need.

## 4. Where AI reasoning stops and deterministic execution begins

| Step | Deterministic code | AI |
|---|---|---|
| Is this transition allowed? | ✔ state machine + RBAC | ✘ |
| Which applications are stalled? | ✔ SQL over timestamps/SLAs | ✘ |
| What does this resume actually claim? | | ✔ extraction into a schema |
| Does the evidence meet requirement R3? | | ✔ judgement with citations |
| Is the citation real? | ✔ string/offset check against source text | |
| Which interview slots are free? | ✔ calendar intersection | ✘ |
| What does "any day after Diwali works" mean? | | ✔ intent parsing → validated date range |
| Send the email | ✔ adapter + delivery receipt | ✘ (AI may draft text) |
| Next interview question | | ✔ adaptive generation within a question plan |
| Final score aggregation | ✔ fixed formula over rubric scores | ✘ |
| Reject / hire / send offer | ✔ only on human action | ✘ never |

**Outcome verification rule:** after any tool call, the runtime re-reads the actual
system state (DB row, provider receipt) and records success only if it matches. The
model's own claim that something happened is never trusted.

## 5. Orchestration model

The **central orchestrator is deterministic code**, not an LLM. It:
1. Listens to domain events from the outbox (e.g. `application.created`).
2. Looks up the tenant's workflow configuration for that event.
3. Starts a durable workflow whose steps are either plain functions or bounded agent tasks.
4. Enforces approval gates (`awaiting_human` step state) and timeouts.
5. Records every step, input hash, output, model/prompt version and cost.

Agents never call each other directly. They hand results back to the orchestrator,
which decides the next step. This keeps control flow inspectable and testable.

## 6. Model usage — provider-independent

**Decision (adopted):** the platform has no default or permanent LLM provider. All AI access
goes through the AI Gateway; vendor SDKs live only in adapter packages; each recruitment task
is routed to a provider and model by configuration, validated against a capability registry
and the task's data policy. Full design: [`AI_GATEWAY.md`](AI_GATEWAY.md).

Consequences for the rest of the design:
- Agents and workflows name a **task** (e.g. `screening.evaluate`), never a provider or model.
- Structured output, tool calling, streaming, vision and embeddings are normalized; where a
  model lacks a capability natively it is recorded in the registry (e.g. `prompt_validated`
  structured output) and tasks that require the native capability cannot be routed to it.
- Provider-specific optimisations (prompt caching, batch APIs, reasoning controls) are optional
  hints honoured inside adapters; correctness never depends on them.
- Model choice per task is made from **evaluation results**, recorded on the routing config.
- Untrusted content (resumes, candidate messages) is always passed as delimited data in a
  dedicated field of the gateway request, whatever the provider.

## 7. Cross-cutting concerns

| Concern | Approach |
|---|---|
| Idempotency | Idempotency key on every mutating API call and every outbound side effect |
| Retries | Exponential backoff with jitter, max attempts per step type, then dead-letter + alert |
| Observability | Structured JSON logs with `tenant_id`, `workflow_id`, `step_id`, `trace_id`; OpenTelemetry traces; per-tenant AI cost metering |
| Configuration | Tenant config stored as versioned, schema-validated JSON |
| Secrets | Cloud secret manager; per-tenant OAuth tokens encrypted with envelope encryption |
| Time zones | Store UTC; render in user locale; scheduling works in the candidate's zone |
| Localisation | UI in English first; candidate-facing text templatable for Hindi and other languages (D-9) |

## 8. Deployment (assumption, D-4)

- Single cloud region in India for data at rest (e.g. Mumbai) unless a tenant contract
  requires otherwise. **Open question:** whether model inference outside India is
  acceptable to target customers; DPDP permits transfers except to notified countries,
  but enterprise buyers may require more.
- Containers on a managed platform; managed PostgreSQL with point-in-time recovery.
- Environments: local (Docker Compose), staging (anonymised data only), production.
