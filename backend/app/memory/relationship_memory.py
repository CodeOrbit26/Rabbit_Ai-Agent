"""Layer 3 — Relationship / Topic Memory: tracks topics discussed, conversation patterns, outcomes."""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.core.models import TopicRecord
from app.db.database import db
from app.db.vector_store import vector_store

logger = logging.getLogger(__name__)

TOPIC_EXTRACTION_PROMPT = """Analyse the following conversation exchange and extract the main topics discussed.
Return a JSON array of objects. Each object must have:
- "topic": a short topic name (1-4 words)
- "summary": a one-sentence summary of what was discussed about this topic
- "related_topics": array of related topic strings (can be empty)
- "outcome": what was the result/decision regarding this topic (or empty string)

If no meaningful topics were discussed, return an empty array [].

Conversation:
User: {user_message}
Assistant: {assistant_message}

Return ONLY the JSON array, no markdown fences, no extra text."""


class RelationshipMemory:
    """Tracks all topics discussed between user and AI.

    Remembers previous conversations, questions asked, responses given,
    decisions made, and outcomes. Enables recalling relevant past
    discussions when answering future queries.
    """

    # ── tracking ──────────────────────────────────────────────────────────

    async def track_topics(
        self,
        session_id: str,
        user_message: str,
        assistant_message: str,
        llm_call,
    ) -> list[TopicRecord]:
        """Extract topics from a conversation turn and persist them."""
        prompt = TOPIC_EXTRACTION_PROMPT.format(
            user_message=user_message,
            assistant_message=assistant_message,
        )
        try:
            raw = await llm_call(prompt)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            items = json.loads(raw)
        except Exception as e:
            logger.warning("RelationshipMemory topic extraction failed: %s", e)
            return []

        records: list[TopicRecord] = []
        now = time.time()

        for item in items:
            if not isinstance(item, dict) or "topic" not in item:
                continue

            topic_name = item["topic"].strip().lower()
            if not topic_name:
                continue

            # Check if this topic already exists for this session
            existing = await db.find_topic_by_name(session_id, topic_name)

            if existing:
                # Update existing topic
                rec = TopicRecord(
                    id=existing["id"],
                    session_id=session_id,
                    topic=topic_name,
                    summary=item.get("summary", existing.get("summary", "")),
                    frequency=existing.get("frequency", 0) + 1,
                    first_discussed=existing.get("first_discussed", now),
                    last_discussed=now,
                    related_topics=list(set(
                        existing.get("related_topics", []) +
                        item.get("related_topics", [])
                    )),
                    outcomes=existing.get("outcomes", []) + (
                        [item["outcome"]] if item.get("outcome") else []
                    ),
                )
            else:
                # New topic
                rec = TopicRecord(
                    session_id=session_id,
                    topic=topic_name,
                    summary=item.get("summary", ""),
                    frequency=1,
                    first_discussed=now,
                    last_discussed=now,
                    related_topics=item.get("related_topics", []),
                    outcomes=[item["outcome"]] if item.get("outcome") else [],
                )

            await db.upsert_topic(
                id=rec.id,
                session_id=rec.session_id,
                topic=rec.topic,
                summary=rec.summary,
                frequency=rec.frequency,
                first_discussed=rec.first_discussed,
                last_discussed=rec.last_discussed,
                related_topics=rec.related_topics,
                outcomes=rec.outcomes,
            )

            # Add to FAISS for semantic search
            search_text = f"{rec.topic}: {rec.summary}"
            await vector_store.add_text(
                search_text,
                metadata={"type": "topic_memory", "topic": rec.topic, "id": rec.id},
            )
            records.append(rec)

        if records:
            logger.info("RelationshipMemory: tracked %d topics for session %s", len(records), session_id)
        return records

    # ── retrieval ─────────────────────────────────────────────────────────

    async def get_all_topics(self, session_id: str) -> list[TopicRecord]:
        rows = await db.get_topics(session_id=session_id)
        return [
            TopicRecord(
                id=r["id"],
                session_id=r["session_id"],
                topic=r["topic"],
                summary=r.get("summary", ""),
                frequency=r.get("frequency", 1),
                first_discussed=r.get("first_discussed", 0),
                last_discussed=r.get("last_discussed", 0),
                related_topics=r.get("related_topics", []),
                outcomes=r.get("outcomes", []),
            )
            for r in rows
        ]

    async def find_similar_discussions(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        """Search for previously discussed topics similar to *query*."""
        results = await vector_store.search(query, k=k * 2)
        filtered = [r for r in results if r.get("metadata", {}).get("type") == "topic_memory"]
        return filtered[:k]

    async def get_context_string(self, session_id: str, query: str = "", limit: int = 8) -> str:
        """Return topic memory context as a formatted string."""
        if query:
            similar = await self.find_similar_discussions(query, k=limit)
            if similar:
                lines = [f"- {r['text']} (relevance: {r['score']:.2f})" for r in similar]
                return "Previously discussed topics:\n" + "\n".join(lines)

        # Fallback: most recent topics
        topics = await self.get_all_topics(session_id)
        if not topics:
            return "(No previous topic history.)"
        recent = sorted(topics, key=lambda t: t.last_discussed, reverse=True)[:limit]
        lines = [f"- {t.topic}: {t.summary} (discussed {t.frequency}x)" for t in recent]
        return "Previously discussed topics:\n" + "\n".join(lines)


# ── Singleton ─────────────────────────────────────────────────────────────────
relationship_memory = RelationshipMemory()
