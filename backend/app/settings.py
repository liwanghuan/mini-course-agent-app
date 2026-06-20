"""Runtime settings for the mini-course backend."""

from __future__ import annotations

import os

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - only used before optional local deps are installed.
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()

CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-4-8")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
COURSE_AGENT_MODE = os.getenv("COURSE_AGENT_MODE", "fake")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5175")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", FRONTEND_ORIGIN).split(",")
    if origin.strip()
]
