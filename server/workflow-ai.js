/**
 * AI workflow generation via Groq (OpenAI-compatible chat completions API).
 *
 * - The API key is read from GROQ_API_KEY on the server only.
 * - The model is configurable with GROQ_MODEL.
 * - Output is constrained with a strict JSON schema whose node-type enum comes from the
 *   frontend's node registry catalog, then checked structurally here. If the check fails,
 *   Groq gets one repair attempt with the list of problems.
 * - The frontend re-validates the result against the real registry before rendering it.
 */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TYPE_RE = /^[a-z]+(\.[a-z0-9]+)?$/;

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** The catalog is supplied by the frontend; accept only a bounded, well-formed shape. */
function checkCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length < 5 || catalog.length > 120) throw new HttpError(400, 'Invalid node catalog.');
  if (JSON.stringify(catalog).length > 80000) throw new HttpError(400, 'Node catalog too large.');
  for (const c of catalog) {
    if (!c || typeof c.type !== 'string' || !TYPE_RE.test(c.type)) throw new HttpError(400, 'Invalid node catalog entry.');
    if (!Array.isArray(c.params) || !Array.isArray(c.outputs)) throw new HttpError(400, 'Invalid node catalog entry.');
  }
  return catalog;
}

function catalogText(catalog) {
  return catalog
    .map((c) => {
      const outs = c.dynamicOutputs || (c.outputs && c.outputs.length ? c.outputs.join(',') : 'main');
      const sub = c.role === 'sub' ? ` [SUB-NODE -> ai.agent slot: ${c.subSlot}; NO inputs]` : '';
      const params = (c.params || [])
        .filter((p) => p.required || p.options)
        .map((p) => `${p.key}${p.options ? `:[${p.options.join('|')}]` : ''}`)
        .join('; ');
      return `- ${c.type} (${c.title}): ${c.description || ''}${sub} | outputs: ${outs}${params ? ` | key-params: ${params}` : ''}`;
    })
    .join('\n');
}

