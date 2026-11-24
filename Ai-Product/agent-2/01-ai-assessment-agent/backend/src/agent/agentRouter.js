'use strict';

const path = require('path');
const fs = require('fs');
const { createAgentTools } = require('./tools');
const { runAgentLoop, getSession, clearSession } = require('./agentLoop');

function createAgentRouter({ express, database, secret, generationConfig, onEvent }) {
  const router = express.Router();
  const notifications = [];

  const handleAgentEvent = (event) => {
    if (onEvent) onEvent(event);
    if (event.name === 'student_submitted' || event.name === 'test.submitted') {
      notifications.unshift({
        id: event.id || Date.now(),
        type: 'student_submitted',
        title: 'Student Test Submitted',
        studentName: event.studentName || 'Student',
        assessmentTitle: event.assessmentTitle || event.title || 'Assessment',
        assessmentId: event.assessmentId,
        score: event.score,
        total: event.total,
        percentage: event.percentage,
        weakTopics: event.weakTopics || [],
        at: new Date().toISOString(),
        read: false
      });
      if (notifications.length > 50) notifications.pop();
    }
  };

  const tools = createAgentTools({ database, secret, generationConfig, onEvent: handleAgentEvent });
  const ROOT = path.resolve(__dirname, '../../..');
  const emailsDir = path.join(ROOT, 'data', 'emails');

  // SSE Chat Endpoint
  router.post('/chat', async (req, res) => {
    const { message = '' } = req.body || {};
    const user = req.user;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const generator = runAgentLoop({ message, user, tools, onEvent });
      for await (const event of generator) {
        sendEvent(event);
      }
    } catch (err) {
      console.error('[agentRouter] Error in agent loop:', err);
      sendEvent({ type: 'error', message: err.message || 'An error occurred during agent execution.' });
      sendEvent({ type: 'done' });
    } finally {
      res.end();
    }
  });

  // Current session state
  router.get('/state', (req, res) => {
    const session = getSession(req.user.userId);
    res.json({
      phase: session.context.phase,
      context: session.context,
      messageCount: session.messages.length
    });
  });

  // Reset session
  router.post('/reset', (req, res) => {
    clearSession(req.user.userId);
    res.json({ success: true, message: 'Agent session reset.' });
  });

  // List sent emails
  router.get('/emails', (req, res) => {
    if (!fs.existsSync(emailsDir)) return res.json({ emails: [] });
    const files = fs.readdirSync(emailsDir).filter((f) => f.endsWith('.html'));
    const emails = files.map((file) => {
      const stats = fs.statSync(path.join(emailsDir, file));
      return {
        id: file.replace('.html', ''),
        file,
        url: `/api/agent/emails/${file}`,
        created: stats.mtime
      };
    });
    res.json({ emails });
  });

  // View rendered email
  router.get('/emails/:file', (req, res) => {
    const file = path.basename(req.params.file);
    const fullPath = path.join(emailsDir, file);
    if (!fs.existsSync(fullPath)) return res.status(404).send('Email not found.');
    res.sendFile(fullPath);
  });

  // Get notifications for teacher
  router.get('/notifications', (req, res) => {
    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length
    });
  });

  // Mark notifications as read
  router.post('/notifications/read', (req, res) => {
    notifications.forEach((n) => {
      n.read = true;
    });
    res.json({ success: true });
  });

  return router;
}

module.exports = { createAgentRouter };
