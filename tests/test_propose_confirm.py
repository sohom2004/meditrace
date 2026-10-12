import pytest
from app.core.errors import ValidationError
from app.modules.pending_actions.service import PendingActionService


@pytest.mark.asyncio
async def test_propose_and_confirm_appointment(db_session):
    # Assistant proposes an appointment
    pending = await PendingActionService.create_pending_action(
        session=db_session,
        care_profile_id="cp-ramesh-father",
        user_id="usr-patient-aarav",
        action_type="propose_appointment",
        summary="Appointment with Dr. Ananya Mukherjee for 2026-10-16 10:30 AM",
        payload={
            "practitioner_id": "doc-ananya-mukherjee",
            "appointment_time": "2026-10-16T10:30:00Z",
            "notes": "Quarterly diabetic review"
        }
    )
    assert pending.status == "pending"

    # User confirms action via API
    confirmed = await PendingActionService.confirm_action(
        session=db_session,
        action_id=pending.id,
        user_id="usr-patient-aarav"
    )
    assert confirmed["status"] == "confirmed"
    assert "appointment_id" in confirmed["committed_data"]

    # Re-confirming an already confirmed action must fail with ValidationError
    with pytest.raises(ValidationError):
        await PendingActionService.confirm_action(
            session=db_session,
            action_id=pending.id,
            user_id="usr-patient-aarav"
        )
