import asyncio

from app.course.agents import INERTIA_SENTENCE, PUCK_QUESTION, FakeRoleAgents
from app.course.orchestrator import CourseOrchestrator
from app.course.repository import CourseRepository


def test_newtons_laws_beginner_flow_logs_inertia_weak_spot():
    asyncio.run(_run_newtons())


def test_generic_topic_flow_is_topic_driven():
    asyncio.run(_run_generic())


async def _run_newtons():
    orchestrator = CourseOrchestrator(CourseRepository(), FakeRoleAgents())
    session = await orchestrator.create_session("Newton's Laws", "beginner")

    assert session.memory.topic == "Newton's Laws"
    assert session.memory.learner_level == "beginner"
    assert session.memory.current_part == 1

    part_events = [event async for event in orchestrator.start_part(session.id, 1)]
    lesson_event = next(event for event in part_events if event.event_type == "lesson.taught")
    quiz_event = next(event for event in part_events if event.event_type == "quiz.created")

    assert INERTIA_SENTENCE in lesson_event.payload["tutor_turn"]["content"]
    assert quiz_event.payload["quiz"]["question"] == PUCK_QUESTION
    assert any(event.event_type == "agent.completed" and event.agent_role == "tutor" for event in part_events)
    assert any(event.event_type == "agent.completed" and event.agent_role == "quiz_maker" for event in part_events)

    quiz_id = quiz_event.payload["quiz"]["id"]
    grade_events = [event async for event in orchestrator.submit_answer(session.id, quiz_id, "yes")]
    grade_event = next(event for event in grade_events if event.event_type == "grade.completed")

    assert grade_event.payload["grade"]["is_correct"] is False
    assert grade_event.payload["grade"]["correct_answer"] == "no"
    assert any(event.event_type == "agent.completed" and event.agent_role == "grader" for event in grade_events)

    final_session = await orchestrator.repository.get_session(session.id)
    assert final_session.memory.weak_spots[0].concept == "inertia"
    assert final_session.memory.mastery["inertia"] == "weak_spot"


async def _run_generic():
    orchestrator = CourseOrchestrator(CourseRepository(), FakeRoleAgents())
    session = await orchestrator.create_session("Photosynthesis", "beginner")

    part_events = [event async for event in orchestrator.start_part(session.id, 1)]
    lesson_event = next(event for event in part_events if event.event_type == "lesson.taught")
    quiz_event = next(event for event in part_events if event.event_type == "quiz.created")

    assert "Photosynthesis" in lesson_event.payload["tutor_turn"]["content"]
    assert quiz_event.payload["quiz"]["question"] != PUCK_QUESTION
    assert "Photosynthesis" in quiz_event.payload["quiz"]["question"]

    quiz_id = quiz_event.payload["quiz"]["id"]
    grade_events = [event async for event in orchestrator.submit_answer(session.id, quiz_id, "I am not sure")]
    grade_event = next(event for event in grade_events if event.event_type == "grade.completed")

    assert grade_event.payload["grade"]["is_correct"] is False
    final_session = await orchestrator.repository.get_session(session.id)
    assert final_session.memory.topic == "Photosynthesis"
    assert final_session.memory.weak_spots
