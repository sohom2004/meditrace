import hashlib
import json
import os
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.errors import NotFoundError, ValidationError
from app.db.models import (
    Allergy,
    ClinicalObservation,
    Condition,
    Document,
    DocumentChunk,
    ExtractionRun,
    IngestionJob,
    MedicationStatement,
    OutboxEvent,
    TimelineEvent,
)
from app.modules.ingestion.extractor import DocumentExtractor
from app.workers.projections import ProjectionWorker


class IngestionService:
    @staticmethod
    async def initiate_upload(
        session: AsyncSession,
        care_profile_id: str,
        user_id: str,
        filename: str,
        mime_type: str,
        size_bytes: int
    ) -> dict[str, str]:
        """Generates direct presigned upload endpoint and registers document record."""
        # Ensure local storage folder exists if using local storage
        storage_dir = Path(settings.STORAGE_DIR)
        storage_dir.mkdir(parents=True, exist_ok=True)

        doc = Document(
            care_profile_id=care_profile_id,
            uploaded_by_user_id=user_id,
            filename=filename,
            file_path=str(storage_dir / filename),
            mime_type=mime_type,
            size_bytes=size_bytes,
            checksum="",  # Populated on complete
            status="uploaded"
        )
        session.add(doc)
        await session.commit()
        await session.refresh(doc)

        upload_url = f"/api/v1/uploads/{doc.id}/file"
        return {
            "upload_url": upload_url,
            "document_id": doc.id,
            "storage_key": doc.file_path
        }

    @staticmethod
    async def process_document_content(
        session: AsyncSession,
        document_id: str,
        file_bytes: bytes,
        checksum: str | None = None
    ) -> Document:
        """Processes uploaded document bytes, verifies checksum & deduplication, runs extraction, and projects facts."""
        res = await session.execute(select(Document).where(Document.id == document_id))
        doc = res.scalar_one_or_none()
        if not doc:
            raise NotFoundError(f"Document {document_id} not found")

        computed_sha = hashlib.sha256(file_bytes).hexdigest()
        if checksum and checksum != computed_sha:
            raise ValidationError(f"Checksum mismatch: received {checksum}, computed {computed_sha}")

        doc.checksum = computed_sha
        doc.size_bytes = len(file_bytes)

        # Deduplication check: check if same document was already completed for this care profile
        dup_res = await session.execute(
            select(Document).where(
                Document.care_profile_id == doc.care_profile_id,
                Document.checksum == computed_sha,
                Document.id != doc.id,
                Document.status.in_(["completed", "needs_review"])
            )
        )
        existing_dup = dup_res.scalar_one_or_none()
        if existing_dup:
            doc.status = "completed"
            await session.commit()
            return doc

        # Save physical file
        with open(doc.file_path, "wb") as f:
            f.write(file_bytes)

        # Create IngestionJob
        job = IngestionJob(
            document_id=doc.id,
            care_profile_id=doc.care_profile_id,
            status="processing",
            parser_type=DocumentExtractor.route_document(doc.filename, doc.mime_type)
        )
        session.add(job)
        await session.commit()

        # Run extraction
        extracted = await DocumentExtractor.extract_structured_facts(
            file_content=file_bytes,
            filename=doc.filename,
            mime_type=doc.mime_type
        )

        # Save ExtractionRun
        run = ExtractionRun(
            document_id=doc.id,
            extractor_version="v2.1",
            raw_output_json=json.dumps(extracted)
        )
        session.add(run)

        requires_review = False

        # Persist Clinical Observations
        for o in extracted.get("observations", []):
            if o.get("requires_review_prompt"):
                requires_review = True
            obs = ClinicalObservation(
                fact_id=o["fact_id"],
                care_profile_id=doc.care_profile_id,
                document_id=doc.id,
                code_loinc=o.get("code_loinc"),
                display_name=o["display_name"],
                category=o.get("category", "laboratory"),
                value_numeric=o.get("value_numeric"),
                unit=o.get("unit"),
                reference_range_low=o.get("reference_range_low"),
                reference_range_high=o.get("reference_range_high"),
                flag=o.get("flag", "normal"),
                confidence=o.get("confidence", 1.0),
                verification_status=o.get("verification_status", "unreviewed"),
                provenance_json=json.dumps(o.get("provenance", {}))
            )
            session.add(obs)

        # Persist Medications
        for m in extracted.get("medications", []):
            if m.get("requires_review_prompt"):
                requires_review = True
            med = MedicationStatement(
                fact_id=m["fact_id"],
                care_profile_id=doc.care_profile_id,
                document_id=doc.id,
                medicine_name=m["medicine_name"],
                generic_name=m.get("generic_name"),
                atc_code=m.get("atc_code"),
                dosage=m.get("dosage"),
                frequency=m.get("frequency"),
                duration=m.get("duration"),
                confidence=m.get("confidence", 1.0),
                verification_status=m.get("verification_status", "unreviewed"),
                provenance_json=json.dumps(m.get("provenance", {}))
            )
            session.add(med)

        # Persist Conditions
        for c in extracted.get("conditions", []):
            cond = Condition(
                fact_id=c["fact_id"],
                care_profile_id=doc.care_profile_id,
                document_id=doc.id,
                name=c["name"],
                clinical_status=c.get("clinical_status", "active"),
                verification_status=c.get("verification_status", "unreviewed"),
                provenance_json=json.dumps(c.get("provenance", {}))
            )
            session.add(cond)

        # Persist Allergies
        for a in extracted.get("allergies", []):
            if a.get("requires_review_prompt"):
                requires_review = True
            alg = Allergy(
                fact_id=a["fact_id"],
                care_profile_id=doc.care_profile_id,
                document_id=doc.id,
                allergen=a["allergen"],
                reaction=a.get("reaction"),
                severity=a.get("severity", "moderate"),
                verification_status=a.get("verification_status", "unreviewed"),
                provenance_json=json.dumps(a.get("provenance", {}))
            )
            session.add(alg)

        # Generate Document Chunk for Hybrid Search
        summary_text = (
            f"Document: {doc.filename}. Contains observations: "
            + ", ".join(f"{o['display_name']} ({o.get('value_numeric')})" for o in extracted.get("observations", []))
            + ". Medications: "
            + ", ".join(m['medicine_name'] for m in extracted.get("medications", []))
        )
        chunk = DocumentChunk(
            care_profile_id=doc.care_profile_id,
            document_id=doc.id,
            page_number=1,
            chunk_text=summary_text,
            embedding_json=None  # Can be populated via embedding model
        )
        session.add(chunk)

        # Update Job and Doc status
        doc.status = "needs_review" if requires_review else "completed"
        job.status = doc.status

        # Emit Outbox Event
        outbox = OutboxEvent(
            event_type="document_ingested",
            aggregate_id=doc.id,
            payload_json=json.dumps({
                "care_profile_id": doc.care_profile_id,
                "document_id": doc.id,
                "filename": doc.filename,
                "obs_count": len(extracted.get("observations", [])),
                "med_count": len(extracted.get("medications", []))
            })
        )
        session.add(outbox)
        await session.commit()

        # Build Connected Clinical Graph Subgraph with report mapping & temporal comparisons
        from app.modules.graph_memory.service import GraphMemoryService
        await GraphMemoryService.build_document_subgraph(
            session=session,
            care_profile_id=doc.care_profile_id,
            document_id=doc.id,
            extracted_facts=extracted
        )

        # Trigger projection update
        await ProjectionWorker.process_outbox_event(session, outbox.id)

        return doc
