from __future__ import annotations
import json
import logging
from typing import Any
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobExecutorType,
    TurnHandlingOptions,
    function_tool,
)
from app.core.config import settings
from app.db.session import async_session_maker
from app.modules.assistant.tools.catalog import ToolCatalog
from app.voice.bridge import publish_event, set_active_room

logger = logging.getLogger("meditrace.voice_agent")


def build_voice_system_prompt(snapshot_markdown: str, language: str = "en") -> str:
    return f"""
You are the voice interface of MediTrace, an empathetic and concise AI medical assistant in India.
Preferred Language: {language}

IMPORTANT VOICE RULES:
1. Speak in natural, warm, and concise spoken sentences (1-3 sentences per turn).
2. Avoid bullet points, asterisks, or markdown symbols when speaking.
3. GROUNDING & PROPOSING: If the user wants to book an appointment or set a reminder, call the appropriate proposing tool.
   Always say: "I have prepared this for you to confirm on your screen", NEVER claim it is already finalized.
4. If the user mentions emergency red-flag symptoms (severe chest pain, choking, severe bleeding, stroke symptoms), immediately say:
   "This sounds like an urgent medical emergency. Please call 112 or 108 immediately or go to the nearest emergency room."
5. Never perform numerical delta math yourself; call compare_observations for test comparisons.

{snapshot_markdown}
""".strip()


# LiveKit Agent server setup
server = AgentServer(
    job_executor_type=JobExecutorType.THREAD,
    num_idle_processes=1,
)


@server.rtc_session()
async def voice_entrypoint(ctx: JobContext):
    await ctx.connect()
    set_active_room(ctx.room)

    # Extract care_profile_id & language from room metadata
    meta = {}
    try:
        meta = json.loads(ctx.room.metadata or "{}")
    except Exception:
        meta = {}

    care_profile_id = meta.get("care_profile_id", "default_profile")
    user_id = meta.get("user_id", "default_user")
    language = meta.get("language", "en")

    # Load patient snapshot for voice instructions
    async with async_session_maker() as db_session:
        from app.modules.assistant.snapshot import PatientSnapshotService
        snapshot = await PatientSnapshotService.compute_snapshot(db_session, care_profile_id)
        snapshot_md = PatientSnapshotService.format_snapshot_for_prompt(snapshot)

    instructions = build_voice_system_prompt(snapshot_md, language=language)

    # Define Fast-Path Voice Tools with UI Event Publishing
    @function_tool
    async def get_patient_snapshot() -> str:
        """Retrieves patient health snapshot (allergies, meds, latest labs)."""
        await publish_event({"type": "model_activity", "phase": "start", "tool": "get_patient_snapshot", "text": "Accessing health snapshot..."})
        async with async_session_maker() as sess:
            res = await ToolCatalog.execute_tool(sess, care_profile_id, user_id, "get_patient_snapshot", {})
        await publish_event({"type": "model_activity", "phase": "done", "tool": "get_patient_snapshot", "text": "Snapshot retrieved"})
        return json.dumps(res, default=str)

    @function_tool
    async def search_medical_records(query: str) -> str:
        """Searches patient's documents, lab reports, and clinical history."""
        await publish_event({"type": "model_activity", "phase": "start", "tool": "search_medical_records", "text": f"Searching records for '{query}'..."})
        async with async_session_maker() as sess:
            res = await ToolCatalog.execute_tool(sess, care_profile_id, user_id, "search_medical_records", {"query": query})
        await publish_event({"type": "model_activity", "phase": "done", "tool": "search_medical_records", "text": "Search completed"})
        return json.dumps(res, default=str)

    @function_tool
    async def compare_observations(test_name: str) -> str:
        """Deterministically compares lab test trends (e.g. HbA1c, Fasting Glucose)."""
        await publish_event({"type": "model_activity", "phase": "start", "tool": "compare_observations", "text": f"Calculating trend for {test_name}..."})
        async with async_session_maker() as sess:
            res = await ToolCatalog.execute_tool(sess, care_profile_id, user_id, "compare_observations", {"test_name": test_name})
        await publish_event({"type": "model_activity", "phase": "done", "tool": "compare_observations", "text": "Observation trend ready", "chart_data": res})
        return json.dumps(res, default=str)

    @function_tool
    async def propose_appointment(practitioner_id: str, appointment_time: str, notes: str = "") -> str:
        """Proposes an appointment for the user to confirm on the glassmorphism screen."""
        await publish_event({"type": "model_activity", "phase": "start", "tool": "propose_appointment", "text": "Preparing appointment confirmation card..."})
        async with async_session_maker() as sess:
            res = await ToolCatalog.execute_tool(
                sess, care_profile_id, user_id, "propose_appointment",
                {"practitioner_id": practitioner_id, "appointment_time": appointment_time, "notes": notes}
            )
        await publish_event({"type": "pending_action_created", "action": res})
        await publish_event({"type": "model_activity", "phase": "done", "tool": "propose_appointment", "text": "Confirmation card sent to screen"})
        return json.dumps(res, default=str)

    # Gemini Live Model configuration
    api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
    if not api_key:
        logger.warning("No GEMINI_API_KEY configured for LiveKit RealtimeModel")
        return

    from livekit.plugins import google
    from google.genai import types as genai_types

    session = AgentSession(
        turn_handling=TurnHandlingOptions(
            turn_detection="realtime_llm",
            interruption={
                "enabled": True,
                "min_duration": 0.28,
                "min_words": 0,
                "resume_false_interruption": False,
                "false_interruption_timeout": 1.0,
            },
        ),
        llm=google.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice="Kore",
            api_key=api_key,
            instructions=instructions,
            realtime_input_config=genai_types.RealtimeInputConfig(
                activity_handling=genai_types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
                automatic_activity_detection=genai_types.AutomaticActivityDetection(
                    disabled=False,
                    start_of_speech_sensitivity=genai_types.StartSensitivity.START_SENSITIVITY_HIGH,
                    end_of_speech_sensitivity=genai_types.EndSensitivity.END_SENSITIVITY_LOW,
                    prefix_padding_ms=10,
                    silence_duration_ms=450,
                ),
            ),
        ),
    )

    agent = Agent(
        instructions=instructions,
        tools=[
            get_patient_snapshot,
            search_medical_records,
            compare_observations,
            propose_appointment,
        ]
    )

    await session.start(agent, ctx.room)
