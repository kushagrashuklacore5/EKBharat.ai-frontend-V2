export interface AgentCapability {
  title: string
  desc: string
}

export interface AgentSpec {
  id: 'vaani' | 'tutor' | 'cheating-detection' | 'assessment' | 'orchestrator'
  number: string
  name: string
  category: string
  badge: string
  accent: string
  accentRgb: string
  tagline: string
  shortDesc: string
  purpose: string[]
  capabilities: AgentCapability[]
  specs: { label: string; value: string }[]
  demoType: 'voice' | 'tutor' | 'cheating' | 'assessment' | 'orchestrator'
}

export const AGENTS_DATA: AgentSpec[] = [
  {
    id: 'vaani',
    number: '01',
    name: 'Vaani – Voice AI Agent',
    category: 'Customer Experience / Voice Automation',
    badge: 'Voice Automation',
    accent: '#1d6a80',
    accentRgb: '29, 106, 128',
    tagline: 'Enterprise voice AI engineered for natural, low-latency customer care and contact centre automation.',
    shortDesc:
      'AI-powered voice agent for customer care. Handles customer conversations, automates BPO workflows, and demonstrates voice-based AI interaction across Indian languages.',
    purpose: [
      'AI-powered voice agent for customer care.',
      'Handles customer conversations.',
      'Designed for customer support and BPO replacement/automation.',
      'Demonstrates voice-based AI interaction.',
    ],
    capabilities: [
      {
        title: 'Bilingual Voice Processing',
        desc: 'Real-time conversational handling in English, Hindi, and regional dialects with native nuance.',
      },
      {
        title: 'Sub-300ms Turn Latency',
        desc: 'Optimized voice pipeline from speech-to-text, LLM inference, to neural TTS streaming.',
      },
      {
        title: 'Intent & Entity Extraction',
        desc: 'Extracts customer intent, account identifiers, and issue classifications on the fly.',
      },
      {
        title: 'Telephony & SIP Integration',
        desc: 'Ready for enterprise PBX, Twilio, Exotel, and private cloud telephony trunking.',
      },
    ],
    specs: [
      { label: 'Primary Domain', value: 'Customer Support & BPO' },
      { label: 'Latency Target', value: '< 280 ms end-to-end' },
      { label: 'Voice Mode', value: 'Full-duplex streaming' },
      { label: 'Languages', value: 'English, Hindi, Hinglish' },
    ],
    demoType: 'voice',
  },
  {
    id: 'tutor',
    number: '02',
    name: 'AI Tutor Agent',
    category: 'Education',
    badge: 'Education',
    accent: '#2c64a0',
    accentRgb: '44, 100, 160',
    tagline: 'Pedagogical AI assistant guiding learners through concepts, step-by-step derivations, and Socratic discovery.',
    shortDesc:
      'AI-powered tutoring assistant that helps students with learning and educational queries, providing curriculum-aligned explanations and personalised guidance.',
    purpose: [
      'AI-powered tutoring assistant.',
      'Helps students with learning and educational queries.',
    ],
    capabilities: [
      {
        title: 'Socratic Concept Guidance',
        desc: 'Encourages critical thinking by posing guided questions rather than serving rote answers.',
      },
      {
        title: 'Curriculum & Syllabus Grounding',
        desc: 'Strictly aligned with specified textbooks, NCERT/CBSE standards, and institutional syllabi.',
      },
      {
        title: 'Step-by-Step Problem Solving',
        desc: 'Breaks down complex mathematical, scientific, and logical problems into digestible steps.',
      },
      {
        title: 'Adaptive Learning Pace',
        desc: 'Detects student comprehension gaps and adjusts complexity and illustrative examples dynamically.',
      },
    ],
    specs: [
      { label: 'Target Audience', value: 'K-12 & Higher Ed Students' },
      { label: 'Pedagogy', value: 'Socratic & Stepwise' },
      { label: 'Curriculum Align', value: 'NCERT, CBSE & Custom' },
      { label: 'Safety Filters', value: 'Strict Academic Scope' },
    ],
    demoType: 'tutor',
  },
  {
    id: 'cheating-detection',
    number: '03',
    name: 'Cheating Detection Agent',
    category: 'Education / Academic Integrity',
    badge: 'Academic Integrity',
    accent: '#b84848',
    accentRgb: '184, 72, 72',
    tagline: 'Real-time telemetry and behaviour analysis safeguarding high-stakes examinations and online assessments.',
    shortDesc:
      'Detects potential cheating and suspicious academic behaviour during assessments and exams, helping institutions maintain uncompromising academic integrity.',
    purpose: [
      'Detects potential cheating and suspicious academic behaviour.',
      'Helps maintain examination integrity.',
    ],
    capabilities: [
      {
        title: 'Multi-Face & Presence Analysis',
        desc: 'Identifies multiple faces, absent candidates, or unauthorized persons within camera range.',
      },
      {
        title: 'Acoustic Anomaly Flagging',
        desc: 'Monitors acoustic telemetry for background whispers, second speakers, and electronic devices.',
      },
      {
        title: 'Session Telemetry & Window Blur',
        desc: 'Tracks tab switching, external monitor detection, clipboard pastes, and window focus loss.',
      },
      {
        title: 'Auditable Proctor Review Queue',
        desc: 'Generates flagged incident timelines with timestamped evidence for human proctors to verify.',
      },
    ],
    specs: [
      { label: 'Application', value: 'Proctored Exams & Tests' },
      { label: 'Telemetry Signals', value: 'Vision, Audio, Browser' },
      { label: 'Decision Role', value: 'Flagging only (Human signs off)' },
      { label: 'Audit Trail', value: '100% timestamped events' },
    ],
    demoType: 'cheating',
  },
  {
    id: 'assessment',
    number: '04',
    name: 'AI Assessment Agent',
    category: 'Education',
    badge: 'Automated Evaluation',
    accent: '#3f7d58',
    accentRgb: '63, 125, 88',
    tagline: 'Objective, rubric-grounded evaluation and constructive feedback generation for student submissions.',
    shortDesc:
      'AI-powered assessment and evaluation supporting automated assessment workflows, rubric scoring, and objective educator feedback.',
    purpose: [
      'AI-powered assessment and evaluation.',
      'Supports automated assessment workflows.',
    ],
    capabilities: [
      {
        title: 'Rubric-Grounded Scoring',
        desc: 'Evaluates answers against structured institutional rubrics with explicit criteria weighting.',
      },
      {
        title: 'Citation-Backed Justification',
        desc: 'Highlights specific sentences and arguments in the student work that substantiate each score.',
      },
      {
        title: 'Constructive Feedback Generation',
        desc: 'Drafts actionable growth recommendations for students alongside criterion breakdowns.',
      },
      {
        title: 'Educator Approval Workflow',
        desc: 'Integrates into grading queues where teachers can review, adjust, and approve final grades.',
      },
    ],
    specs: [
      { label: 'Use Case', value: 'Assignments & Subjective Tests' },
      { label: 'Scoring Basis', value: 'Multi-criteria rubrics' },
      { label: 'Evidence', value: 'Text citation extraction' },
      { label: 'Educator Role', value: 'Review & grade approval' },
    ],
    demoType: 'assessment',
  },
  {
    id: 'orchestrator',
    number: '05',
    name: 'Orchestrator Agent',
    category: 'Multi-Agent Orchestration',
    badge: 'Multi-Agent Systems',
    accent: '#5867a8',
    accentRgb: '88, 103, 168',
    tagline: 'Hierarchical coordinator delegating subtasks, synchronizing shared state, and enforcing deterministic human gates.',
    shortDesc:
      'Coordinates multiple AI agents, manages task delegation and workflow execution, and demonstrates multi-agent collaboration under rigorous human oversight.',
    purpose: [
      'Coordinates multiple AI agents.',
      'Manages task delegation and workflow execution.',
      'Demonstrates multi-agent collaboration and orchestration.',
    ],
    capabilities: [
      {
        title: 'Task Decomposition & Planning',
        desc: 'Breaks complex enterprise requests into discrete subtasks and assigns them to specialist agents.',
      },
      {
        title: 'Shared Context & Memory Store',
        desc: 'Maintains stateful memory across agent handoffs without loss of context or redundant prompt tokens.',
      },
      {
        title: 'Agent-to-Agent Contracts',
        desc: 'Enforces typed JSON schemas for outputs moving from research and analysis to reporting.',
      },
      {
        title: 'Human-in-the-Loop Checkpoints',
        desc: 'Pauses execution before sensitive actions, allowing reviewers to inspect reasoning and approve.',
      },
    ],
    specs: [
      { label: 'Architecture', value: 'Hierarchical Coordinator' },
      { label: 'Execution', value: 'Stateful DAG & Parallel loops' },
      { label: 'Tool Protocol', value: 'Typed function calling' },
      { label: 'Safety', value: 'Deterministic approval gates' },
    ],
    demoType: 'orchestrator',
  },
]
