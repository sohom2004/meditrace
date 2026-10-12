import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from app.db.session import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    full_name = Column(String(120), nullable=False)
    role = Column(String(20), default="patient")  # patient, practitioner, admin
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class CareProfile(Base):
    __tablename__ = "care_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    full_name = Column(String(120), nullable=False)
    relationship = Column(String(30), default="self")  # self, father, mother, child, spouse, other
    date_of_birth = Column(String(20), nullable=True)  # YYYY-MM-DD
    gender = Column(String(20), default="Unknown")
    blood_group = Column(String(10), nullable=True)
    abha_address = Column(String(50), nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class CareProfileMember(Base):
    __tablename__ = "care_profile_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    role = Column(String(20), default="owner")  # owner, caregiver, viewer
    created_at = Column(DateTime(timezone=True), default=utc_now)


class PractitionerProfile(Base):
    __tablename__ = "practitioner_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(120), nullable=False)
    council_reg_number = Column(String(60), nullable=False)
    council_name = Column(String(100), default="State Medical Council (India)")
    specialty = Column(String(100), default="General Medicine")
    qualification = Column(String(100), default="MBBS, MD")
    is_verified = Column(Boolean, default=True)
    verification_date = Column(DateTime(timezone=True), nullable=True)
    bio = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class AccessGrant(Base):
    __tablename__ = "access_grants"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    practitioner_id = Column(String(36), ForeignKey("practitioner_profiles.id"), nullable=False, index=True)
    purpose = Column(String(100), default="clinical_consultation")
    valid_from = Column(DateTime(timezone=True), default=utc_now)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_revoked = Column(Boolean, default=False)
    permissions_json = Column(Text, default="all")
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    policy_version = Column(String(20), default="DPDP_2026_V1")
    purpose = Column(String(100), nullable=False)
    granted_at = Column(DateTime(timezone=True), default=utc_now)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    uploaded_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, default=0)
    checksum = Column(String(64), index=True, nullable=False)  # SHA-256
    status = Column(String(30), default="uploaded")  # uploaded, scanning, queued, processing, needs_review, completed, failed
    created_at = Column(DateTime(timezone=True), default=utc_now)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    status = Column(String(30), default="queued")  # queued, processing, needs_review, completed, failed
    error_message = Column(Text, nullable=True)
    attempt_count = Column(Integer, default=0)
    parser_type = Column(String(40), default="auto_router")  # pdf_digital, layout_ai, vision_handwriting
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ExtractionRun(Base):
    __tablename__ = "extraction_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    extractor_version = Column(String(30), default="v2.1")
    raw_output_json = Column(Text, nullable=True)
    run_at = Column(DateTime(timezone=True), default=utc_now)


class ClinicalObservation(Base):
    __tablename__ = "clinical_observations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    fact_id = Column(String(60), unique=True, index=True, nullable=False)  # Stable fact identifier (e.g. FACT-OBS-xxxx)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True, index=True)
    code_loinc = Column(String(30), index=True, nullable=True)
    display_name = Column(String(150), index=True, nullable=False)
    category = Column(String(50), default="laboratory")
    value_numeric = Column(Float, nullable=True)
    value_text = Column(String(100), nullable=True)
    unit = Column(String(30), nullable=True)
    reference_range_low = Column(Float, nullable=True)
    reference_range_high = Column(Float, nullable=True)
    flag = Column(String(20), default="normal")  # normal, abnormal, critical_high, critical_low
    observed_at = Column(DateTime(timezone=True), default=utc_now)
    confidence = Column(Float, default=1.0)
    verification_status = Column(String(30), default="unreviewed")  # unreviewed, patient_confirmed, clinician_verified, corrected, rejected
    provenance_json = Column(Text, nullable=True)  # page, bounding_box, raw_excerpt
    created_at = Column(DateTime(timezone=True), default=utc_now)


