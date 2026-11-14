# Product Requirements — AI Recruitment & Onboarding Platform

Phase 0 · 2026-11-13 · Status: draft for review

## 1. Problem and goal

Recruiting teams spend most of their time on coordination: reading resumes,
chasing interviewers, scheduling, sending status updates, collecting documents.
Decisions that matter (who to interview, who to hire) get rushed and are poorly
documented.

**Goal:** an AI-native recruitment operating system that removes repetitive work,
produces explainable, evidence-backed evaluations, and keeps humans in control of
every consequential decision — sold as a multi-tenant SaaS product.

**Non-goals (explicitly out of scope):**
- Automatic rejection or hiring of a candidate by AI.
- Judging candidates from facial expressions, voice tone, gaze or pauses.
- Payroll, performance management or full HRIS functionality (we integrate, not replace).
- Background verification performed by us (we orchestrate third-party providers later).

## 2. Actors and permissions

| Actor | Who | Can do | Cannot do |
|---|---|---|---|
| Platform admin | Core5 staff | Manage tenants, plans, global model settings | Read tenant candidate data without a logged, time-boxed support grant |
| Tenant admin | Customer's HR/IT lead | Configure company, roles, workflows, integrations, retention | Bypass audit logging |
| Hiring manager | Department head | Raise requisitions, review shortlists, give final interview decisions, request offers | See salary bands of other departments (configurable) |
| Recruiter | TA team | Run pipelines, review AI output, move candidates, send communications | Approve their own offer above policy limits |
| Interviewer | Any employee assigned | See assigned candidate packet, submit scorecard | See other interviewers' scores before submitting (prevents anchoring) |
| Approver | Finance / leadership | Approve requisitions and offers per approval chain | Edit the thing they approve |
| Candidate | External applicant | Apply, upload documents, take interviews/assessments, see own status, request own data, withdraw | See evaluations of themselves beyond what the tenant chooses to share |
| New hire | Accepted candidate | Complete pre-boarding tasks and documents | Access recruiting data |
| AI agent (service identity) | System | Only the tools listed in `AGENT_SPECIFICATIONS.md`, scoped to one tenant and one task | Anything not explicitly granted; any irreversible action without approval |

Permissions are role-based with tenant-configurable overrides, enforced in the
backend (never only in the UI). Every permission check is testable (see testing doc).

## 3. Recruitment lifecycle (state model)

```
Requisition:  draft → pending_approval → approved → open → on_hold → filled | cancelled
Application:  new → screening → shortlisted → interviewing → assessment → decision_pending
              → offer → hired | rejected | withdrawn        (any active state → withdrawn)
Offer:        draft → pending_approval → approved → sent → accepted | declined | expired | rescinded
Onboarding:   preboarding → documents_pending → verification → ready → day_one → completed
```

Rules:
- Only defined transitions are allowed; each has an owner role and preconditions.
- `rejected` and `hired` always require a human action (an AI may *recommend* only).
- Every transition writes an audit event (who/what, when, from, to, reason, evidence links).

## 4. Journeys

### 4.1 Recruiter journey (MVP)
1. Hiring manager raises a requisition → approval chain → job opens.
2. AI drafts a job description **and a structured requirements list** (must-have,
   nice-to-have, evidence that would satisfy each). Recruiter edits and approves.
3. Applications arrive (career page, upload, email forward, later job boards).
4. Resume intelligence extracts structured evidence; screening evaluator scores each
   requirement with citations to the resume. Recruiter sees a ranked list *with reasons*
   and reviews; nothing is auto-rejected.
5. Recruiter shortlists → scheduling automation proposes slots → invites go out.
6. Adaptive interview (AI-led text interview first; human interviews supported throughout).
7. Practical assessment (later phase) graded against a rubric with deterministic tests.
8. Interviewers submit structured scorecards; decision meeting view shows all evidence.
9. Offer drafted from templates and bands → approval chain → sent → accepted.
10. Pre-boarding: document collection, task checklist, day-one plan.

### 4.2 Candidate journey (MVP)
Apply in under 5 minutes on mobile → clear privacy notice → status page with plain-language
updates → interview/assessment links with accessibility options and time-extension requests →
offer acceptance → pre-boarding checklist. Candidates can withdraw and request their data at
any time.

## 5. Company-specific configuration (no code changes per customer)

