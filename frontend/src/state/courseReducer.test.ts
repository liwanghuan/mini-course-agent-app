import { describe, expect, it } from 'vitest';
import type { CourseEvent, CourseSession } from '../types/course';
import { courseReducer, initialCourseState } from './courseReducer';

const session: CourseSession = {
  id: 'course_1',
  status: 'created',
  created_at: '2026-06-17T00:00:00Z',
  updated_at: '2026-06-17T00:00:00Z',
  events: [],
  memory: {
    session_id: 'course_1',
    topic: 'Photosynthesis',
    learner_level: 'beginner',
    current_part: 1,
    lesson_plan: null,
    taught_parts: [],
    quiz_history: [],
    answer_history: [],
    grade_history: [],
    weak_spots: [],
    mastery: {},
    event_log: [],
    version: 0,
  },
};

function event(event_type: string, payload: CourseEvent['payload'], agent_role: CourseEvent['agent_role'] = 'tutor'): CourseEvent {
  return { id: `event_${event_type}`, sequence: 1, session_id: 'course_1', event_type, agent_role, payload, created_at: '2026-06-17T00:00:00Z' };
}

describe('courseReducer', () => {
  it('stores lesson, quiz, and grade events', () => {
    let state = courseReducer(initialCourseState, { type: 'SESSION_CREATED', session });
    state = courseReducer(state, { type: 'STREAM_EVENT_RECEIVED', event: event('lesson.taught', { tutor_turn: { part_number: 1, content: 'Photosynthesis turns light into energy.', concept_tags: ['photosynthesis'], agent_role: 'tutor' } }) });
    state = courseReducer(state, { type: 'STREAM_EVENT_RECEIVED', event: event('quiz.created', { quiz: { id: 'quiz_1', part_number: 1, question: 'What is photosynthesis?', correct_answer: 'photosynthesis', accepted_answers: ['photosynthesis'], concept_tags: ['photosynthesis'], misconception_tags: [] } }, 'quiz_maker') });
    state = courseReducer(state, { type: 'STREAM_EVENT_RECEIVED', event: event('grade.completed', { grade: { quiz_id: 'quiz_1', is_correct: false, correct_answer: 'photosynthesis', feedback: 'Not quite.', weak_spot_tags: ['photosynthesis'], memory_patch: {} } }, 'grader') });

    expect(state.lesson?.content).toContain('Photosynthesis');
    expect(state.quiz?.question).toContain('photosynthesis');
    expect(state.grade?.is_correct).toBe(false);
  });

  it('tracks topic drafts and agent status', () => {
    let state = courseReducer(initialCourseState, { type: 'TOPIC_CHANGED', value: 'SQL joins' });
    state = courseReducer(state, { type: 'LEARNER_LEVEL_CHANGED', value: 'intermediate' });
    expect(state.topicDraft).toBe('SQL joins');
    expect(state.learnerLevelDraft).toBe('intermediate');

    state = courseReducer(state, { type: 'STREAM_EVENT_RECEIVED', event: event('agent.started', { agent: 'planner' }, 'planner') });
    expect(state.agentRuns.planner.status).toBe('running');

    state = courseReducer(state, { type: 'STREAM_EVENT_RECEIVED', event: event('agent.completed', { agent: 'planner' }, 'planner') });
    expect(state.agentRuns.planner.status).toBe('completed');
  });
});
