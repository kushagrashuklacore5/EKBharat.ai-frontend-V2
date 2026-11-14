# Implementation Roadmap

Phase 0 · 2026-11-13 · Status: proposal — **Phase 1 starts only after written approval**

Estimates assume a small team (3–4 engineers + part-time product/design/QA) and are
ranges, not commitments. They will be re-estimated after Phase 1.

## Phase overview

| Phase | Name | Main outcome | Estimate |
|---|---|---|---|
| 0 | Discovery & architecture | This document set; decisions D-1…D-9 answered | Done → review |
| 1 | Foundation | Secure multi-tenant skeleton: auth, RBAC, core data, workflow engine, audit, model gateway, CI | 6–8 weeks |
| 2 | Requisitions → Screening | Jobs with structured requirements, applications, resume intelligence, evidence-based screening with human review | 6–8 weeks |
| 3 | Interviews & communications | Scorecards, scheduling, templated messaging, adaptive **text** interview | 6–8 weeks |
| 4 | Assessments & offers | Sandboxed practical assessments, offer drafting + approvals + e-signature | 6–8 weeks |
| 5 | Onboarding & proactive ops | Pre-boarding/onboarding, Operations agent, talent rediscovery, analytics | 5–7 weeks |
| 6 | Hardening & GA | Pen test, load test, DPDP audit readiness, pilot feedback, integrations | 4–6 weeks |

**MVP = end of Phase 3** (≈ 5–6 months): a pilot customer can run real hiring end to end
for knowledge-worker roles, with AI screening and AI text interviews under human review.

## Phase 1 — Foundation (detailed)

### Scope
1. Module scaffolding per D-1 (`apps/api`, `apps/web`, `packages/domain`, `packages/ai`,
   `packages/evals`), TypeScript strict mode, lint, formatting.
2. PostgreSQL schema for: tenants, tenant_configs, users, role_assignments, departments,
   requisitions, jobs, job_requirements, candidates, applications, audit_events,
   outbox_events, idempotency_keys, workflow_runs, workflow_steps, agent_executions, tool_calls.
3. Row-level security on every tenant table.
4. OIDC sign-in for staff; candidate magic-link stub; RBAC policy layer.
5. Requisition state machine with configurable approval chain (end to end in the UI).
6. Durable workflow runner (per D-3) with idempotent steps, retries, dead-letter, and an
   `awaiting_human` approval step type.
7. Provider-independent **AI Gateway** (`AI_GATEWAY.md`): neutral interface, capability and task
   registries, config-driven routing with validation, policy-aware fallback, metering, and
   **at least two provider adapters** passing the conformance suite — exercised by one low-risk task:
   **draft a job description + structured requirements** (Job Requirements Agent), human-approved.
8. Evaluation harness skeleton with the Job Requirements dataset (≥ 30 cases) and CI gate.
9. Audit log viewer for tenant admins.
10. CI pipeline: lint, typecheck, unit, integration (real Postgres), E2E smoke, dependency scan.
11. Local dev with one command (Docker Compose); seed data for two tenants.

### Out of scope for Phase 1
Resume parsing, screening, interviews, assessments, offers, onboarding, external integrations
other than the model provider and transactional email (for magic links).

### Exact acceptance criteria for Phase 1

| # | Criterion | How it is verified |
|---|---|---|
| 1 | A tenant admin can sign in via OIDC, invite users, and assign roles | E2E test |
| 2 | Users of tenant A cannot read or modify any record of tenant B through any API endpoint or storage path | Automated cross-tenant suite covering 100% of endpoints, run in CI |
| 3 | RLS is active on every tenant table; the app DB role has no `BYPASSRLS` | Migration test queries `pg_class`/`pg_policies` and fails if any tenant table lacks a policy |
| 4 | Requisitions follow only defined transitions; invalid transitions return 409 and change nothing | Unit + API tests for every (state, action) pair |
| 5 | A configurable 2-step approval chain works; an approver cannot approve their own requisition | E2E + API tests |
| 6 | Every state change produces exactly one audit event with actor, before/after and reason; audit rows cannot be updated or deleted by the app role | Integration tests incl. attempted UPDATE/DELETE |
| 7 | Replaying the same request with the same idempotency key produces no duplicate effect | Integration test |
| 8 | Killing a worker mid-workflow and restarting it completes the workflow exactly once | Fault-injection test |
| 9 | The Job Requirements Agent returns schema-valid output on ≥ 95% of first attempts and 100% after bounded retry or `needs_human`; nothing invalid is stored | Eval run in CI on ≥ 30 cases |
| 10 | The job draft cannot be published without a human approval action | API test |
| 11 | Every model call records tenant, prompt version, model, tokens, cost and trace id | Integration test |
| 12 | With the model provider disabled, a recruiter can still create and publish a job manually | E2E test |
| 13 | CI runs lint, typecheck, unit, integration, E2E smoke and dependency scan on every PR; main is protected | Repository settings + pipeline run |
| 14 | `docs/` updated: setup guide, architecture decision records for D-1…D-9 | Review |
| 15 | **Provider independence:** the Job Requirements task runs successfully on two different providers by changing routing configuration only; the change touches no agent, workflow or domain file | Recorded demo + CI test that runs the task under both configs and diffs changed files |
| 16 | AI Gateway criteria AG-2 … AG-8 in `AI_GATEWAY.md` § 13 pass | CI |

## Dependencies between phases

- Phase 2 needs Phase 1's gateway, workflow runner and eval harness.
- Phase 3 needs calendar/email provider decisions (D-6) and OAuth app verification lead time
  (start the Google/Microsoft verification process during Phase 2).
- Phase 4 needs the sandbox decision (D-7) — prototype it during Phase 3.
- Phase 6 penetration test booking should be made during Phase 4.

## Complexity summary

| Capability | Complexity | Main risk |
|---|---|---|
| Multi-tenancy + RBAC + audit | Medium | Getting isolation right everywhere — mitigated by RLS + tests |
| Durable workflows | Medium | Choosing and operating the engine |
| Resume intelligence | Medium | Format variety (scans, columns, Indian formats) |
| Evidence-based screening | Medium–High | Calibration data and fairness validation |
| Adaptive text interview | High | Quality and safety of open conversation |
| Practical assessments + sandbox | High | Security of code execution |
| Voice interviews | Very high | Latency, accent bias, cost — postponed |
| Job-board / HRIS integrations | Variable | API access may not be available — unverified |