- Pipeline stages and which are mandatory (within the state model above).
- Approval chains (by department, salary band, headcount type).
- Scorecard templates and rating scales.
- Interview question banks and competency frameworks.
- Communication templates, languages, sender identity.
- Data retention periods (within legal minimums/maximums).
- Which AI features are enabled, and which actions an agent may take without approval
  (from a fixed, safe list — see `AGENT_SPECIFICATIONS.md` § 3).
- Branding of candidate-facing pages.

## 6. Failure and recovery scenarios (must be handled)

| Scenario | Required behaviour |
|---|---|
| Model provider down or rate-limited | Work queues; retries with backoff; recruiter sees "AI analysis pending", manual path always available |
| Model returns invalid/partial output | Schema validation fails → bounded retry → flagged for human; never stored as valid |
| Resume contains hidden instructions | Treated as data; flagged as an anomaly; no tool action influenced (see security doc) |
| Email/calendar integration fails | Action marked failed, not "sent"; retried; recruiter notified after N failures |
| Duplicate webhook / double click | Idempotency keys; no duplicate emails, offers or state transitions |
| Worker crash mid-workflow | Durable workflow resumes from last committed step |
| Candidate disputes an evaluation | Full evidence + model/prompt version shown to recruiter; human re-review recorded |
| Tenant offboarding | Export, then deletion per contract; deletion verified and logged |

## 7. Integrations

| Integration | MVP? | Status |
|---|---|---|
| Email sending (transactional provider) | Yes | Assumption — provider to be chosen (D-6) |
| Inbound email (apply-by-email) | Later | — |
| Google Calendar / Microsoft 365 calendar | Phase 3 | **Open question:** customer mix; both offer public APIs, OAuth app verification needed |
| Video meeting links (Meet/Teams/Zoom) | Phase 3 | Same as above |
| Job boards (LinkedIn, Naukri, Indeed, etc.) | Later | **Not verified** — posting/partner API access is restricted for several; must confirm before promising |
| HRIS export (e.g. Keka, Darwinbox, Zoho People) | Later | **Not verified** — confirm API availability per vendor |
| Background verification vendors | Later | **Not verified** |
| E-signature for offers | Phase 4 | Provider to be chosen |
| SSO for tenant staff (OIDC/SAML) | Phase 1 (OIDC), SAML later | — |

No integration will be described to customers as available until it has been built
and tested against the real API.

## 8. Privacy and security requirements (summary)

Full detail in `SECURITY_AND_GUARDRAILS.md`. Headline requirements:
- India DPDP Act 2023 + DPDP Rules 2025 compliance as the baseline (notice, purpose
  limitation, consent where required, data-principal rights, breach reporting,
  retention limits). **Verified (secondary sources):** the Rules were notified in
  Nov 2025 with obligations phasing in; broader obligations by **13 May 2027**. Exact
  scope of the employment "legitimate use" exception must be confirmed by counsel.
- GDPR-ready design for non-Indian tenants (export, erasure, DPA).
- Strict tenant isolation enforced at the database layer.
- Every AI-assisted evaluation is explainable, versioned and reviewable by a human.

## 9. MVP scope vs future

**MVP (Phases 1–3, see roadmap):** tenants/roles/SSO, requisitions with approvals,
job + structured requirements, career page + application, resume intelligence,
evidence-based screening with human review, structured scorecards, scheduling and
templated communications, adaptive **text** interview, audit trail, analytics basics.

**Next (Phases 4–5):** practical assessments with sandboxed code execution, offers with
approvals and e-signature, pre-boarding/onboarding, proactive operations agent, talent
rediscovery, richer analytics.

**Later / research:** voice interviews, job-board distribution, HRIS sync, background
verification orchestration, bottleneck prediction, multilingual voice.

**Not planned:** behavioural "cheating" or emotion detection used for decisions.

## 10. Success metrics (product level)

- Recruiter time per hire on screening + scheduling reduced by ≥ 40% (measured in pilot).
- Time from application to first response ≤ 48 hours for ≥ 90% of applicants.
- Screening agreement between AI recommendation and calibrated human reviewers ≥ 85% on
  the evaluation set, with no statistically significant adverse impact across measured groups.
- Zero cross-tenant data exposure incidents; zero AI-initiated irreversible actions without approval.
- Candidate satisfaction (post-process survey) ≥ 4.2 / 5.