class MedicationStatement(Base):
    __tablename__ = "medication_statements"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    fact_id = Column(String(60), unique=True, index=True, nullable=False)  # FACT-MED-xxxx
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True, index=True)
    medicine_name = Column(String(150), nullable=False)
    generic_name = Column(String(150), nullable=True)
    atc_code = Column(String(20), nullable=True)
    dosage = Column(String(60), nullable=True)
    frequency = Column(String(60), nullable=True)
    duration = Column(String(60), nullable=True)
    route = Column(String(30), default="oral")
    instructions = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    confidence = Column(Float, default=1.0)
    verification_status = Column(String(30), default="unreviewed")  # unreviewed, patient_confirmed, clinician_verified, corrected
    provenance_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Condition(Base):
    __tablename__ = "conditions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    fact_id = Column(String(60), unique=True, index=True, nullable=False)  # FACT-COND-xxxx
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True)
    code_snomed = Column(String(30), nullable=True)
    name = Column(String(150), nullable=False)
    clinical_status = Column(String(30), default="active")
    verification_status = Column(String(30), default="unreviewed")
    observed_at = Column(DateTime(timezone=True), default=utc_now)
    provenance_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Allergy(Base):
    __tablename__ = "allergies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    fact_id = Column(String(60), unique=True, index=True, nullable=False)  # FACT-ALLERGY-xxxx
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True)
    allergen = Column(String(120), nullable=False)
    reaction = Column(String(150), nullable=True)
    severity = Column(String(30), default="moderate")  # mild, moderate, severe, fatal
    verification_status = Column(String(30), default="unreviewed")
    provenance_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # lab_report, prescription, consultation, vitals, condition
    event_date = Column(DateTime(timezone=True), nullable=False)
    title = Column(String(180), nullable=False)
    summary = Column(Text, nullable=False)
    source_fact_id = Column(String(60), nullable=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    page_number = Column(Integer, default=1)
    chunk_text = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # JSON array of floats for portable similarity calculation
    index_version = Column(String(20), default="v1")
    created_at = Column(DateTime(timezone=True), default=utc_now)


class PatientSnapshot(Base):
    __tablename__ = "patient_snapshots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), unique=True, nullable=False, index=True)
    snapshot_json = Column(Text, nullable=False)  # Allergies, active meds, recent key labs, upcoming appointments
    version = Column(Integer, default=1)
    updated_at = Column(DateTime(timezone=True), default=utc_now)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(150), default="Health Assistant Conversation")
    channel = Column(String(20), default="text")  # text, voice
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    sender_role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    speech_text = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)  # [{fact_id, document_id, page}]
    ui_blocks_json = Column(Text, nullable=True)  # [{type, resource_id, data}]
    pending_actions_json = Column(Text, nullable=True)  # [{id, summary, expires_at}]
    created_at = Column(DateTime(timezone=True), default=utc_now)


class PendingAction(Base):
    __tablename__ = "pending_actions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    action_type = Column(String(50), nullable=False)  # propose_appointment, propose_cancellation, propose_reminder, propose_refill_request
    summary = Column(String(255), nullable=False)
    payload_json = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="pending")  # pending, confirmed, rejected, expired
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    practitioner_id = Column(String(36), ForeignKey("practitioner_profiles.id"), nullable=False, index=True)
    appointment_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="scheduled")  # scheduled, completed, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    practitioner_id = Column(String(36), ForeignKey("practitioner_profiles.id"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_booked = Column(Boolean, default=False)


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    remind_at = Column(DateTime(timezone=True), nullable=False)
    channel = Column(String(20), default="push")  # push, whatsapp, sms
    status = Column(String(20), default="pending")  # pending, sent, cancelled
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    practitioner_id = Column(String(36), ForeignKey("practitioner_profiles.id"), nullable=False, index=True)
    diagnosis = Column(String(255), nullable=False)
    medications_json = Column(Text, nullable=False)  # array of prescribed meds
    instructions = Column(Text, nullable=True)
    is_signed = Column(Boolean, default=False)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signature_hash = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_type = Column(String(60), nullable=False)  # document_extracted, fact_updated, appointment_booked, etc.
    aggregate_id = Column(String(36), nullable=False)
    payload_json = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending, processed
    created_at = Column(DateTime(timezone=True), default=utc_now)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True)
    care_profile_id = Column(String(36), nullable=True)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=False)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)


class DoctorPatientMessage(Base):
    __tablename__ = "doctor_patient_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    practitioner_id = Column(String(36), ForeignKey("practitioner_profiles.id"), nullable=False, index=True)
    sender_role = Column(String(20), nullable=False)  # "patient" or "doctor"
    content = Column(Text, nullable=False)
    attachment_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class MedicineOrder(Base):
    __tablename__ = "medicine_orders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    care_profile_id = Column(String(36), ForeignKey("care_profiles.id"), nullable=False, index=True)
    items_json = Column(Text, nullable=False)  # JSON array of medicines and quantities
    delivery_address = Column(String(255), nullable=False)
    status = Column(String(30), default="processing")  # processing, dispatched, delivered
    total_estimate = Column(Float, default=450.0)  # INR
    created_at = Column(DateTime(timezone=True), default=utc_now)