function systemPrompt(catalog) {
  return `You design automation workflows for "Workflow Studio", a visual workflow builder for Indian businesses.
Return ONE workflow as JSON that matches the provided JSON schema. Use ONLY node types from this catalog:

${catalogText(catalog)}

Rules:
1. Start with exactly one trigger node (type starts with "trigger."). Pick the trigger that matches the request (chat/WhatsApp message → trigger.chat, form → trigger.form, email → trigger.email, recurring → trigger.schedule, otherwise trigger.webhook or trigger.manual).
2. Order nodes in execution order. Every non-trigger main node must be reachable from the trigger.
3. Edges: "from"/"to" are node ids.
   - For main nodes: "fromOutput" is "main" (or "true"/"false" for logic.if, "approved"/"rejected" for human.approval, "case-0", "case-1", … and "fallback" for logic.switch), and "toInput" is ALWAYS "main".
   - CRITICAL SUB-NODE RULE: Sub-nodes (sub.model, sub.memory, sub.tool) have NO INPUTS. Never connect a trigger or any node to a sub-node. An edge only goes FROM a sub-node ("fromOutput": "sub") TO an ai.agent ("toInput": "model", "memory", or "tools").
4. Every ai.agent MUST have a sub.model connected to its "model" slot. Use sub.tool nodes for actions the agent may take. Triggers and upstream main nodes connect directly to the ai.agent ("toInput": "main"), NEVER to the sub.model.
5. Use logic.if / logic.switch for decisions, human.approval before risky write actions (payments, accounting entries, sending to customers when the request implies review), and an output or notification node at the end. Use output.respond to reply when the trigger is a chat.
6. config is a list of {key, value} using ONLY param keys listed for that node type; values are strings (numbers/booleans as text, select values exactly as listed). Expressions like {{ $json.field }} may reference fields produced by earlier nodes.
7. NEVER invent credentials, API keys, real people, real phone numbers, real companies or real customer data. If something must come from the user (credentials, a mailbox, a recipient address, a real lead source, a database query), add a short instruction to that node's "needs" list and leave the value empty or use an obvious placeholder.
8. Data flows as items. Conditions (logic.if / logic.switch / logic.filter "field") and {{ $json.x }} expressions must use fields that really exist at that point: the trigger payload fields (from demoInput), fields listed under "produces", or keys of an upstream node's "sample" object. To decide whether a lead qualifies, have an ai.agent or ai.llm output a numeric score (e.g. sample {"score": 78, "reason": "..."}) and use logic.if with operator "gte" on it — do not use ai.classifier for scoring.
9. For demo-adapter nodes you may set "sample" to a small JSON OBJECT (never an array) with obviously fictional placeholder values (e.g. {"crm_lead_id": "DEMO-001"}); it is merged into every item. To produce a list for logic.loop, put the array inside a field (e.g. {"leads": [...]}) and set the loop "field" to "leads". Write "sample" and "payload" values as plain JSON text (no extra escaping). All names in samples must be obviously fictional, e.g. "Demo Prospect A (fictional)", with example.com emails. Use plausible demo values (e.g. "score": 82, not 0 or empty) so a demo run exercises the main path through conditions and approvals.
10. "demoInput" is a JSON string with a FICTIONAL test event for the trigger (for lead workflows: an array of 2–4 prospects named like "Demo Prospect A (fictional)" with example.com emails, unless an upstream node creates the list). Keep it small.
11. "purpose" is "lead_generation" when the workflow finds, qualifies or routes leads/prospects; otherwise "general".
12. "summary" explains in 1–2 plain sentences what the workflow does; "steps" is 3–8 short plain-language bullets for a non-technical user.
13. Keep it focused: 4–14 nodes. Prefer fewer, well-configured nodes. A real lead source (search API, directory, CRM list) is never available by default: say so in "needs" of the node that produces leads.
14. Handling ambiguous or high-level requests: When the prompt is brief or ambiguous (such as "automate my sales", "help with customer support", "process invoices", "vendor onboarding"), do NOT fail. Infer a standard, sensible enterprise workflow:
   - Lead generation / sales: trigger.form -> data.http / ai.agent (research) -> logic.if (score >= 70) -> india.zoho (create lead) / human.notify.
   - Customer support: trigger.chat -> ai.classifier -> ai.knowledge / ai.llm -> logic.if (refund or complex) -> human.approval -> output.respond.
   - Invoices / Financial: trigger.email -> ai.agent (document extraction) -> logic.if (within tolerance) -> human.approval -> india.tally.
   Set clear "needs" entries (e.g. "Configure CRM credentials", "Provide sample invoice template") so the user knows what to configure.
15. Reachability and handles: Every main node must be connected in the graph and reachable from the trigger. Output handles must strictly match node definitions: logic.if uses "true" and "false"; human.approval uses "approved" and "rejected"; logic.switch uses "case-0", "case-1", ..., and "fallback". Sub-nodes (sub.model, sub.memory, sub.tool) must have fromOutput "sub" and connect to the respective slot ("model", "memory", "tools") of an ai.agent.`;
}

function schemaFor(catalog) {
  const str = { type: 'string' };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'summary', 'purpose', 'steps', 'nodes', 'edges', 'demoInput'],
    properties: {
      name: str,
      summary: str,
      purpose: { type: 'string', enum: ['lead_generation', 'general'] },
      steps: { type: 'array', items: str },
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'type', 'name', 'config', 'needs'],
          properties: {
            id: str,
            type: { type: 'string', enum: catalog.map((c) => c.type) },
            name: str,
            config: {
              type: 'array',
              items: { type: 'object', additionalProperties: false, required: ['key', 'value'], properties: { key: str, value: str } },
            },
            needs: { type: 'array', items: str },
          },
        },
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'to', 'fromOutput', 'toInput'],
          properties: { from: str, to: str, fromOutput: str, toInput: str },
        },
      },
      demoInput: str,
    },
  };
}

