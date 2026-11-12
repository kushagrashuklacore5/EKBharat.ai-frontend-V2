const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

// Load environment variables from .env if present
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Also support mail-config.json if present
const cfgPath = path.join(__dirname, 'mail-config.json');
let fileCfg = {};
if (fs.existsSync(cfgPath)) {
  try {
    fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    console.error('Could not parse mail-config.json:', e.message);
  }
}

const cfg = {
  smtp_host: process.env.SMTP_HOST || fileCfg.smtp_host || 'smtp.gmail.com',
  smtp_port: parseInt(process.env.SMTP_PORT || fileCfg.smtp_port || 465, 10),
  smtp_secure: process.env.SMTP_SECURE !== undefined
    ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
    : (fileCfg.smtp_secure !== undefined ? fileCfg.smtp_secure : true),
  smtp_user: process.env.SMTP_USER || fileCfg.smtp_user,
  smtp_pass: process.env.SMTP_PASS || fileCfg.smtp_pass,
  from_name: process.env.FROM_NAME || fileCfg.from_name || 'Core5 Website',
  contact_to: process.env.CONTACT_TO || fileCfg.contact_to || process.env.SMTP_USER || fileCfg.smtp_user,
};

const PORT = parseInt(process.env.PORT || fileCfg.port || 5501, 10);

if (!cfg.smtp_user || !cfg.smtp_pass) {
  console.error('ERROR: SMTP credentials missing. Please set SMTP_USER and SMTP_PASS.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: cfg.smtp_host,
  port: cfg.smtp_port,
  secure: cfg.smtp_secure,
  auth: {
    user: cfg.smtp_user,
    pass: String(cfg.smtp_pass).replace(/\s+/g, ''),
  },
});

// Verify SMTP connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('[SMTP Error] Connection verification failed:', error.message);
  } else {
    console.log('[SMTP Ready] Server is ready to send emails via:', cfg.smtp_user);
  }
});

const app = express();

// Enable CORS for all incoming requests (Vite dev server, production domain, etc.)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
}));

app.use(express.urlencoded({ extended: true }));
// 1 MB: workflow snapshots for email sharing are larger than contact-form payloads
app.use(express.json({ limit: '1mb' }));

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function fieldRow(label, valueHtml) {
  return '<tr><td style="padding:0 32px 16px 32px;">'
    + '<div style="font:700 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#007a8c;margin-bottom:4px;">' + esc(label) + '</div>'
    + '<div style="font:400 15px/1.5 Arial,Helvetica,sans-serif;color:#0b2034;">' + valueHtml + '</div>'
    + '</td></tr>';
}

