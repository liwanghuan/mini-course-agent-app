import type { AgentRole, CourseEvent, CourseSession, GradeResult, QuizItem, SharedCourseMemory, TutorTurn } from '../types/course';
import type { AgentRunState } from '../state/courseReducer';

const AGENT_LABELS: Record<AgentRole, string> = {
  orchestrator: 'Orchestrator',
  planner: 'Planner',
  tutor: 'Tutor',
  quiz_maker: 'Quiz Maker',
  grader: 'Grader',
};

export function Header({
  session,
  busy,
  topicDraft,
  learnerLevelDraft,
  onTopicChange,
  onLearnerLevelChange,
  onStart,
  onDemo,
}: {
  session: CourseSession | null;
  busy: boolean;
  topicDraft: string;
  learnerLevelDraft: string;
  onTopicChange: (value: string) => void;
  onLearnerLevelChange: (value: string) => void;
  onStart: () => void;
  onDemo: () => void;
}) {
  return (
    <section className="hero">
      <div className="heroMain">
        <p className="eyebrow">Mini-course multi-agent product</p>
        <h1>Build a personalized mini-course on any topic</h1>
        <p>Give the system a topic. The Orchestrator coordinates Planner, Tutor, Quiz Maker, and Grader while every agent shares the same memory.</p>
        <div className="setupForm">
          <label>
            <span>Topic</span>
            <input placeholder="e.g. Photosynthesis, SQL joins, Stoicism" value={topicDraft} onChange={(event) => onTopicChange(event.target.value)} />
          </label>
          <label>
            <span>Learner level</span>
            <select value={learnerLevelDraft} onChange={(event) => onLearnerLevelChange(event.target.value)}>
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button disabled={busy || !topicDraft.trim()} onClick={onStart}>Start mini-course</button>
          <button className="secondary" disabled={busy} onClick={onDemo}>Try Newton example</button>
        </div>
      </div>
      <div className="stats">
        <div><span>Topic</span><strong>{session?.memory.topic ?? (topicDraft || 'choose a topic')}</strong></div>
        <div><span>Learner</span><strong>{session?.memory.learner_level ?? learnerLevelDraft}</strong></div>
        <div><span>Status</span><strong>{session?.status ?? 'not started'}</strong></div>
      </div>
    </section>
  );
}

