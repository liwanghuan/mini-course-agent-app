import type { CourseApi, CourseStreamHandlers } from './contracts';
import type { CourseEvent, CourseSession, SharedCourseMemory } from '../types/course';

const now = () => new Date().toISOString();
const sessionId = 'course_mock_session';
const quizId = 'quiz_mock_concept';
const newtonsQuizId = 'quiz_inertia_puck';
let currentTopic = 'Photosynthesis';
let currentLevel = 'beginner';

function structuredLesson(content: string, summary: string, concept: string, topic: string) {
  return {
    part_number: 1,
    content,
    summary,
    sections: [
      { kind: 'overview' as const, title: 'Big picture', body: summary },
      { kind: 'concept' as const, title: `Key concept: ${concept}`, body: `Use ${concept} as the anchor for this lesson.` },
      { kind: 'example' as const, title: 'Concrete example', body: `Connect ${topic} to one everyday situation you can picture.` },
      { kind: 'recap' as const, title: 'Quick recap', body: `Remember the core idea before moving to the quiz.` },
    ],
    key_takeaways: [`Start with ${concept}.`, 'Use one concrete example.', 'Check your understanding with the quiz.'],
    examples: [{ title: 'Everyday example', scenario: `Imagine explaining ${topic} to a friend.`, explanation: `A clear example makes ${concept} easier to remember.` }],
    vocabulary: [{ term: concept, definition: `A key term for this part of ${topic}.` }],
    concept_tags: [concept],
    agent_role: 'tutor' as const,
  };
}

function event(sequence: number, event_type: string, agent_role: CourseEvent['agent_role'], payload: Record<string, unknown>): CourseEvent {
  return { id: `event_${sequence}_${event_type}`, sequence, session_id: sessionId, event_type, agent_role, payload, created_at: now() };
}

function memory(done = false, graded = false, topic = currentTopic, learnerLevel = currentLevel): SharedCourseMemory {
  const isNewton = topic === "Newton's Laws";
  const quiz = isNewton
    ? { id: newtonsQuizId, part_number: 1, question: 'On frictionless ice, does a moving puck slow down on its own?', correct_answer: 'no', accepted_answers: ['no'], concept_tags: ['inertia'], misconception_tags: ['motion naturally stops'] }
    : { id: quizId, part_number: 1, question: `What is the key beginner idea in ${topic}?`, correct_answer: topic.toLowerCase(), accepted_answers: [topic.toLowerCase(), 'core idea'], concept_tags: [topic.toLowerCase()], misconception_tags: [`confusing ${topic} with another topic`] };
  const lesson = isNewton
    ? structuredLesson(
        "A ball stays still until you kick it — that's inertia. Newton's First Law says objects do not change motion unless a force acts on them.",
        'Inertia means objects keep doing what they are already doing unless a force changes that.',
        'inertia',
        "Newton's Laws"
      )
    : structuredLesson(
        `For ${topic}, start with the core idea first, then connect it to one concrete example.`,
        `${topic} becomes easier when you learn one core idea, one example, and one takeaway at a time.`,
        topic.toLowerCase(),
        topic
      );
  const grade = isNewton
    ? { quiz_id: newtonsQuizId, is_correct: false, correct_answer: 'no', feedback: 'Not quite. The correct answer is no: on frictionless ice, the puck does not slow down on its own. That shows inertia.', weak_spot_tags: ['inertia'], memory_patch: { weak_spot: 'inertia' } }
    : { quiz_id: quizId, is_correct: false, correct_answer: topic.toLowerCase(), feedback: `Not quite. Focus on the core idea of ${topic}.`, weak_spot_tags: [topic.toLowerCase()], memory_patch: { weak_spot: topic.toLowerCase() } };

  return {
    session_id: sessionId,
    topic,
    learner_level: learnerLevel,
    current_part: 1,
    lesson_plan: done
      ? { topic, learner_level: learnerLevel, parts: [{ part_number: 1, title: `Part 1: What is ${topic}?`, learning_goal: `Build a beginner-friendly mental model of ${topic}.`, concepts: isNewton ? ['inertia'] : [topic.toLowerCase()] }] }
      : null,
    taught_parts: done ? [lesson] : [],
    quiz_history: done ? [quiz] : [],
    answer_history: graded ? [{ quiz_id: quiz.id, answer_text: isNewton ? 'yes' : 'not sure', created_at: now() }] : [],
    grade_history: graded ? [grade] : [],
    weak_spots: graded ? [{ concept: grade.weak_spot_tags[0], evidence: grade.feedback, count: 1, created_at: now(), last_seen_at: now() }] : [],
    mastery: graded ? { [grade.weak_spot_tags[0]]: 'weak_spot' } : done ? { [quiz.concept_tags[0]]: 'introduced' } : {},
    event_log: [],
    version: graded ? 4 : done ? 3 : 0,
  };
}

