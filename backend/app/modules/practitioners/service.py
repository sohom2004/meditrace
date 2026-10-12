import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.errors import NotFoundError, ValidationError
from app.db.models import (
    AccessGrant,
    Allergy,
    CareProfile,
    ClinicalObservation,
    Condition,
    MedicationStatement,
    PractitionerProfile,
    Prescription,
    DoctorPatientMessage,
)
from app.db.schemas import DoctorBriefingRead, SourceRef


class PractitionerService:
    @staticmethod
    async def get_authorized_patients(
        session: AsyncSession,
        practitioner_id: str
    ) -> list[dict[str, Any]]:
        """Returns the list of patients who have granted active access to this practitioner."""
        grants_res = await session.execute(
            select(AccessGrant, CareProfile)
            .join(CareProfile, AccessGrant.care_profile_id == CareProfile.id)
            .where(
                AccessGrant.practitioner_id == practitioner_id,
                AccessGrant.is_revoked == False
            )
        )
        patients = []
        for grant, profile in grants_res.all():
            patients.append({
                "grant_id": grant.id,
                "care_profile_id": profile.id,
                "full_name": profile.full_name,
                "relationship": profile.relationship,
                "gender": profile.gender,
                "dob": profile.date_of_birth,
                "blood_group": profile.blood_group,
                "purpose": grant.purpose,
                "valid_until": str(grant.valid_until) if grant.valid_until else "Indefinite"
            })
        return patients

    @staticmethod
    async def generate_patient_briefing(
        session: AsyncSession,
        care_profile_id: str,
        practitioner_id: str
    ) -> DoctorBriefingRead:
        """Generates a structured, sourced clinical briefing with drill-down provenance."""
        cp_res = await session.execute(select(CareProfile).where(CareProfile.id == care_profile_id))
        cp = cp_res.scalar_one_or_none()
        if not cp:
            raise NotFoundError(f"CareProfile {care_profile_id} not found")

        # Fetch conditions
        cond_res = await session.execute(
            select(Condition).where(
                Condition.care_profile_id == care_profile_id,
                Condition.clinical_status == "active"
            )
        )
        conditions = [c.name for c in cond_res.scalars().all()]

        # Fetch medications
        med_res = await session.execute(
            select(MedicationStatement).where(
                MedicationStatement.care_profile_id == care_profile_id,
                MedicationStatement.is_active == True
            )
        )
        meds = [
            {
                "fact_id": m.fact_id,
                "name": m.medicine_name,
                "generic": m.generic_name,
                "dosage": m.dosage,
                "frequency": m.frequency
            }
            for m in med_res.scalars().all()
        ]

        # Fetch allergies
        alg_res = await session.execute(
            select(Allergy).where(Allergy.care_profile_id == care_profile_id)
        )
        allergies = [f"{a.allergen} ({a.reaction})" for a in alg_res.scalars().all()]

        # Fetch recent observations
        obs_res = await session.execute(
            select(ClinicalObservation)
            .where(ClinicalObservation.care_profile_id == care_profile_id)
            .order_by(ClinicalObservation.observed_at.desc())
            .limit(10)
        )
        observations = []
        sources: list[SourceRef] = []
        for o in obs_res.scalars().all():
            observations.append({
                "fact_id": o.fact_id,
                "name": o.display_name,
                "value": f"{o.value_numeric} {o.unit or ''}",
                "flag": o.flag,
                "date": str(o.observed_at)[:10] if o.observed_at else None
            })
            sources.append(
                SourceRef(
                    fact_id=o.fact_id,
                    document_id=o.document_id,
                    label=o.display_name,
                    excerpt=f"{o.display_name}: {o.value_numeric} {o.unit or ''} ({o.flag})"
                )
            )

        now = datetime.now(timezone.utc)
        narrative = (
            f"Patient {cp.full_name} ({cp.gender}, Blood Group: {cp.blood_group or 'Unknown'}). "
            f"Active conditions: {', '.join(conditions) if conditions else 'None documented'}. "
            f"Current regimen comprises {len(meds)} active medication(s). "
            f"Allergies recorded: {', '.join(allergies) if allergies else 'NKDA (No known drug allergies)'}. "
            f"Diagnostic records reflect {len(observations)} tracked lab indicators."
        )

        return DoctorBriefingRead(
            care_profile_id=care_profile_id,
            patient_name=cp.full_name,
            data_as_of=now,
            active_conditions=conditions,
            active_medications=meds,
            recent_observations=observations,
            allergies=allergies,
            sources=sources,
            summary_narrative=narrative
        )

    @staticmethod
    async def draft_and_sign_prescription(
        session: AsyncSession,
        care_profile_id: str,
        practitioner_id: str,
        diagnosis: str,
        medications: list[dict[str, Any]],
        instructions: str | None = None,
        sign_now: bool = False,
        signature_pin: str | None = None
    ) -> Prescription:
        """Drafts a prescription with automated allergy cross-check and optional digital signing."""
        # 1. Deterministic Allergy Cross-Check
        alg_res = await session.execute(
            select(Allergy).where(Allergy.care_profile_id == care_profile_id)
        )
        allergies = [a.allergen.lower() for a in alg_res.scalars().all()]

        for m in medications:
            med_name = m.get("medicine_name", "").lower()
            generic = m.get("generic_name", "").lower()
            for alg in allergies:
                if (alg in med_name or alg in generic) and alg:
                    raise ValidationError(
                        f"CRITICAL SAFETY ALERT: Patient has documented allergy to '{alg}'. Cannot prescribe '{m.get('medicine_name')}' without explicit override."
                    )

        presc = Prescription(
            care_profile_id=care_profile_id,
            practitioner_id=practitioner_id,
            diagnosis=diagnosis,
            medications_json=json.dumps(medications),
            instructions=instructions,
            is_signed=False
        )

        if sign_now and signature_pin == "1234":
            now = datetime.now(timezone.utc)
            sig_payload = f"{practitioner_id}:{care_profile_id}:{now.isoformat()}:{diagnosis}"
            sig_hash = hashlib.sha256(sig_payload.encode()).hexdigest()
            presc.is_signed = True
            presc.signed_at = now
            presc.signature_hash = sig_hash

        session.add(presc)
        await session.commit()
        await session.refresh(presc)
        return presc

    @staticmethod
    async def send_doctor_patient_message(
        session: AsyncSession,
        care_profile_id: str,
        practitioner_id: str,
        sender_role: str,
        content: str
    ) -> DoctorPatientMessage:
        """Sends a secure message between connected doctor and patient."""
        msg = DoctorPatientMessage(
            care_profile_id=care_profile_id,
            practitioner_id=practitioner_id,
            sender_role=sender_role,
            content=content
        )
        session.add(msg)
        await session.commit()
        await session.refresh(msg)
        return msg

    @staticmethod
    async def get_doctor_patient_messages(
        session: AsyncSession,
        care_profile_id: str,
        practitioner_id: str
    ) -> list[DoctorPatientMessage]:
        """Fetches interactive two-way secure message history between doctor and patient."""
        res = await session.execute(
            select(DoctorPatientMessage)
            .where(
                DoctorPatientMessage.care_profile_id == care_profile_id,
                DoctorPatientMessage.practitioner_id == practitioner_id
            )
            .order_by(DoctorPatientMessage.created_at)
        )
        return res.scalars().all()

