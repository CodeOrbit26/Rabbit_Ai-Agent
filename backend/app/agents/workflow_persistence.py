"""Workflow persistence — save/restore LangGraph state for human-in-the-loop."""
from __future__ import annotations

import json
import time
import logging
from typing import Any

from app.db.database import db

logger = logging.getLogger(__name__)


class WorkflowPersistence:
    """Saves and restores workflow state to SQLite.

    This enables human-in-the-loop patterns where the graph pauses,
    waits for user input, and resumes from the exact same state.
    """

    async def save(self, workflow_id: str, session_id: str, state: dict[str, Any], node: str = "") -> None:
        """Persist the current workflow state."""
        # Filter out non-serialisable keys
        serialisable_state = {}
        for k, v in state.items():
            if k.startswith("_"):  # skip private keys like _streaming_callback
                continue
            try:
                json.dumps(v)
                serialisable_state[k] = v
            except (TypeError, ValueError):
                continue

        now = time.time()
        existing = await db.get_workflow_state(workflow_id)

        await db.save_workflow_state(
            workflow_id=workflow_id,
            session_id=session_id,
            state_json=json.dumps(serialisable_state),
            node=node,
            created_at=existing["created_at"] if existing else now,
            updated_at=now,
        )
        logger.info("Workflow %s saved at node '%s'", workflow_id, node)

    async def restore(self, workflow_id: str) -> dict[str, Any] | None:
        """Restore a previously saved workflow state."""
        row = await db.get_workflow_state(workflow_id)
        if not row:
            return None
        state = json.loads(row["state_json"])
        state["current_node"] = row.get("node", "")
        logger.info("Workflow %s restored from node '%s'", workflow_id, state["current_node"])
        return state

    async def delete(self, workflow_id: str) -> None:
        """Remove a completed workflow state."""
        await db.delete_workflow_state(workflow_id)


workflow_persistence = WorkflowPersistence()
