/**
 * Secure Backend Model Execution Gateway.
 *
 * Calls real LLM completions via Groq on the server side using GROQ_API_KEY.
 * Validates requests, allowlists models, parses structured outputs into Item arrays,
 * captures real token metrics, and calculates INR pricing.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Model pricing in INR per million tokens (mirrors routing.ts with configurable rates)
const MODEL_PRICING = {
  'gemini-flash': { inrPerMInput: 25, inrPerMOutput: 100, groqModel: 'openai/gpt-oss-20b' },
  'gemini-pro': { inrPerMInput: 110, inrPerMOutput: 880, groqModel: 'openai/gpt-oss-120b' },
  'claude-sonnet': { inrPerMInput: 260, inrPerMOutput: 1300, groqModel: 'openai/gpt-oss-120b' },
  'claude-haiku': { inrPerMInput: 85, inrPerMOutput: 420, groqModel: 'openai/gpt-oss-20b' },
  'sarvam-m': { inrPerMInput: 30, inrPerMOutput: 90, groqModel: 'qwen/qwen3.8-27b' },
  'openai/gpt-oss-120b': { inrPerMInput: 120, inrPerMOutput: 480, groqModel: 'openai/gpt-oss-120b' },
  'openai/gpt-oss-20b': { inrPerMInput: 40, inrPerMOutput: 160, groqModel: 'openai/gpt-oss-20b' },
  'qwen/qwen3.8-27b': { inrPerMInput: 50, inrPerMOutput: 200, groqModel: 'qwen/qwen3.8-27b' },
};

const ALLOWED_TASKS = new Set(['classify', 'extract', 'reason', 'generate', 'chat', 'embed']);

const { HttpError } = require('./workflow-ai');

function resolveGroqModel(requestedModel) {
  const profile = MODEL_PRICING[requestedModel];
  if (profile) return profile.groqModel;
  // If it's a direct Groq model
  if (requestedModel === 'openai/gpt-oss-120b' || requestedModel === 'openai/gpt-oss-20b' || requestedModel === 'qwen/qwen3.8-27b') {
    return requestedModel;
  }
  return process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
}

function calculateCostInr(modelId, inTokens, outTokens) {
  const p = MODEL_PRICING[modelId] || MODEL_PRICING['openai/gpt-oss-120b'];
  return (inTokens * p.inrPerMInput + outTokens * p.inrPerMOutput) / 1e6;
}

function systemPromptForTask(task, nodeName) {
  const base = `You are executing an automated step for enterprise node "${nodeName || 'AI Step'}" in Ek Bharat.AI Workflow Studio. Respond ONLY with valid, unescaped JSON.`;
  switch (task) {
    case 'classify':
      return `${base}\nClassify the input item. Return a JSON object with: { "category": string, "confidence": number (0-1), "language": string, "reason": string }.`;
    case 'extract':
      return `${base}\nExtract structured fields from the input according to the prompt. Return a JSON object with the extracted fields.`;
    case 'chat':
      return `${base}\nGenerate a conversational response in the same language as the user. Return a JSON object with: { "reply": string, "language": string, "lead_score": number (0-100), "qualified": boolean }.`;
    case 'generate':
      return `${base}\nGenerate the requested text or content based on the input and prompt. Return a JSON object with: { "text": string, "summary": string }.`;
    case 'reason':
    case 'generate':
    default:
      return `${base}\nExecute the prompt using the provided input data. Return a JSON object containing the result fields or structured analysis.`;
  }
}

/** Validate and parse model response into an array of Item objects */
function parseOutputItems(content, rawInputItems) {
  if (!content) return [{ text: '' }];
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Attempt markdown JSON code block extraction
    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try { parsed = JSON.parse(match[1]); } catch { /* ignore */ }
    }
  }

  // If parsed is a single object, merge with input context or return as single item
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      return parsed.filter((x) => x && typeof x === 'object');
    }
    // Normalize generated text property if named differently
    if (!parsed.text && (parsed.response || parsed.email || parsed.content || parsed.message || parsed.answer || parsed.result)) {
      parsed.text = parsed.response || parsed.email || parsed.content || parsed.message || parsed.answer || parsed.result;
    }
    // Merge first input item if available to preserve upstream flow
    const baseItem = rawInputItems && rawInputItems[0] && typeof rawInputItems[0] === 'object' ? rawInputItems[0] : {};
    return [{ ...baseItem, ...parsed }];
  }

  // Fallback: clean string
  return [{ text: String(content).trim() }];
}

/** Complete an LLM task execution securely on the backend */
async function executeModelCompletion({ model, task, prompt, input, node }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new HttpError(503, 'AI completion service is not configured on the server (GROQ_API_KEY is missing).');

  if (!task || !ALLOWED_TASKS.has(task)) {
    throw new HttpError(400, `Invalid task "${task}". Allowed tasks: ${[...ALLOWED_TASKS].join(', ')}.`);
  }

  const userPrompt = String(prompt || '').trim();
  if (!userPrompt) throw new HttpError(400, 'Prompt is required.');
  if (userPrompt.length > 10000) throw new HttpError(400, 'Prompt exceeds maximum length (10,000 characters).');

  const inputItems = Array.isArray(input) ? input.slice(0, 50) : [];
  let groqModel = resolveGroqModel(model);

  const messages = [
    { role: 'system', content: systemPromptForTask(task, node) },
    {
      role: 'user',
      content: `Prompt / Goal:\n${userPrompt}\n\nInput Data (${inputItems.length} items):\n${JSON.stringify(inputItems, null, 2).slice(0, 8000)}\n\nRespond with JSON only.`,
    },
  ];

  const startTime = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000);

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: groqModel,
        messages,
        temperature: 0.3,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
        ...(/gpt-oss/.test(groqModel) ? { reasoning_effort: 'low' } : {}),
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new HttpError(504, `Model execution timed out after 40 seconds (${groqModel}).`);
    }
    throw new HttpError(502, `Failed to connect to model provider: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = body.error?.message || `HTTP ${res.status}`;
    // If daily or rate limit reached on chosen model, try fallback model once
    if (res.status === 429 && groqModel !== 'openai/gpt-oss-20b') {
      console.warn(`[Model Complete] ${groqModel} rate limited. Retrying with fallback openai/gpt-oss-20b...`);
      return executeModelCompletion({ model: 'openai/gpt-oss-20b', task, prompt, input, node });
    }
    throw new HttpError(res.status === 401 ? 502 : res.status, `Model execution failed: ${errorMsg}`);
  }

  const latencyMs = Date.now() - startTime;
  const content = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  const usage = body.usage || {};
  const inTokens = usage.prompt_tokens || Math.ceil((userPrompt.length + JSON.stringify(inputItems).length) / 4);
  const outTokens = usage.completion_tokens || Math.ceil((content || '').length / 4);
  const costInr = calculateCostInr(model || groqModel, inTokens, outTokens);

  const items = parseOutputItems(content, inputItems);

  console.log(`[Model Complete] ${node || 'Node'} executed with ${groqModel} in ${latencyMs}ms | ${inTokens} in / ${outTokens} out | ₹${costInr.toFixed(4)}`);

  return {
    items,
    usage: {
      inputTokens: inTokens,
      outputTokens: outTokens,
      latencyMs,
      costInr,
    },
    model: groqModel,
    source: 'backend',
  };
}

module.exports = { executeModelCompletion, HttpError, MODEL_PRICING };
