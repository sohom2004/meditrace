import json
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    Allergy,
    Appointment,
    CareProfile,
    ClinicalObservation,
    MedicationStatement,
    PatientSnapshot,
    PractitionerProfile,
)

class PatientSnapshotService:
    @staticmethod
    async def compute_snapshot(session: AsyncSession, care_profile_id: str) -> dict[str, Any]:
        """Materializes the structured patient snapshot context pack for low-latency grounding."""
        # 1. Profile metadata
        cp_res = await session.execute(select(CareProfile).where(CareProfile.id == care_profile_id))
        cp = cp_res.scalar_one_or_none()
        patient_info = {
            "name": cp.full_name if cp else "Unknown",
            "relationship": cp.relationship if cp else "self",
            "gender": cp.gender if cp else "Unknown",
            "blood_group": cp.blood_group if cp else "Unknown",
            "dob": cp.date_of_birth if cp else None,
            "abha_address": cp.abha_address if cp else None,
        }

        # 2. Allergies
        alg_res = await session.execute(
            select(Allergy).where(Allergy.care_profile_id == care_profile_id)
        )
        allergies = [
            {
                "fact_id": a.fact_id,
                "allergen": a.allergen,
                "reaction": a.reaction,
                "severity": a.severity,
                "status": a.verification_status
            }
            for a in alg_res.scalars().all()
        ]

        # 3. Active Medications
        med_res = await session.execute(
            select(MedicationStatement).where(
                MedicationStatement.care_profile_id == care_profile_id,
                MedicationStatement.is_active == True
            )
        )
        active_medications = [
            {
                "fact_id": m.fact_id,
                "medicine_name": m.medicine_name,
                "generic_name": m.generic_name,
                "dosage": m.dosage,
                "frequency": m.frequency,
                "route": m.route,
                "verification_status": m.verification_status
            }
            for m in med_res.scalars().all()
        ]

        # 4. Latest Key Observations
        obs_res = await session.execute(
            select(ClinicalObservation)
            .where(ClinicalObservation.care_profile_id == care_profile_id)
            .order_by(desc(ClinicalObservation.observed_at))
            .limit(10)
        )
        recent_labs = [
            {
                "fact_id": o.fact_id,
                "name": o.display_name,
                "value": o.value_numeric,
                "unit": o.unit,
                "flag": o.flag,
                "observed_at": o.observed_at.strftime("%Y-%m-%d") if o.observed_at else None,
                "verification_status": o.verification_status
            }
            for o in obs_res.scalars().all()
        ]

        # 5. Upcoming Appointments
        now = datetime.now(timezone.utc)
        appt_res = await session.execute(
            select(Appointment, PractitionerProfile)
            .join(PractitionerProfile, Appointment.practitioner_id == PractitionerProfile.id)
            .where(
                Appointment.care_profile_id == care_profile_id,
                Appointment.status == "scheduled",
                Appointment.appointment_time >= now
            )
            .order_by(Appointment.appointment_time)
            .limit(3)
        )
        upcoming_appointments = [
            {
                "appointment_id": appt.id,
                "doctor_name": prac.name,
                "specialty": prac.specialty,
                "appointment_time": appt.appointment_time.strftime("%Y-%m-%d %H:%M"),
                "status": appt.status
            }
            for appt, prac in appt_res.all()
        ]

        snapshot_data = {
            "patient": patient_info,
            "allergies": allergies,
            "active_medications": active_medications,
            "recent_observations": recent_labs,
            "upcoming_appointments": upcoming_appointments,
            "snapshot_updated_at": now.isoformat()
        }

        # Materialize in PatientSnapshot table for fast retrieval
        snap_res = await session.execute(
            select(PatientSnapshot).where(PatientSnapshot.care_profile_id == care_profile_id)
        )
        existing_snap = snap_res.scalar_one_or_none()
        if existing_snap:
            existing_snap.snapshot_json = json.dumps(snapshot_data)
            existing_snap.version += 1
            existing_snap.updated_at = now
        else:
            new_snap = PatientSnapshot(
                care_profile_id=care_profile_id,
                snapshot_json=json.dumps(snapshot_data),
                version=1,
                updated_at=now
            )
            session.add(new_snap)

        await session.commit()
        return snapshot_data

    @staticmethod
    def format_snapshot_for_prompt(snapshot: dict[str, Any]) -> str:
        """Formats the patient snapshot into a clean markdown section for system prompt injection."""
        p = snapshot.get("patient", {})
        allergies = snapshot.get("allergies", [])
        meds = snapshot.get("active_medications", [])
        labs = snapshot.get("recent_observations", [])
        appts = snapshot.get("upcoming_appointments", [])

        allergy_str = ", ".join(f"{a['allergen']} ({a['reaction']})" for a in allergies) if allergies else "None documented"
        med_str = "\n".join(
            f"- {m['medicine_name']} ({m.get('generic_name', '')}) {m.get('dosage', '')} [{m['fact_id']}]"
            for m in meds
        ) if meds else "None documented"

        lab_str = "\n".join(
            f"- {l['name']}: {l['value']} {l['unit']} ({l['flag']}) on {l['observed_at']} [{l['fact_id']}]"
            for l in labs
        ) if labs else "No recent labs"

        appt_str = "\n".join(
            f"- Dr. {ap['doctor_name']} ({ap['specialty']}) at {ap['appointment_time']}"
            for ap in appts
        ) if appts else "No upcoming appointments"

        return f"""
### PATIENT SNAPSHOT (Grounded Baseline)
- **Patient**: {p.get('name')} | Gender: {p.get('gender')} | Blood Group: {p.get('blood_group')} | Relationship: {p.get('relationship')}
- **Documented Allergies**: {allergy_str}
- **Active Medications**:
{med_str}
- **Recent Diagnostic Observations**:
{lab_str}
- **Upcoming Appointments**:
{appt_str}
""".strip()
