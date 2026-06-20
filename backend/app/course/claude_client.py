"""Official Claude API wrapper for role agents."""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from app.settings import CLAUDE_MODEL

logger = logging.getLogger(__name__)


class ClaudeCourseClient:
    def __init__(self, model: str | None = None) -> None:
        self.model = model or CLAUDE_MODEL
        self.client = anthropic.AsyncAnthropic()

    async def complete_text(self, system: str, prompt: str) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        self._raise_for_stop_reason(response)
        return self._text_from_response(response)

    async def complete_json(self, system: str, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        self._raise_for_stop_reason(response)
        return json.loads(self._text_from_response(response))

    def _raise_for_stop_reason(self, response: Any) -> None:
        request_id = getattr(response, "_request_id", None)
        if response.stop_reason == "refusal":
            logger.warning("Claude refused course request request_id=%s", request_id)
            raise RuntimeError("Claude refused to complete this course step.")
        if response.stop_reason == "max_tokens":
            logger.warning("Claude hit max_tokens request_id=%s", request_id)
            raise RuntimeError("Claude response was truncated. Please retry.")

    def _text_from_response(self, response: Any) -> str:
        for block in response.content:
            if block.type == "text":
                return block.text
        raise RuntimeError("Claude response did not include text content.")
