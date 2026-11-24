# Immersive AI Assessment Classroom: design

Status: approach chosen by the product owner (typed answers + AI grading against a rubric).
Date: 2026-11-23.

## Intent

Turn the AI Assessment Agent into a 3D classroom in which a real teacher and a real student move through
the whole assessment lifecycle on the live backend, polished enough for live school demonstrations.
Every animation reports something that actually happened on the server.

## Goals

1. Teacher generates real written questions and a rubric, edits both, and publishes.
2. Publishing uses the existing assignment workflow and reaches the class.
3. Student receives the paper, types answers, saves progress and submits.
4. AI marks typed answers against the rubric: criterion marks, reasoning, constructive feedback.
5. AI marks stay suggestions until the teacher approves them.
6. Students and analytics show approved marks only.
7. The main site embeds the app through configuration, with no hardcoded localhost.

## Non-goals

- Replacing the existing teacher and student portals. They stay available and keep working.
- Changing MCQ/numeric grading or PDF assignment evaluation.
- Per-student targeting of assignments. The existing assignment workflow targets one class.
- Real-time sockets. Short polling is enough for cross-device arrival.

## Anti-goals (a failure even if it "works")

- A number, question, stage or score on screen that the server did not produce.
- A timer-driven progress bar presented as real progress.
- A student seeing an unapproved AI mark.
- A visual effect that blocks a working action. Every step must work without WebGL.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| Typed answers, rubric AI grading, teacher approval | Needs additive backend work | **Chosen by the product owner** |
| Existing MCQ/numeric tests only | No backend work, but rubric grading would be fake | Rejected |
| Existing PDF assignments | Real AI, but a PDF upload breaks the live demo | Rejected |

## Data model (additive, migration 011)

- `aia_written_assignments`: one row per written assignment (`assignment_id`, `university_id`, `subject`,
  `topic`, `difficulty`, `rubric_json`). Its presence is what makes an `aia_assignments` row "written".
- `aia_written_answers`: autosaved answers (`assignment_id`, `student_id`, `position`, `answer_text`).
- Submitting creates a normal `aia_assignment_submissions` row with an opaque `typed:<uuid>` storage key.
  The roster, statuses, `ai_*` suggestion columns and `final_*` marks are therefore the existing ones.

Existing PDF routes treat a `typed:` submission explicitly: no PDF upload to a written assignment, no file
download, and the existing "Evaluate with AI" button runs rubric evaluation for it.

The embedded database applies migration 011 idempotently on open. An LMS host applies it through its own
migration process. Until then the written routes answer `503 WRITTEN_NOT_READY` and nothing else changes.

## Rubric

```json
{ "questions": [ { "position": 1, "criteria": [
  { "id": "C1", "name": "Concept accuracy", "description": "...", "maxMarks": 3 }
], "evaluationRules": ["Award no marks for a restated question."] } ] }
```

Criterion marks are whole numbers and must add up to the question's marks. Question marks must add up to the
assignment total. The server checks this on save and again on publish.

## APIs (all behind the existing auth, tenant and actor checks)

| Method and path (under `/api/assessment-agent`) | Purpose |
|---|---|
| `POST /teacher/assessments/generate-written` | SSE: real generation events. Saves nothing |
| `POST /teacher/written` | Save reviewed questions + rubric as a draft assignment |
| `GET/PUT /teacher/written/:id` | Read or edit the draft |
| `POST /teacher/assignments/:id/publish` | Existing publish route |
| `GET /teacher/written/:id/submissions` | Roster with typed answers and AI suggestions |
| `POST /teacher/written/:id/submissions/:sid/evaluate` | SSE: real evaluation stages, stores `ai_*` only |
| `PUT /teacher/written/:id/submissions/:sid/approve` | Teacher's final criterion marks |
| `GET /teacher/written/analytics` | Approved-marks analytics |
| `GET /student/written` | Written assignments for this student |
| `GET /student/written/:id` | Paper, saved answers, approved result only |
| `PUT /student/written/:id/answers/:position` | Autosave one answer |
| `POST /student/written/:id/submit` | Final submission |

## Generation and streaming

The existing generate route is unchanged. Written generation reuses the provider, timeout, error mapping,
content guard patterns and the throttles. Groq streams tokens. A complete question is emitted only after it
passes per-question validation. The whole response is validated again at the end, and a failure emits `error`,
so the client removes provisional cards. Providers without streaming return once, and the same events follow.

Events: `started`, `model_connected`, `question`, `rubric`, `validated`, `done`, `error`.

## Evaluation stages

`loading_answers`, `matching_rubric`, `model_evaluating`, `validating`, `criterion` (one per marked criterion),
`storing`, `done`, `error`. Each is emitted when that step really runs. Totals are computed by the server.

## Security

- Tenant, teacher, student and role always come from the verified session and database, never the body.
- Unknown body fields are rejected, as in the rest of the module.
- Answers go to the model after the existing name and e-mail redaction, and are marked as data.
- Student views never include `ai_*` data or the rubric's evaluation rules before approval.
- SSE uses `fetch` with the `Authorization` header, so tokens never appear in URLs.

## Animation synchronisation

A small lifecycle store receives only real events. Scenes subscribe to it.

| Visual | Trigger |
|---|---|
| AI core activates | Request accepted (`started`) |
| Question card appears | `question` event |
| Rubric hologram | `rubric` event |
| Paper plane flies | Publish returned success |
| Desk lights up | Student's poll finds the published assignment |
| Grading stages | Evaluation SSE events |
| Score reveal | Approved `finalMarks` returned by the server |

## Frontend

A new lazy route, `/classroom`, in the assessment client, using React Three Fiber v8 (React 18), three and GSAP.
HTML panels carry every interaction. The 3D canvas is decoration that reacts to events, so the flow still works
with no WebGL, and with reduced motion, where the camera and plane jump to their end states.

## Deployment

The main site reads `VITE_ASSESSMENT_APP_URL`. In development it falls back to the current host and
`VITE_ASSESSMENT_DEV_PORT`. In a production build with no URL it shows a clear "not configured" state.

## Left to the builder

Component boundaries, exact motion curves, and low-poly model detail.
