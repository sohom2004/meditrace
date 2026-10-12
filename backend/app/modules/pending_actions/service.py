import json
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.errors import NotFoundError, ValidationError
from app.db.models import (
    Appointment,
    AvailabilitySlot,
    OutboxEvent,
    PendingAction,
    Reminder,
)

class PendingActionService:
    @staticmethod
    async def create_pending_action(
        session: AsyncSession,
        care_profile_id: str,
        user_id: str,
        action_type: str,
        summary: str,
        payload: dict[str, Any],
        duration_minutes: int = 15
    ) -> PendingAction:
        """Assistant tools invoke this to propose an action without committing it."""
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
        action = PendingAction(
            care_profile_id=care_profile_id,
            user_id=user_id,
            action_type=action_type,
            summary=summary,
            payload_json=json.dumps(payload),
            expires_at=expires_at,
            status="pending"
        )
        session.add(action)
        await session.commit()
        await session.refresh(action)
        return action

    @staticmethod
    async def confirm_action(
        session: AsyncSession,
        action_id: str,
        user_id: str
    ) -> dict[str, Any]:
        """User or clinician commits the action via authenticated API call."""
        res = await session.execute(
            select(PendingAction).where(PendingAction.id == action_id)
        )
        action = res.scalar_one_or_none()
        if not action:
            raise NotFoundError(f"PendingAction {action_id} not found")

        if action.status != "pending":
            raise ValidationError(f"Action {action_id} is already {action.status}")

        now = datetime.now(timezone.utc)
        if action.expires_at.replace(tzinfo=timezone.utc) < now:
            action.status = "expired"
            await session.commit()
            raise ValidationError(f"Action {action_id} has expired")

        payload = json.loads(action.payload_json)
        result_details: dict[str, Any] = {}

        # Commit deterministic service action according to type
        if action.action_type == "propose_appointment":
            practitioner_id = payload["practitioner_id"]
            appointment_time = datetime.fromisoformat(payload["appointment_time"])
            notes = payload.get("notes", "")

            # Create Appointment
            appt = Appointment(
                care_profile_id=action.care_profile_id,
                practitioner_id=practitioner_id,
                appointment_time=appointment_time,
                status="scheduled",
                notes=notes
            )
            session.add(appt)
            result_details = {
                "appointment_id": appt.id,
                "practitioner_id": practitioner_id,
                "appointment_time": payload["appointment_time"],
                "status": "scheduled"
            }

        elif action.action_type == "propose_cancellation":
            appointment_id = payload["appointment_id"]
            appt_res = await session.execute(
                select(Appointment).where(Appointment.id == appointment_id)
            )
            appt = appt_res.scalar_one_or_none()
            if appt:
                appt.status = "cancelled"
            result_details = {"appointment_id": appointment_id, "status": "cancelled"}

        elif action.action_type == "propose_reminder":
            title = payload["title"]
            remind_at = datetime.fromisoformat(payload["remind_at"])
            channel = payload.get("channel", "push")

            rem = Reminder(
                care_profile_id=action.care_profile_id,
                user_id=user_id,
                title=title,
                remind_at=remind_at,
                channel=channel,
                status="pending"
            )
            session.add(rem)
            result_details = {
                "reminder_id": rem.id,
                "title": title,
                "remind_at": payload["remind_at"],
                "channel": channel
            }

        elif action.action_type == "propose_refill_request":
            result_details = {
                "medicine_name": payload.get("medicine_name"),
                "status": "submitted_to_doctor",
                "request_id": action.id
            }

        # Mark action as confirmed
        action.status = "confirmed"

        # Emit Outbox Event for background notifications
        outbox = OutboxEvent(
            event_type="action_committed",
            aggregate_id=action.id,
            payload_json=json.dumps({"action_type": action.action_type, "details": result_details})
        )
        session.add(outbox)

        await session.commit()
        return {
            "action_id": action.id,
            "status": "confirmed",
            "summary": action.summary,
            "committed_data": result_details
        }

    @staticmethod
    async def reject_action(session: AsyncSession, action_id: str) -> dict[str, Any]:
        res = await session.execute(
            select(PendingAction).where(PendingAction.id == action_id)
        )
        action = res.scalar_one_or_none()
        if not action:
            raise NotFoundError(f"PendingAction {action_id} not found")
        action.status = "rejected"
        await session.commit()
        return {"action_id": action.id, "status": "rejected"}