export function LessonPanel({ memory, lesson }: { memory: SharedCourseMemory | null; lesson: TutorTurn | null }) {
  const planPart = memory?.lesson_plan?.parts.find((part) => part.part_number === (lesson?.part_number ?? memory.current_part));
  const conceptTags = Array.from(new Set([...(planPart?.concepts ?? []), ...(lesson?.concept_tags ?? [])]));
  const hasStructuredLesson = Boolean(lesson?.summary || lesson?.sections?.length || lesson?.examples?.length || lesson?.key_takeaways?.length || lesson?.vocabulary?.length);

  return (
    <section className="panel lessonPanel">
      <div className="lessonHeader">
        <p className="eyebrow">Tutor · Part {lesson?.part_number ?? memory?.current_part ?? 1}</p>
        <h2>{planPart?.title ?? 'Lesson'}</h2>
        {planPart ? <p className="goal">Goal: {planPart.learning_goal}</p> : null}
        {conceptTags.length ? <div className="conceptChips">{conceptTags.map((concept) => <span key={concept}>{concept}</span>)}</div> : null}
      </div>

      {lesson ? <>
        {lesson.summary ? <div className="lessonSummary"><span>Lesson summary</span><p>{lesson.summary}</p></div> : null}
        {lesson.sections?.length ? <div className="lessonSectionGrid">{lesson.sections.map((section) => <article className={`lessonBlock ${section.kind}`} key={`${section.kind}-${section.title}`}><span>{section.kind}</span><h3>{section.title}</h3><p>{section.body}</p></article>)}</div> : null}
        {lesson.examples?.length ? <div className="lessonExamples"><h3>Examples</h3>{lesson.examples.map((example) => <article className="exampleCard" key={example.title}><strong>{example.title}</strong><p>{example.scenario}</p><p>{example.explanation}</p></article>)}</div> : null}
        <div className="lessonSupportGrid">
          {lesson.vocabulary?.length ? <div><h3>Vocabulary</h3><div className="vocabularyGrid">{lesson.vocabulary.map((item) => <div key={item.term}><strong>{item.term}</strong><p>{item.definition}</p></div>)}</div></div> : null}
          {lesson.key_takeaways?.length ? <div><h3>Key takeaways</h3><ul className="takeawayList">{lesson.key_takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul></div> : null}
        </div>
        <details className="lessonFallback" open={!hasStructuredLesson}>
          <summary>{hasStructuredLesson ? 'Plain-text lesson' : 'Lesson'}</summary>
          <p className="lesson">{lesson.content}</p>
        </details>
      </> : <p className="empty">Tutor output appears after Planner prepares the course.</p>}
    </section>
  );
}

export function QuizPanel({ quiz, answerDraft, busy, onAnswerChange, onSubmitAnswer }: { quiz: QuizItem | null; answerDraft: string; busy: boolean; onAnswerChange: (value: string) => void; onSubmitAnswer: () => void }) {
  return (
    <section className="panel practicePanel">
      <p className="eyebrow">Quiz Maker</p><h2>Concept check</h2>
      {quiz ? <><p className="quiz">{quiz.question}</p><label><span>Learner answer</span><input placeholder="Type your answer" value={answerDraft} onChange={(event) => onAnswerChange(event.target.value)} /></label><button disabled={busy || !answerDraft.trim()} onClick={onSubmitAnswer}>Submit to Grader</button></> : <p className="empty">Quiz appears after the lesson.</p>}
    </section>
  );
}

export function GradePanel({ grade }: { grade: GradeResult | null }) {
  return <section className="panel practicePanel"><p className="eyebrow">Grader</p><h2>Feedback</h2>{grade ? <div className={grade.is_correct ? 'grade correct' : 'grade wrong'}><strong>{grade.is_correct ? 'Correct' : 'Wrong'}</strong><p>{grade.feedback}</p><p>Correct answer: <strong>{grade.correct_answer}</strong></p></div> : <p className="empty">Feedback appears after grading.</p>}</section>;
}

export function AgentTimeline({ agentRuns, events }: { agentRuns: Record<AgentRole, AgentRunState>; events: CourseEvent[] }) {
  return (
    <section className="panel compactPanel">
      <p className="eyebrow">Orchestration</p><h2>Agent workflow</h2>
      <div className="agentGrid">
        {Object.values(agentRuns).map((run) => <div className={`agentCard ${run.status}`} key={run.role}><strong>{AGENT_LABELS[run.role]}</strong><span>{run.status}</span><p>{run.summary}</p></div>)}
      </div>
      <h3>Recent activity</h3>
      <div className="timeline">{events.length ? events.slice(-8).map((event) => <div key={event.id}><strong>{event.sequence}</strong><span>{event.agent_role ? AGENT_LABELS[event.agent_role] : 'System'} · {event.event_type}</span></div>) : <p className="empty">No agent events yet.</p>}</div>
    </section>
  );
}

export function SharedMemoryPanel({ memory }: { memory: SharedCourseMemory | null }) {
  return (
    <section className="panel compactPanel">
      <p className="eyebrow">Shared memory</p><h2>What all agents know</h2>
      {memory ? <div className="memory">
        <div><span>Course</span><strong>{memory.topic}</strong><p>Level: {memory.learner_level} · Part {memory.current_part} · Version {memory.version}</p></div>
        <div><span>Roadmap</span>{memory.lesson_plan ? <ol>{memory.lesson_plan.parts.map((part) => <li className={part.part_number === memory.current_part ? 'currentPart' : ''} key={part.part_number}><strong>{part.title}</strong><br />{part.learning_goal}<div className="miniChips">{part.concepts.map((concept) => <em key={concept}>{concept}</em>)}</div></li>)}</ol> : <strong>not planned yet</strong>}</div>
        <div><span>Mastery</span><div className="miniChips">{Object.entries(memory.mastery).length ? Object.entries(memory.mastery).map(([concept, status]) => <em key={concept}>{concept}: {status}</em>) : <strong>none yet</strong>}</div></div>
        <div><span>Latest quiz</span>{memory.quiz_history.length ? <p>{memory.quiz_history[memory.quiz_history.length - 1].question}</p> : <strong>none yet</strong>}</div>
        <div><span>Weak spots</span>{memory.weak_spots.length ? <ul>{memory.weak_spots.map((weakSpot) => <li key={weakSpot.concept}><strong>{weakSpot.concept}</strong>: {weakSpot.evidence}</li>)}</ul> : <strong>none yet</strong>}</div>
      </div> : <p className="empty">Memory appears after session start.</p>}
    </section>
  );
}
