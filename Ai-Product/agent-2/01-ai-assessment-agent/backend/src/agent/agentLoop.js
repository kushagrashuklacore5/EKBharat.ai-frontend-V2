'use strict';

/**
 * Autonomous Human-in-the-Loop Agentic Reasoning Loop.
 * Communicates with client via Server-Sent Events (SSE).
 */

class AgentSession {
  constructor(userId) {
    this.userId = userId;
    this.messages = [];
    this.context = {
      phase: 'INIT',
      classroomId: null,
      className: null,
      courseId: null,
      courseTitle: null,
      subject: null,
      topic: null,
      templateId: null,
      assessmentId: null,
      assessmentTitle: null,
      studentId: null,
      studentName: null,
      studentEmail: null,
      studentToken: null,
      score: null,
      totalMarks: null,
      weakTopics: [],
      generatedQuestions: []
    };
  }

  addMessage(role, content, extra = {}) {
    this.messages.push({ role, content, timestamp: new Date().toISOString(), ...extra });
    if (this.messages.length > 30) this.messages.shift();
  }
}

const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, new AgentSession(userId));
  }
  return sessions.get(userId);
}

function clearSession(userId) {
  sessions.delete(userId);
}

/**
 * Zero-Shot Magic Intent Parser.
 * Uses Groq to decode teacher raw text (English / Hindi / Hinglish) into exact DB parameters.
 */
