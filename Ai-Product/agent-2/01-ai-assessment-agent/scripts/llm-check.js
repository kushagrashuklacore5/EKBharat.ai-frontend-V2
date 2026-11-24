/**
 * Real-LLM check (uses your API key from .env; one small paid request):
 *   npm run llm:check
 * Starts the agent in memory, signs in as the demo teacher and asks the configured provider
 * (Groq / Gemini / Hugging Face) for 2 questions through the normal route. Nothing is saved.
 * (Replaces the LMS-only tests/manual/real*Check.js scripts, which need the LMS server.)
 */
const path = require('path');
process.env.AIA_IN_MEMORY = 'true';
process.env.AIA_PORT = process.env.AIA_CHECK_PORT || '5162';
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { start } = require('../backend/src/standalone/server');

(async () => {
  const { server } = await start();
  const base = `http://localhost:${process.env.AIA_PORT}/api`;
  try {
    const health = await (await fetch(`${base}/health`)).json();
    if (!health.ai.configured) {
      console.log(`AI is not configured (${health.ai.reason}). Set AIA_LLM_PROVIDER, AIA_LLM_MODEL and the provider key in .env.`);
      process.exitCode = 1;
      return;
    }
    const { token } = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'asha.teacher@demo.local', password: 'demo1234' }) })).json();
    const t0 = Date.now();
    const r = await fetch(`${base}/assessment-agent/teacher/assessments/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ topic: 'The water cycle', subject: 'Science', classroomId: 1, count: 2, difficulty: 'easy' }),
    });
    const body = await r.json();
    console.log(`${health.ai.provider} / ${health.ai.model}: HTTP ${r.status} in ${Date.now() - t0} ms`);
    if (!r.ok) { console.log(JSON.stringify(body.error)); process.exitCode = 1; return; }
    for (const [i, q] of body.questions.entries()) {
      console.log(`Q${i + 1}. ${q.text}`);
      for (const o of q.options || []) console.log(`    ${o.isCorrect ? '*' : ' '} ${o.text}`);
    }
    console.log('OK: the provider answered and the output passed validation.');
  } finally {
    server.close();
    setTimeout(() => process.exit(), 200);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
