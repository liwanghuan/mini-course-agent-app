export type AgentRole = 'orchestrator' | 'planner' | 'tutor' | 'quiz_maker' | 'grader';

export type CourseSessionStatus = 'created' | 'planning' | 'teaching' | 'waiting_for_answer' | 'grading' | 'completed' | 'error';

export interface CoursePart {
  part_number: number;
  title: string;
  learning_goal: string;
  concepts: string[];
}

export interface LessonPlan {
  topic: string;
  learner_level: string;
  parts: CoursePart[];
}

export type LessonBlockKind = 'overview' | 'concept' | 'example' | 'analogy' | 'steps' | 'recap';

export interface LessonBlock {
  kind: LessonBlockKind;
  title: string;
  body: string;
}

export interface LessonExample {
  title: string;
  scenario: string;
  explanation: string;
}

export interface VocabularyItem {
  term: string;
  definition: string;
}

export interface TutorTurn {
  part_number: number;
  content: string;
  summary?: string | null;
  sections?: LessonBlock[];
  key_takeaways?: string[];
  examples?: LessonExample[];
  vocabulary?: VocabularyItem[];
  concept_tags: string[];
  agent_role: AgentRole;
}

export interface QuizItem {
  id: string;
  part_number: number;
  question: string;
  correct_answer: string;
  accepted_answers: string[];
  concept_tags: string[];
  misconception_tags: string[];
}

export interface LearnerAnswer {
  quiz_id: string;
  answer_text: string;
  created_at: string;
}

export interface GradeResult {
  quiz_id: string;
  is_correct: boolean;
  correct_answer: string;
  feedback: string;
  weak_spot_tags: string[];
  memory_patch: Record<string, unknown>;
}

export interface WeakSpot {
  concept: string;
  evidence: string;
  count: number;
  created_at: string;
  last_seen_at: string;
}

export interface SharedCourseMemory {
  session_id: string;
  topic: string;
  learner_level: string;
  current_part: number;
  lesson_plan: LessonPlan | null;
  taught_parts: TutorTurn[];
  quiz_history: QuizItem[];
  answer_history: LearnerAnswer[];
  grade_history: GradeResult[];
  weak_spots: WeakSpot[];
  mastery: Record<string, string>;
  event_log: string[];
  version: number;
}

export interface CourseEvent {
  id: string;
  sequence: number;
  session_id: string;
  event_type: string;
  agent_role: AgentRole | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CourseSession {
  id: string;
  status: CourseSessionStatus;
  memory: SharedCourseMemory;
  events: CourseEvent[];
  created_at: string;
  updated_at: string;
}