async function parseMagicIntent(message, availableClasses) {
  const groqApiKey = process.env.GROQ_API_KEY;
  const model = process.env.AIA_LLM_MODEL || 'openai/gpt-oss-120b';
  const currentDateIso = new Date().toISOString();

  const systemPrompt = `You are a school assistant intent parser.
Current server timestamp: ${currentDateIso}
Given a teacher's message in English, Hindi, or Hinglish, extract the parameters to create an assessment test.
Available classrooms and courses in the school:
${JSON.stringify(availableClasses, null, 2)}

Rules for extraction:
1. "classroomId": Match mentions like "8th A", "class 8", "grade 8" to the correct classroom id. If NOT mentioned or ambiguous, set "classroomId": null and "needsClarification": true.
2. "courseId": Match course like "Science", "Physics", "Maths" to the correct course id belonging to that classroom. If classroomId is null, set courseId: null.
3. "className": Name of the matched class (e.g. "Grade 8 - A") or null if not mentioned.
4. "subject": Title of the matched course (e.g. "Science") or null if not mentioned.
5. "topic": Extracted topic (e.g. "Photosynthesis", "Newton Laws", "Optics"). If no topic is mentioned, use "General Science Diagnostic".
6. "durationMinutes": Duration in minutes if mentioned (e.g. "15 minute", "20 min"), default is 15.
7. "count": Number of questions if mentioned (e.g. "14 questions" -> 14, "10 questions" -> 10, default 3, max 20).
8. "difficulty": "easy", "medium", or "hard" (default "medium").
9. "templateId": One of ["concept_mastery", "board_exam_practice", "fundamentals_first", "application_reasoning", "revision_quick_test"]. Default "board_exam_practice".
10. "autoPublish": true if teacher's text includes words like "publish", "assign", "kardo", "daal do", "bhej do", "schedule", "deploy", "activate". false if they only said "create" or "banao".
11. "opensAt": ISO string in UTC if teacher specified a future scheduled time (e.g. "kal 8.40", "tomorrow 8:40 am", "subah 8:40"). Calculate relative to current server timestamp. Null if not scheduled.
12. "needsClarification": true if user asked for a test on a topic but DID NOT specify which class/classroom. false if classroom was mentioned.
13. "isTestIntent": true if user is asking to create, make, prepare, generate, schedule, or publish a test/quiz/assignment, or mentions a topic/class. false for casual greetings like "hello".

Return STRICT JSON ONLY conforming to:
{
  "isTestIntent": boolean,
  "needsClarification": boolean,
  "autoPublish": boolean,
  "opensAt": string | null,
  "classroomId": number | null,
  "className": string | null,
  "courseId": number | null,
  "subject": string | null,
  "topic": string,
  "durationMinutes": number,
  "count": number,
  "difficulty": string,
  "templateId": string
}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) return JSON.parse(content);
  } catch (err) {
    console.error('[agentLoop] parseMagicIntent Groq error, falling back to heuristic parser:', err.message);
  }

  // Heuristic Fallback Parser if Groq is unavailable
  const lower = (message || '').toLowerCase();
  const isTest = lower.includes('test') || lower.includes('exam') || lower.includes('quiz') || lower.includes('banao') || lower.includes('prepare') || lower.includes('create') || lower.includes('schedule') || lower.includes('publish');
  if (!isTest) return null;

  // Check if class is mentioned
  const hasClassMention = lower.includes('8') || lower.includes('9') || lower.includes('class') || lower.includes('grade') || lower.includes('section');
  const firstClass = availableClasses[0] || { id: 1, name: 'Grade 8 - A', courses: [{ id: 1, title: 'Science' }] };
  const matchedClass = hasClassMention
    ? availableClasses.find(c => lower.includes(c.name.toLowerCase()) || (c.name.includes('8') && (lower.includes('8th') || lower.includes('8'))) || (c.name.includes('9') && (lower.includes('9th') || lower.includes('9')))) || firstClass
    : null;
  const matchedCourse = matchedClass?.courses?.[0] || null;

  let topic = 'Photosynthesis';
  if (lower.includes('optic')) topic = 'Optics and Light';
  else if (lower.includes('motion')) topic = 'Laws of Motion';
  else if (lower.includes('photo')) topic = 'Photosynthesis';
  else {
    const topicMatch = /(?:on|ke liye|topic|pr|par)\s+([a-zA-Z\s]{3,20})/i.exec(message);
    if (topicMatch) topic = topicMatch[1].trim();
  }

  // Count parsing (e.g. 14 questions)
  const countMatch = /(\d+)\s*(?:questions|question|sawal|mcq|prashan)/i.exec(message);
  const count = countMatch ? Math.min(20, Math.max(1, parseInt(countMatch[1], 10))) : 3;

  const durationMatch = /(\d+)\s*(?:min|minute)/i.exec(message);
  const duration = durationMatch ? parseInt(durationMatch[1], 10) : 15;
  const autoPub = lower.includes('publish') || lower.includes('assign') || lower.includes('kardo') || lower.includes('daal do') || lower.includes('deploy') || lower.includes('schedule');

  // Scheduled time parsing (e.g. kal 8.40)
  let opensAt = null;
  const isTomorrow = lower.includes('kal') || lower.includes('tomorrow');
  const timeMatch = /(\d{1,2})[:.](\d{2})/i.exec(message);
  if (isTomorrow || timeMatch) {
    const target = new Date();
    if (isTomorrow) target.setDate(target.getDate() + 1);
    let hours = 8;
    let mins = 40;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      mins = parseInt(timeMatch[2], 10);
      if (lower.includes('pm') && hours < 12) hours += 12;
    }
    // IST to UTC offset (IST is UTC+5:30)
    target.setHours(hours, mins, 0, 0);
    opensAt = target.toISOString();
  }

  return {
    isTestIntent: true,
    needsClarification: !matchedClass,
    autoPublish: autoPub,
    opensAt,
    classroomId: matchedClass?.id || null,
    className: matchedClass?.name || null,
    courseId: matchedCourse?.id || null,
    subject: matchedCourse?.title || null,
    topic,
    durationMinutes: duration,
    count,
    difficulty: 'medium',
    templateId: 'board_exam_practice'
  };
}

/**
 * Runs the agent loop and yields event objects:
 * { type: 'thinking' | 'tool_start' | 'tool_done' | 'message' | 'questions_preview' | 'options_prompt' | 'student_session' | 'report_preview' | 'study_plan' | 'done', ... }
 */
async function* runAgentLoop({ message, user, tools, onEvent }) {
  const session = getSession(user.userId);
  session.addMessage('user', message);

  const text = (message || '').trim().toLowerCase();
  const ctx = session.context;

  // Helper to emit thinking
  function thinking(content) {
    return { type: 'thinking', content };
  }

  // Helper to emit tool start
  function toolStart(tool, label, args = {}) {
    return { type: 'tool_start', tool, label, args };
  }

  // Helper to emit tool done
  function toolDone(tool, label, summary, data = {}) {
    return { type: 'tool_done', tool, label, summary, data };
  }

  // ==========================================
  // PHASE: RESET or GREETING
  // ==========================================
  if (text.includes('restart') || text.includes('reset') || text === '/reset') {
    clearSession(user.userId);
    yield thinking('Resetting workflow session...');
    yield {
      type: 'message',
      content: 'Session reset. You can request assessment generation directly, for example: "8th A ke liye photosynthesis ka 15-minute test banao".'
    };
    yield {
      type: 'options_prompt',
      options: [
        { label: 'Grade 8 - A: 15-minute Photosynthesis Test', value: '8th A ke liye photosynthesis ka 15-minute test banao' },
        { label: 'Grade 9: Optics Examination', value: 'Grade 9 Physics ke liye optics ka exam prepare karo' },
        { label: 'View Class Overview', value: 'Show my classes' }
      ]
    };
    yield { type: 'done' };
    return;
  }

  // ==========================================
  // CONFIRMATION STEPS (Human In The Loop)
  // Check if we are awaiting a confirmation before running new generation
  // ==========================================

  // STEP 2.5: CLARIFICATION RESOLVER (When teacher didn't mention classroom initially)
  if (ctx.phase === 'AWAITING_CLASS_SELECTION') {
    yield thinking('Matching selected class for pending assessment...');
    const overview = await tools.executeTool('get_classes_and_courses', {}, user);
    const classes = overview.classes || [];

    const matchedClass = classes.find(c =>
      text.includes(c.name.toLowerCase()) ||
      (c.name.includes('8') && (text.includes('8th') || text.includes('8'))) ||
      (c.name.includes('9') && (text.includes('9th') || text.includes('9')))
    ) || classes[0];

    const matchedCourse = matchedClass?.courses?.[0] || { id: 1, title: 'Science' };
    const pending = ctx.pendingDraft || { topic: 'Photosynthesis', count: 3, durationMinutes: 15 };

    ctx.classroomId = matchedClass.id;
    ctx.className = matchedClass.name;
    ctx.courseId = matchedCourse.id;
    ctx.courseTitle = matchedCourse.title;
    ctx.subject = matchedCourse.title;
    ctx.topic = pending.topic;
    ctx.count = pending.count;
    ctx.opensAt = pending.opensAt;
    ctx.templateId = pending.templateId || 'board_exam_practice';

    yield thinking(`Selected ${matchedClass.name}. Generating ${pending.count} questions on "${pending.topic}"...`);
    yield toolStart('generate_questions', `Generating ${pending.count} questions on "${pending.topic}" via Groq AI`, {
      count: pending.count,
      difficulty: pending.difficulty || 'medium',
      templateId: ctx.templateId
    });

    const genResult = await tools.executeTool('generate_questions', {
      topic: pending.topic,
      subject: ctx.subject,
      classroomId: ctx.classroomId,
      courseId: ctx.courseId,
      count: pending.count,
      difficulty: pending.difficulty || 'medium',
      templateId: ctx.templateId
    }, user);

    yield toolDone('generate_questions', 'Questions generated successfully', `Generated ${genResult.questions.length} multiple-choice questions`);

    yield thinking('Saving draft assessment in database...');
    yield toolStart('save_assessment_draft', 'Saving draft assessment in database');

    const draftResult = await tools.executeTool('save_assessment_draft', {
      title: `${pending.topic} - Diagnostic Assessment`,
      subject: ctx.subject,
      classroomId: ctx.classroomId,
      courseId: ctx.courseId,
      durationMinutes: pending.durationMinutes || 15,
      opensAt: pending.opensAt || null,
      questions: genResult.questions
    }, user);

    yield toolDone('save_assessment_draft', 'Draft saved in database', `Assessment ID: #${draftResult.assessmentId}`);

    ctx.assessmentId = draftResult.assessmentId;
    ctx.assessmentTitle = draftResult.title;
    ctx.generatedQuestions = genResult.questions;

    if (pending.autoPublish || pending.opensAt) {
      yield thinking(`Publishing assessment #${draftResult.assessmentId} to ${ctx.className}...`);
      yield toolStart('publish_assessment', `Publishing Assessment #${draftResult.assessmentId} to ${ctx.className}`);
      const pubResult = await tools.executeTool('publish_assessment', { assessmentId: draftResult.assessmentId }, user);
      yield toolDone('publish_assessment', 'Assessment published', pubResult.message);

      ctx.phase = 'AWAITING_DEMO_ATTEMPT';

      const schedText = pending.opensAt
        ? `\n\nScheduled to open on: **${new Date(pending.opensAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}**`
        : '';

      yield {
        type: 'questions_preview',
        assessmentId: draftResult.assessmentId,
        title: draftResult.title,
        className: ctx.className,
        subject: ctx.subject,
        durationMinutes: pending.durationMinutes || 15,
        opensAt: pending.opensAt,
        questions: genResult.questions,
        isPublished: true
      };

      yield {
        type: 'message',
        content: `Assessment Created & Published for **${ctx.className}**!${schedText}

Generated **${genResult.questions.length} questions** on **"${pending.topic}"**.`
      };

      yield {
        type: 'options_prompt',
        category: 'demo_action',
        options: [
          { label: 'Attempt test as Demo Student (Aarav Sharma)', value: 'Attempt test as student' },
          { label: 'Skip attempt, generate teacher report directly', value: 'Skip attempt, generate teacher report directly' }
        ]
      };

      yield { type: 'done' };
      return;
    }

    ctx.phase = 'AWAITING_PUBLISH';
    yield {
      type: 'questions_preview',
      assessmentId: draftResult.assessmentId,
      title: draftResult.title,
      className: ctx.className,
      subject: ctx.subject,
      durationMinutes: pending.durationMinutes || 15,
      opensAt: pending.opensAt,
      questions: genResult.questions
    };

    yield {
      type: 'message',
      content: `Questions generated for **${ctx.className}** (${genResult.questions.length} questions, ${pending.durationMinutes} mins).\n\nReady to publish and assign this to ${ctx.className}?`
    };

    yield {
      type: 'options_prompt',
      category: 'confirmation',
      options: [
        { label: `1-Click Approve & Publish to ${ctx.className}`, value: 'Yes, publish this assessment now' },
        { label: 'Regenerate questions', value: `Regenerate test for ${ctx.className} on ${pending.topic}` }
      ]
    };

    yield { type: 'done' };
    return;
  }

  // STEP 3: PUBLISH CONFIRMATION
  if (ctx.phase === 'AWAITING_PUBLISH' && (text.includes('yes') || text.includes('publish') || text.includes('assign') || text.includes('approve') || text.includes('haan'))) {
    yield thinking(`Publishing assessment #${ctx.assessmentId} and activating it for ${ctx.className}...`);

    yield toolStart('publish_assessment', `Publishing Assessment #${ctx.assessmentId} to ${ctx.className}`);
    const pubResult = await tools.executeTool('publish_assessment', { assessmentId: ctx.assessmentId }, user);
    yield toolDone('publish_assessment', 'Assessment published', pubResult.message);

    ctx.phase = 'AWAITING_DEMO_ATTEMPT';

    yield {
      type: 'message',
      content: `**Assessment Published & Assigned**\nThe test is now active for all students in **${ctx.className}**.\n\nWould you like to simulate a student test attempt (Aarav Sharma) to verify grading?`
    };

    yield {
      type: 'options_prompt',
      category: 'demo_action',
      options: [
        { label: 'Simulate Demo Student Attempt (Aarav Sharma)', value: 'Attempt test as student' },
        { label: 'Generate Teacher Diagnostic Report Directly', value: 'Skip attempt, generate teacher report directly' }
      ]
    };

    yield { type: 'done' };
    return;
  }

  // STEP 4: DEMO STUDENT ATTEMPT & SUBMISSION
  if (ctx.phase === 'AWAITING_DEMO_ATTEMPT' && (text.includes('attempt') || text.includes('student') || text.includes('yes') || text.includes('haan'))) {
    yield thinking(`Retrieving student credentials for ${ctx.className} and generating a secure student session token...`);

    yield toolStart('get_demo_student_session', 'Setting up student session');
    const studentSession = await tools.executeTool('get_demo_student_session', {
      classroomId: ctx.classroomId,
      assessmentId: ctx.assessmentId
    }, user);

    ctx.studentId = studentSession.studentId;
    ctx.studentName = studentSession.studentName;
    ctx.studentEmail = studentSession.studentEmail;
    ctx.studentToken = studentSession.studentToken;

    yield toolDone('get_demo_student_session', 'Student session active', `Logged in as ${studentSession.studentName}`);

    yield {
      type: 'student_session',
      studentName: studentSession.studentName,
      studentEmail: studentSession.studentEmail,
      studentToken: studentSession.studentToken,
      assessmentId: ctx.assessmentId
    };

    yield thinking(`Simulating realistic student test attempt: selecting answers with genuine conceptual reasoning...`);
    yield toolStart('submit_student_test', `Auto-answering and submitting test for ${studentSession.studentName}`);

    const subResult = await tools.executeTool('submit_student_test', {
      assessmentId: ctx.assessmentId,
      studentId: studentSession.studentId,
      studentToken: studentSession.studentToken
    }, user);

    ctx.score = subResult.score;
    ctx.totalMarks = subResult.totalMarks;
    ctx.percentage = subResult.percentage;
    ctx.weakTopics = subResult.weakTopics;
    ctx.phase = 'AWAITING_TEACHER_SWITCH';

    yield toolDone('submit_student_test', 'Test submitted & auto-graded', `Score: ${subResult.score}/${subResult.totalMarks} (${subResult.percentage}%)`);

    yield {
      type: 'message',
      content: `**Student Test Completed**\nStudent **${studentSession.studentName}** completed and submitted answers.\n- Score: ${subResult.score} / ${subResult.totalMarks} (${subResult.percentage}%)\n- Status: Evaluated & Saved to Gradebook.\n\nNotification sent to Teacher Dashboard: ${studentSession.studentName} submitted "${ctx.assessmentTitle || 'Assessment'}" (${subResult.score}/${subResult.totalMarks}).\n\nWould you like to switch to the Teacher Portal to view the Diagnostic Report?`
    };

    yield {
      type: 'options_prompt',
      category: 'role_switch',
      options: [
        { label: 'Switch to Teacher Portal & Generate Report', value: 'Switch to teacher portal and generate report' }
      ]
    };

    yield { type: 'done' };
    return;
  }

  // STEP 5: SWITCH TO TEACHER & GENERATE AI REPORT
  if (ctx.phase === 'AWAITING_TEACHER_SWITCH' || (ctx.phase !== 'INIT' && (text.includes('switch to teacher') || text.includes('generate report')))) {
    yield thinking(`Switching context back to Teacher (${user.name}). Generating AI Student Performance Analysis...`);

    yield toolStart('generate_performance_report', `Generating AI Performance Report for ${ctx.studentName || 'Student'}`);
    const report = await tools.executeTool('generate_performance_report', {
      studentId: ctx.studentId || 10,
      studentName: ctx.studentName || 'Aarav Sharma',
      assessmentId: ctx.assessmentId,
      score: ctx.score || 2,
      total: ctx.totalMarks || 3,
      weakTopics: ctx.weakTopics
    }, user);

    ctx.reportData = report;
    ctx.phase = 'AWAITING_EMAIL_SEND';

    yield toolDone('generate_performance_report', 'AI Performance Report ready', `Report #${report.reportId} generated`);

    yield {
      type: 'report_preview',
      reportId: report.reportId,
      studentName: report.studentName,
      assessmentTitle: report.assessmentTitle,
      score: report.score,
      total: report.total,
      percentage: report.percentage,
      summary: report.summary,
      strengths: report.strengths,
      weakTopics: report.weakTopics,
      recommendation: report.recommendation
    };

    yield {
      type: 'message',
      content: `**AI Student Performance Report Generated**\nFoundational knowledge is solid, with an identified gap in: **${report.weakTopics.join(', ')}**.\n\nWould you like to dispatch this report to parents or a custom email?`
    };

    const parentEmail = `${(ctx.studentName || 'aarav').toLowerCase().replace(/\s+/g, '.')}.parents@demo.local`;
    yield {
      type: 'options_prompt',
      category: 'email_action',
      options: [
        { label: `Send to Registered Parent Email (${parentEmail})`, value: `Send report to ${parentEmail}` },
        { label: `Send to Custom Email (teacher.demo@gmail.com)`, value: `Send report to teacher.demo@gmail.com` },
        { label: `Skip Email & Generate Study Plan`, value: 'Generate study plan for weak topics' }
      ]
    };

    yield { type: 'done' };
    return;
  }

  // STEP 6: SEND REPORT EMAIL
  if (ctx.phase === 'AWAITING_EMAIL_SEND' && (text.includes('email') || text.includes('send') || text.includes('@'))) {
    const emailMatch = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.exec(message);
    const recipient = emailMatch ? emailMatch[1] : `${(ctx.studentName || 'aarav').toLowerCase().replace(/\s+/g, '.')}.parents@demo.local`;

    yield thinking(`Composing branded HTML report and sending email to ${recipient}...`);

    yield toolStart('send_report_email', `Sending report email to ${recipient}`);
    const emailRes = await tools.executeTool('send_report_email', {
      recipientEmail: recipient,
      studentName: ctx.studentName || 'Aarav Sharma',
      assessmentTitle: ctx.assessmentTitle || 'Class Assessment',
      score: ctx.score || 2,
      total: ctx.totalMarks || 3,
      weakTopics: ctx.weakTopics,
      recommendations: ctx.reportData?.recommendation
    }, user);

    ctx.sentEmail = emailRes;
    ctx.phase = 'AWAITING_STUDY_PLAN';

    yield toolDone('send_report_email', 'Email dispatched & archived', `Saved to ${emailRes.savedPath}`);

    yield {
      type: 'message',
      content: `**Report Sent Successfully**\nDelivered to **${recipient}**. Email includes the score breakdown and teacher recommendation.\n\nWould you like an adaptive 3-day recovery study plan with curated YouTube lectures and reading articles?`
    };

    yield {
      type: 'options_prompt',
      category: 'study_plan_action',
      options: [
        { label: 'Generate Adaptive Study Plan & Video Lectures', value: 'Generate study plan for weak topics' }
      ]
    };

    yield { type: 'done' };
    return;
  }

  // STEP 7: GENERATE STUDY PLAN & TUTORIAL AGENT HANDOFF
  if (ctx.phase === 'AWAITING_STUDY_PLAN' || text.includes('study plan') || text.includes('youtube') || text.includes('lecture')) {
    yield thinking(`Calling Groq AI to generate a targeted 3-day recovery micro-study plan with search-optimized YouTube video links and reading articles...`);

    yield toolStart('generate_study_plan', 'Synthesizing adaptive micro-study plan with Groq');
    const plan = await tools.executeTool('generate_study_plan', {
      studentName: ctx.studentName || 'Aarav Sharma',
      subject: ctx.subject || 'Science',
      weakTopics: ctx.weakTopics && ctx.weakTopics.length ? ctx.weakTopics : ['Limiting Factors in Photosynthesis']
    }, user);

    ctx.studyPlan = plan;
    ctx.phase = 'WORKFLOW_COMPLETE';

    yield toolDone('generate_study_plan', 'Study plan synthesized', `${plan.modules.length} targeted learning modules created`);

    yield {
      type: 'study_plan',
      plan
    };

    yield {
      type: 'message',
      content: `**Personalized Study Plan Ready**\nConstructed a 3-day recovery plan for **${ctx.studentName || 'Aarav'}** with direct YouTube lecture links and concept references above.\n\nWorkflow completed:\n1. Question Generation with Pedagogical Style\n2. In-Chat Review & Scheduled / Instant Publishing\n3. Demo Student Attempt Simulation\n4. Role Switching & AI Diagnostic Report\n5. Parent Email Dispatch\n6. Adaptive Study Plan with Curated Lectures`
    };

    yield {
      type: 'options_prompt',
      options: [
        { label: 'Create Another Assessment (Grade 9 Physics)', value: 'Grade 9 Physics ke liye optics ka 15-min exam prepare karo' },
        { label: 'Clear Session', value: '/reset' }
      ]
    };

    yield { type: 'done' };
    return;
  }

  // ==========================================
  // ONE-SHOT "MAGIC INTENT" RESOLVER
  // If user says "8th A ke liye photosynthesis ka 15-minute test banao"
  // or "Create an assignment", or mentions any topic/class
  // ==========================================
  yield thinking('Fetching assigned classrooms from database for teacher context...');
  const overview = await tools.executeTool('get_classes_and_courses', {}, user);
  const classes = overview.classes || [];

  yield thinking('Analyzing teacher prompt with Groq Zero-Shot Intent Resolver...');
  const magic = await parseMagicIntent(message, classes);

  if (magic && magic.isTestIntent) {
    // If teacher didn't specify which classroom to target, ask politely!
    if (magic.needsClarification || !magic.classroomId) {
      ctx.pendingDraft = {
        topic: magic.topic,
        count: magic.count || 3,
        durationMinutes: magic.durationMinutes || 15,
        opensAt: magic.opensAt || null,
        autoPublish: magic.autoPublish || false,
        difficulty: magic.difficulty || 'medium',
        templateId: magic.templateId || 'board_exam_practice'
      };
      ctx.phase = 'AWAITING_CLASS_SELECTION';

      yield {
        type: 'message',
        content: `Sure! Main **"${magic.topic}"** ka **${magic.count || 3} questions** ka test ready karta hoon.\n\nLekin aap ye test **kis Class** ke liye banana chahti hain?`
      };

      yield {
        type: 'options_prompt',
        category: 'class_selection',
        options: classes.map(c => ({
          label: `${c.name} (${c.courses?.[0]?.title || 'Science'})`,
          value: `Class: ${c.name}`
        }))
      };

      yield { type: 'done' };
      return;
    }

    yield thinking(`🎯 Magic Intent Decoded!
• Classroom: ${magic.className} (ID: ${magic.classroomId})
• Subject: ${magic.subject} (ID: ${magic.courseId})
• Topic: "${magic.topic}"
• Duration: ${magic.durationMinutes} mins
• Questions: ${magic.count} MCQs (${magic.difficulty}, ${magic.templateId})
${magic.opensAt ? `• Scheduled: ${magic.opensAt}` : ''}`);

    ctx.classroomId = magic.classroomId;
    ctx.className = magic.className;
    ctx.courseId = magic.courseId;
    ctx.courseTitle = magic.subject;
    ctx.subject = magic.subject;
    ctx.topic = magic.topic;
    ctx.templateId = magic.templateId;

    yield toolStart('generate_questions', `Generating ${magic.count} questions on "${magic.topic}" via Groq AI`, {
      count: magic.count,
      difficulty: magic.difficulty,
      templateId: magic.templateId
    });

    const genResult = await tools.executeTool('generate_questions', {
      topic: magic.topic,
      subject: magic.subject,
      classroomId: magic.classroomId,
      courseId: magic.courseId,
      count: magic.count || 3,
      difficulty: magic.difficulty || 'medium',
      templateId: magic.templateId || 'board_exam_practice'
    }, user);

    yield toolDone('generate_questions', 'Questions generated successfully', `Generated ${genResult.questions.length} multiple-choice questions`);

    yield thinking('Autonomously saving draft assessment in database with answer keys and explanations...');
    yield toolStart('save_assessment_draft', 'Saving draft assessment in database');

    const draftResult = await tools.executeTool('save_assessment_draft', {
      title: `${magic.topic} - Diagnostic Assessment`,
      subject: magic.subject,
      classroomId: magic.classroomId,
      courseId: magic.courseId,
      durationMinutes: magic.durationMinutes || 15,
      opensAt: magic.opensAt || null,
      questions: genResult.questions
    }, user);

    yield toolDone('save_assessment_draft', 'Draft saved in database', `Assessment ID: #${draftResult.assessmentId}`);

    ctx.assessmentId = draftResult.assessmentId;
    ctx.assessmentTitle = draftResult.title;
    ctx.generatedQuestions = genResult.questions;

    // Check if teacher explicitly asked to publish/assign directly in the prompt or scheduled
    if (magic.autoPublish || magic.opensAt) {
      yield thinking(`Auto-publish requested: publishing assessment #${draftResult.assessmentId} to ${magic.className}...`);
      yield toolStart('publish_assessment', `Publishing Assessment #${draftResult.assessmentId} to ${magic.className}`);
      const pubResult = await tools.executeTool('publish_assessment', { assessmentId: draftResult.assessmentId }, user);
      yield toolDone('publish_assessment', 'Assessment published & live', pubResult.message);

      ctx.phase = 'AWAITING_DEMO_ATTEMPT';

      const schedText = magic.opensAt
        ? `\n\nScheduled to open on: **${new Date(magic.opensAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}**`
        : '';

      yield {
        type: 'questions_preview',
        assessmentId: draftResult.assessmentId,
        title: draftResult.title,
        className: magic.className,
        subject: magic.subject,
        durationMinutes: magic.durationMinutes || 15,
        opensAt: magic.opensAt,
        questions: genResult.questions,
        isPublished: true
      };

      yield {
        type: 'message',
        content: `Assessment Created & Published for **${magic.className}**!${schedText}

I generated **${genResult.questions.length} questions** on **"${magic.topic}"** and published it.

**Next step:** Would you like to simulate a student attempt (Aarav Sharma) to verify grading & analytics?`
      };

      yield {
        type: 'options_prompt',
        category: 'demo_action',
        options: [
          { label: 'Simulate Demo Student Attempt (Aarav Sharma)', value: 'Attempt test as student' },
          { label: 'Generate Teacher Report Directly', value: 'Skip attempt, generate teacher report directly' }
        ]
      };

      yield { type: 'done' };
      return;
    }

    ctx.phase = 'AWAITING_PUBLISH';

    yield {
      type: 'questions_preview',
      assessmentId: draftResult.assessmentId,
      title: draftResult.title,
      className: magic.className,
      subject: magic.subject,
      durationMinutes: magic.durationMinutes || 15,
      questions: genResult.questions
    };

    yield {
      type: 'message',
      content: `**Assessment Draft Created**\n\nGenerated **${genResult.questions.length} questions** on **"${magic.topic}"** for **${magic.className}** (${magic.subject}, ${magic.durationMinutes} mins).\n\nReview the questions above. Would you like to approve and publish to ${magic.className}?`
    };

    yield {
      type: 'options_prompt',
      category: 'confirmation',
      options: [
        { label: `Approve & Publish to ${magic.className}`, value: 'Yes, publish this assessment now' },
        { label: 'Regenerate Questions', value: `Regenerate test for ${magic.className} on ${magic.topic}` }
      ]
    };

    yield { type: 'done' };
    return;
  }

  // ==========================================
  // FALLBACK / GENERAL CONVERSATIONAL AI
  // ==========================================
  yield thinking('Processing conversational message with Groq LLM brain...');
  const groqApiKey = process.env.GROQ_API_KEY;
  const model = process.env.AIA_LLM_MODEL || 'openai/gpt-oss-120b';

  let reply = "Hello. I am your AI Assessment Assistant. You can provide instructions directly, such as: \"8th A ke liye photosynthesis ka 15-minute test banao\".";
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are the Assessment Assistant for an enterprise school LMS. You can create assessments with one shot, assign them, simulate student attempts, generate reports, send parent emails, and create study plans. Answer professionally, concisely, without emojis, and remind the user of example commands.`
          },
          ...session.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }))
        ],
        temperature: 0.5
      })
    });
    const data = await res.json();
    if (data.choices?.[0]?.message?.content) {
      reply = data.choices[0].message.content;
    }
  } catch (err) {
    console.error('[agentLoop] Fallback LLM error:', err.message);
  }

  session.addMessage('assistant', reply);
  yield { type: 'message', content: reply };
  yield {
    type: 'options_prompt',
    options: [
      { label: 'Grade 8 - A: 15-minute Photosynthesis Test', value: '8th A ke liye photosynthesis ka 15-minute test banao' },
      { label: 'Grade 9: Optics Examination', value: 'Grade 9 Physics ke liye optics ka exam prepare karo' }
    ]
  };
  yield { type: 'done' };
}

module.exports = { runAgentLoop, getSession, clearSession };
