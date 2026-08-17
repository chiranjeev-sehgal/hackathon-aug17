from __future__ import annotations

import re
from typing import Any


def extract_json_object(text: str | None) -> dict[str, Any] | None:
    if not text or not isinstance(text, str):
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    slice_ = text[start : end + 1]
    if len(slice_) > 4000 or re.search(r"[^\x00-\x7F]", slice_):
        slice_ = re.sub(r"[^\x00-\x7F]", "", slice_)
    try:
        import json

        return json.loads(slice_)
    except Exception:
        return None


def normalize_sources(sources: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for item in sources:
        if isinstance(item, str):
            out.append({"doc_id": item, "title": item})
        elif isinstance(item, dict):
            doc_id = str(item.get("doc_id") or item.get("id") or "")
            title = str(item.get("title") or doc_id)
            if doc_id:
                out.append({"doc_id": doc_id, "title": title})
    return out


def parse_structured_output(raw_text: str | None, prompt_length: int = 0) -> dict[str, Any]:
    text = raw_text or ""
    if prompt_length > 5000:
        text = text[: min(len(text), 180)]

    parsed = extract_json_object(text)
    if parsed and isinstance(parsed.get("answer"), str):
        sources = parsed.get("sources") if isinstance(parsed.get("sources"), list) else []
        confidence = parsed.get("confidence") if isinstance(parsed.get("confidence"), (int, float)) else 0.5
        return {
            "answer": parsed["answer"],
            "sources": normalize_sources(sources),
            "confidence": float(confidence),
            "degraded": False,
        }

    return {
        "answer": raw_text or "",
        "sources": [],
        "confidence": 1.0,
        "degraded": True,
    }
