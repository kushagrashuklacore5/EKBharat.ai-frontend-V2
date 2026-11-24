# AI Assessment Agent

Teachers create tests by hand or with AI, students take timed attempts, and teachers get class reports, per-student performance analysis and AI-assisted marking of written (PDF) assignments.

Extracted from the `lms_final_v1` LMS (`ai-modules/ai-assessment-agent` + its LMS pages). The module's code under `backend/src/` is the LMS code, apart from `backend/src/standalone/` (the new host) and **two files fixed in the audit**: `core/ai/reportPreview.js` and `llm/providers/groq/GroqGenerationProvider.js`. Changed lines are marked `[standalone audit fix]`.

## Features

| Feature | Needs an AI key? |
|---|---|
| Tests: single-answer MCQ, multiple-select, numerical; question pictures; drafts, publish/unpublish, open/close windows | No |
| Assign to a whole class or selected students | No |
| Student attempts with a server-side timer, autosave, automatic grading, results | No |
| Teacher report per test; retakes (archived attempts) | No |
| Student Performance Analyst: facts and charts across tests | No |
| Descriptive assignments: students upload PDFs, teacher marks them | No |
| **Generate questions with AI** (topic, difficulty, type, templates, teacher instructions), teacher reviews before saving | Yes |
| **AI performance report** for one student, which the teacher can share with that student | Yes |
| **AI-assisted assignment evaluation** (suggested marks + feedback; the teacher decides) | Yes |

AI providers: **Groq**, **Gemini**, **Hugging Face** (inference router). AI output is strictly validated, and anything that looks like prompt injection is refused before it reaches the model.

## Quick start

Requires **Node.js 22.5 or newer**, because PDF text extraction (`pdf-parse` 2.x) needs it. Nothing else needs installing: the database is embedded PostgreSQL ([PGlite](https://pglite.dev)).

```bash
cp .env.example .env          # optional: add an AI key
npm run setup                 # installs the server + client and builds the web app
npm start                     # http://localhost:5060
```

Sign in with one of the demo buttons. Every demo account uses the password `demo1234`.

- Teachers: `asha.teacher@demo.local`, `rahul.teacher@demo.local`
- Students: `aarav@demo.local`, `diya@demo.local`, … (10 students in 2 classes)

Other commands:

| Command | What it does |
|---|---|
| `npm run demo` | Runs a scripted teacher-and-student scenario against an in-memory copy and prints each step. It uses AI if it is configured. |
| `npm test` | Runs the full test suite (≈400 tests) on embedded PostgreSQL. |
| `npm run llm:check` | Sends one real request to your configured provider: it generates 2 questions and saves nothing. |
| `npm run llm:check:assignments` | Sends one real AI evaluation of a synthetic PDF answer. |
| `npm run dev` + `npm run dev:client` | Development mode with hot reload. The client runs on :5173 and proxies `/api`. |

## Configuration (`.env`)

To turn AI on, set `AIA_LLM_PROVIDER` (`groq`, `gemini` or `huggingface`), set `AIA_LLM_MODEL`, and add the key for that provider (`GROQ_API_KEY`, `GEMINI_API_KEY` or `HF_TOKEN`). See `.env.example` for every option, including the data folder, the JWT secret and timeouts.

For production, set `AIA_DEMO_MODE=false` and a 32-character or longer `AIA_JWT_SECRET`. Then load your own school directory into the `universities`, `users`, `classrooms`, `student_classroom_assignment`, `classroomAssignments` and `courses` tables (see `backend/src/standalone/schema.sql`).

## How it is built

```
client/ (React, the LMS pages unchanged)  ──>  /api/auth/*            standalone login (JWT)
                                               /api/assessment-agent  THE MODULE (createLmsAssessmentAgentRouter, unchanged)
                                               /api/courses/teaching/overview   course picker (re-implemented)
                                                     │ SQL ({get, all, run, transaction})
                                               embedded PostgreSQL (PGlite) ── schema.sql (LMS tables the module reads + aia_*)
```

### What was extracted

- `backend/src/**`: core services, AI generator and prompts, content guard, performance analyst, assignments, the Postgres LMS adapter, and the providers (Groq, Gemini, Hugging Face).
- `client/src/pages/assessment-agent/*`: all 18 LMS pages and helpers.
- `client/src/components/QuestionImage.jsx`.
- `tests/**`: the module's test suite.
- `docs/ARCHITECTURE.md` and `DEVELOPMENT.md`.

### LMS dependencies removed, and what replaces them

| In the LMS | Standalone replacement |
|---|---|
| LMS PostgreSQL server + `server/config/pg-db.js` | `backend/src/standalone/embeddedDatabase.js`: the same SQL translation, ported, running on PGlite. Data is kept in `./data/db`. |
| LMS schema migrations | `backend/src/standalone/schema.sql`: the 20 tables the module uses, extracted from the LMS migration |
| LMS login, `authMiddleware`, `requireTenant` | `backend/src/standalone/server.js`: email and password login, JWT, school check |
| LMS notifications (`assessmentAgentNotifications.js`) | An in-memory event log at `GET /api/events`, also printed to the console |
| LMS `/api/courses/teaching/overview` | Re-implemented in `server.js` with the same rule: the courses the teacher mentors in each class |
| `MentorLayout`, `StudentLayout`, `auth.jsx`, `TranslationContext` (20 languages) | Small shims in `client/src`. English text is taken from the LMS dictionaries (`client/src/i18n/en.json`). |
| Tests on the LMS test PostgreSQL server | `tests/helpers/lmsTestDb.js` now creates in-memory PGlite databases |
| Real-LLM scripts that read the LMS `server/.env` | `scripts/llm-check.js`, and `tests/manual/realAssignmentEvalCheck.js` now reads this `.env` |

### Test results (this extraction)

On Node 22, **430 of 430 tests pass**, on a clean install in an isolated folder. Nine LMS-host integration suites (`tests/lms-integration/*`) are reported as SKIP because they need the original LMS server; the same scenarios are covered by the module tests, `tests/standalone/` and `npm run demo`.

**Fixed in the audit** (see `../FINAL_AUDIT_REPORT.md`, Tasks 2 and 5):
- **Preview mode invented AI text.** `core/ai/reportPreview.js` was restored to the version before LMS commit `e86611d`, which had made preview mode fill missing report sections with invented AI-sounding text.
- **Groq errors were miscoded.** The Groq provider now uses the provider error contract: a wrong key and a rate limit get their own messages, and response bodies are never put in error messages.
- **New tests:** `tests/ai/groqProvider.test.js` and `tests/standalone/standaloneServer.test.js` (login, sessions, school isolation).

## Customising for a client

- **Branding:** edit `client/src/components/AppLayout.jsx` and `client/src/Login.jsx`. Colours are Tailwind classes.
- **Directory data:** replace `backend/src/standalone/demoSeed.js` with an import from the client's system. To use the client's own database, write a new adapter: the contract is `backend/src/adapters/lms/AssessmentLmsAdapter.js`.
- **Prompts and templates:** edit `backend/src/core/ai/generationPrompt.js` and `generationTemplates.js`.
- **Another PostgreSQL server:** the SQL is plain PostgreSQL. Replace `openEmbeddedDatabase` with a `pg` Pool using the same translation layer.
