"""In-memory repository for course sessions."""

from __future__ import annotations

import asyncio
from copy import deepcopy

from app.course.models import CourseEvent, CourseSession, CourseSessionStatus, SharedCourseMemory, utc_now


class CourseRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, CourseSession] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._repo_lock = asyncio.Lock()

    async def create_session(self, topic: str, learner_level: str) -> CourseSession:
        async with self._repo_lock:
            memory = SharedCourseMemory(session_id="pending", topic=topic, learner_level=learner_level)
            session = CourseSession(memory=memory)
            session.memory.session_id = session.id
            self._sessions[session.id] = session
            self._locks[session.id] = asyncio.Lock()
            return deepcopy(session)

    async def get_session(self, session_id: str) -> CourseSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        return deepcopy(session)

    async def get_memory(self, session_id: str) -> SharedCourseMemory:
        return (await self.get_session(session_id)).memory

    async def set_status(self, session_id: str, status: CourseSessionStatus) -> CourseSession:
        async with self._lock_for(session_id):
            session = self._require_session(session_id)
            session.status = status
            session.updated_at = utc_now()
            return deepcopy(session)

    async def update_memory(self, session_id: str, updater) -> SharedCourseMemory:
        async with self._lock_for(session_id):
            session = self._require_session(session_id)
            updater(session.memory)
            session.memory.version += 1
            session.updated_at = utc_now()
            return deepcopy(session.memory)

    async def append_event(self, event: CourseEvent) -> CourseEvent:
        async with self._lock_for(event.session_id):
            session = self._require_session(event.session_id)
            event.sequence = len(session.events) + 1
            session.events.append(event)
            session.memory.event_log.append(event.event_type)
            session.updated_at = utc_now()
            return deepcopy(event)

    async def list_events(self, session_id: str, after_sequence: int | None = None) -> list[CourseEvent]:
        session = self._require_session(session_id)
        events = session.events
        if after_sequence is not None:
            events = [event for event in events if event.sequence > after_sequence]
        return deepcopy(events)

    def _lock_for(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._locks:
            self._locks[session_id] = asyncio.Lock()
        return self._locks[session_id]

    def _require_session(self, session_id: str) -> CourseSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        return session


course_repository = CourseRepository()
