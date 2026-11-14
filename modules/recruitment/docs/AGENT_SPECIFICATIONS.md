# Agent Specifications

Phase 0 · 2026-11-13 · Status: draft for review

## 1. Principles

- **Few agents, narrow jobs.** Six agents cover the product. Anything predictable is
  ordinary code, not an agent.
- **No agent can make a consequential decision.** Agents recommend; humans decide on
  reject, hire, offer and anything legally significant.
- **Tools are typed and allow-listed per agent.** An agent cannot discover or call a tool
  that is not in its list. Tool inputs are schema-validated before execution.
- **Every agent run is bounded:** max tool calls, max tokens/cost, wall-clock timeout.
- **Untrusted content is data, never instructions** (resumes, candidate messages,
  uploaded files, web pages).
- **Outcomes are verified** against the system of record after every write tool.
- **Provider-neutral.** Agents call the AI Gateway by task name only; they never import a
  vendor SDK or name a provider/model. Routing is configuration (see `AI_GATEWAY.md`).

## 2. The orchestrator (deterministic — not an agent)

| Item | Specification |
|---|---|
| Objective | Run tenant-configured workflows reliably from domain events |
| Inputs | Outbox events, timers (SLA checks), human approval events |
| Outputs | Workflow step records, agent task requests, notifications |
| Decides | Which step runs next, retries, timeouts, approval gates |
| Never | Interprets free text, calls a model, or skips an approval gate |

## 3. Action safety classes (used by every agent)

| Class | Examples | Rule |
|---|---|---|
| A — read | Fetch application, read job requirements | Allowed within tenant + task scope |
| B — reversible, low impact | Add an internal note, tag a candidate, draft a message, propose slots | Allowed if the tenant enables it; logged |
| C — external or hard to reverse | Send a message to a candidate, book a calendar slot | Requires approval unless the tenant opts the specific template/action into auto-mode |
| D — consequential | Reject, advance to offer, change compensation, delete data | **Never** executed by an agent; agent may only create a recommendation |

## 4. Agents

### 4.1 Job Requirements Agent
| Item | Specification |
|---|---|
| Objective | Turn a requisition intake into a job description and a **structured requirements list** with the evidence that satisfies each |
| Inputs | Requisition fields, hiring-manager notes, tenant competency framework |
| Outputs | `JobDraft { description, requirements[{id, text, type: must|nice, evidence_examples[], weight}] }` |
| Tools | `get_requisition` (A), `get_competency_framework` (A), `save_job_draft` (B) |
| Context | Tenant style guide; banned-terms list (age, gender, etc.) |
| Success | Every requirement is job-related, testable and free of protected-attribute proxies (checked by a deterministic term list + evaluator) |
| Failure | Missing info → asks the hiring manager specific questions instead of inventing requirements |
| Escalation | Always human-approved before the job opens |
| Evaluation | Rubric review on 50 real-world intakes; bias-term detector recall ≥ 0.95 |

### 4.2 Resume Intelligence Agent
| Item | Specification |
|---|---|
| Objective | Extract what the resume actually claims into a typed evidence record, and flag anomalies |
| Inputs | Sanitised resume text (with page/offset map), job requirements |
| Outputs | `ResumeEvidence { roles[], skills[{name, evidence_spans[], recency, depth}], education[], certifications[], gaps[], anomalies[] }` |
| Tools | None that write — single structured-output call; the worker saves the result after validation |
| Context | Extraction schema, examples; resume enclosed as delimited data |
| Success | Every extracted claim cites a span that exists in the source text (deterministic check) |
| Failure | Unparseable file, very low text yield (scanned image), or invalid schema → `needs_manual_review` |
| Anomalies flagged (never decisive) | Hidden/white text, instruction-like content, impossible dates, duplicate content across applicants, unreadable sections |
| Retry | 2 attempts on schema failure with the validation error fed back; then human |
| Evaluation | Field-level precision/recall on a labelled set of 300 resumes (Indian + international formats); citation validity 100% |

