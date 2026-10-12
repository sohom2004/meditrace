import json
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import (
    ClinicalObservation,
    Document,
    MedicationStatement,
    OutboxEvent,
    TimelineEvent,
)
from app.modules.assistant.snapshot import PatientSnapshotService


class ProjectionWorker:
    @staticmethod
    async def process_outbox_event(session: AsyncSession, event_id: str) -> None:
        """Processes transactional outbox events to maintain eventual consistency of relational projections."""
        ev_res = await session.execute(select(OutboxEvent).where(OutboxEvent.id == event_id))
        event = ev_res.scalar_one_or_none()
        if not event or event.status == "processed":
            return

        payload = json.loads(event.payload_json)

        if event.event_type == "document_ingested":
            care_profile_id = payload["care_profile_id"]
            document_id = payload["document_id"]
            filename = payload.get("filename", "Medical Document")

            # 1. Project into Timeline
            # Add Document Upload event
            tl_doc = TimelineEvent(
                care_profile_id=care_profile_id,
                event_type="document_uploaded",
                event_date=datetime.now(timezone.utc),
                title=f"New Record Uploaded: {filename}",
                summary=f"Processed diagnostic record containing {payload.get('obs_count', 0)} observations and {payload.get('med_count', 0)} medications.",
                document_id=document_id
            )
            session.add(tl_doc)

            # 2. Recompute and cache PatientSnapshot
            await PatientSnapshotService.compute_snapshot(session, care_profile_id)

        elif event.event_type == "action_committed":
            pass

        event.status = "processed"
        await session.commit()
