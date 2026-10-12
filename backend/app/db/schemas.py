from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    phone: str
    full_name: str
    role: str = "patient"


class UserCreate(UserBase):
    pass


class UserRead(UserBase):
    id: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


class CareProfileBase(BaseModel):
    full_name: str
    relationship: str = "self"
    date_of_birth: str | None = None
    gender: str = "Unknown"
    blood_group: str | None = None
    abha_address: str | None = None


class CareProfileCreate(CareProfileBase):
    pass


class CareProfileRead(CareProfileBase):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CareProfileMemberRead(BaseModel):
    id: str
    user_id: str
    care_profile_id: str
    role: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PractitionerProfileCreate(BaseModel):
    name: str
    council_reg_number: str
    council_name: str = "State Medical Council (India)"
    specialty: str = "General Medicine"
    qualification: str = "MBBS, MD"
    bio: str | None = None


class PractitionerProfileRead(BaseModel):
    id: str
    user_id: str
    name: str
    council_reg_number: str
    council_name: str
    specialty: str
    qualification: str
    is_verified: bool
    verification_date: datetime | None
    bio: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AccessGrantCreate(BaseModel):
    care_profile_id: str
    practitioner_id: str
    purpose: str = "clinical_consultation"
    valid_until: datetime | None = None
    permissions: str = "all"


class AccessGrantRead(BaseModel):
    id: str
    care_profile_id: str
    practitioner_id: str
    purpose: str
    valid_from: datetime
    valid_until: datetime | None
    is_revoked: bool
    permissions_json: str
    model_config = ConfigDict(from_attributes=True)


class ConsentRecordCreate(BaseModel):
    care_profile_id: str
    purpose: str
    policy_version: str = "DPDP_2026_V1"


class ConsentRecordRead(BaseModel):
    id: str
    care_profile_id: str
    user_id: str
    policy_version: str
    purpose: str
    granted_at: datetime
    revoked_at: datetime | None
    model_config = ConfigDict(from_attributes=True)


class UploadPresignRequest(BaseModel):
    care_profile_id: str
    filename: str
    mime_type: str
    size_bytes: int


class UploadPresignResponse(BaseModel):
    upload_url: str
    document_id: str
    storage_key: str
    required_headers: dict[str, str] = {}


class UploadCompleteRequest(BaseModel):
    document_id: str
    checksum: str  # sha-256


class DocumentRead(BaseModel):
    id: str
    care_profile_id: str
    filename: str
    mime_type: str
    size_bytes: int
    checksum: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class IngestionJobRead(BaseModel):
    id: str
    document_id: str
    care_profile_id: str
    status: str
    error_message: str | None
    attempt_count: int
    parser_type: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ClinicalObservationRead(BaseModel):
    id: str
    fact_id: str
    care_profile_id: str
    document_id: str | None
    code_loinc: str | None
    display_name: str
    category: str
    value_numeric: float | None
    value_text: str | None
    unit: str | None
    reference_range_low: float | None
    reference_range_high: float | None
    flag: str
    observed_at: datetime
    confidence: float
    verification_status: str
    provenance_json: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MedicationStatementRead(BaseModel):
    id: str
    fact_id: str
    care_profile_id: str
    document_id: str | None
    medicine_name: str
    generic_name: str | None
    atc_code: str | None
    dosage: str | None
    frequency: str | None
    duration: str | None
    route: str
    instructions: str | None
    is_active: bool
    confidence: float
    verification_status: str
    provenance_json: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConditionRead(BaseModel):
    id: str
    fact_id: str
    care_profile_id: str
    document_id: str | None
    code_snomed: str | None
    name: str
    clinical_status: str
    verification_status: str
    observed_at: datetime
    provenance_json: str | None
    model_config = ConfigDict(from_attributes=True)


class AllergyRead(BaseModel):
    id: str
    fact_id: str
    care_profile_id: str
    document_id: str | None
    allergen: str
    reaction: str | None
    severity: str
    verification_status: str
    provenance_json: str | None
    model_config = ConfigDict(from_attributes=True)


class TimelineEventRead(BaseModel):
    id: str
    care_profile_id: str
    event_type: str
    event_date: datetime
    title: str
    summary: str
    source_fact_id: str | None
    document_id: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ObservationCompareRequest(BaseModel):
    care_profile_id: str
    test_name: str
    target_unit: str | None = None


class ObservationCompareResponse(BaseModel):
    test_name: str
    normalized_unit: str
    current_value: float
    current_date: str
    previous_value: float | None
    previous_date: str | None
    delta: float | None
    delta_percentage: float | None
    trend_direction: Literal["up", "down", "stable", "first_reading"]
    status_flag: str
    interpretation_note: str


