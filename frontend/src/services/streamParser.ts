import type { CourseEvent } from '../types/course';

interface ParsedSseMessage {
  event?: string;
  data: string;
}

export function parseSseMessages(buffer: string): { messages: ParsedSseMessage[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const chunks = normalized.split('\n\n');
  const remainder = chunks.pop() ?? '';
  const messages = chunks.map(parseChunk).filter((message): message is ParsedSseMessage => Boolean(message));
  return { messages, remainder };
}

export function parseCourseEvent(data: string): CourseEvent {
  return JSON.parse(data) as CourseEvent;
}

export async function readCourseEventStream(response: Response, onEvent: (event: CourseEvent) => void) {
  if (!response.ok) {
    throw new Error(`Course stream failed with ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Course stream response has no body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseMessages(buffer);
    buffer = parsed.remainder;
    parsed.messages.forEach((message) => {
      if (message.data) onEvent(parseCourseEvent(message.data));
    });
  }
}

function parseChunk(chunk: string): ParsedSseMessage | null {
  const data: string[] = [];
  let event: string | undefined;

  chunk.split('\n').forEach((line) => {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    if (line.startsWith('data:')) data.push(line.slice('data:'.length).trimStart());
  });

  if (!event && data.length === 0) return null;
  return { event, data: data.join('\n') };
}
