"""FastAPI entrypoint for the mini-course backend."""

from __future__ import annotations

import json
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app.course.models import CreateCourseSessionRequest, SubmitAnswerRequest
from app.course.orchestrator import course_orchestrator
from app.course.repository import course_repository
from app.settings import FRONTEND_ORIGINS

logger = logging.getLogger(__name__)

app = FastAPI(title="Mini-Course Agent API", version="0.1.0")
_allow_all_origins = "*" in FRONTEND_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        *FRONTEND_ORIGINS,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ]
    if not _allow_all_origins
    else ["*"],
    allow_credentials=not _allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"ok": True, "service": "mini-course-agent-api"}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/course/sessions")
async def create_session(request: CreateCourseSessionRequest):
    session = await course_orchestrator.create_session(request.topic, request.learner_level)
    return session.model_dump(mode="json")


@app.get("/api/course/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        return (await course_orchestrator.repository.get_session(session_id)).model_dump(mode="json")
    except KeyError:
        raise HTTPException(status_code=404, detail="Course session not found")


@app.get("/api/course/sessions/{session_id}/memory")
async def get_memory(session_id: str):
    try:
        return (await course_repository.get_memory(session_id)).model_dump(mode="json")
    except KeyError:
        raise HTTPException(status_code=404, detail="Course session not found")


@app.get("/api/course/sessions/{session_id}/events")
async def get_events(session_id: str, after_sequence: int | None = None):
    try:
        events = await course_repository.list_events(session_id, after_sequence)
        return {"events": [event.model_dump(mode="json") for event in events]}
    except KeyError:
        raise HTTPException(status_code=404, detail="Course session not found")


@app.post("/api/course/sessions/{session_id}/parts/{part_number}/stream")
async def start_part_stream(session_id: str, part_number: int, req: Request):
    async def event_generator():
        try:
            async for event in course_orchestrator.start_part(session_id, part_number):
                if await req.is_disconnected():
                    break
                yield _sse_event(event)
        except Exception as exc:
            logger.exception("Course part stream failed")
            yield {"event": "session.error", "data": json.dumps({"message": str(exc)})}

    return EventSourceResponse(event_generator(), media_type="text/event-stream", sep="\n")


@app.post("/api/course/sessions/{session_id}/answers/stream")
async def submit_answer_stream(session_id: str, request: SubmitAnswerRequest, req: Request):
    async def event_generator():
        try:
            async for event in course_orchestrator.submit_answer(session_id, request.quiz_id, request.answer_text):
                if await req.is_disconnected():
                    break
                yield _sse_event(event)
        except Exception as exc:
            logger.exception("Course answer stream failed")
            yield {"event": "session.error", "data": json.dumps({"message": str(exc)})}

    return EventSourceResponse(event_generator(), media_type="text/event-stream", sep="\n")


@app.post("/api/course/demo/newtons-laws")
async def run_newtons_demo():
    return (await course_orchestrator.run_newtons_demo()).model_dump(mode="json")


def _sse_event(event):
    return {"event": event.event_type, "data": json.dumps(event.model_dump(mode="json"), ensure_ascii=False)}