function buildContactEmail(data) {
  const isBrief = data.kind === 'project-brief' || !!data.company || !!data.problem;
  const title = isBrief ? 'New Project Brief Submission' : 'New Website Enquiry';
  const subtitle = isBrief
    ? 'Submitted through the Build With Us brief generator on Ek Bharat.AI'
    : 'Submitted through the Contact form on Ek Bharat.AI';

  let customFields = '';
  if (data.company) customFields += fieldRow('Company / Organisation', esc(data.company));
  if (data.topic) customFields += fieldRow('Topic / Interest', esc(data.topic));
  if (data.service) customFields += fieldRow('Service', esc(data.service));
  if (data.phone) {
    const telHref = data.phone.replace(/[^0-9+]/g, '');
    customFields += fieldRow('Phone', `<a href="tel:${esc(telHref)}" style="color:#007a8c;text-decoration:none;">${esc(data.phone)}</a>`);
  }
  if (data.types && Array.isArray(data.types) && data.types.length) {
    customFields += fieldRow('Solution Types', esc(data.types.join(', ')));
  }
  if (data.users) customFields += fieldRow('Target Users / Scale', esc(data.users));
  if (data.deployment) customFields += fieldRow('Deployment Preference', esc(data.deployment));
  if (data.timeline) customFields += fieldRow('Target Timeline', esc(data.timeline));
  if (data.budget) customFields += fieldRow('Budget Range', esc(data.budget));
  if (data.integrations && Array.isArray(data.integrations) && data.integrations.length) {
    customFields += fieldRow('Integrations Required', esc(data.integrations.join(', ')));
  }

  const messageText = data.problem || data.message || data.notes || data.brief || '';
  const msgHtml = esc(messageText).replace(/\n/g, '<br>') || '&mdash;';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#edf2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf2f7;padding:30px 12px;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:620px;max-width:100%;background:#ffffff;border:1px solid #d9e2ec;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:#0b2034;padding:26px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font:700 20px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:0.5px;">
                      Ek Bharat<span style="color:#45d3e6;">.AI</span>
                      <span style="font-size:12px;color:#94a3b8;font-weight:400;margin-left:8px;">by Core5</span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:4px 10px;background:rgba(69,211,230,0.15);color:#45d3e6;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.5px;">
                      ${esc(data.kind || 'Inquiry')}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:28px 32px 14px 32px;">
              <div style="font:700 22px/1.3 Arial,Helvetica,sans-serif;color:#0b2034;">${title}</div>
              <div style="font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#627d98;margin-top:4px;">${subtitle}</div>
            </td>
          </tr>
          <!-- Sender Details -->
          ${fieldRow('Name', esc(data.name))}
          ${fieldRow('Email', `<a href="mailto:${esc(data.email)}" style="color:#007a8c;text-decoration:underline;">${esc(data.email)}</a>`)}
          ${customFields}
          <!-- Message / Problem Section -->
          <tr>
            <td style="padding:6px 32px 24px 32px;">
              <div style="font:700 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#007a8c;margin-bottom:8px;">
                ${isBrief ? 'Problem Description / Scope' : 'Message'}
              </div>
              <div style="font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#102a43;background:#f0f4f8;border-left:3px solid #45d3e6;border-radius:6px;padding:14px 16px;">
                ${msgHtml}
              </div>
            </td>
          </tr>
          <!-- Reply CTA Button -->
          <tr>
            <td style="padding:0 32px 30px 32px;">
              <a href="mailto:${esc(data.email)}?subject=${encodeURIComponent('Re: ' + (data.topic || 'Your inquiry on Ek Bharat.AI'))}" 
                 style="display:inline-block;background:#0b2034;color:#ffffff;font:700 13px/1 Arial,Helvetica,sans-serif;text-decoration:none;padding:12px 22px;border-radius:6px;">
                Reply to ${esc(data.name)} &rarr;
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 32px;">
              <div style="font:400 12px/1.5 Arial,Helvetica,sans-serif;color:#829ab1;">
                Received on ${esc(data.ts)} &middot; Ek Bharat.AI &middot; Core5 Systems and Services Pvt. Ltd.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `================================================
${title.toUpperCase()}
================================================
Time:        ${data.ts}
Name:        ${data.name}
Email:       ${data.email}
${data.company ? `Company:     ${data.company}\n` : ''}${data.topic ? `Topic:       ${data.topic}\n` : ''}${data.phone ? `Phone:       ${data.phone}\n` : ''}${data.service ? `Service:     ${data.service}\n` : ''}${data.types ? `Types:       ${Array.isArray(data.types) ? data.types.join(', ') : data.types}\n` : ''}${data.users ? `Scale:       ${data.users}\n` : ''}${data.deployment ? `Deployment:  ${data.deployment}\n` : ''}${data.timeline ? `Timeline:    ${data.timeline}\n` : ''}${data.budget ? `Budget:      ${data.budget}\n` : ''}
Message / Details:
------------------------------------------------
${messageText}
------------------------------------------------
Ek Bharat.AI - Core5 Systems and Services Pvt. Ltd.`;

  return { html, text };
}

// Health check endpoint
app.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Ek Bharat.AI / Core5 Mail Service',
    time: new Date().toISOString(),
    smtp_configured: !!(cfg.smtp_user && cfg.smtp_pass),
    ai_configured: !!process.env.GROQ_API_KEY,
    ai_model: process.env.GROQ_API_KEY ? process.env.GROQ_MODEL || 'openai/gpt-oss-120b' : null,
    contact_to: cfg.contact_to,
  });
});

// Primary mail handler
async function handleMailSubmission(req, res) {
  const b = req.body || {};

  // Honeypot detection
  if (b._honey || b.honey) {
    return res.json({ success: true, message: 'Message sent successfully.' });
  }

  const name = (b.name || b['Full Name'] || '').trim();
  const email = (b.email || '').trim();
  const message = (b.message || b.Message || b.problem || b.notes || b.brief || '').trim();
  const topic = (b.topic || b.service || b['Service of Interest'] || '').trim();
  const phone = (b.phone || b.Phone || '').trim();
  const company = (b.company || '').trim();

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  const submissionData = {
    ...b,
    name,
    email,
    message,
    topic,
    phone,
    company,
    ts: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
  };

  const mail = buildContactEmail(submissionData);
  const subject = submissionData.kind === 'project-brief'
    ? `New Project Brief from ${name}${company ? ` (${company})` : ''}`
    : `New Contact Enquiry: ${topic || 'Ek Bharat.AI'} — ${name}`;

  try {
    const info = await transporter.sendMail({
      from: `"${cfg.from_name}" <${cfg.smtp_user}>`,
      to: cfg.contact_to,
      replyTo: `"${name}" <${email}>`,
      subject: subject,
      text: mail.text,
      html: mail.html,
    });

    console.log(`[Mail Sent] Message from ${name} <${email}> delivered:`, info.messageId);
    return res.json({ success: true, message: 'Inquiry received. We will get back to you shortly!' });
  } catch (err) {
    console.error('[Mail Error] Failed to send email:', err && err.message);
    return res.status(502).json({ success: false, message: 'Failed to send email. Please try again later.' });
  }
}

