/**
 * Command-line demo: starts the agent with an in-memory database and the demo school, then plays a
 * teacher and a student through the HTTP API (the same calls the web client makes) and prints each step.
 *   npm run demo
 * With an AI key in .env it also generates questions with AI and writes an AI performance report.
 */
const path = require('path');
process.env.AIA_IN_MEMORY = 'true';
process.env.AIA_PORT = process.env.AIA_DEMO_PORT || '5161';
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { start } = require('../backend/src/standalone/server');

const BASE = `http://localhost:${process.env.AIA_PORT}/api`;
const step = (t) => console.log(`\n=== ${t}`);

async function call(method, url, token, body) {
  const r = await fetch(`${BASE}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(json.error || json)}`), { status: r.status, body: json });
  return json;
}
const login = async (email) => (await call('POST', '/auth/login', null, { email, password: 'demo1234' })).token;

async function main() {
  const { server } = await start();
  try {
    const health = await call('GET', '/health');
    step(`AI: ${health.ai.configured ? `${health.ai.provider} / ${health.ai.model}` : `off (${health.ai.reason}); manual flow only`}`);

    const teacher = await login('asha.teacher@demo.local');
    const { classrooms } = await call('GET', '/assessment-agent/teacher/classrooms', teacher);
    step(`Teacher Asha Verma signed in; classes: ${classrooms.map((c) => c.name).join(', ')}`);

    let assessment;
    if (health.ai.configured) {
      step('Generating 3 questions with AI (nothing is saved until the teacher accepts)');
      const gen = await call('POST', '/assessment-agent/teacher/assessments/generate', teacher, { topic: 'Photosynthesis', subject: 'Science', classroomId: 1, count: 3, difficulty: 'easy' });
      gen.questions.forEach((q, i) => console.log(`  Q${i + 1}. ${q.text}`));
      const saved = await call('POST', '/assessment-agent/teacher/assessments/from-review', teacher, {
        title: 'Photosynthesis (AI draft)', subject: 'Science', classroomId: 1, courseId: 1, durationMinutes: 10,
        questions: gen.questions.map((q) => ({ type: q.type, text: q.text, explanation: q.explanation, difficulty: q.difficulty, options: q.options, ...(q.numericAnswer ? { numericAnswer: q.numericAnswer } : {}) })),
      });
      assessment = saved.assessment;
    } else {
      step('Creating a test by hand');
      assessment = (await call('POST', '/assessment-agent/teacher/assessments', teacher, { title: 'Photosynthesis quiz', subject: 'Science', classroomId: 1, courseId: 1, durationMinutes: 10 })).assessment;
      const Q = [
        ['What gas do plants take in for photosynthesis?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 1],
        ['Where in the leaf does photosynthesis mainly happen?', ['Root hairs', 'Chloroplasts', 'Xylem', 'Stomata'], 1],
        ['Which is a product of photosynthesis?', ['Glucose', 'Salt', 'Protein', 'Carbon dioxide'], 0],
      ];
      for (const [text, opts, correct] of Q) {
        await call('POST', `/assessment-agent/teacher/assessments/${assessment.id}/questions`, teacher, { text, options: opts.map((o, i) => ({ text: o, isCorrect: i === correct })) });
        console.log(`  + ${text}`);
      }
    }
    await call('POST', `/assessment-agent/teacher/assessments/${assessment.id}/publish`, teacher);
    step(`Published "${assessment.title}" to Grade 8 - A`);

    for (const [email, pick] of [['aarav@demo.local', [1, 1, 0]], ['diya@demo.local', [0, 1, 3]]]) {
      const s = await login(email);
      const { attempt } = await call('POST', `/assessment-agent/student/assessments/${assessment.id}/attempt`, s);
      for (const [i, q] of attempt.questions.entries()) {
        const body = q.type === 'numerical' ? { value: '1' } : q.type === 'multi_select' ? { optionPositions: [pick[i] ?? 0] } : { optionPosition: pick[i] ?? 0 };
        await call('PUT', `/assessment-agent/student/attempts/${attempt.id}/answers/${q.id}`, s, body);
      }
      const done = await call('POST', `/assessment-agent/student/attempts/${attempt.id}/submit`, s);
      step(`${email} submitted: score ${done.attempt.result?.score ?? done.attempt.score}/${done.attempt.result?.totalQuestions ?? attempt.questions.length}`);
    }

    const { report } = await call('GET', `/assessment-agent/teacher/assessments/${assessment.id}/report`, teacher);
    step(`Teacher report: ${report.summary.studentsAttempted}/${report.summary.studentsInClass} attempted, average ${report.summary.averagePercentage}%`);

    const perf = await call('GET', '/assessment-agent/teacher/students/10/performance', teacher);
    step(`Performance facts for ${perf.student.name}: ${JSON.stringify(perf.metrics.counts)}`);
    if (health.ai.configured) {
      try {
        const ai = await call('POST', '/assessment-agent/teacher/students/10/performance/analysis', teacher, {});
        step('AI performance report (summary):');
        console.log(`  ${JSON.stringify(ai.report?.content?.executiveSummary || ai.analysis || ai).slice(0, 600)}`);
      } catch (e) {
        step(`AI performance report not produced: ${e.message}`);
      }
    }
    step('Done. Run "npm start" and open http://localhost:5060 for the web app.');
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 200);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
