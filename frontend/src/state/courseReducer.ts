import type { AgentRole, CourseEvent, CourseSession, GradeResult, QuizItem, SharedCourseMemory, TutorTurn } from '../types/course';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'error';

export interface AgentRunState {
  role: AgentRole;
  status: AgentStatus;
  summary: string;
}

export interface CourseUiState {
  session: CourseSession | null;
  events: CourseEvent[];
  lesson: TutorTurn | null;
  quiz: QuizItem | null;
  grade: GradeResult | null;
  answerDraft: string;
  topicDraft: string;
  learnerLevelDraft: string;
  agentRuns: Record<AgentRole, AgentRunState>;
  busy: boolean;
  error: string | null;
}

export type CourseAction =
  | { type: 'SESSION_CREATED'; session: CourseSession }
  | { type: 'STREAM_EVENT_RECEIVED'; event: CourseEvent }
  | { type: 'ANSWER_CHANGED'; value: string }
  | { type: 'TOPIC_CHANGED'; value: string }
  | { type: 'LEARNER_LEVEL_CHANGED'; value: string }
  | { type: 'BUSY_CHANGED'; busy: boolean }
  | { type: 'ERROR_RECEIVED'; message: string | null };

const AGENT_ROLES: AgentRole[] = ['orchestrator', 'planner', 'tutor', 'quiz_maker', 'grader'];

export const initialCourseState: CourseUiState = {
  session: null,
  events: [],
  lesson: null,
  quiz: null,
  grade: null,
  answerDraft: '',
  topicDraft: '',
  learnerLevelDraft: 'beginner',
  agentRuns: createAgentRuns(),
  busy: false,
  error: null,
};

export function courseReducer(state: CourseUiState, action: CourseAction): CourseUiState {
  switch (action.type) {
    case 'SESSION_CREATED':
      return {
        ...initialCourseState,
        session: action.session,
        events: action.session.events,
        lesson: lastItem(action.session.memory.taught_parts),
        quiz: lastItem(action.session.memory.quiz_history),
        grade: lastItem(action.session.memory.grade_history),
        topicDraft: action.session.memory.topic,
        learnerLevelDraft: action.session.memory.learner_level,
        agentRuns: applyEvents(createAgentRuns(), action.session.events),
      };
    case 'STREAM_EVENT_RECEIVED':
      return applyCourseEvent({ ...state, events: [...state.events, action.event] }, action.event);
    case 'ANSWER_CHANGED':
      return { ...state, answerDraft: action.value };
    case 'TOPIC_CHANGED':
      return { ...state, topicDraft: action.value };
    case 'LEARNER_LEVEL_CHANGED':
      return { ...state, learnerLevelDraft: action.value };
    case 'BUSY_CHANGED':
      return { ...state, busy: action.busy, error: action.busy ? null : state.error };
    case 'ERROR_RECEIVED':
      return { ...state, error: action.message, busy: false };
    default:
      return state;
  }
}

function applyCourseEvent(state: CourseUiState, event: CourseEvent): CourseUiState {
  let next = { ...state, agentRuns: applyAgentEvent(state.agentRuns, event) };
  if (event.event_type === 'lesson.taught') next = { ...next, lesson: event.payload.tutor_turn as TutorTurn };
  if (event.event_type === 'quiz.created') next = { ...next, quiz: event.payload.quiz as QuizItem, answerDraft: '' };
  if (event.event_type === 'grade.completed') next = { ...next, grade: event.payload.grade as GradeResult };
  if (event.event_type === 'memory.updated') next = patchMemory(next, event.payload.memory as SharedCourseMemory);
  if (event.event_type === 'session.status' && next.session) next = { ...next, session: { ...next.session, status: event.payload.status as CourseSession['status'] } };
  if (event.event_type === 'session.error') next = { ...next, error: String(event.payload.message ?? 'Course session failed.'), busy: false };
  return next;
}

function patchMemory(state: CourseUiState, memory: SharedCourseMemory): CourseUiState {
  if (!state.session) return state;
  return { ...state, session: { ...state.session, memory } };
}

function createAgentRuns(): Record<AgentRole, AgentRunState> {
  return AGENT_ROLES.reduce((runs, role) => {
    runs[role] = { role, status: 'pending', summary: 'Waiting' };
    return runs;
  }, {} as Record<AgentRole, AgentRunState>);
}

function applyEvents(agentRuns: Record<AgentRole, AgentRunState>, events: CourseEvent[]): Record<AgentRole, AgentRunState> {
  return events.reduce((runs, event) => applyAgentEvent(runs, event), agentRuns);
}

function applyAgentEvent(agentRuns: Record<AgentRole, AgentRunState>, event: CourseEvent): Record<AgentRole, AgentRunState> {
  const role = event.agent_role;
  if (!role) return agentRuns;
  const current = agentRuns[role] ?? { role, status: 'pending', summary: 'Waiting' };
  const next = { ...agentRuns };
  if (event.event_type === 'agent.started') {
    next[role] = { ...current, status: 'running', summary: 'Running now' };
    return next;
  }
  if (event.event_type === 'session.error') {
    next[role] = { ...current, status: 'error', summary: String(event.payload.message ?? 'Error') };
    return next;
  }
  if (event.event_type === 'agent.completed' || ['lesson.taught', 'quiz.created', 'grade.completed', 'session.status'].includes(event.event_type)) {
    next[role] = { ...current, status: 'completed', summary: readableEvent(event.event_type) };
    return next;
  }
  next[role] = { ...current, summary: readableEvent(event.event_type) };
  return next;
}

function readableEvent(eventType: string): string {
  return eventType.split('.').join(' ');
}

function lastItem<T>(items: T[]): T | null {
  return items.length ? items[items.length - 1] : null;
}
