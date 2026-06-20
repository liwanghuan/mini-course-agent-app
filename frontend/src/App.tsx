import { useReducer } from 'react';
import { Header, AgentTimeline, GradePanel, LessonPanel, QuizPanel, SharedMemoryPanel } from './components/CoursePanels';
import type { CourseApi } from './services/contracts';
import { courseApi } from './services/http';
import { courseReducer, initialCourseState } from './state/courseReducer';

export function App({ api = courseApi }: { api?: CourseApi }) {
  const [state, dispatch] = useReducer(courseReducer, initialCourseState);
  const latestLesson = state.session ? lastItem(state.session.memory.taught_parts) : null;
  const latestQuiz = state.session ? lastItem(state.session.memory.quiz_history) : null;
  const latestGrade = state.session ? lastItem(state.session.memory.grade_history) : null;

  const start = async () => {
    const topic = state.topicDraft.trim();
    const learnerLevel = state.learnerLevelDraft.trim() || 'beginner';
    if (!topic) {
      dispatch({ type: 'ERROR_RECEIVED', message: 'Please enter a topic before starting the course.' });
      return;
    }

    dispatch({ type: 'BUSY_CHANGED', busy: true });
    try {
      const session = await api.createSession({ topic, learner_level: learnerLevel });
      dispatch({ type: 'SESSION_CREATED', session });
      await api.streamStartPart(session.id, 1, { onEvent: (event) => dispatch({ type: 'STREAM_EVENT_RECEIVED', event }) });
    } catch (error) {
      dispatch({ type: 'ERROR_RECEIVED', message: error instanceof Error ? error.message : String(error) });
    } finally {
      dispatch({ type: 'BUSY_CHANGED', busy: false });
    }
  };

  const submit = async () => {
    if (!state.session || !state.quiz) return;
    const answer = state.answerDraft.trim();
    if (!answer) {
      dispatch({ type: 'ERROR_RECEIVED', message: 'Please enter an answer before submitting to the Grader.' });
      return;
    }

    dispatch({ type: 'BUSY_CHANGED', busy: true });
    try {
      await api.streamSubmitAnswer(state.session.id, { quiz_id: state.quiz.id, answer_text: answer }, { onEvent: (event) => dispatch({ type: 'STREAM_EVENT_RECEIVED', event }) });
    } catch (error) {
      dispatch({ type: 'ERROR_RECEIVED', message: error instanceof Error ? error.message : String(error) });
    } finally {
      dispatch({ type: 'BUSY_CHANGED', busy: false });
    }
  };

  const demo = async () => {
    dispatch({ type: 'BUSY_CHANGED', busy: true });
    try {
      dispatch({ type: 'SESSION_CREATED', session: await api.runNewtonDemo() });
    } catch (error) {
      dispatch({ type: 'ERROR_RECEIVED', message: error instanceof Error ? error.message : String(error) });
    } finally {
      dispatch({ type: 'BUSY_CHANGED', busy: false });
    }
  };

  return (
    <main className="shell">
      <Header
        session={state.session}
        busy={state.busy}
        topicDraft={state.topicDraft}
        learnerLevelDraft={state.learnerLevelDraft}
        onTopicChange={(value) => dispatch({ type: 'TOPIC_CHANGED', value })}
        onLearnerLevelChange={(value) => dispatch({ type: 'LEARNER_LEVEL_CHANGED', value })}
        onStart={start}
        onDemo={demo}
      />
      {state.error ? <section className="panel error">{state.error}</section> : null}
      <div className="layout">
        <div className="mainColumn">
          <LessonPanel memory={state.session?.memory ?? null} lesson={state.lesson ?? latestLesson} />
          <div className="practiceGrid">
            <QuizPanel quiz={state.quiz ?? latestQuiz} answerDraft={state.answerDraft} busy={state.busy} onAnswerChange={(value) => dispatch({ type: 'ANSWER_CHANGED', value })} onSubmitAnswer={submit} />
            <GradePanel grade={state.grade ?? latestGrade} />
          </div>
        </div>
        <aside className="sideColumn">
          <AgentTimeline agentRuns={state.agentRuns} events={state.events.length ? state.events : state.session?.events ?? []} />
          <SharedMemoryPanel memory={state.session?.memory ?? null} />
        </aside>
      </div>
    </main>
  );
}

function lastItem<T>(items: T[]): T | null {
  return items.length ? items[items.length - 1] : null;
}
