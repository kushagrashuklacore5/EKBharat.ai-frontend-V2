'use strict';
/**
 * Standalone host for the AI Assessment Agent.
 *
 * Replaces what the LMS provided around the module:
 *   LMS PostgreSQL (server/config/pg-db.js)     -> embedded PostgreSQL (PGlite) or any PostgreSQL via the same SQL
 *   LMS login + JWT (authMiddleware)            -> /api/auth/login with its own JWT (AIA_JWT_SECRET)
 *   requireTenant                               -> requireTenant below (school must exist)
 *   LMS notifications (assessmentAgentNotifications.js) -> in-memory event log, GET /api/events
 *   LMS client pages                            -> client/ (the same React pages, built with Vite)
 *
 * The module itself (backend/src/**) is unchanged: it is mounted exactly as the LMS mounted it:
 *   app.use('/api/assessment-agent', requireAuth, requireTenant, router, errorHandler)
 */
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
// The module reads the Gemini key as SOA_GEMINI_API_KEY (a name shared with the onboarding agent in the LMS).
if (!process.env.SOA_GEMINI_API_KEY && process.env.GEMINI_API_KEY) process.env.SOA_GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createLmsAssessmentAgentRouter, assessmentErrorHandler } = require('../integration/lmsAssessmentAgent');
const { createAgentRouter } = require('../agent/agentRouter');
const { loadGenerationConfig } = require('../llm/generationConfig');
const { openEmbeddedDatabase } = require('./embeddedDatabase');
const { seedDemoSchool, DEMO_PASSWORD, TEACHERS, STUDENTS } = require('./demoSeed');

const PORT = Number(process.env.AIA_PORT) || 5060;
const DEMO_MODE = process.env.AIA_DEMO_MODE !== 'false';
const DATA_DIR = process.env.AIA_DATA_DIR
  ? path.resolve(ROOT, process.env.AIA_DATA_DIR)
  : path.join(ROOT, 'data', 'db');

function jwtSecret() {
  const s = process.env.AIA_JWT_SECRET;
  if (s && s.length >= 32) return s;
  if (!DEMO_MODE) throw new Error('AIA_JWT_SECRET (32+ characters) is required when AIA_DEMO_MODE=false.');
  console.warn('[assessment-agent] AIA_JWT_SECRET not set: using a random secret (sessions end when the server stops).');
  return require('crypto').randomBytes(48).toString('hex');
}

