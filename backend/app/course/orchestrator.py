"""Master Orchestrator coordinating the specialist agents."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from app.course.agents import FakeRoleAgents, OpenAIRoleAgents, RoleAgents
from app.course.events import make_event
from app.course.memory import remember_answer_and_grade, remember_lesson_plan, remember_quiz, remember_tutor_turn
from app.course.models import AgentRole, CourseEvent, CourseSession, CourseSessionStatus, LearnerAnswer
from app.course.repository import CourseRepository, course_repository


class CourseOrchestrator:
    def __init__(self, repository: CourseRepository, agents: RoleAgents) -> None:
        self.repository = repository
        self.agents = agents

    async def create_session(self, topic: str, learner_level: str) -> CourseSession:
        session = await self.repository.create_session(topic, learner_level)
        await self._emit(
            session.id,
            "session.status",
            {"status": CourseSessionStatus.CREATED, "topic": topic, "learner_level": learner_level},
            AgentRole.ORCHESTRATOR,
        )
        return await self.repository.get_session(session.id)

    async def start_part(self, session_id: str, part_number: int) -> AsyncGenerator[CourseEvent, None]:
        await self.repository.set_status(session_id, CourseSessionStatus.PLANNING)
        memory = await self.repository.get_memory(session_id)
        if memory.lesson_plan is None:
            yield await self._emit(session_id, "agent.started", {"agent": AgentRole.PLANNER, "part_number": part_number}, AgentRole.PLANNER)
            lesson_plan = await self.agents.plan(memory)
            updated_memory = await self.repository.update_memory(session_id, lambda current: remember_lesson_plan(current, lesson_plan))
            yield await self._emit(session_id, "agent.completed", {"agent": AgentRole.PLANNER, "lesson_plan": lesson_plan.model_dump(mode="json")}, AgentRole.PLANNER)
            yield await self._emit(session_id, "memory.updated", {"memory": updated_memory.model_dump(mode="json")}, AgentRole.PLANNER)
        else:
            yield await self._emit(session_id, "agent.completed", {"agent": AgentRole.PLANNER, "reason": "lesson_plan_already_exists"}, AgentRole.PLANNER)

        await self.repository.update_memory(session_id, lambda current: setattr(current, "current_part", part_number))
        await self.repository.set_status(session_id, CourseSessionStatus.TEACHING)
        yield await self._emit(session_id, "agent.started", {"agent": AgentRole.TUTOR, "part_number": part_number}, AgentRole.TUTOR)
        memory = await self.repository.get_memory(session_id)
        tutor_turn = await self.agents.teach_part(memory, part_number)
        updated_memory = await self.repository.update_memory(session_id, lambda current: remember_tutor_turn(current, tutor_turn))
        yield await self._emit(session_id, "lesson.taught", {"tutor_turn": tutor_turn.model_dump(mode="json")}, AgentRole.TUTOR)
        yield await self._emit(session_id, "agent.completed", {"agent": AgentRole.TUTOR, "part_number": part_number}, AgentRole.TUTOR)
        yield await self._emit(session_id, "memory.updated", {"memory": updated_memory.model_dump(mode="json")}, AgentRole.TUTOR)

        yield await self._emit(session_id, "agent.started", {"agent": AgentRole.QUIZ_MAKER, "part_number": part_number}, AgentRole.QUIZ_MAKER)
        memory = await self.repository.get_memory(session_id)
        quiz = await self.agents.make_quiz(memory, part_number)
        updated_memory = await self.repository.update_memory(session_id, lambda current: remember_quiz(current, quiz))
        yield await self._emit(session_id, "quiz.created", {"quiz": quiz.model_dump(mode="json")}, AgentRole.QUIZ_MAKER)
        yield await self._emit(session_id, "agent.completed", {"agent": AgentRole.QUIZ_MAKER, "quiz_id": quiz.id}, AgentRole.QUIZ_MAKER)
        yield await self._emit(session_id, "memory.updated", {"memory": updated_memory.model_dump(mode="json")}, AgentRole.QUIZ_MAKER)
        await self.repository.set_status(session_id, CourseSessionStatus.WAITING_FOR_ANSWER)
        yield await self._emit(session_id, "session.waiting_for_answer", {"quiz_id": quiz.id}, AgentRole.ORCHESTRATOR)

    async def submit_answer(self, session_id: str, quiz_id: str, answer_text: str) -> AsyncGenerator[CourseEvent, None]:
        await self.repository.set_status(session_id, CourseSessionStatus.GRADING)
        yield await self._emit(session_id, "agent.started", {"agent": AgentRole.GRADER, "quiz_id": quiz_id}, AgentRole.GRADER)
        memory = await self.repository.get_memory(session_id)
        quiz = next((item for item in memory.quiz_history if item.id == quiz_id), None)
        if quiz is None:
            await self.repository.set_status(session_id, CourseSessionStatus.ERROR)
            yield await self._emit(session_id, "session.error", {"message": f"Quiz not found: {quiz_id}"}, AgentRole.ORCHESTRATOR)
            return

        grade = await self.agents.grade(memory, quiz, answer_text)
        learner_answer = LearnerAnswer(quiz_id=quiz_id, answer_text=answer_text)
        updated_memory = await self.repository.update_memory(
            session_id,
            lambda current: remember_answer_and_grade(current, learner_answer, grade),
        )
        yield await self._emit(session_id, "grade.completed", {"answer": learner_answer.model_dump(mode="json"), "grade": grade.model_dump(mode="json")}, AgentRole.GRADER)
        yield await self._emit(session_id, "agent.completed", {"agent": AgentRole.GRADER, "quiz_id": quiz_id}, AgentRole.GRADER)
        if grade.weak_spot_tags:
            yield await self._emit(session_id, "weak_spot.logged", {"weak_spots": grade.weak_spot_tags}, AgentRole.GRADER)
        yield await self._emit(session_id, "memory.updated", {"memory": updated_memory.model_dump(mode="json")}, AgentRole.GRADER)
        await self.repository.set_status(session_id, CourseSessionStatus.COMPLETED)
        yield await self._emit(session_id, "session.status", {"status": CourseSessionStatus.COMPLETED}, AgentRole.ORCHESTRATOR)

    async def run_newtons_demo(self) -> CourseSession:
        session = await self.create_session("Newton's Laws", "beginner")
        async for _ in self.start_part(session.id, 1):
            pass
        latest = await self.repository.get_session(session.id)
        quiz_id = latest.memory.quiz_history[-1].id
        async for _ in self.submit_answer(session.id, quiz_id, "yes"):
            pass
        return await self.repository.get_session(session.id)

    async def _emit(self, session_id: str, event_type: str, payload: dict, agent_role: AgentRole | None = None) -> CourseEvent:
        return await self.repository.append_event(make_event(session_id, event_type, payload, agent_role))


def create_orchestrator(agents: RoleAgents | None = None) -> CourseOrchestrator:
    if agents is not None:
        return CourseOrchestrator(course_repository, agents)

    from app.settings import COURSE_AGENT_MODE

    mode = COURSE_AGENT_MODE.lower()
    if mode == "fake":
        return CourseOrchestrator(course_repository, FakeRoleAgents())
    if mode in {"openai", "chatgpt"}:
        from app.course.openai_client import OpenAICourseClient

        return CourseOrchestrator(course_repository, OpenAIRoleAgents(OpenAICourseClient()))
    raise RuntimeError(f"Unsupported COURSE_AGENT_MODE={COURSE_AGENT_MODE!r}. Use 'fake' or 'openai'.")


course_orchestrator = create_orchestrator()
