"""Shared-memory mutation helpers."""

from __future__ import annotations

from app.course.models import GradeResult, LearnerAnswer, LessonPlan, QuizItem, SharedCourseMemory, TutorTurn, WeakSpot, utc_now


def remember_lesson_plan(memory: SharedCourseMemory, lesson_plan: LessonPlan) -> None:
    memory.lesson_plan = lesson_plan


def remember_tutor_turn(memory: SharedCourseMemory, tutor_turn: TutorTurn) -> None:
    memory.taught_parts = [turn for turn in memory.taught_parts if turn.part_number != tutor_turn.part_number]
    memory.taught_parts.append(tutor_turn)
    for concept in tutor_turn.concept_tags:
        memory.mastery.setdefault(concept, "introduced")


def remember_quiz(memory: SharedCourseMemory, quiz_item: QuizItem) -> None:
    memory.quiz_history = [quiz for quiz in memory.quiz_history if quiz.id != quiz_item.id]
    memory.quiz_history.append(quiz_item)


def remember_answer_and_grade(memory: SharedCourseMemory, learner_answer: LearnerAnswer, grade_result: GradeResult) -> None:
    memory.answer_history.append(learner_answer)
    memory.grade_history.append(grade_result)
    if grade_result.is_correct:
        for quiz in memory.quiz_history:
            if quiz.id == grade_result.quiz_id:
                for concept in quiz.concept_tags:
                    memory.mastery[concept] = "practicing"
        return

    for concept in grade_result.weak_spot_tags:
        _upsert_weak_spot(memory, concept, grade_result.feedback)
        memory.mastery[concept] = "weak_spot"


def _upsert_weak_spot(memory: SharedCourseMemory, concept: str, evidence: str) -> None:
    now = utc_now()
    for weak_spot in memory.weak_spots:
        if weak_spot.concept == concept:
            weak_spot.count += 1
            weak_spot.evidence = evidence
            weak_spot.last_seen_at = now
            return
    memory.weak_spots.append(WeakSpot(concept=concept, evidence=evidence, created_at=now, last_seen_at=now))
