"""Pydantic models for the mini-course multi-agent workflow."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class AgentRole(str, Enum):
    ORCHESTRATOR = "orchestrator"
    PLANNER = "planner"
    TUTOR = "tutor"
    QUIZ_MAKER = "quiz_maker"
    GRADER = "grader"


class CourseSessionStatus(str, Enum):
    CREATED = "created"
    PLANNING = "planning"
    TEACHING = "teaching"
    WAITING_FOR_ANSWER = "waiting_for_answer"
    GRADING = "grading"
    COMPLETED = "completed"
    ERROR = "error"


class CoursePart(BaseModel):
    part_number: int
    title: str
    learning_goal: str
    concepts: list[str] = Field(default_factory=list)


class LessonPlan(BaseModel):
    topic: str
    learner_level: str
    parts: list[CoursePart]


class LessonBlock(BaseModel):
    kind: Literal["overview", "concept", "example", "analogy", "steps", "recap"]
    title: str
    body: str


class LessonExample(BaseModel):
    title: str
    scenario: str
    explanation: str


class VocabularyItem(BaseModel):
    term: str
    definition: str


class TutorTurn(BaseModel):
    part_number: int
    content: str
    summary: str | None = None
    sections: list[LessonBlock] = Field(default_factory=list)
    key_takeaways: list[str] = Field(default_factory=list)
    examples: list[LessonExample] = Field(default_factory=list)
    vocabulary: list[VocabularyItem] = Field(default_factory=list)
    concept_tags: list[str] = Field(default_factory=list)
    agent_role: AgentRole = AgentRole.TUTOR


class QuizItem(BaseModel):
    id: str = Field(default_factory=lambda: new_id("quiz"))
    part_number: int
    question: str
    correct_answer: str
    accepted_answers: list[str] = Field(default_factory=list)
    concept_tags: list[str] = Field(default_factory=list)
    misconception_tags: list[str] = Field(default_factory=list)


class LearnerAnswer(BaseModel):
    quiz_id: str
    answer_text: str
    created_at: datetime = Field(default_factory=utc_now)


class WeakSpot(BaseModel):
    concept: str
    evidence: str
    count: int = 1
    created_at: datetime = Field(default_factory=utc_now)
    last_seen_at: datetime = Field(default_factory=utc_now)


class GradeResult(BaseModel):
    quiz_id: str
    is_correct: bool
    correct_answer: str
    feedback: str
    weak_spot_tags: list[str] = Field(default_factory=list)
    memory_patch: dict[str, Any] = Field(default_factory=dict)


class CourseEvent(BaseModel):
    id: str = Field(default_factory=lambda: new_id("event"))
    sequence: int = 0
    session_id: str
    event_type: str
    agent_role: AgentRole | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utc_now)


class SharedCourseMemory(BaseModel):
    session_id: str
    topic: str
    learner_level: str
    current_part: int = 1
    lesson_plan: LessonPlan | None = None
    taught_parts: list[TutorTurn] = Field(default_factory=list)
    quiz_history: list[QuizItem] = Field(default_factory=list)
    answer_history: list[LearnerAnswer] = Field(default_factory=list)
    grade_history: list[GradeResult] = Field(default_factory=list)
    weak_spots: list[WeakSpot] = Field(default_factory=list)
    mastery: dict[str, str] = Field(default_factory=dict)
    event_log: list[str] = Field(default_factory=list)
    version: int = 0


class CourseSession(BaseModel):
    id: str = Field(default_factory=lambda: new_id("course"))
    status: CourseSessionStatus = CourseSessionStatus.CREATED
    memory: SharedCourseMemory
    events: list[CourseEvent] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CreateCourseSessionRequest(BaseModel):
    topic: str
    learner_level: str = "beginner"

    @field_validator("topic", "learner_level")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value must not be empty.")
        return value

    @field_validator("topic")
    @classmethod
    def validate_topic_length(cls, value: str) -> str:
        if len(value) > 160:
            raise ValueError("Topic must be 160 characters or fewer.")
        return value


class SubmitAnswerRequest(BaseModel):
    quiz_id: str
    answer_text: str

    @field_validator("quiz_id", "answer_text")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value must not be empty.")
        return value
