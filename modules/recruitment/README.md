# Ek भारत.AI — Recruitment & Onboarding Platform (module)

**Status:** Phase 0 — discovery and planning only. No application code exists yet.
**Owner:** Core5 Systems and Services Pvt. Ltd.
**Last updated:** 2026-11-13

This folder holds everything that belongs to the AI Recruitment & Onboarding
platform, kept separate from the Ek भारत.AI marketing website (`/src`, `/public`)
so the two are never confused. Nothing in this folder is imported by the website,
and nothing in the website is imported here.

## Documents (read in this order)

| # | Document | What it answers |
|---|---|---|
| 1 | [PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Who uses it, what it must do, MVP vs later |
| 2 | [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | How it is built and where AI sits vs deterministic code |
| 3 | [AI_GATEWAY.md](docs/AI_GATEWAY.md) | Provider-independent AI layer: adapters, capability registry, routing, fallback |
| 4 | [AGENT_SPECIFICATIONS.md](docs/AGENT_SPECIFICATIONS.md) | Each AI agent: job, tools, limits, escalation, evaluation |
| 5 | [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) | Entities, relationships, tenant isolation, retention |
| 6 | [SECURITY_AND_GUARDRAILS.md](docs/SECURITY_AND_GUARDRAILS.md) | Auth, prompt-injection defence, privacy, fairness |
| 7 | [TESTING_AND_EVALUATION_STRATEGY.md](docs/TESTING_AND_EVALUATION_STRATEGY.md) | Tests, agent evals, acceptance criteria |
| 8 | [IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) | Phases, scope, Phase 1 acceptance criteria |
| 9 | [COMPETITIVE_ANALYSIS.md](docs/COMPETITIVE_ANALYSIS.md) | Ashby, Greenhouse, HireVue, Paradox, Eightfold and others |
| 10 | [RISKS_AND_TECHNICAL_DECISIONS.md](docs/RISKS_AND_TECHNICAL_DECISIONS.md) | Risks, trade-offs, decisions awaiting approval |

## Conventions used in every document

- **Verified** — checked in this repository or in a cited public source.
- **Assumption** — a reasonable default we are planning around; may change.
- **Open question** — needs an answer from the product owner before it is built.
- **Decision needed** — a choice that requires explicit approval (collected in
  `RISKS_AND_TECHNICAL_DECISIONS.md` § 3).

## Planned layout once Phase 1 is approved (not created yet)

```
modules/recruitment/
  docs/                 ← this planning set
  apps/api/             ← backend service (HTTP API + workflow workers)
  apps/web/             ← recruiter / candidate web app (separate from the marketing site)
  packages/domain/      ← entities, state machines, validation schemas
  packages/ai/          ← AI gateway: neutral interface, router, registries, prompts (versioned)
  packages/ai-adapters/ ← one package per provider — the ONLY place vendor SDKs are imported
  packages/evals/       ← evaluation datasets and runners
  infra/                ← deployment and local-dev configuration
```

Whether this stays inside this repository or moves to its own repository is
decision **D-1** in `RISKS_AND_TECHNICAL_DECISIONS.md`.
