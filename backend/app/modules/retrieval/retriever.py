import json
import math
from typing import Any
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import ClinicalObservation, DocumentChunk, MedicationStatement


class HybridRetriever:
    @staticmethod
    def cosine_similarity(v1: list[float], v2: list[float]) -> float:
        a = np.array(v1, dtype=np.float32)
        b = np.array(v2, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    @staticmethod
    def lexical_score(query: str, text: str) -> float:
        """Token overlap and BM25-style term frequency score."""
        q_tokens = set(query.lower().split())
        t_tokens = text.lower().split()
        if not q_tokens or not t_tokens:
            return 0.0

        score = 0.0
        for token in q_tokens:
            count = t_tokens.count(token)
            if count > 0:
                score += 1.0 + math.log(1.0 + count)
        return score

    @staticmethod
    async def search(
        session: AsyncSession,
        care_profile_id: str,
        query: str,
        query_embedding: list[float] | None = None,
        limit: int = 5
    ) -> list[dict[str, Any]]:
        """Hybrid search combining semantic vectors and lexical text matching, strictly partitioned by care_profile_id."""
        # 1. Fetch document chunks strictly belonging to care_profile_id
        chunk_res = await session.execute(
            select(DocumentChunk).where(DocumentChunk.care_profile_id == care_profile_id)
        )
        chunks = chunk_res.scalars().all()

        scored_candidates: list[dict[str, Any]] = []

        for c in chunks:
            text = c.chunk_text
            # Semantic score
            v_score = 0.0
            if query_embedding and c.embedding_json:
                try:
                    c_emb = json.loads(c.embedding_json)
                    v_score = HybridRetriever.cosine_similarity(query_embedding, c_emb)
                except Exception:
                    v_score = 0.0

            # Lexical score
            l_score = HybridRetriever.lexical_score(query, text)

            scored_candidates.append({
                "type": "document_chunk",
                "chunk_id": c.id,
                "document_id": c.document_id,
                "page": c.page_number,
                "text": text,
                "vector_score": v_score,
                "lexical_score": l_score,
            })

        # Rank candidates by vector score
        scored_candidates.sort(key=lambda x: x["vector_score"], reverse=True)
        for rank, c in enumerate(scored_candidates):
            c["vector_rank"] = rank + 1

        # Rank candidates by lexical score
        scored_candidates.sort(key=lambda x: x["lexical_score"], reverse=True)
        for rank, c in enumerate(scored_candidates):
            c["lexical_rank"] = rank + 1

        # Compute Reciprocal Rank Fusion (RRF)
        # RRF score = 1 / (60 + v_rank) + 1 / (60 + l_rank)
        for c in scored_candidates:
            rrf = (1.0 / (60.0 + c["vector_rank"])) + (1.0 / (60.0 + c["lexical_rank"]))
            c["hybrid_score"] = round(rrf, 5)

        scored_candidates.sort(key=lambda x: x["hybrid_score"], reverse=True)
        top_candidates = scored_candidates[:limit]

        # Also search structured facts directly (observations and medications)
        obs_res = await session.execute(
            select(ClinicalObservation).where(ClinicalObservation.care_profile_id == care_profile_id)
        )
        matched_facts: list[dict[str, Any]] = []
        for o in obs_res.scalars().all():
            q_clean = query.lower()
            if o.display_name.lower() in q_clean or (o.code_loinc and o.code_loinc in q_clean):
                matched_facts.append({
                    "type": "structured_observation",
                    "fact_id": o.fact_id,
                    "document_id": o.document_id,
                    "title": o.display_name,
                    "value": f"{o.value_numeric} {o.unit or ''} ({o.flag})",
                    "text": f"Lab observation: {o.display_name} = {o.value_numeric} {o.unit or ''} on {o.observed_at} [{o.fact_id}]",
                    "hybrid_score": 1.0
                })

        return [*matched_facts, *top_candidates][:limit]
