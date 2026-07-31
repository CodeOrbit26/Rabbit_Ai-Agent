"""FAISS vector store wrapper for semantic similarity search."""
from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# We lazily import heavy libs so startup is fast if they aren't installed.
_faiss = None
_np = None


def _ensure_imports():
    global _faiss, _np
    if _faiss is None:
        import faiss  # type: ignore
        import numpy as np
        _faiss = faiss
        _np = np


class VectorStore:
    """Lightweight FAISS wrapper that stores text + embeddings for similarity search.

    Uses a simple in-process FAISS IndexFlatIP (inner-product / cosine on
    normalised vectors) which is fast enough for <100 k vectors.
    """

    DIMENSION = 768  # Google embedding-001 output dimension

    def __init__(self) -> None:
        self._index_dir = settings.faiss_full_path
        self._index = None          # faiss.IndexFlatIP
        self._texts: list[str] = []
        self._metadatas: list[dict[str, Any]] = []
        self._embed_fn = None       # callable that turns text → list[float]

    # ── lifecycle ─────────────────────────────────────────────────────────

    async def initialize(self, embed_fn=None) -> None:
        """Create or load the FAISS index.  ``embed_fn`` must be an async or
        sync callable:  ``(text: str) -> list[float]``."""
        _ensure_imports()
        self._embed_fn = embed_fn
        self._index_dir.mkdir(parents=True, exist_ok=True)

        idx_path = self._index_dir / "index.faiss"
        meta_path = self._index_dir / "texts.json"

        if idx_path.exists() and meta_path.exists():
            import json
            self._index = _faiss.read_index(str(idx_path))
            with open(meta_path) as f:
                stored = json.load(f)
                self._texts = stored.get("texts", [])
                self._metadatas = stored.get("metadatas", [])
            logger.info("FAISS index loaded – %d vectors", self._index.ntotal)
        else:
            self._index = _faiss.IndexFlatIP(self.DIMENSION)
            logger.info("Created new FAISS index (dim=%d)", self.DIMENSION)

    def _save(self) -> None:
        import json
        _faiss.write_index(self._index, str(self._index_dir / "index.faiss"))
        with open(self._index_dir / "texts.json", "w") as f:
            json.dump({"texts": self._texts, "metadatas": self._metadatas}, f)

    # ── public API ────────────────────────────────────────────────────────

    async def add_text(self, text: str, metadata: dict[str, Any] | None = None) -> None:
        """Embed *text* and add it to the index."""
        if not text.strip():
            return
        vec = await self._embed(text)
        arr = _np.array([vec], dtype=_np.float32)
        _faiss.normalize_L2(arr)
        self._index.add(arr)
        self._texts.append(text)
        self._metadatas.append(metadata or {})
        self._save()

    async def search(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        """Return the *k* most similar stored texts to *query*."""
        if self._index is None or self._index.ntotal == 0:
            return []
        vec = await self._embed(query)
        arr = _np.array([vec], dtype=_np.float32)
        _faiss.normalize_L2(arr)
        scores, indices = self._index.search(arr, min(k, self._index.ntotal))
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            results.append({
                "text": self._texts[idx],
                "score": float(score),
                "metadata": self._metadatas[idx],
            })
        return results

    # ── embedding helper ──────────────────────────────────────────────────

    async def _embed(self, text: str) -> list[float]:
        """Produce a float vector from *text* using the configured embed fn."""
        if self._embed_fn is None:
            # Fallback: deterministic hash-based pseudo-embedding (for dev/testing)
            import hashlib
            h = hashlib.sha256(text.encode()).digest()
            vec = [float(b) / 255.0 for b in h]
            # Pad / truncate to DIMENSION
            vec = (vec * ((self.DIMENSION // len(vec)) + 1))[:self.DIMENSION]
            return vec
        import asyncio
        if asyncio.iscoroutinefunction(self._embed_fn):
            return await self._embed_fn(text)
        return self._embed_fn(text)


# ── Singleton ─────────────────────────────────────────────────────────────────
vector_store = VectorStore()
