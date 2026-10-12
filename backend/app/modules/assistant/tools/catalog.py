import json
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    Allergy,
    Appointment,
    AvailabilitySlot,
    ClinicalObservation,
    Document,
    MedicationStatement,
    PractitionerProfile,
    TimelineEvent,
)
from app.modules.assistant.snapshot import PatientSnapshotService
from app.modules.clinical_data.comparator import ObservationComparator
from app.modules.pending_actions.service import PendingActionService
from app.modules.retrieval.retriever import HybridRetriever


class ToolCatalog:
    @staticmethod
    def get_tool_definitions(is_doctor: bool = False) -> list[dict[str, Any]]:
        """Returns OpenAPI / function calling tool schemas."""
        base_tools = [
            {
                "name": "get_patient_snapshot",
                "description": "Retrieves the precomputed patient snapshot (allergies, active medications, recent labs, upcoming appointments).",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "search_medical_records",
                "description": "Hybrid semantic and lexical search across the patient's verified medical records and documents.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query text (e.g. 'HbA1c history', 'cardiology report')"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_patient_timeline",
                "description": "Returns chronological medical timeline events for this patient.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "Number of events to return (default 10)"}
                    },
                    "required": []
                }
            },
            {
                "name": "query_observations",
                "description": "Queries clinical diagnostic observations by test name or code.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "test_name": {"type": "string", "description": "Name or keyword of the lab test"}
                    },
                    "required": ["test_name"]
                }
            },
            {
                "name": "compare_observations",
                "description": "DETERMINISTIC observation comparison. Computes numerical trend, delta, and percentage change. Call this instead of calculating math in the LLM.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "test_name": {"type": "string", "description": "Name of diagnostic test (e.g. 'HbA1c', 'Fasting Blood Glucose')"},
                        "target_unit": {"type": "string", "description": "Optional unit to standardize to"}
                    },
                    "required": ["test_name"]
                }
            },
            {
                "name": "get_medication_history",
                "description": "Returns documented medication statements, dosage, and active treatment regimens.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "list_pending_reviews",
                "description": "Lists extracted facts awaiting patient or clinician review and confirmation.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "search_doctors",
                "description": "Search verified doctors and medical specialists.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "specialty": {"type": "string", "description": "Medical specialty (e.g. 'Cardiology', 'General Medicine')"}
                    },
                    "required": []
                }
            },
            {
                "name": "get_appointment_availability",
                "description": "Fetches available appointment slots for a specific doctor.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "practitioner_id": {"type": "string", "description": "ID of practitioner"}
                    },
                    "required": ["practitioner_id"]
                }
            },
            {
                "name": "propose_appointment",
                "description": "Proposes an appointment booking. This creates a confirmation card for the user; it does NOT commit without user confirmation.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "practitioner_id": {"type": "string", "description": "Doctor ID"},
                        "appointment_time": {"type": "string", "description": "ISO timestamp (e.g. 2026-10-15T10:00:00Z)"},
                        "notes": {"type": "string", "description": "Reason for visit"}
                    },
                    "required": ["practitioner_id", "appointment_time"]
                }
            },
            {
                "name": "propose_reminder",
                "description": "Proposes a medication or follow-up reminder for the patient to confirm.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Reminder description"},
                        "remind_at": {"type": "string", "description": "ISO timestamp"},
                        "channel": {"type": "string", "enum": ["push", "whatsapp", "sms"]}
                    },
                    "required": ["title", "remind_at"]
                }
            },
            {
                "name": "propose_refill_request",
                "description": "Proposes a prescription medication refill request.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "medicine_name": {"type": "string", "description": "Name of medicine to refill"}
                    },
                    "required": ["medicine_name"]
                }
            }
        ]

        doctor_tools = [
            {
                "name": "get_patient_briefing",
                "description": "Generates a structured, sourced clinical briefing for the doctor with data-as-of timestamp.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "draft_clinical_note",
                "description": "Drafts a clinical encounter note for the doctor to review and save.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "note_text": {"type": "string", "description": "Clinical encounter summary"}
                    },
                    "required": ["note_text"]
                }
            },
            {
                "name": "draft_prescription",
                "description": "Drafts a prescription with allergy cross-checking. The doctor must sign before delivery.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "diagnosis": {"type": "string", "description": "Primary clinical diagnosis"},
                        "medications": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "medicine_name": {"type": "string"},
                                    "dosage": {"type": "string"},
                                    "frequency": {"type": "string"},
                                    "duration": {"type": "string"}
                                }
                            }
                        }
                    },
                    "required": ["diagnosis", "medications"]
                }
            }
        ]

        return base_tools + (doctor_tools if is_doctor else [])

    @staticmethod
    async def execute_tool(
        session: AsyncSession,
        care_profile_id: str,
        user_id: str,
        tool_name: str,
        args: dict[str, Any]
    ) -> dict[str, Any]:
        """Dispatches tool execution deterministically with scope checking."""

        if tool_name == "get_patient_snapshot":
            return await PatientSnapshotService.compute_snapshot(session, care_profile_id)

        elif tool_name == "search_medical_records":
            q = args.get("query", "")
            return await HybridRetriever.search(session, care_profile_id, q, limit=5)

        elif tool_name == "get_patient_timeline":
            limit = int(args.get("limit", 10))
            tl_res = await session.execute(
                select(TimelineEvent)
                .where(TimelineEvent.care_profile_id == care_profile_id)
                .order_by(desc(TimelineEvent.event_date))
                .limit(limit)
            )
            events = tl_res.scalars().all()
            return [
                {
                    "title": e.title,
                    "date": str(e.event_date),
                    "summary": e.summary,
                    "event_type": e.event_type
                }
                for e in events
            ]

        elif tool_name == "query_observations":
            t_name = args.get("test_name", "")
            obs_res = await session.execute(
                select(ClinicalObservation)
                .where(ClinicalObservation.care_profile_id == care_profile_id)
                .order_by(desc(ClinicalObservation.observed_at))
            )
            matched = []
            for o in obs_res.scalars().all():
                if t_name.lower() in o.display_name.lower():
                    matched.append({
                        "fact_id": o.fact_id,
                        "test_name": o.display_name,
                        "value": o.value_numeric,
                        "unit": o.unit,
                        "flag": o.flag,
                        "observed_at": str(o.observed_at)
                    })
            return matched

        elif tool_name == "compare_observations":
            t_name = args.get("test_name", "")
            target_unit = args.get("target_unit")
            obs_res = await session.execute(
                select(ClinicalObservation)
                .where(ClinicalObservation.care_profile_id == care_profile_id)
                .order_by(desc(ClinicalObservation.observed_at))
            )
            all_obs = [o for o in obs_res.scalars().all() if t_name.lower() in o.display_name.lower()]
            if not all_obs:
                return {"error": f"No observations found for '{t_name}'"}

            current_obs = all_obs[0]
            prev_obs = all_obs[1] if len(all_obs) > 1 else None

            return ObservationComparator.compare(
                test_name=current_obs.display_name,
                current_val=current_obs.value_numeric,
                current_unit=current_obs.unit or "",
                current_date_str=str(current_obs.observed_at)[:10],
                prev_val=prev_obs.value_numeric if prev_obs else None,
                prev_unit=prev_obs.unit if prev_obs else None,
                prev_date_str=str(prev_obs.observed_at)[:10] if prev_obs else None,
                target_unit=target_unit,
                ref_low=current_obs.reference_range_low,
                ref_high=current_obs.reference_range_high
            )

        elif tool_name == "get_medication_history":
            med_res = await session.execute(
                select(MedicationStatement).where(MedicationStatement.care_profile_id == care_profile_id)
            )
            return [
                {
                    "fact_id": m.fact_id,
                    "medicine_name": m.medicine_name,
                    "generic_name": m.generic_name,
                    "dosage": m.dosage,
                    "frequency": m.frequency,
                    "is_active": m.is_active,
                    "verification_status": m.verification_status
                }
                for m in med_res.scalars().all()
            ]

        elif tool_name == "list_pending_reviews":
            obs_res = await session.execute(
                select(ClinicalObservation).where(
                    ClinicalObservation.care_profile_id == care_profile_id,
                    ClinicalObservation.verification_status == "unreviewed"
                )
            )
            med_res = await session.execute(
                select(MedicationStatement).where(
                    MedicationStatement.care_profile_id == care_profile_id,
                    MedicationStatement.verification_status == "unreviewed"
                )
            )
            reviews = []
            for o in obs_res.scalars().all():
                reviews.append({
                    "fact_id": o.fact_id,
                    "type": "observation",
                    "item": f"{o.display_name}: {o.value_numeric} {o.unit or ''}",
                    "flag": o.flag
                })
            for m in med_res.scalars().all():
                reviews.append({
                    "fact_id": m.fact_id,
                    "type": "medication",
                    "item": f"{m.medicine_name} ({m.dosage or ''})",
                    "flag": "handwritten_check"
                })
            return reviews

        elif tool_name == "search_doctors":
            spec = args.get("specialty")
            q = select(PractitionerProfile).where(PractitionerProfile.is_verified == True)
            if spec:
                q = q.where(PractitionerProfile.specialty.ilike(f"%{spec}%"))
            docs = (await session.execute(q)).scalars().all()
            return [
                {
                    "id": d.id,
                    "name": d.name,
                    "specialty": d.specialty,
                    "qualification": d.qualification,
                    "council_reg": d.council_reg_number
                }
                for d in docs
            ]

        elif tool_name == "get_appointment_availability":
            pid = args.get("practitioner_id")
            slots = (await session.execute(
                select(AvailabilitySlot).where(
                    AvailabilitySlot.practitioner_id == pid,
                    AvailabilitySlot.is_booked == False
                )
            )).scalars().all()
            return [
                {
                    "slot_id": s.id,
                    "start_time": s.start_time.isoformat(),
                    "end_time": s.end_time.isoformat()
                }
                for s in slots
            ]

        # PROPOSING TOOLS (Creates pending_action, NEVER commits directly!)
        elif tool_name == "propose_appointment":
            pid = args.get("practitioner_id")
            doc_res = await session.execute(select(PractitionerProfile).where(PractitionerProfile.id == pid))
            doc = doc_res.scalar_one_or_none()
            doc_name = doc.name if doc else "Doctor"
            time_str = args.get("appointment_time", "")
            summary = f"Appointment booking with Dr. {doc_name} for {time_str}"
            pending = await PendingActionService.create_pending_action(
                session=session,
                care_profile_id=care_profile_id,
                user_id=user_id,
                action_type="propose_appointment",
                summary=summary,
                payload=args
            )
            return {
                "status": "proposed",
                "pending_action_id": pending.id,
                "summary": summary,
                "expires_at": pending.expires_at.isoformat(),
                "notice": "This action requires user confirmation via confirmation card. It is NOT yet booked."
            }

        elif tool_name == "propose_reminder":
            title = args.get("title", "Medication Reminder")
            rem_time = args.get("remind_at", "")
            summary = f"Set reminder: '{title}' at {rem_time}"
            pending = await PendingActionService.create_pending_action(
                session=session,
                care_profile_id=care_profile_id,
                user_id=user_id,
                action_type="propose_reminder",
                summary=summary,
                payload=args
            )
            return {
                "status": "proposed",
                "pending_action_id": pending.id,
                "summary": summary,
                "expires_at": pending.expires_at.isoformat()
            }

        elif tool_name == "propose_refill_request":
            med = args.get("medicine_name", "")
            summary = f"Refill prescription request for '{med}'"
            pending = await PendingActionService.create_pending_action(
                session=session,
                care_profile_id=care_profile_id,
                user_id=user_id,
                action_type="propose_refill_request",
                summary=summary,
                payload=args
            )
            return {
                "status": "proposed",
                "pending_action_id": pending.id,
                "summary": summary,
                "expires_at": pending.expires_at.isoformat()
            }

        return {"error": f"Unknown tool: {tool_name}"}
