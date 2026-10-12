import re
from typing import Any
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Allergy, ClinicalObservation, Condition, Document, MedicationStatement


class CitationValidationResult(BaseModel):
    is_valid: bool
    verified_sources: list[dict[str, Any]]
    violations: list[str]


class DeterministicCitationVerifier:
    @staticmethod
    def extract_cited_fact_ids(text: str, structured_sources: list[dict[str, Any]] | None = None) -> set[str]:
        """Extracts all fact IDs mentioned in text tags like [fact_id: XYZ] or in structured sources."""
        fact_ids = set()

        # Regex search in text: [fact_id: XYZ] or [fact: XYZ] or FACT-xxx
        pattern = r"(?:\[(?:fact_id|fact):\s*([a-zA-Z0-9_\-]+)\]|\b(FACT-[A-Z0-9_\-]+)\b)"
        for match in re.finditer(pattern, text, re.IGNORECASE):
            fid = match.group(1) or match.group(2)
            if fid:
                fact_ids.add(fid.strip())

        if structured_sources:
            for s in structured_sources:
                if isinstance(s, dict) and "fact_id" in s and s["fact_id"]:
                    fact_ids.add(s["fact_id"].strip())

        return fact_ids

    @staticmethod
    async def verify_citations(
        session: AsyncSession,
        care_profile_id: str,
        text: str,
        sources: list[dict[str, Any]] | None = None
    ) -> CitationValidationResult:
        """Deterministically verifies that EVERY cited fact_id exists within the caller's authorized scope."""
        cited_ids = DeterministicCitationVerifier.extract_cited_fact_ids(text, sources)

        if not cited_ids:
            return CitationValidationResult(is_valid=True, verified_sources=[], violations=[])

        # Query all allowed fact_ids for this care_profile_id across tables
        valid_fact_map: dict[str, dict[str, Any]] = {}

        # 1. Observations
        obs_res = await session.execute(
            select(ClinicalObservation).where(
                ClinicalObservation.care_profile_id == care_profile_id,
                ClinicalObservation.fact_id.in_(list(cited_ids))
            )
        )
        for obs in obs_res.scalars().all():
            valid_fact_map[obs.fact_id] = {
                "fact_id": obs.fact_id,
                "document_id": obs.document_id,
                "label": obs.display_name,
                "type": "observation",
                "value": f"{obs.value_numeric} {obs.unit or ''}".strip(),
                "observed_at": str(obs.observed_at)
            }

        # 2. Medications
        med_res = await session.execute(
            select(MedicationStatement).where(
                MedicationStatement.care_profile_id == care_profile_id,
                MedicationStatement.fact_id.in_(list(cited_ids))
            )
        )
        for med in med_res.scalars().all():
            valid_fact_map[med.fact_id] = {
                "fact_id": med.fact_id,
                "document_id": med.document_id,
                "label": med.medicine_name,
                "type": "medication",
                "value": f"{med.generic_name or med.medicine_name} ({med.dosage or ''})".strip(),
                "observed_at": str(med.created_at)
            }

        # 3. Conditions
        cond_res = await session.execute(
            select(Condition).where(
                Condition.care_profile_id == care_profile_id,
                Condition.fact_id.in_(list(cited_ids))
            )
        )
        for cond in cond_res.scalars().all():
            valid_fact_map[cond.fact_id] = {
                "fact_id": cond.fact_id,
                "document_id": cond.document_id,
                "label": cond.name,
                "type": "condition",
                "value": cond.clinical_status,
                "observed_at": str(cond.observed_at)
            }

        # 4. Allergies
        allergy_res = await session.execute(
            select(Allergy).where(
                Allergy.care_profile_id == care_profile_id,
                Allergy.fact_id.in_(list(cited_ids))
            )
        )
        for alg in allergy_res.scalars().all():
            valid_fact_map[alg.fact_id] = {
                "fact_id": alg.fact_id,
                "document_id": alg.document_id,
                "label": alg.allergen,
                "type": "allergy",
                "value": f"Reaction: {alg.reaction or 'Unknown'} ({alg.severity})",
                "observed_at": str(alg.created_at)
            }

        violations: list[str] = []
        verified_sources: list[dict[str, Any]] = []

        for cid in cited_ids:
            if cid in valid_fact_map:
                verified_sources.append(valid_fact_map[cid])
            else:
                violations.append(
                    f"Invalid or out-of-scope citation: '{cid}' not found in CareProfile {care_profile_id}"
                )

        return CitationValidationResult(
            is_valid=(len(violations) == 0),
            verified_sources=verified_sources,
            violations=violations
        )