class FactVerificationRequest(BaseModel):
    verification_status: Literal["patient_confirmed", "clinician_verified", "corrected", "rejected"]
    corrected_value: str | None = None


class SourceRef(BaseModel):
    fact_id: str
    document_id: str | None = None
    page: int = 1
    label: str | None = None
    excerpt: str | None = None


class UIBlock(BaseModel):
    type: Literal["observation_chart", "confirmation_card", "emergency_card", "review_card", "doctor_card"]
    resource_id: str
    data: dict[str, Any] = {}


class PendingActionRef(BaseModel):
    id: str
    action_type: str
    summary: str
    expires_at: str


class PendingActionRead(BaseModel):
    id: str
    care_profile_id: str
    user_id: str
    action_type: str
    summary: str
    payload_json: str
    expires_at: datetime
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatMessageRequest(BaseModel):
    care_profile_id: str
    message: str
    language: str = "en"  # en, hi, bn, ta


class ChatMessageResponse(BaseModel):
    message_id: str
    language: str
    text: str
    speech_text: str | None = None
    sources: list[SourceRef] = []
    ui_blocks: list[UIBlock] = []
    pending_actions: list[PendingActionRef] = []
    safety: dict[str, Any] = {"emergency": False, "disclaimer_shown": True}


class ConversationRead(BaseModel):
    id: str
    care_profile_id: str
    user_id: str
    title: str
    channel: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MessageRead(BaseModel):
    id: str
    conversation_id: str
    sender_role: str
    content: str
    speech_text: str | None
    sources_json: str | None
    ui_blocks_json: str | None
    pending_actions_json: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AppointmentCreate(BaseModel):
    care_profile_id: str
    practitioner_id: str
    appointment_time: datetime
    notes: str | None = None


class AppointmentRead(BaseModel):
    id: str
    care_profile_id: str
    practitioner_id: str
    appointment_time: datetime
    status: str
    notes: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReminderCreate(BaseModel):
    care_profile_id: str
    title: str
    remind_at: datetime
    channel: str = "push"


class ReminderRead(BaseModel):
    id: str
    care_profile_id: str
    user_id: str
    title: str
    remind_at: datetime
    channel: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PrescriptionDraftRequest(BaseModel):
    care_profile_id: str
    diagnosis: str
    medications: list[dict[str, Any]]
    instructions: str | None = None


class PrescriptionSignRequest(BaseModel):
    practitioner_signature_pin: str = "1234"


class PrescriptionRead(BaseModel):
    id: str
    care_profile_id: str
    practitioner_id: str
    diagnosis: str
    medications_json: str
    instructions: str | None
    is_signed: bool
    signed_at: datetime | None
    signature_hash: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DoctorBriefingRead(BaseModel):
    care_profile_id: str
    patient_name: str
    data_as_of: datetime
    active_conditions: list[str]
    active_medications: list[dict[str, Any]]
    recent_observations: list[dict[str, Any]]
    allergies: list[str]
    sources: list[SourceRef]
    summary_narrative: str


class DoctorPatientMessageCreate(BaseModel):
    care_profile_id: str
    practitioner_id: str
    content: str
    sender_role: Literal["patient", "doctor"]


class DoctorPatientMessageRead(BaseModel):
    id: str
    care_profile_id: str
    practitioner_id: str
    sender_role: str
    content: str
    attachment_json: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MedicineOrderCreate(BaseModel):
    care_profile_id: str
    delivery_address: str = "Flat 4B, Silver Heights, Salt Lake Sector 5, Kolkata"
    items: list[dict[str, Any]] = []


class MedicineOrderRead(BaseModel):
    id: str
    care_profile_id: str
    items_json: str
    delivery_address: str
    status: str
    total_estimate: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class VoicePrescriptionRequest(BaseModel):
    care_profile_id: str
    dictation_text: str


class VoicePrescriptionResponse(BaseModel):
    diagnosis: str
    medications: list[dict[str, Any]]
    instructions: str | None
    allergy_warning: str | None = None
    is_safe: bool = True


class DoctorVoiceQueryRequest(BaseModel):
    query: str
    patient_id: str | None = None


class DoctorVoiceQueryResponse(BaseModel):
    spoken_answer: str
    text_answer: str
    patient_name: str | None = None
    data_sources: list[dict[str, Any]] = []


class VoiceTurnRequest(BaseModel):
    care_profile_id: str
    speech_input: str
    language: str = "en"


class VoiceTurnResponse(BaseModel):
    transcription: str
    speech_output: str
    text_output: str
    model_activity: str
    sources: list[dict[str, Any]] = []
    pending_actions: list[dict[str, Any]] = []