function session(done = false, graded = false, topic = currentTopic, learnerLevel = currentLevel): CourseSession {
  return { id: sessionId, status: graded ? 'completed' : done ? 'waiting_for_answer' : 'created', memory: memory(done, graded, topic, learnerLevel), events: [], created_at: now(), updated_at: now() };
}

export const mockCourseApi: CourseApi = {
  async createSession(request) {
    currentTopic = request.topic;
    currentLevel = request.learner_level;
    return session(false, false, request.topic, request.learner_level);
  },
  async getSession() {
    return session(true, true);
  },
  async getMemory() {
    return memory(true, true);
  },
  async streamStartPart(_sessionId: string, _partNumber: number, handlers: CourseStreamHandlers) {
    const done = memory(true, false);
    [
      event(1, 'agent.started', 'planner', { agent: 'planner', part_number: 1 }),
      event(2, 'agent.completed', 'planner', { agent: 'planner', lesson_plan: done.lesson_plan }),
      event(3, 'memory.updated', 'planner', { memory: done }),
      event(4, 'agent.started', 'tutor', { agent: 'tutor', part_number: 1 }),
      event(5, 'lesson.taught', 'tutor', { tutor_turn: done.taught_parts[0] }),
      event(6, 'agent.completed', 'tutor', { agent: 'tutor', part_number: 1 }),
      event(7, 'agent.started', 'quiz_maker', { agent: 'quiz_maker', part_number: 1 }),
      event(8, 'quiz.created', 'quiz_maker', { quiz: done.quiz_history[0] }),
      event(9, 'agent.completed', 'quiz_maker', { agent: 'quiz_maker', quiz_id: done.quiz_history[0].id }),
      event(10, 'memory.updated', 'quiz_maker', { memory: done }),
      event(11, 'session.waiting_for_answer', 'orchestrator', { quiz_id: done.quiz_history[0].id }),
    ].forEach(handlers.onEvent);
  },
  async streamSubmitAnswer(_sessionId: string, request, handlers: CourseStreamHandlers) {
    const done = memory(true, true);
    [
      event(12, 'agent.started', 'grader', { agent: 'grader', quiz_id: request.quiz_id }),
      event(13, 'grade.completed', 'grader', { answer: done.answer_history[0], grade: done.grade_history[0] }),
      event(14, 'agent.completed', 'grader', { agent: 'grader', quiz_id: request.quiz_id }),
      event(15, 'weak_spot.logged', 'grader', { weak_spots: done.grade_history[0].weak_spot_tags }),
      event(16, 'memory.updated', 'grader', { memory: done }),
      event(17, 'session.status', 'orchestrator', { status: 'completed' }),
    ].forEach(handlers.onEvent);
  },
  async runNewtonDemo() {
    currentTopic = "Newton's Laws";
    currentLevel = 'beginner';
    return session(true, true, "Newton's Laws", 'beginner');
  },
};
