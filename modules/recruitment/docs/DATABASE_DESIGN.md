# Database Design

Phase 0 · 2026-11-13 · Status: draft for review · Engine: PostgreSQL (assumption, D-2)

## 1. Tenant isolation

- Every tenant-owned table has `tenant_id uuid not null`.
- **Row-level security (RLS)** is enabled on all tenant tables; policies compare
  `tenant_id` with a session setting (`app.tenant_id`) set by the API per request.
- The application connects as a role **without** `BYPASSRLS`. Migrations and platform
  jobs use a separate role, audited.
- Unique constraints and indexes always lead with `tenant_id`.
- Object storage keys are prefixed `tenants/{tenant_id}/…`; signed URLs are short-lived.
- Automated tests prove that tenant A cannot read or write tenant B data through any API.

## 2. Core entities

```
Tenant ─┬─ Organization settings / Config (versioned)
        ├─ Department ── Requisition ── Job ── JobRequirement
        ├─ User ── RoleAssignment                     │
        ├─ Candidate ── Application ──────────────────┘
        │      │            ├─ ResumeDocument ── ResumeEvidence ── SkillEvidence
        │      │            ├─ Screening ── RequirementAssessment
        │      │            ├─ Interview ── InterviewTurn / Scorecard
        │      │            ├─ Assessment ── Submission ── Grade
        │      │            ├─ Offer ── Approval
        │      │            └─ Message
        │      └─ ConsentRecord / DataRequest
        ├─ Employee ── OnboardingPlan ── OnboardingTask ── Document ── VerificationRecord
        ├─ WorkflowRun ── WorkflowStep ── AgentExecution ── ToolCall
        └─ AuditEvent (append-only), OutboxEvent
```

## 3. Tables (key columns only)