// Support all standard endpoint routes
app.post('/api/contact', handleMailSubmission);
app.post('/api/send', handleMailSubmission);
app.post('/send', handleMailSubmission);

// ── Workflow Studio: AI generation (Groq) + approved-workflow email + live model execution ──
const { generateWorkflow, HttpError } = require('./workflow-ai');
const { checkPayload, buildWorkflowEmail } = require('./workflow-mail');
const { executeModelCompletion } = require('./model-completion');

/** Minimal in-memory fixed-window rate limiter per client IP (single-instance server). */
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please wait a few minutes and try again.' });
    }
    list.push(now);
    hits.set(key, list);
    next();
  };
}

function sendError(res, err, tag) {
  const status = (err && typeof err.status === 'number' && err.status >= 400 && err.status < 600) ? err.status : null;
  if (status) {
    return res.status(status).json({ success: false, message: err.message, details: err.details });
  }
  console.error(`[${tag}]`, err && err.message);
  return res.status(500).json({ success: false, message: 'Unexpected server error.' });
}

app.post(
  '/api/workflows/generate',
  rateLimit(parseInt(process.env.WORKFLOW_GENERATE_LIMIT || '20', 10), 60 * 60 * 1000),
  async (req, res) => {
    const started = Date.now();
    try {
      const out = await generateWorkflow({ prompt: req.body && req.body.prompt, catalog: req.body && req.body.catalog });
      // prompts are not logged (may contain business data) — only sizes and timing
      console.log(`[Workflow AI] generated ${out.workflow.nodes.length} nodes with ${out.model} in ${Date.now() - started}ms (attempts ${out.attempts})`);
      return res.json({ success: true, ...out });
    } catch (err) {
      return sendError(res, err, 'Workflow AI');
    }
  },
);

app.post(
  '/api/models/complete',
  rateLimit(parseInt(process.env.MODEL_COMPLETE_LIMIT || '60', 10), 60 * 1000),
  async (req, res) => {
    try {
      const b = req.body || {};
      const result = await executeModelCompletion({
        model: b.model,
        task: b.task,
        prompt: b.prompt,
        input: b.input,
        node: b.node,
      });
      return res.json({ success: true, ...result });
    } catch (err) {
      return sendError(res, err, 'Model Complete');
    }
  },
);

