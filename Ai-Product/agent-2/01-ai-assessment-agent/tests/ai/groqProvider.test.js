// [standalone audit] The Groq provider (added in LMS commit e86611d) had no tests. FAKE fetch only: no network, no key.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { GroqGenerationProvider } = require('../../backend/src/llm/providers/groq/GroqGenerationProvider');
const { loadGenerationConfig } = require('../../backend/src/llm/generationConfig');
const { createGenerationProvider } = require('../../backend/src/llm/createGenerationProvider');
const { AssessmentGenerator } = require('../../backend/src/core/ai/AssessmentGenerator');
const { validateGenerationRequest } = require('../../backend/src/core/ai/generationRequest');
const { buildGenerationPrompt } = require('../../backend/src/core/ai/generationPrompt');
const { genOutput } = require('../helpers/mockProvider');

const KEY = 'gsk_' + 'K'.repeat(40); // synthetic
function fakeFetch(respond) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return respond(url, init); };
  fn.calls = calls;
  return fn;
}
const reply = (status, body, text = '') => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new SyntaxError('bad json'); return body; }, text: async () => text });
const chat = (content) => reply(200, { choices: [{ message: { role: 'assistant', content } }] });
const make = (fetchImpl, extra = {}) => new GroqGenerationProvider({ apiKey: KEY, fetchImpl, ...extra });
const request = validateGenerationRequest({ classroomId: 10, topic: 'Photosynthesis', subject: 'Biology', count: 1, difficulty: 'easy' });
const prompt = () => buildGenerationPrompt(request, { grade: '8' });
async function errorOf(p) { try { await p; } catch (e) { return e; } assert.fail('expected an error'); }

describe('GroqGenerationProvider request', () => {
  it('posts an OpenAI-compatible JSON-mode request with the key only in the Authorization header', async () => {
    const fetch = fakeFetch(() => chat('{"questions":[]}'));
    assert.equal(await make(fetch).generateJson(prompt()), '{"questions":[]}');
    const { url, init } = fetch.calls[0];
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user']);
    assert.equal(init.body.includes(KEY), false, 'the key is never in the body');
  });

  it('never exposes the key when the provider or config is serialized', () => {
    assert.equal(JSON.stringify(make(async () => chat('{}'))).includes(KEY), false);
    const config = loadGenerationConfig({ AIA_LLM_PROVIDER: 'groq', GROQ_API_KEY: KEY });
    assert.equal(JSON.stringify(config).includes(KEY), false);
    assert.deepEqual([config.configured, config.model], [true, 'openai/gpt-oss-120b']);
    assert.equal(createGenerationProvider(config).name, 'groq');
  });

  it('is "not configured" (nothing is called) without a key', () => {
    const config = loadGenerationConfig({ AIA_LLM_PROVIDER: 'groq' });
    assert.deepEqual([config.configured, config.reason], [false, 'API_KEY_MISSING']);
  });
});

describe('GroqGenerationProvider errors follow the provider contract (code + status, never the body)', () => {
  for (const [status, code] of [[401, 'AUTH_FAILED'], [403, 'AUTH_FAILED'], [404, 'MODEL_NOT_FOUND'], [429, 'RATE_LIMITED'], [402, 'QUOTA_EXCEEDED'], [500, 'UNAVAILABLE'], [503, 'UNAVAILABLE'], [400, 'BAD_REQUEST']]) {
    it(`HTTP ${status} -> ${code}`, async () => {
      const err = await errorOf(make(fakeFetch(() => reply(status, {}, `{"error":{"message":"secret-echo ${KEY}"}}`))).generateJson(prompt()));
      assert.deepEqual([err.name, err.code, err.status], ['LlmProviderError', code, status]);
      assert.equal(err.message.includes('secret-echo'), false);
      assert.equal(err.message.includes(KEY), false);
    });
  }

  it('unreadable or empty replies -> BAD_RESPONSE; network failure -> NETWORK_ERROR', async () => {
    assert.equal((await errorOf(make(fakeFetch(() => reply(200, undefined))).generateJson(prompt()))).code, 'BAD_RESPONSE');
    assert.equal((await errorOf(make(fakeFetch(() => reply(200, { choices: [] }))).generateJson(prompt()))).code, 'BAD_RESPONSE');
    assert.equal((await errorOf(make(fakeFetch(() => chat('   '))).generateJson(prompt()))).code, 'BAD_RESPONSE');
    assert.equal((await errorOf(make(async () => { throw new TypeError('fetch failed'); }).generateJson(prompt()))).code, 'NETWORK_ERROR');
  });
});

describe('through the AssessmentGenerator (what the teacher sees)', () => {
  const gen = (fetchImpl, opts = {}) => new AssessmentGenerator({ provider: make(fetchImpl), log: () => {}, ...opts });

  it('valid output -> validated proposal', async () => {
    const out = await gen(async () => chat(genOutput(1))).generate(request, { grade: '8' });
    assert.deepEqual([out.questions.length, out.provider], [1, 'groq']);
  });

  it('a wrong key and a rate limit get their own public errors (not "unavailable")', async () => {
    assert.deepEqual(pick(await errorOf(gen(async () => reply(401, {})).generate(request))), [502, 'AI_CONFIGURATION_REJECTED']);
    assert.deepEqual(pick(await errorOf(gen(async () => reply(429, {})).generate(request))), [429, 'AI_RATE_LIMITED']);
    assert.deepEqual(pick(await errorOf(gen(async () => reply(503, {})).generate(request))), [503, 'AI_UNAVAILABLE']);
  });

  it('a request that does not answer in time is aborted -> AI_TIMEOUT', async () => {
    const hanging = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }));
    assert.deepEqual(pick(await errorOf(gen(hanging, { timeoutMs: 50 }).generate(request))), [504, 'AI_TIMEOUT']);
  });

  function pick(e) { return [e.statusCode, e.code]; }
});