| Table | Key columns | Notes |
|---|---|---|
| `tenants` | id, name, plan, region, status, created_at | Platform-owned |
| `tenant_configs` | tenant_id, version, config jsonb, created_by | Immutable versions; one marked active |
| `users` | tenant_id, id, email, name, idp_subject, status | Unique (tenant_id, email) |
| `role_assignments` | tenant_id, user_id, role, scope (department_id null = all) | |
| `departments` | tenant_id, id, name, parent_id | |
| `requisitions` | tenant_id, id, department_id, title, headcount, band_id, state, created_by | State machine column |
| `jobs` | tenant_id, id, requisition_id, title, description, location, employment_type, state, published_at | |
| `job_requirements` | tenant_id, id, job_id, text, kind (must/nice), weight, evidence_examples jsonb, version | Versioned: screenings reference the version used |
| `candidates` | tenant_id, id, name, email, phone, location, source, created_at | PII; email unique per tenant (dedupe) |
| `applications` | tenant_id, id, candidate_id, job_id, state, stage_entered_at, withdrawn_at | Unique (tenant_id, candidate_id, job_id) |
| `resume_documents` | tenant_id, id, application_id, storage_key, sha256, mime, page_count, text_extracted, extraction_status | Hash for duplicate detection |
| `resume_evidence` | tenant_id, id, resume_document_id, schema_version, data jsonb, prompt_version, model, created_at | |
| `skill_evidence` | tenant_id, id, candidate_id, skill_id, source_type, source_id, span_start, span_end, strength | Powers the skill evidence graph |
| `skills` | id, canonical_name, aliases[], taxonomy_parent | Global taxonomy + tenant extensions |
| `screenings` | tenant_id, id, application_id, requirement_set_version, recommendation, confidence, status (pending/needs_review/reviewed), reviewed_by | |
| `requirement_assessments` | tenant_id, screening_id, requirement_id, rating, citations jsonb, rationale | |
| `interviews` | tenant_id, id, application_id, type (ai_text/human/panel), plan_id, scheduled_at, state | |
| `interview_turns` | tenant_id, interview_id, seq, speaker, content, created_at | Transcript |
| `scorecards` | tenant_id, id, interview_id, author (user or agent), competency_scores jsonb, notes, submitted_at | Hidden from other interviewers until submitted |
| `assessments` / `submissions` / `grades` | … task_id, rubric_id, test_results jsonb, integrity_indicators jsonb | Indicators are informational |
| `offers` | tenant_id, id, application_id, compensation jsonb, state, expires_at | Compensation encrypted at column level |
| `approvals` | tenant_id, id, subject_type, subject_id, step, approver_id, decision, decided_at | Generic approval chain |
| `messages` | tenant_id, id, application_id, direction, channel, template_id, body, status, provider_message_id | Status only from provider receipts |
| `employees` / `onboarding_plans` / `onboarding_tasks` | … | |
| `documents` / `verification_records` | tenant_id, id, owner_type, owner_id, kind, storage_key, status, verified_by | |
| `consent_records` | tenant_id, candidate_id, purpose, notice_version, given_at, withdrawn_at | DPDP notice/consent evidence |
| `data_requests` | tenant_id, id, subject_id, kind (access/correct/erase), state, due_at | |
| `workflow_runs` / `workflow_steps` | tenant_id, id, definition_version, state, attempt, input_hash, output jsonb, error | Durable execution record |
| `agent_executions` | tenant_id, id, step_id, agent, prompt_version, model, input_hash, output jsonb, status, tokens_in, tokens_out, cost, trace_id | |
| `tool_calls` | tenant_id, execution_id, seq, tool, input jsonb, result jsonb, verified bool | |
| `ai_operations` | tenant_id, operation_id, task, provider, model, adapter_version, prompt_version, routing_config_version, attempt, fallback_from, status, finish_reason, error_class, input/output/cached tokens, cost_minor, currency, price_table_version, latency_ms, ttft_ms, trace_id | One row per AI call through the gateway (see `AI_GATEWAY.md` § 8) |
| `ai_routing_configs` | id, scope (env/tenant), version, config jsonb, eval_result_ids, created_by, active | Validated against registries before activation |
| `tenant_ai_credentials` | tenant_id, provider, encrypted_key, key_ref, rotated_at | Optional bring-your-own-key; envelope-encrypted, never returned by any API |
| `audit_events` | tenant_id, id, at, actor_type, actor_id, action, subject_type, subject_id, before jsonb, after jsonb, reason, request_id | **Append-only** (no UPDATE/DELETE grants); hash-chained per tenant |
| `outbox_events` | id, tenant_id, type, payload, created_at, processed_at | Written in the same transaction as the change |
| `idempotency_keys` | tenant_id, key, request_hash, response, created_at | Expires after 24–72 h |

## 4. Skill evidence graph

Not a separate graph database. `skill_evidence` rows link a candidate to a canonical skill
through a **source** (resume span, interview answer, assessment test, certification) with a
strength. Queries ("who has verified Kubernetes evidence from an assessment in the last 2
years?") are SQL. A graph store is reconsidered only if query patterns demand it.

## 5. Search and rediscovery

- `pgvector` embeddings on resume evidence summaries and job requirements, always filtered
  by `tenant_id` first.
- Rediscovery returns candidates who have **not opted out** and whose data is within retention.

## 6. Retention and deletion

| Data | Default retention (tenant-configurable within limits) |
|---|---|
| Rejected/withdrawn candidate data | 12 months after last activity, then deleted or anonymised |
| Hired candidate recruiting data | Moved to employee record; recruiting artefacts per tenant policy |
| Interview transcripts / recordings | 6–12 months |
| Audit events | 7 years (content minimised — references, not full PII) |
| AI execution logs | 90 days full; summary metrics retained longer |
| Backups | 35 days; deletions honoured on restore via a tombstone list |

Deletion is a workflow: storage objects, rows, embeddings and search indexes are removed,
then verified, then the request is closed with an audit event. **Open question:** exact
statutory periods per customer industry — to confirm with counsel.

## 7. Migrations and conventions

- Forward-only, reviewed migrations; every table migration ships with its RLS policy and a test.
- `created_at`, `updated_at` on every table; UUID v7 primary keys (time-ordered).
- Money stored as integer minor units + currency code.