/** Normalize edge direction and sub-node slot handles before strict check. */
function normalizeWorkflowEdges(wf, catalog) {
  if (!wf || !Array.isArray(wf.nodes) || !Array.isArray(wf.edges)) return wf;
  const byType = new Map(catalog.map((c) => [c.type, c]));
  const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]));

  // Auto-fill standard defaults for human nodes so users don't see warning spam
  for (const n of wf.nodes) {
    if (!n.config) n.config = {};
    if (n.type === 'human.approval' && !n.config.assignee) {
      n.config.assignee = 'Manager';
    }
    if (Array.isArray(n.needs)) {
      n.needs = n.needs.filter((x) => !/assign|approver/i.test(x));
    }
  }
  
  const cleaned = [];
  for (const e of wf.edges) {
    const s = nodeMap.get(e.from);
    const t = nodeMap.get(e.to);
    if (!s || !t) continue;
    const sc = byType.get(s.type);
    const tc = byType.get(t.type);
    if (!sc || !tc) continue;

    // If model reversed sub-node edge (i.e. ai.agent -> sub.model instead of sub.model -> ai.agent)
    if (tc.role === 'sub' && sc.type === 'ai.agent') {
      cleaned.push({
        from: t.id,
        to: s.id,
        fromOutput: 'sub',
        toInput: tc.subSlot || 'model',
      });
      continue;
    }

    // If sub-node connects to ai.agent but handles were incorrect
    if (sc.role === 'sub' && tc.type === 'ai.agent') {
      cleaned.push({
        from: s.id,
        to: t.id,
        fromOutput: 'sub',
        toInput: tc.slots && tc.slots.includes(sc.subSlot) ? sc.subSlot : (e.toInput === 'sub' ? 'model' : e.toInput || 'model'),
      });
      continue;
    }

    cleaned.push(e);
  }
  wf.edges = cleaned;
  return wf;
}

