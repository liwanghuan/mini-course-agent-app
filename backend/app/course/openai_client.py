"""Official OpenAI client wrapper for course role agents."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.settings import OPENAI_BASE_URL, OPENAI_MODEL

logger = logging.getLogger(__name__)


class OpenAICourseClient:
    def __init__(self, model: str | None = None) -> None:
        try:
            from openai import AsyncOpenAI
        except ModuleNotFoundError as exc:  # pragma: no cover - depends on local env setup.
            raise RuntimeError("OpenAI mode requires the 'openai' package. Run: python -m pip install -e '.[test]'") from exc

        self.model = model or OPENAI_MODEL
        kwargs: dict[str, Any] = {}
        if OPENAI_BASE_URL:
            kwargs["base_url"] = OPENAI_BASE_URL
        self.client = AsyncOpenAI(**kwargs)

    async def complete_text(self, system: str, prompt: str) -> str:
        try:
            response = await self.client.responses.create(
                model=self.model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            )
            text = getattr(response, "output_text", None)
            if text:
                return text
            return _text_from_response(response)
        except Exception as exc:  # pragma: no cover - provider behavior is mocked in tests.
            logger.exception("OpenAI text completion failed")
            raise RuntimeError(f"OpenAI text completion failed: {exc}") from exc

    async def complete_json(self, system: str, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
        try:
            response = await self.client.responses.create(
                model=self.model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": schema.get("title", "course_response"),
                        "schema": schema,
                        "strict": False,
                    }
                },
            )
            parsed = json.loads(getattr(response, "output_text", None) or _text_from_response(response))
            if not isinstance(parsed, dict):
                raise ValueError("OpenAI JSON response was not an object.")
            return parsed
        except Exception as exc:  # pragma: no cover - provider behavior is mocked in tests.
            logger.exception("OpenAI JSON completion failed")
            raise RuntimeError(f"OpenAI JSON completion failed: {exc}") from exc


def _text_from_response(response: Any) -> str:
    output = getattr(response, "output", None) or []
    for item in output:
        content = getattr(item, "content", None) or []
        for block in content:
            text = getattr(block, "text", None)
            if text:
                return text
    raise RuntimeError("OpenAI response did not include text content.")
