'use strict';
/**
 * Sample school for demos (replaces the LMS's real users/classrooms).
 * Every demo account uses the password in DEMO_PASSWORD (change it, or load your own directory,
 * before showing this to anyone outside your team).
 *
 *   School 1  "Demo Academy"
 *     Teachers:  1 Asha Verma (asha.teacher@demo.local)      2 Rahul Iyer (rahul.teacher@demo.local)
 *     Students:  10..15 in Grade 8 - A, 16..19 in Grade 9 - B
 *     Classes:   1 Grade 8 - A (Asha, Rahul)   2 Grade 9 - B (Asha)
 *     Courses:   1 Science (Asha, class 1)     2 Mathematics (Rahul, class 1)     3 Physics (Asha, class 2)
 */
const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'demo1234';

const TEACHERS = [
  [1, 'Asha Verma', 'asha.teacher@demo.local'],
  [2, 'Rahul Iyer', 'rahul.teacher@demo.local'],
];
const STUDENTS = [
  [10, 'Aarav Sharma', 'aarav@demo.local', 1], [11, 'Diya Patel', 'diya@demo.local', 1],
  [12, 'Kabir Singh', 'kabir@demo.local', 1], [13, 'Meera Nair', 'meera@demo.local', 1],
  [14, 'Rohan Gupta', 'rohan@demo.local', 1], [15, 'Sara Khan', 'sara@demo.local', 1],
  [16, 'Ishaan Rao', 'ishaan@demo.local', 2], [17, 'Anaya Joshi', 'anaya@demo.local', 2],
  [18, 'Vivaan Das', 'vivaan@demo.local', 2], [19, 'Tara Menon', 'tara@demo.local', 2],
];

async function seedDemoSchool(sql) {
  const existing = await sql.get('SELECT COUNT(*) AS n FROM users');
  if (existing && existing.n > 0) return false;
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  await sql.transaction(async () => {
    await sql.run("INSERT INTO universities (id, name, area) VALUES (1, 'Demo Academy', 'Demo City')");
    for (const [id, name, email] of TEACHERS) {
      await sql.run("INSERT INTO users (id, name, email, password, role, university_id, isApproved) VALUES (?, ?, ?, ?, 'mentor', 1, 1)", [id, name, email, hash]);
    }
    for (const [id, name, email] of STUDENTS) {
      await sql.run("INSERT INTO users (id, name, email, password, role, university_id, isApproved) VALUES (?, ?, ?, ?, 'student', 1, 1)", [id, name, email, hash]);
    }
    await sql.run("INSERT INTO classrooms (id, university_id, name, grade, section) VALUES (1, 1, 'Grade 8 - A', '8', 'A'), (2, 1, 'Grade 9 - B', '9', 'B')");
    for (const [id, , , classroomId] of STUDENTS) {
      await sql.run('INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (?, ?)', [id, classroomId]);
    }
    await sql.run('INSERT INTO classroomAssignments (classroomId, teacherId) VALUES (1, 1), (2, 1), (1, 2)');
    await sql.run(`INSERT INTO courses (id, title, description, mentorId, classroomId, university_id) VALUES
      (1, 'Science', 'Grade 8 science', 1, 1, 1), (2, 'Mathematics', 'Grade 8 maths', 2, 1, 1), (3, 'Physics', 'Grade 9 physics', 1, 2, 1)`);
    for (const [id, , , classroomId] of STUDENTS) {
      if (classroomId === 1) await sql.run('INSERT INTO course_students (courseId, studentId) VALUES (1, ?), (2, ?)', [id, id]);
      else await sql.run('INSERT INTO course_students (courseId, studentId) VALUES (3, ?)', [id]);
    }
  });
  return true;
}

module.exports = { seedDemoSchool, DEMO_PASSWORD, TEACHERS, STUDENTS };