/** Structural checks against the catalog. Returns a list of problems (empty = OK). */
function checkWorkflow(wf, catalog) {
  const problems = [];
  if (!wf || !Array.isArray(wf.nodes) || !Array.isArray(wf.edges)) return ['Response must contain "nodes" and "edges" arrays.'];
  normalizeWorkflowEdges(wf, catalog);
  const byType = new Map(catalog.map((c) => [c.type, c]));
  if (!wf.nodes.length) problems.push('The workflow has no nodes.');
  if (wf.nodes.length > 40) problems.push('Too many nodes (max 40).');
  const ids = new Map();
  for (const n of wf.nodes) {
    const c = byType.get(n.type);
    if (!c) problems.push(`Unsupported node type "${n.type}" (node ${n.id}).`);
    if (ids.has(n.id)) problems.push(`Duplicate node id "${n.id}".`);
    ids.set(n.id, n);
    // unknown params / invalid select values are not structural: the frontend drops them with a
    // visible warning, so they do not cost a second (rate-limited) model call

  }
  const triggers = wf.nodes.filter((n) => String(n.type).startsWith('trigger.'));
  if (triggers.length !== 1) problems.push(`Expected exactly one trigger node, found ${triggers.length}.`);
  for (const e of wf.edges) {
    const s = ids.get(e.from);
    const t = ids.get(e.to);
    if (!s || !t) {
      problems.push(`Edge ${e.from} → ${e.to} references a missing node.`);
      continue;
    }
    const sc = byType.get(s.type);
    const tc = byType.get(t.type);
    if (!sc || !tc) continue;
    if (sc.role === 'sub') {
      if (!tc.slots || !tc.slots.includes(sc.subSlot) || e.toInput !== sc.subSlot) problems.push(`Sub-node ${s.id} (${s.type}) must connect to an ai.agent "${sc.subSlot}" input.`);
      continue;
    }
    if (e.toInput !== 'main') problems.push(`Edge ${e.from} → ${e.to}: toInput must be "main".`);
    if (!tc.hasInput) problems.push(`Node ${t.id} (${t.type}) has no input.`);
    if (sc.type === 'logic.switch') {
      const cases = ((s.config || []).find((kv) => kv.key === 'cases') || { value: '' }).value.split(',').map((x) => x.trim()).filter(Boolean);
      const valid = [...cases.map((_, i) => `case-${i}`), 'fallback'];
      if (!valid.includes(e.fromOutput)) problems.push(`Switch ${s.id} has no output "${e.fromOutput}" (valid: ${valid.join(', ')}).`);
    } else if (sc.outputs.length > 1 && !sc.outputs.includes(e.fromOutput)) {
      problems.push(`Node ${s.id} (${s.type}) has no output "${e.fromOutput}" (valid: ${sc.outputs.join(', ')}).`);
    }
  }
  for (const n of wf.nodes.filter((x) => x.type === 'ai.agent')) {
    if (!wf.edges.some((e) => e.to === n.id && e.toInput === 'model')) problems.push(`AI Agent ${n.id} has no sub.model connected to its "model" input.`);
  }

  // Reachability check: every main node must be reachable from the trigger
  if (triggers.length === 1) {
    const triggerId = triggers[0].id;
    const reachable = new Set([triggerId]);
    const outgoing = new Map();
    for (const e of wf.edges) {
      if (!outgoing.has(e.from)) outgoing.set(e.from, []);
      outgoing.get(e.from).push(e.to);
    }
    const queue = [triggerId];
    while (queue.length) {
      const curr = queue.shift();
      for (const next of outgoing.get(curr) || []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    for (const n of wf.nodes) {
      const c = byType.get(n.type);
      if (c && c.role === 'main' && n.id !== triggerId && !reachable.has(n.id)) {
        problems.push(`Node "${n.name || n.id}" (${n.type}) is disconnected; all main nodes must connect downstream from the trigger.`);
      }
    }
  }

  return problems;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGroq(messages, catalog, opts) {
  try {
    return await callGroqOnce(messages, catalog, opts);
  } catch (e) {
    // If daily quota for primary model is reached, fall back to gpt-oss-20b
    if (e.status === 429 && /tokens per day \(TPD\)/i.test(e.message) && opts.model !== 'openai/gpt-oss-20b' && !opts.fallbackTried) {
      console.warn('[Workflow AI] Primary model daily quota reached. Falling back to openai/gpt-oss-20b...');
      return callGroqOnce(messages, catalog, { ...opts, model: 'openai/gpt-oss-20b', fallbackTried: true });
    }
    // Honour a short Retry-After once, so a single user rarely sees the rate limit
    if (e.status === 429 && !opts.retried) {
      const waitTime = (e.retryAfter && e.retryAfter > 0 ? e.retryAfter : 5);
      if (waitTime <= 45) {
        console.warn(`[Workflow AI] Rate limit encountered. Waiting ${waitTime}s before retry...`);
        await sleep(waitTime * 1000);
        return callGroqOnce(messages, catalog, { ...opts, retried: true });
      }
    }
    throw e;
  }
}

async function callGroqOnce(messages, catalog, { apiKey, model, useSchema }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_completion_tokens: 4000,
        // gpt-oss models are reasoning models: low effort keeps latency and token usage down
        ...(/gpt-oss/.test(model) ? { reasoning_effort: process.env.GROQ_REASONING_EFFORT || 'low' } : {}),
        response_format: useSchema
          ? { type: 'json_schema', json_schema: { name: 'workflow', strict: true, schema: schemaFor(catalog) } }
          : { type: 'json_object' },
      }),
    });
  } catch (e) {
    throw new HttpError(504, e.name === 'AbortError' ? 'Groq did not respond in time. Please try again.' : 'Could not reach Groq. Check the server’s internet connection.');
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body.error && body.error.message) || `HTTP ${res.status}`;
    if (res.status === 401) throw new HttpError(502, 'Groq rejected the API key (GROQ_API_KEY).');
    if (res.status === 429) {
      console.warn(`[Groq 429 Error Details]:`, body && body.error ? body.error.message : 'no body');
      const e = new HttpError(429, `Groq rate limit reached: ${body && body.error && body.error.message ? body.error.message : 'Please wait a moment and try again.'}`);
      const retryHeader = res.headers.get('retry-after');
      let retrySec = retryHeader ? Math.ceil(parseFloat(retryHeader)) : 0;
      if (!retrySec && body.error && body.error.message) {
        const match = body.error.message.match(/try again in ([0-9.]+)s/i);
        if (match) retrySec = Math.ceil(parseFloat(match[1]));
      }
      e.retryAfter = retrySec || 5;
      throw e;
    }
    // If the strict JSON schema validation fails in Groq's grammar engine, fall back to json_object
    if (res.status === 400 && useSchema && (body.error && (body.error.code === 'json_validate_failed' || /response_format|json_schema/i.test(msg)))) {
      console.warn('[Workflow AI] json_schema strict mode failed; falling back to json_object mode...');
      return callGroqOnce(messages, catalog, { apiKey, model, useSchema: false });
    }
    if (res.status === 404 || /model/i.test(msg)) throw new HttpError(502, `Groq model "${model}" is unavailable (${msg}). Set GROQ_MODEL to a model your account can use.`);
    throw new HttpError(502, `Groq error: ${msg}`);
  }
  const content = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  const remainingTokens = parseInt(res.headers.get('x-ratelimit-remaining-tokens') || '8000', 10);
  const resetTokens = parseFloat(res.headers.get('x-ratelimit-reset-tokens') || '0');
  return { content: content || '', usage: body.usage || {}, remainingTokens, resetTokens };
}

