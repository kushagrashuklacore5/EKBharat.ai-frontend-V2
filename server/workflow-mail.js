/**
 * "Send approved workflow via email".
 * The server recomputes the approval hash of the snapshot it receives and refuses to send
 * anything whose content does not match its approval (KEEP IN SYNC with
 * src/components/workflow-studio/engine/approval.ts). All text is HTML-escaped; the email is
 * built only from structured workflow data.
 */
const { HttpError } = require('./workflow-ai');

// ── approval hash (mirror of engine/approval.ts) ─────────────
function stableStringify(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v)
    .filter((k) => v[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
    .join(',')}}`;
}
function canonical(nodes, edges) {
  const n = nodes
    .filter((x) => x.type !== 'note')
    .map((x) => ({
      id: x.id,
      type: x.type,
      name: x.name,
      config: x.config || {},
      settings: x.settings && Object.values(x.settings).some((s) => s !== undefined && s !== false && s !== 'off') ? x.settings : null,
      pinned: x.pinned === undefined ? null : x.pinned,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const e = edges
    .map((x) => ({ source: x.source, sourceHandle: x.sourceHandle || 'main', target: x.target, targetHandle: x.targetHandle || 'main' }))
    .sort((a, b) => {
      const ka = `${a.source}|${a.sourceHandle}|${a.target}|${a.targetHandle}`;
      const kb = `${b.source}|${b.sourceHandle}|${b.target}|${b.targetHandle}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  return stableStringify({ nodes: n, edges: e });
}
function fnv(s, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
function hashWorkflow(nodes, edges) {
  const c = canonical(nodes, edges);
  return fnv(c, 2166136261) + fnv(c, 0x811c9dc5 ^ 0x5bd1e995);
}

// ── helpers ─────────────────────────────────────────────────
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const KIND_COLOR = {
  trigger: '#c4852f', agent: '#2f7fa8', llm: '#2c64a0', knowledge: '#2e8d81', condition: '#a8731c', database: '#4b8a5c',
  integration: '#5d7083', human: '#c0664a', output: '#46607a', parallel: '#5867a8', data: '#557a8f', model: '#2c64a0', memory: '#7a6aa8', tool: '#5d7083',
};
const istTime = (ms) => new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';

/** Validate and bound the request payload. */
function checkPayload(b) {
  const senderEmail = String(b.senderEmail || b.email || b.to || '').trim();
  if (!EMAIL_RE.test(senderEmail) || senderEmail.length > 254) throw new HttpError(400, 'Please enter a valid email address.');
  const senderName = clip(String(b.senderName || b.name || '').trim(), 120);
  const senderPhone = clip(String(b.senderPhone || b.phone || '').trim(), 40);

  const wf = b.workflow;
  const ap = b.approval;
  if (!wf || !Array.isArray(wf.nodes) || !Array.isArray(wf.edges)) throw new HttpError(400, 'Missing workflow snapshot.');
  if (wf.nodes.length < 1 || wf.nodes.length > 80 || wf.edges.length > 200) throw new HttpError(400, 'Workflow is too large to email.');
  if (!ap || typeof ap.hash !== 'string' || !Number.isFinite(Number(ap.approvedAt))) throw new HttpError(400, 'Only approved workflows can be emailed.');
  if (hashWorkflow(wf.nodes, wf.edges) !== ap.hash) {
    throw new HttpError(409, 'This snapshot does not match its approval. Approve the workflow again before sharing it.');
  }
  const ids = new Set(wf.nodes.map((n) => n.id));
  if (wf.edges.some((e) => !ids.has(e.source) || !ids.has(e.target))) throw new HttpError(400, 'Workflow snapshot has broken connections.');
  const details = new Map((Array.isArray(b.details) ? b.details : []).filter((d) => d && ids.has(d.id)).map((d) => [d.id, d]));
  return {
    senderEmail,
    senderName,
    senderPhone,
    to: senderEmail,
    wf,
    ap,
    details,
    note: clip(b.note, 600).trim(),
    ai: b.ai || null,
  };
}

/** Order main-flow nodes breadth-first from the trigger(s). */
function flowOrder(wf, details) {
  const isSub = (n) => (details.get(n.id) || {}).role === 'sub' || String(n.type).startsWith('sub.');
  const main = wf.nodes.filter((n) => !isSub(n) && n.type !== 'note');
  const seen = new Set();
  const out = [];
  const q = main.filter((n) => String(n.type).startsWith('trigger.')).map((n) => n.id);
  while (q.length) {
    const id = q.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const n = main.find((x) => x.id === id);
    if (n) out.push(n);
    wf.edges.filter((e) => e.source === id).forEach((e) => q.push(e.target));
  }
  main.forEach((n) => !seen.has(n.id) && out.push(n));
  return out;
}

function handleLabel(handle) {
  if (!handle || handle === 'main') return '';
  if (handle === 'true' || handle === 'false') return `when ${handle}`;
  if (handle === 'approved' || handle === 'rejected') return `if ${handle}`;
  if (handle === 'fallback') return 'otherwise';
  return handle;
}

/** A simple SVG rendering of the workflow from its canvas positions (attached to the email). */
function buildSvg(wf, details) {
  const W = 212;
  const H = 60;
  const nodes = wf.nodes.filter((n) => n.type !== 'note');
  const xs = nodes.map((n) => Number(n.position && n.position.x) || 0);
  const ys = nodes.map((n) => Number(n.position && n.position.y) || 0);
  const minX = Math.min(...xs) - 40;
  const minY = Math.min(...ys) - 40;
  const width = Math.max(...xs) - minX + W + 40;
  const height = Math.max(...ys) - minY + H + 60;
  const pos = new Map(nodes.map((n) => [n.id, { x: (Number(n.position && n.position.x) || 0) - minX, y: (Number(n.position && n.position.y) || 0) - minY }]));
  const edgesSvg = wf.edges
    .map((e) => {
      const s = pos.get(e.source);
      const t = pos.get(e.target);
      if (!s || !t) return '';
      const sub = e.targetHandle && e.targetHandle !== 'main';
      const [x1, y1, x2, y2] = sub ? [s.x + 78, s.y, t.x + W / 2, t.y + H] : [s.x + W, s.y + H / 2, t.x, t.y + H / 2];
      const d = sub ? `M${x1},${y1} C${x1},${y1 - 50} ${x2},${y2 + 50} ${x2},${y2}` : `M${x1},${y1} C${x1 + 60},${y1} ${x2 - 60},${y2} ${x2},${y2}`;
      const lbl = handleLabel(e.sourceHandle);
      return `<path d="${d}" fill="none" stroke="${sub ? '#8aa1b6' : '#5b7189'}" stroke-width="1.6"${sub ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#a)"/>${lbl ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" font-size="11" font-family="Arial" fill="#a8731c" text-anchor="middle">${esc(lbl)}</text>` : ''}`;
    })
    .join('');
  const nodesSvg = nodes
    .map((n) => {
      const p = pos.get(n.id);
      const d = details.get(n.id) || {};
      const color = KIND_COLOR[d.kind] || '#557a8f';
      const sub = String(n.type).startsWith('sub.');
      const w = sub ? 156 : W;
      const h = sub ? 40 : H;
      return `<g transform="translate(${p.x},${p.y})"><rect width="${w}" height="${h}" rx="${sub ? 20 : 10}" fill="#fbfcfd" stroke="${color}" stroke-width="1.5"/><rect x="0" y="0" width="6" height="${h}" rx="3" fill="${color}"/><text x="16" y="${sub ? 18 : 25}" font-size="13" font-weight="bold" font-family="Arial" fill="#182b3d">${esc(clip(n.name, 26))}</text><text x="16" y="${sub ? 32 : 43}" font-size="11" font-family="Arial" fill="#5d7083">${esc(clip(d.typeTitle || n.type, 30))}</text></g>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5b7189"/></marker></defs><rect width="100%" height="100%" fill="#eef3f6"/><text x="20" y="26" font-size="14" font-family="Arial" font-weight="bold" fill="#0b2034">${esc(clip(wf.name, 80))}</text>${edgesSvg}${nodesSvg}</svg>`;
}

function buildWorkflowEmail({ wf, ap, details, note, ai, senderName, senderEmail, senderPhone }) {
  const order = flowOrder(wf, details);
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  const subFor = (id) => wf.edges.filter((e) => e.target === id && e.targetHandle && e.targetHandle !== 'main').map((e) => byId.get(e.source)).filter(Boolean);
  const mainCount = order.length;
  const branches = [];

  const stepRows = order
    .map((n, i) => {
      const d = details.get(n.id) || {};
      const color = KIND_COLOR[d.kind] || '#557a8f';
      const outs = wf.edges.filter((e) => e.source === n.id && (!e.targetHandle || e.targetHandle === 'main'));
      const nexts = outs.map((e) => {
        const t = byId.get(e.target);
        const lbl = handleLabel(e.sourceHandle);
        if (lbl) branches.push({ from: n.name, cond: d.condition, label: lbl, to: t ? t.name : e.target });
        return `${lbl ? `<b>${esc(lbl)}</b> → ` : '→ '}${esc(t ? t.name : e.target)}`;
      });
      const subs = subFor(n.id).map((s) => `${esc(s.name)} <span style="color:#829ab1;">(${esc((details.get(s.id) || {}).typeTitle || s.type)})</span>`);
      const needs = Array.isArray(n.needs) && n.needs.length ? `<div style="margin-top:6px;font:400 12px/1.5 Arial;color:#9a6f22;">Needs configuration: ${n.needs.map(esc).join('; ')}</div>` : '';
      return `<tr><td style="padding:0 32px 10px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9e2ec;border-left:4px solid ${color};border-radius:8px;">
    <tr><td style="padding:12px 14px;">
      <div style="font:700 11px/1.4 Arial;letter-spacing:1px;text-transform:uppercase;color:${color};">Step ${i + 1} · ${esc(d.typeTitle || n.type)}${d.availability === 'planned' ? ' · planned connector' : d.availability === 'simulated' ? ' · demo adapter' : ''}</div>
      <div style="font:700 15px/1.4 Arial;color:#0b2034;margin-top:2px;">${esc(n.name)}</div>
      ${d.description ? `<div style="font:400 13px/1.5 Arial;color:#486581;margin-top:2px;">${esc(clip(d.description, 300))}</div>` : ''}
      ${d.condition ? `<div style="font:400 13px/1.5 Arial;color:#0b2034;margin-top:4px;">Condition: <code style="background:#f0f4f8;padding:1px 4px;border-radius:3px;">${esc(clip(d.condition, 200))}</code></div>` : ''}
      ${subs.length ? `<div style="font:400 12px/1.5 Arial;color:#486581;margin-top:4px;">Uses: ${subs.join(', ')}</div>` : ''}
      ${nexts.length ? `<div style="font:400 13px/1.6 Arial;color:#334e68;margin-top:6px;">${nexts.join('<br>')}</div>` : '<div style="font:400 12px/1.5 Arial;color:#829ab1;margin-top:6px;">End of this path</div>'}
      ${needs}
    </td></tr>
  </table>
</td></tr>`;
    })
    .join('');

  const branchHtml = branches.length
    ? `<ul style="margin:0;padding-left:18px;font:400 13px/1.7 Arial;color:#102a43;">${branches
        .map((b) => `<li><b>${esc(b.from)}</b>${b.cond ? ` (${esc(clip(b.cond, 120))})` : ''}: ${esc(b.label)} → ${esc(b.to)}</li>`)
        .join('')}</ul>`
    : '<div style="font:400 13px/1.5 Arial;color:#627d98;">This workflow has a single path with no branches.</div>';

  const steps = ai && Array.isArray(ai.steps) && ai.steps.length ? `<ol style="margin:8px 0 0;padding-left:18px;font:400 13px/1.7 Arial;color:#102a43;">${ai.steps.slice(0, 12).map((s) => `<li>${esc(clip(s, 240))}</li>`).join('')}</ol>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#edf2f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf2f7;padding:30px 12px;font-family:Arial,Helvetica,sans-serif;"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#ffffff;border:1px solid #d9e2ec;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#0b2034;padding:24px 32px;">
    <div style="font:700 20px/1 Arial;color:#ffffff;">Ek Bharat<span style="color:#45d3e6;">.AI</span> <span style="font-size:12px;color:#94a3b8;font-weight:400;">Workflow Inquiry</span></div>
  </td></tr>
  <!-- Client Inquiry Section -->
  <tr><td style="padding:22px 32px 18px 32px;background:#f0f7ff;border-bottom:1px solid #d0e2ff;">
    <div style="font:700 11px/1.4 Arial;letter-spacing:1px;text-transform:uppercase;color:#0043ce;margin-bottom:6px;">NEW WORKFLOW INQUIRY FOR CORE5</div>
    <div style="font:700 18px/1.3 Arial;color:#102a43;">${esc(senderName || 'A user')} has requested this approved workflow</div>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;font:400 13px/1.6 Arial;color:#334e68;">
      <tr><td style="width:120px;color:#627d98;font-weight:600;padding:3px 0;">Client Name:</td><td><strong>${esc(senderName || 'Not specified')}</strong></td></tr>
      <tr><td style="color:#627d98;font-weight:600;padding:3px 0;">Client Email:</td><td><a href="mailto:${esc(senderEmail)}" style="color:#007a8c;font-weight:600;text-decoration:underline;">${esc(senderEmail)}</a></td></tr>
      ${senderPhone ? `<tr><td style="color:#627d98;font-weight:600;padding:3px 0;">Phone Number:</td><td><a href="tel:${esc(senderPhone)}" style="color:#007a8c;text-decoration:none;">${esc(senderPhone)}</a></td></tr>` : ''}
      ${note ? `<tr><td style="color:#627d98;font-weight:600;padding:8px 0 3px 0;vertical-align:top;">Message / Notes:</td><td style="padding:8px 0 3px 0;"><div style="background:#ffffff;padding:10px 14px;border-radius:6px;border:1px solid #d9e2ec;color:#102a43;">${esc(note).replace(/\n/g, '<br>')}</div></td></tr>` : ''}
    </table>

    <div style="margin-top:16px;">
      <a href="mailto:${esc(senderEmail)}?subject=${encodeURIComponent('Re: Your Workflow Request - ' + wf.name)}" 
         style="display:inline-block;background:#0b2034;color:#ffffff;font:700 13px/1 Arial;text-decoration:none;padding:11px 20px;border-radius:6px;">
        Reply to ${esc(senderName || 'Client')} &rarr;
      </a>
    </div>
  </td></tr>
  <tr><td style="padding:26px 32px 6px 32px;">
    <span style="display:inline-block;padding:4px 10px;background:#e5f1e8;color:#3f7d58;border-radius:20px;font:700 11px/1.4 Arial;letter-spacing:.5px;">APPROVED · ${esc(istTime(Number(ap.approvedAt)))}</span>
    <div style="font:700 22px/1.3 Arial;color:#0b2034;margin-top:12px;">${esc(clip(wf.name, 120))}</div>
    <div style="font:400 14px/1.6 Arial;color:#486581;margin-top:6px;">${esc(clip(wf.description, 600))}</div>
  </td></tr>
  ${note ? `<tr><td style="padding:12px 32px 0 32px;"><div style="font:400 14px/1.6 Arial;color:#102a43;background:#f0f4f8;border-left:3px solid #45d3e6;border-radius:6px;padding:12px 14px;">${esc(note).replace(/\n/g, '<br>')}</div></td></tr>` : ''}
  <tr><td style="padding:18px 32px 8px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:400 13px/1.5 Arial;color:#334e68;">
      <tr><td style="padding:3px 0;width:150px;color:#829ab1;">Steps</td><td>${mainCount} steps (${wf.nodes.filter((n) => n.type !== 'note').length} nodes including AI sub-nodes)</td></tr>
      <tr><td style="padding:3px 0;color:#829ab1;">Approval</td><td>Approved ${esc(istTime(Number(ap.approvedAt)))} · fingerprint <code>${esc(ap.hash)}</code></td></tr>
      ${ai && ai.model ? `<tr><td style="padding:3px 0;color:#829ab1;">Generated with</td><td>${esc(clip(ai.model, 80))} (AI draft, reviewed and approved by the sender)</td></tr>` : ''}
    </table>
    ${steps ? `<div style="font:700 11px/1.4 Arial;letter-spacing:1.5px;text-transform:uppercase;color:#007a8c;margin-top:14px;">What it does</div>${steps}` : ''}
  </td></tr>
  <tr><td style="padding:16px 32px 10px 32px;"><div style="font:700 11px/1.4 Arial;letter-spacing:1.5px;text-transform:uppercase;color:#007a8c;">Workflow, step by step</div>
    <div style="font:400 12px/1.5 Arial;color:#829ab1;margin-top:2px;">A diagram (workflow-diagram.svg) and the approved workflow JSON are attached.</div></td></tr>
  ${stepRows}
  <tr><td style="padding:10px 32px 6px 32px;"><div style="font:700 11px/1.4 Arial;letter-spacing:1.5px;text-transform:uppercase;color:#007a8c;margin-bottom:6px;">Conditions &amp; branches</div>${branchHtml}</td></tr>
  <tr><td style="padding:16px 32px 24px 32px;"><div style="font:400 12px/1.6 Arial;color:#829ab1;">Connectors marked “planned” or “demo adapter” are not connected to live systems yet. Import the attached JSON in Workflow Studio to view or run this workflow.</div></td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;"><div style="font:400 12px/1.5 Arial;color:#829ab1;">Sent from Ek Bharat.AI Workflow Studio · Core5 Systems and Services Pvt. Ltd.</div></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    '================================================',
    'NEW WORKFLOW INQUIRY',
    '================================================',
    `Client Name:  ${senderName || 'Not specified'}`,
    `Client Email: ${senderEmail}`,
    senderPhone ? `Phone:        ${senderPhone}` : '',
    note ? `Client Note:\n${note}\n` : '',
    '------------------------------------------------',
    `REQUESTED WORKFLOW: ${wf.name}`,
    `Approved:     ${istTime(Number(ap.approvedAt))} (fingerprint ${ap.hash})`,
    '',
    clip(wf.description, 600),
    '',
    'Steps:',
    ...order.map((n, i) => {
      const d = details.get(n.id) || {};
      const nexts = wf.edges.filter((e) => e.source === n.id && (!e.targetHandle || e.targetHandle === 'main')).map((e) => `${handleLabel(e.sourceHandle) ? handleLabel(e.sourceHandle) + ' ' : ''}-> ${(byId.get(e.target) || {}).name || e.target}`);
      return `${i + 1}. ${n.name} [${d.typeTitle || n.type}]${d.condition ? ` — condition: ${d.condition}` : ''}${nexts.length ? ` (${nexts.join('; ')})` : ''}`;
    }),
    '',
    'Attachments: workflow-diagram.svg, approved workflow JSON.',
  ].filter(Boolean).join('\n');

  const slug = String(wf.name || 'workflow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'workflow';
  const json = JSON.stringify(
    {
      format: 'ekbharat.workflow',
      version: 1,
      approval: { approvedAt: new Date(Number(ap.approvedAt)).toISOString(), hash: ap.hash },
      workflow: { name: wf.name, description: wf.description, nodes: wf.nodes, edges: wf.edges },
    },
    null,
    2,
  );
  const subjectName = senderName || senderEmail;
  return {
    subject: `[Workflow Request] ${clip(wf.name, 60)} — from ${clip(subjectName, 50)}`,
    html,
    text,
    attachments: [
      { filename: `${slug}.workflow.json`, content: json, contentType: 'application/json' },
      { filename: 'workflow-diagram.svg', content: buildSvg(wf, details), contentType: 'image/svg+xml' },
    ],
  };
}

module.exports = { checkPayload, buildWorkflowEmail, hashWorkflow };
