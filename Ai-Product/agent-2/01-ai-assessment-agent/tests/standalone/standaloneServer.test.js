// [standalone audit] Tests for the standalone host (backend/src/standalone/server.js): login, session checks and
// school (tenant) isolation through the real HTTP stack, on an in-memory embedded PostgreSQL.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createApp } = require('../../backend/src/standalone/server');
const { openEmbeddedDatabase } = require('../../backend/src/standalone/embeddedDatabase');
const { seedDemoSchool } = require('../../backend/src/standalone/demoSeed');

const SECRET = 'standalone-test-secret-'.padEnd(48, 'x');
let db; let server; let base;

async function call(method, path, { token, body } = {}) {
  const r = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const login = async (email, password = 'demo1234') => (await call('POST', '/api/auth/login', { body: { email, password } })).body;

before(async () => {
  db = await openEmbeddedDatabase();
  await seedDemoSchool(db.sql);
  // A second school with its own teacher, student, class and course.
  const hash = bcrypt.hashSync('demo1234', 4);
  await db.sql.run("INSERT INTO universities (id, name, area) VALUES (2, 'Other School', '')");
  await db.sql.run("INSERT INTO users (id, name, email, password, role, university_id, isApproved) VALUES (50, 'Other Teacher', 'other.teacher@x.test', ?, 'mentor', 2, 1), (51, 'Other Student', 'other.student@x.test', ?, 'student', 2, 1)", [hash, hash]);
  await db.sql.run("INSERT INTO classrooms (id, university_id, name, grade, section) VALUES (20, 2, 'Grade 8 - A', '8', 'A')");
  await db.sql.run('INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (51, 20)');
  await db.sql.run('INSERT INTO classroomAssignments (classroomId, teacherId) VALUES (20, 50)');
  await db.sql.run("INSERT INTO courses (id, title, mentorId, classroomId, university_id) VALUES (20, 'Science', 50, 20, 2)");
  const app = await createApp({ database: db.sql, secret: SECRET });
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server && server.close(); await db.close(); });

describe('login and sessions', () => {
  it('wrong password -> 401; right password -> token, and no password hash in the reply', async () => {
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'asha.teacher@demo.local', password: 'nope' } })).status, 401);
    const ok = await login('asha.teacher@demo.local');
    assert.ok(ok.token);
    assert.equal(JSON.stringify(ok).includes('$2'), false);
    assert.deepEqual([ok.user.role, ok.user.universityId], ['mentor', 1]);
  });

  it('no token, a malformed token, a token signed with another secret and an expired token are all refused', async () => {
    const forged = jwt.sign({ userId: 1, universityId: 1, role: 'mentor' }, 'another-secret');
    const expired = jwt.sign({ userId: 1, universityId: 1, role: 'mentor', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    for (const token of [undefined, 'not.a.jwt', forged, expired]) {
      assert.equal((await call('GET', '/api/assessment-agent/teacher/assessments', { token })).status, 401, String(token));
    }
  });

  it('a token claiming another school for this user is refused by the module (role and school come from the DB)', async () => {
    const lying = jwt.sign({ userId: 1, universityId: 2, role: 'mentor' }, SECRET);
    assert.equal((await call('GET', '/api/assessment-agent/teacher/assessments', { token: lying })).status, 403);
    const promoted = jwt.sign({ userId: 10, universityId: 1, role: 'mentor' }, SECRET); // a student claiming "mentor"
    assert.equal((await call('GET', '/api/assessment-agent/teacher/assessments', { token: promoted })).status, 403);
  });
});

describe('school isolation', () => {
  let asha; let other; let otherStudent; let assessmentId;
  before(async () => {
    asha = (await login('asha.teacher@demo.local')).token;
    other = (await login('other.teacher@x.test')).token;
    otherStudent = (await login('other.student@x.test')).token;
    const created = await call('POST', '/api/assessment-agent/teacher/assessments', { token: asha, body: { title: 'School 1 test', subject: 'Science', classroomId: 1, courseId: 1 } });
    assert.equal(created.status, 201);
    assessmentId = created.body.assessment.id;
    const q = await call('POST', `/api/assessment-agent/teacher/assessments/${assessmentId}/questions`, { token: asha, body: { text: 'Which is a gas?', options: ['Oxygen', 'Iron', 'Salt', 'Wood'].map((t, i) => ({ text: t, isCorrect: i === 0 })) } });
    assert.equal(q.status, 201, JSON.stringify(q.body));
    assert.equal((await call('POST', `/api/assessment-agent/teacher/assessments/${assessmentId}/publish`, { token: asha })).status, 200);
  });

  it('another school\'s teacher sees none of it and cannot open, edit or report on it', async () => {
    assert.deepEqual((await call('GET', '/api/assessment-agent/teacher/assessments', { token: other })).body.assessments, []);
    assert.equal((await call('GET', `/api/assessment-agent/teacher/assessments/${assessmentId}`, { token: other })).status, 404);
    assert.equal((await call('PATCH', `/api/assessment-agent/teacher/assessments/${assessmentId}`, { token: other, body: { title: 'x' } })).status, 404);
    assert.equal((await call('GET', `/api/assessment-agent/teacher/assessments/${assessmentId}/report`, { token: other })).status, 404);
    const classes = (await call('GET', '/api/assessment-agent/teacher/classrooms', { token: other })).body.classrooms.map((c) => c.id);
    assert.deepEqual(classes, [20]);
  });

  it('another school\'s student cannot see or start it', async () => {
    assert.deepEqual((await call('GET', '/api/assessment-agent/student/assessments', { token: otherStudent })).body.assessments, []);
    assert.equal((await call('POST', `/api/assessment-agent/student/assessments/${assessmentId}/attempt`, { token: otherStudent })).status, 404);
  });

  it('the course picker and the event log are per teacher / per school', async () => {
    const mine = (await call('GET', '/api/courses/teaching/overview', { token: other })).body.data.classes;
    assert.deepEqual(mine, [{ id: 20, courses: [{ id: 20, title: 'Science' }] }]);
    const events = (await call('GET', '/api/events', { token: other })).body.events;
    assert.equal(events.some((e) => e.universityId === 1), false);
    assert.ok((await call('GET', '/api/events', { token: asha })).body.events.some((e) => e.name === 'assessment.published'));
  });
});