/** POST /api/workflows/generate  { prompt, catalog } */
async function generateWorkflow({ prompt, catalog }) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  if (!apiKey) throw new HttpError(503, 'AI generation is not configured on the server (GROQ_API_KEY is missing).');
  const text = String(prompt || '').trim();
  if (text.length < 8) throw new HttpError(400, 'Please describe the workflow in a little more detail.');
  if (text.length > 2000) throw new HttpError(400, 'Please keep the description under 2,000 characters.');
  checkCatalog(catalog);

  let messages = [
    { role: 'system', content: systemPrompt(catalog) },
    { role: 'user', content: `Design a workflow for this request. Respond with JSON only.\n\n"""${text}"""` },
  ];
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  let lastProblems = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await callGroq(messages, catalog, { apiKey, model, useSchema: true });
    usage.prompt_tokens += r.usage.prompt_tokens || 0;
    usage.completion_tokens += r.usage.completion_tokens || 0;
    let wf;
    try {
      wf = JSON.parse(r.content);
    } catch {
      lastProblems = ['The response was not valid JSON.'];
    }
    if (wf) lastProblems = checkWorkflow(wf, catalog);
    if (!lastProblems.length) return { workflow: wf, model, attempts: attempt, usage };
    if (r.failed) lastProblems.unshift('The output did not match the required JSON schema.');
    console.warn(`[Workflow AI] attempt ${attempt} needs repair: ${lastProblems.slice(0, 5).join(' | ')}`);

    if (r.remainingTokens && r.remainingTokens < 2500 && r.resetTokens > 0) {
      const waitSec = Math.min(30, Math.ceil(r.resetTokens));
      console.log(`[Workflow AI] Approaching TPM limit (${r.remainingTokens} tokens left). Waiting ${waitSec}s for quota reset...`);
      await sleep(waitSec * 1000);
    }

    messages = [
      { role: 'system', content: systemPrompt(catalog) },
      { role: 'user', content: `Design a workflow for this request: "${text}".\n\nCRITICAL FIXES NEEDED FROM PREVIOUS ATTEMPT:\n- ${lastProblems.slice(0, 5).join('\n- ')}\n\nReturn the complete, corrected workflow JSON matching the schema.` },
    ];
  }
  throw new HttpError(422, 'The AI could not produce a valid workflow for this request. Try rephrasing it.', lastProblems.slice(0, 15));
}

module.exports = { generateWorkflow, checkWorkflow, HttpError };
