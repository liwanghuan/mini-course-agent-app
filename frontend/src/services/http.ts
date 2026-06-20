import type { CourseApi, CourseStreamHandlers } from './contracts';
import type { CourseSession, SharedCourseMemory } from '../types/course';
import { readCourseEventStream } from './streamParser';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Course API request failed with ${response.status}`);
  return (await response.json()) as T;
}

export const courseApi: CourseApi = {
  async createSession(request) {
    const response = await fetch(`${API_BASE}/course/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    return parseJson<CourseSession>(response);
  },
  async getSession(sessionId: string) {
    return parseJson<CourseSession>(await fetch(`${API_BASE}/course/sessions/${sessionId}`));
  },
  async getMemory(sessionId: string) {
    return parseJson<SharedCourseMemory>(await fetch(`${API_BASE}/course/sessions/${sessionId}/memory`));
  },
  async streamStartPart(sessionId: string, partNumber: number, handlers: CourseStreamHandlers) {
    try {
      const response = await fetch(`${API_BASE}/course/sessions/${sessionId}/parts/${partNumber}/stream`, { method: 'POST' });
      await readCourseEventStream(response, handlers.onEvent);
    } catch (error) {
      handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  },
  async streamSubmitAnswer(sessionId: string, request, handlers: CourseStreamHandlers) {
    try {
      const response = await fetch(`${API_BASE}/course/sessions/${sessionId}/answers/stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      await readCourseEventStream(response, handlers.onEvent);
    } catch (error) {
      handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  },
  async runNewtonDemo() {
    return parseJson<CourseSession>(await fetch(`${API_BASE}/course/demo/newtons-laws`, { method: 'POST' }));
  },
};
