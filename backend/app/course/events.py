"""Course event helpers."""

from __future__ import annotations

from typing import Any

from app.course.models import AgentRole, CourseEvent


def make_event(session_id: str, event_type: str, payload: dict[str, Any] | None = None, agent_role: AgentRole | None = None) -> CourseEvent:
    return CourseEvent(session_id=session_id, event_type=event_type, payload=payload or {}, agent_role=agent_role)
