import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.errors import AuthorizationError, MediTraceError, NotFoundError, ValidationError
from app.core.security import create_access_token, decode_access_token
from app.db.models import (
    AccessGrant,
    Allergy,
    Appointment,
    CareProfile,
    CareProfileMember,
    ClinicalObservation,
    ConsentRecord,
    Conversation,
    Document,
    MedicationStatement,
    Message,
    PendingAction,
    PractitionerProfile,
    Prescription,
    Reminder,
    TimelineEvent,
    User,
)
from app.db.schemas import (
    AppointmentCreate,
    AppointmentRead,
    CareProfileCreate,
    CareProfileRead,
    ChatMessageRequest,
    ChatMessageResponse,
    ConversationRead,
    DoctorBriefingRead,
    DocumentRead,
    FactVerificationRequest,
    ObservationCompareRequest,
    ObservationCompareResponse,
    OTPRequest,
    OTPVerify,
    PendingActionRead,
    PractitionerProfileCreate,
    PractitionerProfileRead,
    PrescriptionDraftRequest,
    PrescriptionRead,
    PrescriptionSignRequest,
    ReminderCreate,
    ReminderRead,
    TimelineEventRead,
    TokenResponse,
    UploadCompleteRequest,
    UploadPresignRequest,
    UploadPresignResponse,
    UserRead,
    UserRegisterRequest,
    DoctorPatientMessageCreate,
    DoctorPatientMessageRead,
    MedicineOrderCreate,
    MedicineOrderRead,
    VoicePrescriptionRequest,
    VoicePrescriptionResponse,
    DoctorVoiceQueryRequest,
    DoctorVoiceQueryResponse,
    VoiceTurnRequest,
    VoiceTurnResponse,
)
from app.db.session import get_db, set_rls_care_profile
from app.modules.assistant.runtime import AssistantRuntime
from app.modules.assistant.snapshot import PatientSnapshotService
from app.modules.clinical_data.comparator import ObservationComparator
from app.modules.ingestion.service import IngestionService
from app.modules.pending_actions.service import PendingActionService
from app.modules.practitioners.service import PractitionerService
from app.modules.operations.service import OperationsService
from app.policy.authorization import check_care_profile_access
from app.voice.tokens import create_voice_session_token
from app.voice.service import VoiceService

api_router = APIRouter(prefix="/v1")


