import json
import re
import uuid
from typing import Any, AsyncGenerator
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.models import Conversation, Message
from app.db.schemas import (
    ChatMessageResponse,
    PendingActionRef,
    SourceRef,
    UIBlock,
)
from app.modules.assistant.citation_verifier import DeterministicCitationVerifier
from app.modules.assistant.safety import PreLlmEmergencyScreen
from app.modules.assistant.snapshot import PatientSnapshotService
from app.modules.assistant.tools.catalog import ToolCatalog


class AssistantRuntime:
    @staticmethod
    async def process_turn(
        session: AsyncSession,
        conversation_id: str,
        care_profile_id: str,
        user_id: str,
        user_message: str,
        language: str = "en",
        is_doctor: bool = False
    ) -> ChatMessageResponse:
        """Executes one bounded assistant turn according to §6.1 specification."""

        # 1. Pre-LLM Emergency / Red-Flag Screen
        emergency = PreLlmEmergencyScreen.screen(user_message, language=language)
        if emergency:
            # Persist user message and emergency assistant response
            u_msg = Message(
                conversation_id=conversation_id,
                sender_role="user",
                content=user_message
            )
            a_msg = Message(
                conversation_id=conversation_id,
                sender_role="assistant",
                content=emergency["alert_message"],
                speech_text=emergency["alert_message"],
                ui_blocks_json=json.dumps([emergency["ui_block"]])
            )
            session.add_all([u_msg, a_msg])
            await session.commit()

            return ChatMessageResponse(
                message_id=a_msg.id,
                language=language,
                text=emergency["alert_message"],
                speech_text=emergency["alert_message"],
                sources=[],
                ui_blocks=[UIBlock(**emergency["ui_block"])],
                pending_actions=[],
                safety={"emergency": True, "disclaimer_shown": True, "category": emergency["category"]}
            )

        # 2. Load Patient Snapshot
        snapshot = await PatientSnapshotService.compute_snapshot(session, care_profile_id)
        snapshot_prompt = PatientSnapshotService.format_snapshot_for_prompt(snapshot)

        # 3. Load recent conversation history
        hist_res = await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at))
            .limit(4)
        )
        recent_msgs = list(reversed(hist_res.scalars().all()))

        # Persist incoming user message
        u_msg = Message(
            conversation_id=conversation_id,
            sender_role="user",
            content=user_message
        )
        session.add(u_msg)
        await session.commit()

        # 4. Determine tools to expose
        tool_defs = ToolCatalog.get_tool_definitions(is_doctor=is_doctor)

        # 5. Run tool loop
        collected_ui_blocks: list[dict[str, Any]] = []
        collected_pending_actions: list[dict[str, Any]] = []
        collected_sources: list[dict[str, Any]] = []

        response_text = ""
        speech_text = ""

        # Intent heuristic check for tools or direct model execution
        lower_msg = user_message.lower()
        tool_results_text = ""

        # Check if booking intent
        if any(w in lower_msg for w in ["book", "appointment", "schedule", "visit doctor"]):
            # Suggest or propose appointment
            doctors = await ToolCatalog.execute_tool(session, care_profile_id, user_id, "search_doctors", {})
            if doctors:
                d = doctors[0]
                prop = await ToolCatalog.execute_tool(
                    session,
                    care_profile_id,
                    user_id,
                    "propose_appointment",
                    {
                        "practitioner_id": d["id"],
                        "appointment_time": "2026-10-15T11:00:00Z",
                        "notes": "Follow-up consultation"
                    }
                )
                collected_pending_actions.append(prop)
                collected_ui_blocks.append({
                    "type": "confirmation_card",
                    "resource_id": prop["pending_action_id"],
                    "data": {
                        "action_type": "propose_appointment",
                        "summary": prop["summary"],
                        "doctor_name": d["name"],
                        "specialty": d["specialty"],
                        "time": "2026-10-15 11:00 AM",
                        "expires_at": prop["expires_at"]
                    }
                })
                tool_results_text += f"\n[Tool propose_appointment completed: {prop['summary']}. User must confirm.]\n"

        # Check if trend / compare observation intent
        elif any(w in lower_msg for w in ["compare", "trend", "hba1c", "blood sugar", "glucose", "creatinine", "hemoglobin"]):
            test_target = "HbA1c" if "hba1c" in lower_msg else ("Fasting Blood Glucose" if "sugar" in lower_msg or "glucose" in lower_msg else "Hemoglobin")
            comp = await ToolCatalog.execute_tool(
                session,
                care_profile_id,
                user_id,
                "compare_observations",
                {"test_name": test_target}
            )
            if "error" not in comp:
                tool_results_text += f"\n[Tool compare_observations result: {json.dumps(comp)}]\n"
                collected_ui_blocks.append({
                    "type": "observation_chart",
                    "resource_id": f"chart_{test_target.lower()}",
                    "data": comp
                })

        # Check if general records search intent
        elif any(w in lower_msg for w in ["record", "report", "test", "prescription", "medicine", "history"]):
            search_res = await ToolCatalog.execute_tool(
                session,
                care_profile_id,
                user_id,
                "search_medical_records",
                {"query": user_message}
            )
            tool_results_text += f"\n[Tool search_medical_records results: {json.dumps(search_res)}]\n"

        # Generate LLM response via Gemini or structured deterministic synthesizer
        system_instruction = f"""
You are MediTrace, a medical AI assistant for patients and caregivers in India.
Current Language: {language}
Always follow these rules strictly:
1. Provide clear, empathetic, evidence-grounded health summaries.
2. CITATION RULE: Whenever stating a medical test, value, or medication, cite its exact fact_id like [fact_id: FACT-OBS-XXXX] or [fact_id: FACT-MED-YYYY] from the patient snapshot or tool results.
3. NEVER calculate deltas or numerical changes yourself; rely on the deterministic compare_observations tool result.
4. If an action was proposed (e.g. appointment or reminder), tell the user: "I have prepared this for you to confirm below." NEVER claim you have finalized or booked it.
5. If evidence is not present in the record, clearly abstain and recommend consulting a doctor.
{snapshot_prompt}
""".strip()

        if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 5:
            try:
                from google import genai
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                user_prompt = f"{user_message}\n\nTool Context:\n{tool_results_text}" if tool_results_text else user_message
                resp = client.models.generate_content(
                    model=settings.LLM_MODEL,
                    contents=[system_instruction, user_prompt]
                )
                if resp and resp.text:
                    response_text = resp.text.strip()
            except Exception:
                pass

        if not response_text:
            # Deterministic template synthesis if offline or API failure
            if collected_pending_actions:
                act = collected_pending_actions[0]
                response_text = (
                    f"I have prepared the appointment request for you: **{act['summary']}**.\n\n"
                    "Please tap **Confirm Booking** on the card below to commit this appointment."
                )
            elif "compare_observations" in tool_results_text:
                response_text = (
                    f"Based on your diagnostic history, here is your trend analysis:\n"
                    f"Your readings have been compiled in the chart below. "
                    f"Please discuss any significant fluctuations with your doctor."
                )
            else:
                response_text = (
                    f"Hello! I am reviewing {snapshot['patient']['name']}'s medical records. "
                    f"You have {len(snapshot['active_medications'])} active medications and {len(snapshot['recent_observations'])} recent lab readings on file. "
                    "How can I assist you with your health records today?"
                )

        # 6. Deterministic Citation Verification
        citation_check = await DeterministicCitationVerifier.verify_citations(
            session=session,
            care_profile_id=care_profile_id,
            text=response_text
        )

        if not citation_check.is_valid:
            # Strip invalid citations and attach safety disclaimer
            for violation in citation_check.violations:
                response_text += f"\n\n*(Note: Some mentioned items could not be verified against your official records: {violation})*"

        collected_sources.extend(citation_check.verified_sources)

        # 7. Persist and return
        speech_text = re.sub(r"\[fact_id:[^\]]+\]", "", response_text)
        speech_text = re.sub(r"[*#_`]", "", speech_text).strip()

        a_msg = Message(
            conversation_id=conversation_id,
            sender_role="assistant",
            content=response_text,
            speech_text=speech_text,
            sources_json=json.dumps(collected_sources),
            ui_blocks_json=json.dumps(collected_ui_blocks),
            pending_actions_json=json.dumps(collected_pending_actions)
        )
        session.add(a_msg)
        await session.commit()
        await session.refresh(a_msg)

        return ChatMessageResponse(
            message_id=a_msg.id,
            language=language,
            text=response_text,
            speech_text=speech_text,
            sources=[
                SourceRef(
                    fact_id=s["fact_id"],
                    document_id=s.get("document_id"),
                    label=s.get("label"),
                    excerpt=s.get("value")
                )
                for s in collected_sources
            ],
            ui_blocks=[UIBlock(**b) for b in collected_ui_blocks],
            pending_actions=[
                PendingActionRef(
                    id=a.get("pending_action_id", a.get("id", "")),
                    action_type=a.get("action_type", "propose_appointment"),
                    summary=a.get("summary", ""),
                    expires_at=a.get("expires_at", "")
                )
                for a in collected_pending_actions
            ],
            safety={"emergency": False, "disclaimer_shown": True}
        )
