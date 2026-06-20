import type { CourseEvent, CourseSession, SharedCourseMemory } from '../types/course';

export interface CourseStreamHandlers {
  onEvent(event: CourseEvent): void;
  onError?(error: Error): void;
}

export interface CourseApi {
  createSession(request: { topic: string; learner_level: string }): Promise<CourseSession>;
  getSession(sessionId: string): Promise<CourseSession>;
  getMemory(sessionId: string): Promise<SharedCourseMemory>;
  streamStartPart(sessionId: string, partNumber: number, handlers: CourseStreamHandlers): Promise<void>;
  streamSubmitAnswer(sessionId: string, request: { quiz_id: string; answer_text: string }, handlers: CourseStreamHandlers): Promise<void>;
  runNewtonDemo(): Promise<CourseSession>;
}
