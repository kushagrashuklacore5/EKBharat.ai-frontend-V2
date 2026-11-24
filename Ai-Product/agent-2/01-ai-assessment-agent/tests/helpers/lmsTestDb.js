/**
 * Throwaway database for tests: a fresh in-memory embedded PostgreSQL (PGlite) with the standalone
 * schema (backend/src/standalone/schema.sql = the LMS directory tables + the module's aia_* tables).
 * [Standalone edition: in the LMS this was a temporary database on its PostgreSQL test server.]
 *
 * The schema always holds every table; the options below describe which module migrations the
 * ADAPTER should see (its capability checks read this snapshot), so the behaviour before a
 * migration is still tested:
 *   withMigration: false        no aia_* tables (module not ready)
 *   withStep2 / withStep3 / withStep5 / withStep6: false   the schema before 002 / 003 / 004 / 005
 *   withQuestionTypes: false    before 006 (single-answer MCQs only)
 *   withAssignments: false      without 007
 *   withRecipientsReports: false without 008
 *   (009, question pictures, is visible when both 006 and 007 are)
 *   withCourseLink: true        010 and the LMS course tables (course_students; course_classrooms
 *                               only with withCourseClasses: true) - off by default, as before
 */
const { after } = require('node:test');

// Every database made by this test file is dropped when the file's tests are done.
const created = new Set();
after(async () => {
  for (const db of created) await db.close();
});
const { openEmbeddedDatabase } = require('../../backend/src/standalone/embeddedDatabase');
const { readSchema, createPostgresAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/PostgresAssessmentLmsAdapter');

/**
 * Seed (ids are fixed so tests read clearly):
 *   schools: 1 "School One", 2 "School Two"
 *   users:   1 teacher1 (mentor, s1)   2 teacher2 (mentor, s1)   3 teacher3 (mentor, s2)
 *            4 student1 (s1, class 10) 5 student2 (s1, class 11) 6 student3 (s2, class 20)
 *            7 admin1 (admin, s1)      8 teacherRole (role 'teacher', s1)
 *            9 studentNoClass (s1)
 *   classes: 10 = s1 Grade 10 A, 11 = s1 Grade 11 B, 20 = s2 Grade 10 A
 */
const IDS = Object.freeze({
  school1: 1, school2: 2,
  teacher1: 1, teacher2: 2, teacher3: 3,
  student1: 4, student2: 5, student3: 6,
  admin1: 7, teacherRole: 8, studentNoClass: 9,
  class10: 10, class11: 11, class20: 20,
});

async function seed(db) {
  await db.run("INSERT INTO universities (id, name, area) VALUES (1, 'School One', ''), (2, 'School Two', '')");
  const users = [
    [1, 'Teacher One', 't1@s1.test', 'mentor', 1], [2, 'Teacher Two', 't2@s1.test', 'mentor', 1], [3, 'Teacher Three', 't3@s2.test', 'mentor', 2],
    [4, 'Student One', 'st1@s1.test', 'student', 1], [5, 'Student Two', 'st2@s1.test', 'student', 1], [6, 'Student Three', 'st3@s2.test', 'student', 2],
    [7, 'Admin One', 'a1@s1.test', 'admin', 1], [8, 'Teacher Role', 'tr@s1.test', 'teacher', 1], [9, 'Student No Class', 'st9@s1.test', 'student', 1],
  ];
  for (const [id, name, email, role, school] of users) {
    await db.run("INSERT INTO users (id, name, email, password, role, university_id, isApproved) VALUES (?, ?, ?, 'x', ?, ?, 1)", [id, name, email, role, school]);
  }
  for (const [id, school, name, grade, section] of [[10, 1, 'Grade 10 - A', '10', 'A'], [11, 1, 'Grade 11 - B', '11', 'B'], [20, 2, 'Grade 10 - A', '10', 'A']]) {
    await db.run('INSERT INTO classrooms (id, university_id, name, grade, section) VALUES (?, ?, ?, ?, ?)', [id, school, name, grade, section]);
  }
  await db.run('INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (4, 10), (5, 11), (6, 20)');
  // Teaching assignments (the LMS's classroomAssignments): each school's teachers teach its classes.
  await db.run('INSERT INTO classroomAssignments (classroomId, teacherId) VALUES (10, 1), (11, 1), (10, 2), (11, 2), (10, 8), (11, 8), (20, 3)');
}

/** The schema snapshot the adapter sees for these options (see the file comment). */
function snapshotFor(schema, {
  withMigration = true, withStep2 = true, withStep3 = true, withStep5 = true, withStep6 = true,
  withQuestionTypes = true, withAssignments = true, withRecipientsReports = true, withCourseLink = false, withCourseClasses = false,
} = {}) {
  const tables = new Set(schema.tables);
  const columns = new Map([...schema.columns].map(([t, c]) => [t, new Set(c)]));
  const dropTable = (t) => { tables.delete(t); columns.delete(t); };
  const dropColumn = (t, c) => columns.get(t)?.delete(c);

  const step2 = withMigration && withStep2;
  const step3 = step2 && withStep3;
  const step5 = step3 && withStep5;
  const step6 = step5 && withStep6;
  const types = step6 && withQuestionTypes;
  const assignments = step6 && withAssignments;
  const reports = step6 && withRecipientsReports;
  if (!withMigration) for (const t of [...tables]) if (t.startsWith('aia_')) dropTable(t);
  if (!step2) { dropColumn('aia_questions', 'explanation'); dropColumn('aia_questions', 'difficulty'); }
  if (!step3) { dropTable('aia_attempts'); dropTable('aia_attempt_answers'); }
  if (!step5) for (const c of ['opens_at', 'closes_at', 'closed_at']) dropColumn('aia_assessments', c);
  if (!step6) dropTable('aia_attempt_archive');
  if (!types) {
    for (const c of ['question_type', 'numeric_answer', 'numeric_format']) dropColumn('aia_questions', c);
    dropTable('aia_attempt_responses');
  }
  if (!assignments) for (const t of ['aia_assignments', 'aia_assignment_questions', 'aia_assignment_submissions']) dropTable(t);
  if (!reports) { dropTable('aia_assessment_recipients'); dropTable('aia_performance_reports'); }
  if (!(types && assignments)) { dropColumn('aia_questions', 'image_key'); dropColumn('aia_assignment_questions', 'image_key'); }
  if (!withCourseLink) dropColumn('aia_assessments', 'course_id');
  if (!withCourseLink && !withCourseClasses) dropTable('course_students');
  if (!withCourseClasses) dropTable('course_classrooms');
  return { tables, columns };
}

/**
 * A fresh, seeded LMS database:
 *   get / all / run / transaction    the database interface the adapter uses (? placeholders)
 *   exec(sql)                        raw SQL for test set-up (several statements, no parameters)
 *   sql                              the interface alone (for the HTTP router: { database: db.sql })
 *   schema                           the snapshot for the options
 *   adapter()                        a PostgresAssessmentLmsAdapter on this database and snapshot
 *   close()                          drops the database
 */
async function createLmsTestDb(options = {}) {
  const embedded = await openEmbeddedDatabase();
  const sql = embedded.sql;
  await seed(sql);
  const schema = snapshotFor(await readSchema(sql), options);

  let closed = false;
  const db = {
    ...sql,
    sql,
    schema,
    url: 'pglite://memory',
    exec: (text) => embedded.exec(text), // also moves identity sequences past rows written with explicit ids
    adapter: () => createPostgresAssessmentLmsAdapter(sql, schema),
    /** LMS-host tests only; they skip themselves when the LMS server folder is absent. */
    hostDatabase() {
      throw new Error('hostDatabase() needs the original LMS server; not available in the standalone product.');
    },
    async close() {
      if (closed) return;
      closed = true;
      created.delete(db);
      await embedded.close();
    },
  };
  created.add(db);
  return db;
}

/** A valid question body; `correct` picks the correct option index. */
function mcq(text = 'What is 2 + 2?', correct = 1) {
  return { text, options: ['3', '4', '5', '22'].map((t, i) => ({ text: t, isCorrect: i === correct })) };
}

/** Step 2 (question types): a valid multiple-select body; `correct` lists the correct option indexes. */
function multi(text = 'Which of these are even numbers?', correct = [1, 3]) {
  return { type: 'multi_select', text, options: ['3', '4', '5', '22'].map((t, i) => ({ text: t, isCorrect: correct.includes(i) })) };
}

/** Step 2 (question types): a valid numerical body. */
function numerical(text = 'What is 7 x 6?', value = '42', format = 'integer') {
  return { type: 'numerical', text, numericAnswer: { format, value } };
}

module.exports = { IDS, createLmsTestDb, snapshotFor, mcq, multi, numerical };
