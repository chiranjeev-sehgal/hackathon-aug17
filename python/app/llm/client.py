from __future__ import annotations

import json
import math
from typing import Any

import httpx

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL
from app.llm.parser import parse_structured_output
from app.prompts.system_v1 import build_system_prompt
from app.store import get_knowledge_base


def select_relevant_docs(message: str, allowed_visibility: list[str]) -> list[dict[str, Any]]:
    docs = [d for d in get_knowledge_base() if d.get("visibility") in allowed_visibility]
    lower = (message or "").lower()

    scored = []
    for doc in docs:
        hay = f"{doc.get('title','')} {doc.get('content','')} {doc.get('doc_id','')}".lower()
        score = 0
        for word in [w for w in re_split(lower) if len(w) > 3]:
            if word in hay:
                score += 1
        if "leave" in lower and "leave" in doc.get("doc_id", ""):
            score += 3
        if "onboard" in lower and "onboarding" in doc.get("doc_id", ""):
            score += 3
        if any(k in lower for k in ("salary", "compensation", "band")) and "salary" in doc.get("doc_id", ""):
            score += 3
        if any(k in lower for k in ("security", "mfa", "vault")) and "security" in doc.get("doc_id", ""):
            score += 3
        scored.append((score, doc))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [d for s, d in scored if s > 0][:3]
    return top or docs[:2]


def re_split(text: str) -> list[str]:
    import re

    return re.split(r"\W+", text)


def build_kb_context(docs: list[dict[str, Any]]) -> str:
    parts = []
    for d in docs:
        parts.append(
            f"[doc_id={d['doc_id']} title=\"{d['title']}\" visibility={d['visibility']}]\n{d['content']}"
        )
    return "\n\n".join(parts)


def synthesize_fallback_answer(message: str, docs: list[dict[str, Any]]) -> str:
    if not docs:
        return "I do not have enough information in the knowledge base to answer that."
    primary = docs[0]
    return f"Based on {primary['title']}: {primary['content'][:280]}"


async def call_ollama(message: str, allowed_visibility: list[str]) -> dict[str, Any]:
    docs = select_relevant_docs(message, allowed_visibility)
    system = build_system_prompt()
    context = build_kb_context(docs)
    user_content = (
        "Knowledge base excerpts:\n"
        f"{context or '(none)'}\n\n"
        f"User question:\n{message}\n\n"
        "Respond with JSON only."
    )

    body = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        "format": "json",
    }

    raw_text = ""
    prompt_tokens = 0
    completion_tokens = 0

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=body)
            if response.status_code >= 400:
                raw_text = json.dumps(
                    {
                        "answer": synthesize_fallback_answer(message, docs),
                        "sources": [{"doc_id": d["doc_id"], "title": d["title"]} for d in docs],
                        "confidence": 0.7 if docs else 0.2,
                    }
                )
                prompt_tokens = math.ceil(len(user_content) / 4)
                completion_tokens = math.ceil(len(raw_text) / 4)
            else:
                data = response.json()
                raw_text = ((data.get("message") or {}).get("content")) or ""
                prompt_tokens = data.get("prompt_eval_count") or math.ceil(len(user_content) / 4)
                completion_tokens = data.get("eval_count") or math.ceil(len(raw_text) / 4)
    except Exception:
        raw_text = json.dumps(
            {
                "answer": synthesize_fallback_answer(message, docs),
                "sources": [{"doc_id": d["doc_id"], "title": d["title"]} for d in docs],
                "confidence": 0.65 if docs else 0.2,
            }
        )
        prompt_tokens = math.ceil(len(user_content) / 4)
        completion_tokens = math.ceil(len(raw_text) / 4)

    parsed = parse_structured_output(raw_text, prompt_length=len(message))
    return {
        **parsed,
        "tokens": {
            "prompt": int(prompt_tokens),
            "completion": int(completion_tokens),
            "total": int(prompt_tokens) + int(completion_tokens),
        },
        "retrieved_docs": docs,
    }
