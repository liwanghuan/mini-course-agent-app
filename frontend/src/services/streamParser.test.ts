import { describe, expect, it } from 'vitest';
import { parseCourseEvent, parseSseMessages } from './streamParser';

const eventJson = JSON.stringify({
  id: 'event_1',
  sequence: 1,
  session_id: 'course_1',
  event_type: 'lesson.taught',
  agent_role: 'tutor',
  payload: { tutor_turn: { content: "A ball stays still until you kick it — that's inertia." } },
  created_at: '2026-06-17T00:00:00Z',
});

describe('parseSseMessages', () => {
  it('keeps incomplete chunks as remainder', () => {
    const parsed = parseSseMessages(`event: lesson.taught\ndata: ${eventJson}`);
    expect(parsed.messages).toEqual([]);
    expect(parsed.remainder).toContain('lesson.taught');
  });

  it('parses completed SSE messages', () => {
    const parsed = parseSseMessages(`event: lesson.taught\ndata: ${eventJson}\n\n`);
    expect(parsed.messages).toHaveLength(1);
    expect(parseCourseEvent(parsed.messages[0].data).event_type).toBe('lesson.taught');
  });
});