### 4.3 Screening Evaluator
| Item | Specification |
|---|---|
| Objective | Assess each requirement against extracted evidence and explain the result |
| Inputs | `ResumeEvidence`, job requirements, tenant scoring rubric |
| Outputs | `Screening { per_requirement[{id, rating: met|partial|not_evidenced|unclear, citations[], rationale}], overall_recommendation: advance|review|hold, confidence }` |
| Tools | `save_screening` (B) |
| Context | Rubric; explicit instruction that absence of evidence ≠ evidence of absence |
| Success | Agreement with calibrated reviewers ≥ 85%; citations valid; no protected attributes referenced |
| Never | Rejects a candidate; uses name, photo, age, gender, caste, religion, address, college prestige as a signal (these fields are removed before the call) |
| Escalation | `unclear` on any must-have, low confidence, or any anomaly → human review queue |
| Evaluation | Consistency (same input twice → same rating ≥ 95%), counterfactual fairness tests (swap names/gendered terms → no rating change), adverse-impact monitoring |

### 4.4 Interview Agent (adaptive text interview; voice later)
| Item | Specification |
|---|---|
| Objective | Conduct a structured interview that adapts follow-ups to the candidate's resume and answers |
| Inputs | Interview plan (competencies, required questions, time budget), resume evidence, conversation so far |
| Outputs | Next question; at end, a transcript and per-competency evidence notes (scoring is done by a separate grading call, not the conversational call) |
| Tools | `get_interview_plan` (A), `record_answer` (B), `end_interview` (B) |
| Context | Question plan is fixed; the agent may add at most N follow-ups per competency and must cover every required question |
| Success | 100% plan coverage; follow-ups relevant (rubric); no off-limits questions (deterministic + model check) |
| Failure | Candidate prompt-injects or goes off-topic → polite redirect; connection loss → resumable |
| Accessibility | Extra time, screen-reader-friendly, ability to request a human interview instead |
| Escalation | Candidate distress, accommodation request, or complaint → human |
| Evaluation | Simulated candidates (scripted personas incl. adversarial) — coverage, relevance, safety |

### 4.5 Assessment Evaluator (Phase 4)
| Item | Specification |
|---|---|
| Objective | Grade practical tasks against a rubric |
| Inputs | Task spec, rubric, submission, **deterministic test results** from the sandbox |
| Outputs | Per-criterion score with justification; tests are the primary signal for code |
| Tools | `get_test_results` (A), `save_assessment_grade` (B) |
| Success | Inter-rater agreement with expert graders ≥ 0.8 (weighted kappa) on the eval set |
| Integrity | Plagiarism similarity and paste-volume are shown as **review indicators only** |
| Escalation | Score near a pass threshold or integrity indicator present → human |

### 4.6 Operations & Communication Agent
| Item | Specification |
|---|---|
| Objective | Keep pipelines moving: draft messages, interpret candidate replies, propose next actions on stalled items |
| Inputs | Items surfaced by **deterministic** SLA queries, candidate inbound messages, templates |
| Outputs | Drafted messages, parsed intents (e.g. reschedule request → date range), proposed actions |
| Tools | `draft_message` (B), `propose_slots` (B, uses deterministic availability), `send_message` (C), `create_task` (B) |
| Proactive behaviour | Runs on a schedule over a list the orchestrator provides; it does not search for work itself |
| Success | Intent-parsing accuracy ≥ 95% on the eval set; zero sends outside approved templates/auto-mode |
| Escalation | Complaint, legal/medical/compensation topics, anything not matching a template → recruiter |

Onboarding orchestration (documents, tasks, reminders) is **deterministic workflow**,
using this agent only to draft messages and answer FAQ from tenant-approved content.
Talent rediscovery is **search (pgvector + filters) followed by the Screening Evaluator**,
not a separate agent.

## 5. Agent runtime contract (applies to all)

```
AgentTask {
  tenant_id, task_id, agent: enum, gateway_task: TaskName, prompt_version,   // no provider/model here
  input (schema-validated), allowed_tools[], budget { max_tool_calls, max_tokens, deadline }
}
AgentResult {
  status: succeeded | needs_human | failed, output (schema-validated),
  route { provider, model, fallback_from? },   // filled in by the gateway, for audit
  tool_calls[{name, input, result, verified: bool}], usage, cost, trace_id
}
```

- Retries: model/network errors retried by the gateway (bounded); schema failures retried
  with the error message; anything else → `needs_human`.
- A run that exceeds budget ends with `needs_human`, never with partial writes.
- Prompts live in `packages/ai/prompts/<agent>/<version>.md`; the version is stored on every output.

## 6. Evaluation methodology (summary — full detail in testing doc)

Each agent has: a labelled dataset, an automated grader (deterministic checks first,
model-graded rubric second), a fairness/counterfactual suite, an adversarial suite, and a
regression gate in CI. A prompt or model change ships only if it does not regress any
gate metric beyond tolerance.