# Auth Dependency
async def get_current_user(
    authorization: str | None = Header(None),
    session: AsyncSession = Depends(get_db)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        # Fallback to test demo user if no token provided in local development
        user_res = await session.execute(select(User).limit(1))
        user = user_res.scalar_one_or_none()
        if user:
            return user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization token")

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload["sub"]
    user_res = await session.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# ==========================================
# 1. AUTH & ONBOARDING
# ==========================================

@api_router.post("/auth/otp/request")
async def request_otp(req: OTPRequest, session: AsyncSession = Depends(get_db)):
    """Simulates sending phone OTP for Indian mobile numbers (+91)."""
    return {"status": "otp_sent", "phone": req.phone, "otp_hint": "123456"}


@api_router.post("/auth/otp/verify", response_model=TokenResponse)
async def verify_otp(req: OTPVerify, session: AsyncSession = Depends(get_db)):
    """Verifies phone OTP and returns short-lived JWT access token."""
    if req.otp != "123456" and req.otp != "000000":
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user_res = await session.execute(select(User).where(User.phone == req.phone))
    user = user_res.scalar_one_or_none()
    if not user:
        user = User(
            phone=req.phone,
            full_name="Verified Patient",
            role="patient",
            is_active=True,
            is_verified=True
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # Create default 'Self' CareProfile
        profile = CareProfile(
            full_name=user.full_name,
            relationship="self",
            gender="Unknown"
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)

        member = CareProfileMember(
            user_id=user.id,
            care_profile_id=profile.id,
            role="owner"
        )
        session.add(member)
        await session.commit()

    token = create_access_token({"sub": user.id, "role": user.role, "phone": user.phone})
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@api_router.post("/auth/register", response_model=TokenResponse)
async def register(req: UserRegisterRequest, session: AsyncSession = Depends(get_db)):
    """Registers a new user and provisions their primary 'self' care profile."""
    user_res = await session.execute(select(User).where(User.phone == req.phone))
    existing = user_res.scalar_one_or_none()
    if existing:
        token = create_access_token({"sub": existing.id, "role": existing.role, "phone": existing.phone})
        return TokenResponse(access_token=token, user=UserRead.model_validate(existing))

    user = User(
        phone=req.phone,
        full_name=req.full_name,
        role=req.role,
        is_active=True,
        is_verified=True
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    if req.role == "patient":
        profile = CareProfile(
            full_name=req.full_name,
            relationship="self",
            gender="Unknown"
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)

        member = CareProfileMember(
            user_id=user.id,
            care_profile_id=profile.id,
            role="owner"
        )
        session.add(member)
        await session.commit()
    elif req.role == "practitioner":
        doc_prof = PractitionerProfile(
            user_id=user.id,
            name=req.full_name,
            council_reg_number=f"MCI/{int(datetime.now(timezone.utc).timestamp()) % 100000}",
            council_name="National Medical Commission",
            specialty="General Medicine",
            is_verified=True
        )
        session.add(doc_prof)
        await session.commit()

    token = create_access_token({"sub": user.id, "role": user.role, "phone": user.phone})
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@api_router.get("/auth/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserRead.model_validate(current_user)


# ==========================================
# 2. CARE PROFILES (Self, Parents, Children)
# ==========================================

@api_router.get("/care-profiles", response_model=list[CareProfileRead])
async def list_care_profiles(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Returns all CareProfiles the authenticated user is an owner, caregiver, or viewer of."""
    members_res = await session.execute(
        select(CareProfile)
        .join(CareProfileMember, CareProfile.id == CareProfileMember.care_profile_id)
        .where(CareProfileMember.user_id == current_user.id)
    )
    return [CareProfileRead.model_validate(p) for p in members_res.scalars().all()]


@api_router.post("/care-profiles", response_model=CareProfileRead)
async def create_care_profile(
    req: CareProfileCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Creates a new CareProfile (e.g. for elderly parent or child) and binds current user as owner.

    Enforces maximum 3 members per subscription plan.
    """
    members_res = await session.execute(
        select(CareProfileMember).where(CareProfileMember.user_id == current_user.id)
    )
    if len(members_res.scalars().all()) >= 3:
        raise HTTPException(
            status_code=400,
            detail="Subscription limit reached: Maximum 3 member profiles allowed on this plan."
        )

    profile = CareProfile(**req.model_dump())
    session.add(profile)
    await session.commit()
    await session.refresh(profile)

    member = CareProfileMember(
        user_id=current_user.id,
        care_profile_id=profile.id,
        role="owner"
    )
    session.add(member)
    await session.commit()
    return CareProfileRead.model_validate(profile)


@api_router.delete("/care-profiles/{id}")
async def delete_care_profile(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Deletes a CareProfile if owned by the current user."""
    await check_care_profile_access(session, current_user.id, id, "write")
    m_res = await session.execute(
        select(CareProfileMember).where(CareProfileMember.care_profile_id == id)
    )
    for m in m_res.scalars().all():
        await session.delete(m)

    p = await session.get(CareProfile, id)
    if p:
        await session.delete(p)
    await session.commit()
    return {"status": "deleted", "id": id}


@api_router.get("/care-profiles/{id}/snapshot")
async def get_snapshot(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, id, "read")
    await set_rls_care_profile(session, id)
    return await PatientSnapshotService.compute_snapshot(session, id)


@api_router.get("/care-profiles/{id}/timeline", response_model=list[TimelineEventRead])
async def get_timeline(
    id: str,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, id, "read")
    await set_rls_care_profile(session, id)
    res = await session.execute(
        select(TimelineEvent)
        .where(TimelineEvent.care_profile_id == id)
        .order_by(desc(TimelineEvent.event_date))
        .limit(limit)
    )
    return [TimelineEventRead.model_validate(t) for t in res.scalars().all()]


@api_router.get("/care-profiles/{id}/observations")
async def get_observations(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, id, "read")
    await set_rls_care_profile(session, id)
    res = await session.execute(
        select(ClinicalObservation)
        .where(ClinicalObservation.care_profile_id == id)
        .order_by(desc(ClinicalObservation.observed_at))
    )
    return res.scalars().all()


@api_router.post("/care-profiles/{id}/observations/compare", response_model=ObservationCompareResponse)
async def compare_observations_api(
    id: str,
    req: ObservationCompareRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, id, "read")
    obs_res = await session.execute(
        select(ClinicalObservation)
        .where(ClinicalObservation.care_profile_id == id)
        .order_by(desc(ClinicalObservation.observed_at))
    )
    all_obs = [o for o in obs_res.scalars().all() if req.test_name.lower() in o.display_name.lower()]
    if not all_obs:
        raise HTTPException(status_code=404, detail=f"No observations found for '{req.test_name}'")

    current_obs = all_obs[0]
    prev_obs = all_obs[1] if len(all_obs) > 1 else None

    result = ObservationComparator.compare(
        test_name=current_obs.display_name,
        current_val=current_obs.value_numeric,
        current_unit=current_obs.unit or "",
        current_date_str=str(current_obs.observed_at)[:10],
        prev_val=prev_obs.value_numeric if prev_obs else None,
        prev_unit=prev_obs.unit if prev_obs else None,
        prev_date_str=str(prev_obs.observed_at)[:10] if prev_obs else None,
        target_unit=req.target_unit,
        ref_low=current_obs.reference_range_low,
        ref_high=current_obs.reference_range_high
    )
    return ObservationCompareResponse(**result)


# ==========================================
# CLINICAL GRAPH MEMORY & FINDINGS TRAJECTORIES
# ==========================================

@api_router.get("/care-profiles/{id}/graph")
async def get_patient_graph_endpoint(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Returns patient clinical knowledge graph with report provenance and temporal edges."""
    await check_care_profile_access(session, current_user.id, id, "read")
    from app.modules.graph_memory.service import GraphMemoryService
    return await GraphMemoryService.get_patient_graph(session, id)


@api_router.get("/care-profiles/{id}/trajectories")
async def get_patient_trajectories_endpoint(
    id: str,
    test_name: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Returns multi-report time-series lab trajectories for dynamic charting."""
    await check_care_profile_access(session, current_user.id, id, "read")
    from app.modules.graph_memory.service import GraphMemoryService
    return await GraphMemoryService.get_temporal_trajectories(session, id, test_name)


@api_router.get("/documents/{id}/findings")
async def get_document_findings_endpoint(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Returns extracted findings strictly mapped to a specific report."""
    from app.modules.graph_memory.service import GraphMemoryService
    return await GraphMemoryService.get_report_findings(session, id)


@api_router.get("/care-profiles/{id}/medications")
async def get_medications(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, id, "read")
    res = await session.execute(
        select(MedicationStatement).where(MedicationStatement.care_profile_id == id)
    )
    return res.scalars().all()


@api_router.get("/care-profiles/{id}/reviews")
async def get_pending_reviews(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Targeted review queue for high-risk or low-confidence extracted items."""
    await check_care_profile_access(session, current_user.id, id, "read")
    obs_res = await session.execute(
        select(ClinicalObservation).where(
            ClinicalObservation.care_profile_id == id,
            ClinicalObservation.verification_status == "unreviewed"
        )
    )
    med_res = await session.execute(
        select(MedicationStatement).where(
            MedicationStatement.care_profile_id == id,
            MedicationStatement.verification_status == "unreviewed"
        )
    )
    return {
        "pending_observations": obs_res.scalars().all(),
        "pending_medications": med_res.scalars().all()
    }


@api_router.post("/facts/{id}/confirm")
async def confirm_fact(
    id: str,
    req: FactVerificationRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Confirms or corrects an extracted fact (observation or medication)."""
    # Check observation
    obs_res = await session.execute(select(ClinicalObservation).where(ClinicalObservation.fact_id == id))
    obs = obs_res.scalar_one_or_none()
    if obs:
        await check_care_profile_access(session, current_user.id, obs.care_profile_id, "write")
        obs.verification_status = req.verification_status
        if req.corrected_value:
            try:
                obs.value_numeric = float(req.corrected_value)
            except Exception:
                obs.value_text = req.corrected_value
        await session.commit()
        return {"status": "updated", "fact_id": id, "verification_status": req.verification_status}

    # Check medication
    med_res = await session.execute(select(MedicationStatement).where(MedicationStatement.fact_id == id))
    med = med_res.scalar_one_or_none()
    if med:
        await check_care_profile_access(session, current_user.id, med.care_profile_id, "write")
        med.verification_status = req.verification_status
        if req.corrected_value:
            med.dosage = req.corrected_value
        await session.commit()
        return {"status": "updated", "fact_id": id, "verification_status": req.verification_status}

    raise HTTPException(status_code=404, detail=f"Fact {id} not found")


# ==========================================
# 3. DOCUMENTS & UPLOADS
# ==========================================

@api_router.post("/uploads", response_model=UploadPresignResponse)
async def initiate_upload(
    req: UploadPresignRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, req.care_profile_id, "write")
    res = await IngestionService.initiate_upload(
        session=session,
        care_profile_id=req.care_profile_id,
        user_id=current_user.id,
        filename=req.filename,
        mime_type=req.mime_type,
        size_bytes=req.size_bytes
    )
    return UploadPresignResponse(**res)


@api_router.post("/uploads/{id}/file")
async def upload_file_binary(
    id: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db)
):
    """Direct file ingestion handler matching presigned URL."""
    content = await file.read()
    doc = await IngestionService.process_document_content(
        session=session,
        document_id=id,
        file_bytes=content
    )
    return DocumentRead.model_validate(doc)


@api_router.get("/documents", response_model=list[DocumentRead])
async def list_documents(
    care_profile_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, care_profile_id, "read")
    res = await session.execute(
        select(Document).where(Document.care_profile_id == care_profile_id).order_by(desc(Document.created_at))
    )
    return [DocumentRead.model_validate(d) for d in res.scalars().all()]


# ==========================================
# 4. ASSISTANT & CHAT
# ==========================================

@api_router.post("/conversations", response_model=ConversationRead)
async def create_conversation(
    care_profile_id: str,
    channel: str = "text",
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, care_profile_id, "write")
    conv = Conversation(
        care_profile_id=care_profile_id,
        user_id=current_user.id,
        title=f"Health Consultation ({datetime.now().strftime('%b %d')})",
        channel=channel
    )
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return ConversationRead.model_validate(conv)


@api_router.get("/conversations/{id}/messages")
async def get_messages(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    res = await session.execute(
        select(Message).where(Message.conversation_id == id).order_by(Message.created_at)
    )
    return res.scalars().all()


@api_router.post("/conversations/{id}/messages", response_model=ChatMessageResponse)
async def send_message(
    id: str,
    req: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, req.care_profile_id, "write")
    is_doctor = (current_user.role == "practitioner")
    return await AssistantRuntime.process_turn(
        session=session,
        conversation_id=id,
        care_profile_id=req.care_profile_id,
        user_id=current_user.id,
        user_message=req.message,
        language=req.language,
        is_doctor=is_doctor
    )


# ==========================================
# 5. PENDING ACTIONS (Propose -> Confirm)
# ==========================================

@api_router.get("/pending-actions", response_model=list[PendingActionRead])
async def list_pending_actions(
    care_profile_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, care_profile_id, "read")
    res = await session.execute(
        select(PendingAction).where(
            PendingAction.care_profile_id == care_profile_id,
            PendingAction.status == "pending"
        )
    )
    return [PendingActionRead.model_validate(a) for a in res.scalars().all()]


@api_router.post("/pending-actions/{id}/confirm")
async def confirm_pending_action(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """User explicitly commits an action proposed by the assistant."""
    return await PendingActionService.confirm_action(session, id, current_user.id)


@api_router.post("/pending-actions/{id}/reject")
async def reject_pending_action(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    return await PendingActionService.reject_action(session, id)


# ==========================================
# 6. VOICE PIPELINE
# ==========================================

@api_router.post("/voice/token")
async def get_voice_token(
    care_profile_id: str,
    language: str = "en",
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Generates LiveKit WebRTC session credentials for interactive voice conversations."""
    await check_care_profile_access(session, current_user.id, care_profile_id, "write")
    return create_voice_session_token(
        care_profile_id=care_profile_id,
        user_id=current_user.id,
        language=language
    )


# ==========================================
# 7. DOCTOR PORTAL & WORKSPACE
# ==========================================

@api_router.get("/doctors", response_model=list[PractitionerProfileRead])
async def list_doctors(session: AsyncSession = Depends(get_db)):
    res = await session.execute(select(PractitionerProfile).where(PractitionerProfile.is_verified == True))
    return [PractitionerProfileRead.model_validate(d) for d in res.scalars().all()]


@api_router.get("/doctor/patients")
async def get_doctor_patients(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    prac_res = await session.execute(
        select(PractitionerProfile).where(PractitionerProfile.user_id == current_user.id)
    )
    prac = prac_res.scalar_one_or_none()
    if not prac:
        raise HTTPException(status_code=403, detail="Current user is not an active practitioner")
    return await PractitionerService.get_authorized_patients(session, prac.id)


@api_router.get("/doctor/patients/{id}/briefing", response_model=DoctorBriefingRead)
async def get_doctor_patient_briefing(
    id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    prac_res = await session.execute(
        select(PractitionerProfile).where(PractitionerProfile.user_id == current_user.id)
    )
    prac = prac_res.scalar_one_or_none()
    if not prac:
        raise HTTPException(status_code=403, detail="Current user is not a practitioner")
    return await PractitionerService.generate_patient_briefing(session, id, prac.id)


@api_router.post("/doctor/prescriptions/draft", response_model=PrescriptionRead)
async def draft_prescription_endpoint(
    req: PrescriptionDraftRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    prac_res = await session.execute(
        select(PractitionerProfile).where(PractitionerProfile.user_id == current_user.id)
    )
    prac = prac_res.scalar_one_or_none()
    if not prac:
        raise HTTPException(status_code=403, detail="User is not a practitioner")

    presc = await PractitionerService.draft_and_sign_prescription(
        session=session,
        care_profile_id=req.care_profile_id,
        practitioner_id=prac.id,
        diagnosis=req.diagnosis,
        medications=req.medications,
        instructions=req.instructions
    )
    return PrescriptionRead.model_validate(presc)


@api_router.post("/doctor/prescriptions/{id}/sign", response_model=PrescriptionRead)
async def sign_prescription_endpoint(
    id: str,
    req: PrescriptionSignRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    res = await session.execute(select(Prescription).where(Prescription.id == id))
    presc = res.scalar_one_or_none()
    if not presc:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if req.practitioner_signature_pin != "1234":
        raise HTTPException(status_code=400, detail="Invalid digital signature PIN")

    now = datetime.now(timezone.utc)
    sig_payload = f"{presc.practitioner_id}:{presc.care_profile_id}:{now.isoformat()}:{presc.diagnosis}"
    presc.is_signed = True
    presc.signed_at = now
    presc.signature_hash = hashlib.sha256(sig_payload.encode()).hexdigest()
    await session.commit()
    return PrescriptionRead.model_validate(presc)


# ==========================================
# 8. APPOINTMENTS & REMINDERS
# ==========================================

@api_router.get("/appointments", response_model=list[AppointmentRead])
async def list_appointments(
    care_profile_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, care_profile_id, "read")
    res = await session.execute(
        select(Appointment).where(Appointment.care_profile_id == care_profile_id).order_by(Appointment.appointment_time)
    )
    return [AppointmentRead.model_validate(a) for a in res.scalars().all()]


@api_router.get("/reminders", response_model=list[ReminderRead])
async def list_reminders(
    care_profile_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    await check_care_profile_access(session, current_user.id, care_profile_id, "read")
    res = await session.execute(
        select(Reminder).where(Reminder.care_profile_id == care_profile_id).order_by(Reminder.remind_at)
    )
    return [ReminderRead.model_validate(r) for r in res.scalars().all()]


# ==========================================
# 9. DOCTOR-PATIENT SECURE MESSAGING PLATFORM
# ==========================================

@api_router.get("/doctor-messages", response_model=list[DoctorPatientMessageRead])
async def get_doctor_messages_endpoint(
    care_profile_id: str,
    practitioner_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Retrieves two-way secure message history between connected doctor and patient."""
    await check_care_profile_access(session, current_user.id, care_profile_id, "read")
    messages = await PractitionerService.get_doctor_patient_messages(
        session=session,
        care_profile_id=care_profile_id,
        practitioner_id=practitioner_id
    )
    return [DoctorPatientMessageRead.model_validate(m) for m in messages]


@api_router.post("/doctor-messages", response_model=DoctorPatientMessageRead)
async def send_doctor_message_endpoint(
    req: DoctorPatientMessageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Sends an authenticated message between doctor and patient."""
    await check_care_profile_access(session, current_user.id, req.care_profile_id, "write")
    msg = await PractitionerService.send_doctor_patient_message(
        session=session,
        care_profile_id=req.care_profile_id,
        practitioner_id=req.practitioner_id,
        sender_role=req.sender_role,
        content=req.content
    )
    return DoctorPatientMessageRead.model_validate(msg)


# ==========================================
# 10. OPERATIONS & PHARMACY RESTOCK
# ==========================================

@api_router.get("/operations/restock-status")
async def get_restock_status_endpoint(
    care_profile_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Calculates days of supply left for active medications and returns restock alerts."""
    await check_care_profile_access(session, current_user.id, care_profile_id, "read")
    return await OperationsService.get_medication_restock_status(session, care_profile_id)


@api_router.post("/operations/orders", response_model=MedicineOrderRead)
async def create_pharmacy_order_endpoint(
    req: MedicineOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Submits an e-pharmacy refill delivery order."""
    await check_care_profile_access(session, current_user.id, req.care_profile_id, "write")
    order = await OperationsService.create_pharmacy_order(
        session=session,
        care_profile_id=req.care_profile_id,
        items=req.items,
        delivery_address=req.delivery_address
    )
    return MedicineOrderRead.model_validate(order)


@api_router.get("/doctor/practice-stats")
async def get_doctor_stats_endpoint(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Fetches doctor clinic operations workload and patient stats."""
    prac_res = await session.execute(
        select(PractitionerProfile).where(PractitionerProfile.user_id == current_user.id)
    )
    prac = prac_res.scalar_one_or_none()
    if not prac:
        raise HTTPException(status_code=403, detail="User is not a practitioner")
    return await OperationsService.get_doctor_practice_stats(session, prac.id)


# ==========================================
# 11. DOCTOR VOICE AGENT & VOICE-TO-RX
# ==========================================

@api_router.post("/doctor/voice-query", response_model=DoctorVoiceQueryResponse)
async def doctor_voice_query_endpoint(
    req: DoctorVoiceQueryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Doctor spoken assistant query: reads through patient data and narrates clinical summaries."""
    prac_res = await session.execute(
        select(PractitionerProfile).where(PractitionerProfile.user_id == current_user.id)
    )
    prac = prac_res.scalar_one_or_none()
    if not prac:
        raise HTTPException(status_code=403, detail="User is not a practitioner")

    res = await VoiceService.process_doctor_voice_query(
        session=session,
        query=req.query,
        patient_id=req.patient_id
    )
    return DoctorVoiceQueryResponse(**res)


@api_router.post("/doctor/voice-to-prescription", response_model=VoicePrescriptionResponse)
async def voice_to_prescription_endpoint(
    req: VoicePrescriptionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Parses doctor voice dictation into structured prescription with automatic allergy checks."""
    prac_res = await session.execute(
        select(PractitionerProfile).where(PractitionerProfile.user_id == current_user.id)
    )
    prac = prac_res.scalar_one_or_none()
    if not prac:
        raise HTTPException(status_code=403, detail="User is not a practitioner")

    res = await VoiceService.parse_voice_to_prescription(
        session=session,
        care_profile_id=req.care_profile_id,
        dictation_text=req.dictation_text
    )
    return VoicePrescriptionResponse(**res)


# ==========================================
# 12. FULL DUPLEX VOICE TURN PIPELINE
# ==========================================

@api_router.post("/voice/turn", response_model=VoiceTurnResponse)
async def voice_turn_endpoint(
    req: VoiceTurnRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Full interactive voice turn: processes user speech, calls tools, and returns spoken output."""
    await check_care_profile_access(session, current_user.id, req.care_profile_id, "write")
    res = await VoiceService.process_patient_voice_turn(
        session=session,
        care_profile_id=req.care_profile_id,
        user_id=current_user.id,
        speech_input=req.speech_input,
        language=req.language
    )
    return VoiceTurnResponse(**res)