app.post(
  '/api/workflows/email',
  rateLimit(parseInt(process.env.WORKFLOW_EMAIL_LIMIT || '20', 10), 60 * 60 * 1000),
  async (req, res) => {
    try {
      const payload = checkPayload(req.body || {});
      const mail = buildWorkflowEmail(payload);
      const targetInbox = cfg.contact_to || 'enquiry@core5.co.in';
      const senderReplyTo = payload.senderName ? `"${payload.senderName}" <${payload.senderEmail}>` : payload.senderEmail;

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"${cfg.from_name}" <${cfg.smtp_user}>`,
        to: targetInbox,
        replyTo: senderReplyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
      });

      console.log(`[Workflow Mail] Workflow inquiry from ${payload.senderEmail} delivered to ${targetInbox}: ${info.messageId}`);
      return res.json({
        success: true,
        message: 'Your request has been submitted to the Core5 team.',
        messageId: info.messageId,
      });
    } catch (err) {
      if (!(err instanceof HttpError)) {
        console.error('[Workflow Mail] Send failed:', err && err.message);
        return res.status(502).json({ success: false, message: 'The email could not be sent. Please try again later.' });
      }
      return sendError(res, err, 'Workflow Mail');
    }
  },
);

// ── Lead Dispatch Endpoint: Send approved lead record directly to enquiry@core5.co.in ──
app.post('/api/leads/send', async (req, res) => {
  try {
    const { workflowName, nodeName, lead, note, senderName, senderEmail, senderPhone } = req.body || {};
    if (!lead || typeof lead !== 'object') {
      return res.status(400).json({ success: false, message: 'Lead data is required.' });
    }

    const target = cfg.contact_to || 'enquiry@core5.co.in';
    const clientEmail = String(senderEmail || lead.email || lead.from || lead.sender || '').trim();
    const clientName = String(senderName || lead.name || lead.customer || lead.contact || 'Client').trim();
    const clientPhone = String(senderPhone || lead.phone || lead.mobile || '').trim();

    const leadRows = Object.entries(lead)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => `<tr><td style="padding:6px 10px;font-weight:600;color:#627d98;width:140px;border-bottom:1px solid #edf2f7;background:#f8fafc;">${esc(k)}</td><td style="padding:6px 10px;color:#102a43;border-bottom:1px solid #edf2f7;">${typeof v === 'object' ? `<pre style="margin:0;font-size:11px;font-family:monospace;">${esc(JSON.stringify(v, null, 2))}</pre>` : esc(String(v))}</td></tr>`)
      .join('');

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#edf2f7;padding:24px 12px;margin:0;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #d9e2ec;">
  <tr><td style="background:#0b2034;padding:20px 28px;color:#ffffff;">
    <div style="font-size:18px;font-weight:bold;">Ek Bharat<span style="color:#45d3e6;">.AI</span> Lead Dispatch</div>
  </td></tr>
  <tr><td style="padding:20px 28px;background:#f0f7ff;border-bottom:1px solid #d0e2ff;">
    <div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#0043ce;">APPROVED LEAD / RECORD</div>
    <div style="font-size:17px;font-weight:bold;color:#102a43;margin-top:4px;">Workflow: ${esc(workflowName || 'Workflow Studio')} &middot; Step: ${esc(nodeName || 'Approved Step')}</div>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:13px;color:#334e68;">
      <tr><td style="width:110px;font-weight:600;color:#627d98;padding:2px 0;">Sender/Client:</td><td><strong>${esc(clientName)}</strong></td></tr>
      <tr><td style="font-weight:600;color:#627d98;padding:2px 0;">Email:</td><td><a href="mailto:${esc(clientEmail)}" style="color:#007a8c;font-weight:600;">${esc(clientEmail || 'Not provided')}</a></td></tr>
      ${clientPhone ? `<tr><td style="font-weight:600;color:#627d98;padding:2px 0;">Phone:</td><td><a href="tel:${esc(clientPhone)}" style="color:#007a8c;">${esc(clientPhone)}</a></td></tr>` : ''}
      ${note ? `<tr><td style="font-weight:600;color:#627d98;padding:6px 0 2px 0;vertical-align:top;">Remarks:</td><td style="padding:6px 0 2px 0;"><div style="background:#ffffff;padding:8px 12px;border-radius:4px;border:1px solid #d9e2ec;color:#102a43;">${esc(note)}</div></td></tr>` : ''}
    </table>
  </td></tr>
  <tr><td style="padding:20px 28px;">
    <div style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#007a8c;margin-bottom:10px;">Lead / Transaction Data</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border:1px solid #edf2f7;border-radius:6px;overflow:hidden;">
      ${leadRows}
    </table>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:12px 28px;font-size:12px;color:#829ab1;border-top:1px solid #e2e8f0;">
    Dispatched from Ek Bharat.AI Workflow Studio &middot; Core5 Systems and Services Pvt. Ltd.
  </td></tr>
</table>
</body></html>`;

    const text = `APPROVED LEAD RECORD\nWorkflow: ${workflowName || 'Workflow Studio'}\nStep: ${nodeName}\nClient: ${clientName} (${clientEmail || 'No email'})\n${clientPhone ? `Phone: ${clientPhone}\n` : ''}${note ? `Remarks: ${note}\n\n` : ''}Lead Details:\n` +
      JSON.stringify(lead, null, 2);

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"${cfg.from_name}" <${cfg.smtp_user}>`,
      to: target,
      replyTo: clientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail) ? `"${clientName}" <${clientEmail}>` : undefined,
      subject: `[Approved Lead] ${clientName} (${clientEmail || 'No email'}) — ${workflowName || 'Workflow'}`,
      html,
      text,
    });

    console.log(`[Lead Sent] Lead record for ${clientName} emailed to ${target}: ${info.messageId}`);
    return res.json({ success: true, message: `Lead successfully sent to ${target}!`, messageId: info.messageId });
  } catch (err) {
    console.error('[Lead Send Error]', err && err.message);
    return res.status(500).json({ success: false, message: 'Failed to send lead email.' });
  }
});

app.listen(PORT, () => {
  console.log(`Ek Bharat AI mail server running on http://localhost:${PORT}`);
  console.log(`Contact submissions will be sent to: ${cfg.contact_to}`);
});

