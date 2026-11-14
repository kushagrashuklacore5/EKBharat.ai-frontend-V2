# Risks and Technical Decisions

Phase 0 · 2026-11-13 · Status: **awaiting product-owner input on § 3**

## 1. Critical risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Cross-tenant data exposure | Low (with controls) | Severe | RLS, isolation test suite in CI, security review per phase |
| R2 | Biased or inconsistent AI screening harms candidates and customers | Medium | Severe | Redaction, counterfactual tests, human decision, adverse-impact monitoring |
| R3 | Prompt injection manipulates evaluations | Medium | High | Data/instruction separation, no write tools in evaluation, validation, adversarial suite |
| R4 | Regulatory change (DPDP phase-in, AI-in-hiring laws abroad) | High | Medium–High | Counsel review before GA; configurable notices, retention, audit exports |
| R5 | No labelled data for evals at start | High | High | Synthetic + consented pilot data; calibration sessions with recruiters in Phase 2 |
| R6 | Model provider outage, price change or behaviour change | Medium | Medium | Provider-independent gateway, multiple adapters, policy-aware fallback, pinned model versions, eval gate before any routing change, manual path |
| R11 | Lowest-common-denominator design: normalizing providers hides useful features or overstates parity | Medium | Medium | Capability registry verified by conformance tests; provider extras only as optional hints; tasks declare required capabilities |
| R12 | Inconsistent evaluations across providers (same candidate scored differently by different models) | Medium | High | Per-task model pinning, route recorded on every evaluation, fallback restricted for scoring tasks, cross-provider eval before promotion |
| R7 | Integration access (job boards, HRIS) not obtainable | Medium | Medium | Verify before committing; feeds/export as fallback |
| R8 | Code-execution sandbox escape | Low | Severe | Managed or hardened sandbox, no network, per-run isolation, external pen test |
| R9 | AI cost per hire too high for mid-market pricing | Medium | Medium | Per-tenant metering, caching, batches, effort tuning measured by evals |
| R10 | Scope creep toward "impressive demos" | High | Medium | Phase gates with acceptance criteria; features need an eval before launch |

## 2. Technical decisions — recommendations and trade-offs

| ID | Decision | Recommendation | Trade-off in plain language |
|---|---|---|---|
| D-1 | Where the code lives | **Own repository** (`ekbharat-recruitment`), keeping this `modules/recruitment/docs` folder as the planning record until then | Same repo is quicker to start but mixes a public marketing site with a product holding sensitive data; a separate repo keeps access, CI and deployments clean |
| D-2 | Database | **PostgreSQL** (managed) with RLS and pgvector | One proven database for records, queue, search and audit; fewer moving parts. A dedicated search/graph DB only if needed later |
| D-3 | Durable workflow engine | **Start with a Postgres-backed job queue + explicit workflow tables**; revisit **Temporal** if workflows become long and complex | Postgres option is simpler to run and enough for MVP; Temporal is more powerful but is another system to operate and learn |
| D-4 | Hosting / region | Managed cloud in an **India region** for data at rest | Needed for Indian enterprise buyers; slightly fewer managed services than US regions |
| D-5 | AI providers | **Adopted: provider-independent AI Gateway** (`AI_GATEWAY.md`) — no default provider in the architecture. Open: which two providers to integrate first for the Phase 1 demonstration, and which models each task uses (decided from evals) | Independence costs more engineering up front (adapters, registry, conformance tests) but removes lock-in and lets each task use the best-fitting, policy-compliant model |
| D-5b | Cheaper model for bulk extraction | Decide **only from eval results** | Cheaper models save money but may miss evidence; let measured accuracy decide |
| D-6 | Email / calendar providers | Transactional email provider TBD; Google + Microsoft calendar in Phase 3 | Depends on target customers' office suites |
| D-7 | Code sandbox for assessments | **Prototype a managed sandbox vs self-hosted (gVisor/Firecracker) in Phase 3** | Managed is faster and safer to start; self-hosted is cheaper at scale but needs security expertise |
| D-8 | Backend language | **TypeScript (Node 24)** end to end | Matches the existing team/site and shares types with the UI; Python has richer ML tooling, which we mostly don't need because models are called via API |
| D-9 | Candidate languages at launch | English + Hindi templates; others later | Each language needs eval coverage for interview quality |

## 3. Decisions that need your input before Phase 1

1. **D-1:** Separate repository for the platform, or keep it inside this website repository?
2. **D-3:** Accept "Postgres queue first, Temporal later if needed"?
3. **D-4 / D-5:** Is model inference outside India acceptable for target customers, or must
   everything stay in India (this changes which model hosting options are possible)?
4. **D-5:** Which **two providers** should Phase 1 integrate first for the provider-independence
   demonstration (e.g. two of OpenAI, Anthropic, xAI, Google, or one cloud provider + one
   self-hosted model)? Do you already hold business accounts / DPAs with any of them?
5. **Target customer for the pilot:** company size, industry, roles hired (tech vs frontline),
   and whether they can share anonymised historical hiring data for evaluation.
6. **Identity:** will customers bring their own SSO (Google Workspace / Microsoft Entra), or do
   we provide sign-in for them?
7. **Team and timeline:** how many engineers are available, and is a ~5–6 month MVP acceptable?
8. **Legal:** who is the counsel contact for DPDP and employment-law review?

## 4. Verified facts vs assumptions vs open questions (summary)

**Verified:** repository is a front-end marketing site with no backend, database, auth,
tests, CI or deployment config; providers differ in structured-output, tool-calling,
forced-tool-choice, refusal and caching behaviour (hence the capability registry, whose entries
are verified per model by conformance tests, not assumed); DPDP Rules 2025 notified with phased obligations (secondary
sources); competitor feature announcements as cited in `COMPETITIVE_ANALYSIS.md` (mostly vendor-reported).

**Assumptions:** TypeScript backend; PostgreSQL; India hosting; mid-market Indian companies
as first customers; English + Hindi first; small team of 3–4 engineers.

**Open questions:** items in § 3; exact scope of the DPDP employment legitimate-use exception;
availability of job-board and Indian HRIS APIs; statutory retention periods by industry.
