# Testing and Evaluation Strategy

Phase 0 · 2026-11-13 · Status: draft for review

**Verified starting point:** the repository has no test runner, no tests and no CI.
Everything below is new.

## 1. Test layers

| Layer | Tooling (assumption) | What it covers | Gate |
|---|---|---|---|
| Unit | Vitest | Domain logic, state machines, validators, permission policies, scoring formulas | ≥ 90% line coverage on `packages/domain` |
| Integration | Vitest + real PostgreSQL (Testcontainers) | Repositories, RLS policies, outbox, idempotency, workflow steps | All pass |
| API contract | OpenAPI schema + request tests | Every endpoint: auth required, role checks, tenant isolation, validation errors | All pass |
| End-to-end | Playwright | Requisition → job → apply → screen → interview → offer → onboarding, in browser | Critical paths pass on every merge |
| Workflow recovery | Fault injection in integration tests | Kill worker mid-step, duplicate events, provider timeouts | No duplicate side effects; resumes correctly |
| Security | Authorization matrix tests, dependency/SAST scans, DAST on staging | Cross-tenant access, privilege escalation, OWASP Top 10 | Zero high findings |
| Performance | k6 | API p95 latency, queue throughput, bulk screening | See § 5 |
| Accessibility | axe + manual screen-reader pass | Candidate portal | WCAG 2.2 AA |
| AI provider conformance | Adapter suite (recorded fixtures per PR, live nightly) | Each adapter × model: text, structured output, tools, streaming, vision/embeddings if declared, error + refusal mapping, secret hygiene | Must pass before a registry entry is `active` |
| Architecture boundaries | Dependency-boundary lint | No vendor SDK import outside `packages/ai-adapters/*` | Zero violations |

The AI is mocked in unit/integration tests (recorded, schema-valid fixtures). Real-model
behaviour is tested only in the evaluation suites below.

## 2. Agent evaluation

Each agent has a versioned dataset in `packages/evals/<agent>/` and a runner that
produces metrics, stored per prompt/model version.

| Agent | Dataset (initial target size) | Key metrics | Pass threshold |
|---|---|---|---|
| Job Requirements | 50 intakes | Rubric score (testable, job-related); bias-term recall | ≥ 4/5 mean; recall ≥ 0.95 |
| Resume Intelligence | 300 labelled resumes (varied formats, Indian + international, scanned, multi-column) | Field precision/recall; citation validity | P ≥ 0.92, R ≥ 0.88; citations 100% valid |
| Screening Evaluator | 400 (resume, job) pairs rated by ≥ 2 calibrated reviewers | Agreement with consensus; consistency on re-run | ≥ 85%; ≥ 95% |
| Interview Agent | 60 simulated candidate personas (strong, weak, evasive, adversarial, non-native English) | Plan coverage; follow-up relevance; policy violations | 100%; ≥ 4/5; 0 |
| Assessment Evaluator | 150 graded submissions per task family | Weighted kappa vs experts | ≥ 0.8 |
| Ops & Communication | 500 candidate messages | Intent accuracy; wrong-send rate | ≥ 95%; 0 |

**Grading order:** deterministic checks first (schema, citation offsets, coverage), then a
model-graded rubric for qualitative aspects, with a sample re-checked by humans each release
to keep the grader honest.

**Data sourcing:** synthetic and consented/anonymised data only; no real candidate data in
evals without a documented legal basis. **Open question:** pilot customer willing to provide
anonymised historical data.

**Provider changes:** evals run per (task, provider, model). A routing change is promoted
only when the target model meets the task's thresholds; results are stored with the routing
config version. Adversarial and fairness suites are run per model, since injection resistance
and bias differ between models.

## 3. Adversarial and prompt-injection tests

A corpus of ≥ 200 adversarial inputs, run on every prompt/model change:
- Hidden instructions in resumes (white text, tiny font, metadata, alt text, footnotes).
- Instructions in candidate chat ("you are now…", fake system messages, tool-name mentions).
- Encoded payloads (base64, homoglyphs, zero-width characters).
- Requests for other candidates' data or for the scoring rubric.

**Pass:** zero changes in rating attributable to injected instructions; zero unauthorised
tool calls; ≥ 90% of injected documents flagged as anomalies.

## 4. Fairness and consistency evaluation

- **Counterfactual pairs:** identical resumes differing only in name, gender markers, age
  signals, religion/caste-associated names, college prestige → rating identical in ≥ 98% of pairs.
- **Consistency:** same input, three runs → same rating ≥ 95%.
- **Adverse impact** (where demographic data exists): selection-rate ratios per stage reported
  monthly; investigation triggered below 0.8.
- **Explanation quality:** sampled reviewers rate rationales as accurate and evidence-based ≥ 90%.

## 5. Performance and load targets (MVP)

| Metric | Target |
|---|---|
| API p95 latency (non-AI endpoints) | < 300 ms at 50 req/s |
| Resume processed end-to-end (upload → screening ready) | p95 < 2 min under normal load |
| Bulk screening of 1,000 applications | < 30 min via batches |
| Adaptive interview turn latency | p95 < 6 s (streamed) |
| Queue recovery after 10-min provider outage | Backlog cleared without manual action, no duplicates |

## 6. Release gates (CI)

A merge to main requires: unit + integration + API contract + E2E critical paths green;
authorization matrix green; no high-severity security findings. A prompt or model change
additionally requires: agent eval thresholds met, no regression > 2 points on any gate metric,
adversarial and fairness suites passing. Results are stored and linked from the change.

## 7. Acceptance criteria per major capability

| Capability | Accepted when |
|---|---|
| Tenant isolation | Automated suite proves no cross-tenant read/write across all endpoints and storage |
| Requisition approvals | Every configured chain path tested; approvers cannot edit what they approve |
| Resume intelligence | Thresholds in § 2 met; scanned/low-text files routed to manual review |
| Screening | Thresholds in § 2 and § 4 met; no auto-rejection path exists (verified by test) |
| Scheduling | No double-booking under concurrent requests; time zones correct across 3 zones |
| Communications | Delivery status only from provider receipts; idempotent under duplicate triggers |
| Adaptive interview | Coverage 100%, zero policy violations on persona suite, resumable after disconnect |
| Offers | Approval chain enforced; compensation encrypted; no send without approval |
| Onboarding | Tasks and documents tracked; reminders idempotent; completion auditable |
| Data rights | Access export and erasure completed and verified within configured SLA |
| Provider independence | Same task passes its eval on two providers switched by configuration only; boundary lint clean (see `AI_GATEWAY.md` § 13) |