async function createApp({ database, secret, events = [] }) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // ---- AI Demo Timing Protection (Cooldown & Rate Limiting) ----
  const aiRateLimits = new Map(); // ip -> { lastCall: timestamp, count: number, windowStart: timestamp }
  const AI_COOLDOWN_MS = 25 * 1000; // 25 seconds cooldown between AI generation calls
  const AI_MAX_PER_HOUR = 8; // Max 8 AI calls per hour per user/IP

  app.use((req, res, next) => {
    const isAiRoute = req.path.includes('/assessments/generate') || req.path.startsWith('/api/agent');
    if (!isAiRoute || req.method !== 'POST') return next();

    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = aiRateLimits.get(clientIp) || { lastCall: 0, count: 0, windowStart: now };

    // Reset window if 1 hour has elapsed
    if (now - record.windowStart > 60 * 60 * 1000) {
      record.count = 0;
      record.windowStart = now;
    }

    // Check cooldown
    const timeSinceLast = now - record.lastCall;
    if (timeSinceLast < AI_COOLDOWN_MS) {
      const waitSec = Math.ceil((AI_COOLDOWN_MS - timeSinceLast) / 1000);
      return res.status(429).json({
        error: {
          code: 'AI_COOLDOWN',
          message: `Demo cooldown active. Please wait ${waitSec}s before generating again to protect API limits.`
        }
      });
    }

    // Check quota
    if (record.count >= AI_MAX_PER_HOUR) {
      return res.status(429).json({
        error: {
          code: 'DEMO_QUOTA_EXCEEDED',
          message: 'Demo quota reached (8 AI requests/hour). Please wait or contact Ek Bharat for enterprise access.'
        }
      });
    }

    record.lastCall = now;
    record.count += 1;
    aiRateLimits.set(clientIp, record);
    next();
  });

  // ---- auth (replaces the LMS session) ----
  const sign = (u) => jwt.sign({ userId: u.id, universityId: u.university_id, role: u.role, name: u.name, email: u.email }, secret, { expiresIn: '8h' });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required.' });
    const u = await database.get('SELECT id, name, email, password, role, university_id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (!u || !bcrypt.compareSync(password, u.password)) return res.status(401).json({ error: 'Wrong email or password.' });
    res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role, universityId: u.university_id } });
  });

  function requireAuth(req, res, next) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    try {
      const p = jwt.verify(m[1], secret);
      req.user = { userId: p.userId, universityId: p.universityId, role: p.role, name: p.name, email: p.email };
      next();
    } catch (_e) {
      res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Your session has ended. Please sign in again.' } });
    }
  }

  async function requireTenant(req, res, next) {
    const school = await database.get('SELECT id FROM universities WHERE id = ?', [req.user.universityId]).catch(() => null);
    if (!school) return res.status(403).json({ error: { code: 'TENANT_MISMATCH', message: 'Unknown school.' } });
    next();
  }

  app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: { id: req.user.userId, ...req.user } }));

  app.get('/api/health', (req, res) => {
    const ai = loadGenerationConfig(process.env);
    res.json({ ok: true, product: 'ai-assessment-agent', ai: { configured: ai.configured, provider: ai.provider, model: ai.model, reason: ai.reason } });
  });

  if (DEMO_MODE) {
    app.get('/api/demo/accounts', (req, res) => res.json({
      password: DEMO_PASSWORD,
      teachers: TEACHERS.map(([id, name, email]) => ({ id, name, email })),
      students: STUDENTS.map(([id, name, email]) => ({ id, name, email })),
    }));

    // Reset demo state so new visitors get a 100% fresh, clean slate
    app.post('/api/demo/reset', async (req, res) => {
      try {
        await database.transaction(async () => {
          await database.run('DELETE FROM aia_attempt_answers');
          await database.run('DELETE FROM aia_attempt_responses');
          await database.run('DELETE FROM aia_attempt_archive');
          await database.run('DELETE FROM aia_attempts');
          await database.run('DELETE FROM aia_performance_reports');
          await database.run('DELETE FROM aia_assignment_submissions');
          await database.run('DELETE FROM aia_assignment_questions');
          await database.run('DELETE FROM aia_assignments');
          await database.run('DELETE FROM aia_assessment_recipients');
          await database.run('DELETE FROM aia_options');
          await database.run('DELETE FROM aia_questions');
          await database.run('DELETE FROM aia_assessments');
        });
        console.log('[assessment-agent] Demo state reset to clean initial slate');
        res.json({ ok: true, message: 'Demo sandbox reset.' });
      } catch (err) {
        console.error('[assessment-agent] Reset error:', err.message);
        res.status(500).json({ error: err.message });
      }
    });
  }

  // ---- events (replaces LMS notifications) ----
  const onEvent = (event) => {
    events.unshift({ ...event, at: new Date().toISOString() });
    events.length = Math.min(events.length, 200);
    console.log(`[assessment-agent] event ${event.name}`, JSON.stringify(event));
  };
  app.get('/api/events', requireAuth, (req, res) => res.json({ events: events.filter((e) => e.universityId === req.user.universityId) }));

  // ---- LMS endpoint the teacher page reads for its course picker (LMS: GET /api/courses/teaching/overview) ----
  // The teacher's courses per class: courses they mentor whose home class is that class or that are assigned to it.
  app.get('/api/courses/teaching/overview', requireAuth, requireTenant, async (req, res) => {
    const rows = await database.all(`SELECT c.id AS "classId", co.id AS "courseId", co.title FROM courses co
      JOIN classrooms c ON c.university_id = co.university_id
       AND (c.id = co.classroomId OR EXISTS (SELECT 1 FROM course_classrooms cc WHERE cc.courseId = co.id AND cc.classroomId = c.id))
      WHERE co.mentorId = ? AND co.university_id = ? ORDER BY c.id, co.title`, [req.user.userId, req.user.universityId]);
    const classes = new Map();
    for (const r of rows) {
      if (!classes.has(r.classId)) classes.set(r.classId, { id: r.classId, courses: [] });
      classes.get(r.classId).courses.push({ id: r.courseId, title: r.title });
    }
    res.json({ success: true, data: { classes: [...classes.values()] } });
  });

  // ---- the module, mounted as in the LMS ----
  app.use('/api/assessment-agent', requireAuth, requireTenant,
    createLmsAssessmentAgentRouter({ express, database, onEvent }), assessmentErrorHandler);

  // ---- the autonomous agentic layer ----
  const generationConfig = loadGenerationConfig(process.env);
  app.use('/api/agent', requireAuth, requireTenant,
    createAgentRouter({ express, database, secret, generationConfig, onEvent }));

  // ---- the web client (client/dist, built with `npm run build`) ----
  const dist = path.join(ROOT, 'client', 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }));
  return app;
}

async function start() {
  const db = await openEmbeddedDatabase({ dataDir: process.env.AIA_IN_MEMORY === 'true' ? undefined : DATA_DIR });
  if (DEMO_MODE && (await seedDemoSchool(db.sql))) console.log('[assessment-agent] demo school created (password for every demo account: ' + DEMO_PASSWORD + ')');
  const app = await createApp({ database: db.sql, secret: jwtSecret() });
  const ai = loadGenerationConfig(process.env);
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`[assessment-agent] listening on http://localhost:${PORT}`);
      console.log(`[assessment-agent] AI: ${ai.configured ? `${ai.provider} / ${ai.model}` : `off (${ai.reason}) - manual tests, attempts and reports still work`}`);
      resolve({ server, db });
    });
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[assessment-agent] failed to start:', err.message);
    process.exit(1);
  });
}

module.exports = { createApp, start };
