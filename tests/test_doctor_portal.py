import pytest
from app.core.errors import ValidationError
from app.modules.practitioners.service import PractitionerService


@pytest.mark.asyncio
async def test_doctor_authorized_patients_and_briefing(db_session):
    # Dr. Ananya Mukherjee retrieves authorized patients
    patients = await PractitionerService.get_authorized_patients(db_session, "doc-ananya-mukherjee")
    assert len(patients) >= 1
    p_names = [p["full_name"] for p in patients]
    assert "Ramesh Sharma" in p_names

    # Generate sourced clinical briefing
    briefing = await PractitionerService.generate_patient_briefing(
        session=db_session,
        care_profile_id="cp-ramesh-father",
        practitioner_id="doc-ananya-mukherjee"
    )
    assert briefing.patient_name == "Ramesh Sharma"
    assert "Type 2 Diabetes Mellitus" in briefing.active_conditions
    assert len(briefing.sources) >= 1
    assert briefing.data_as_of is not None


@pytest.mark.asyncio
async def test_prescription_allergy_cross_check(db_session):
    # Ramesh Sharma has a documented severe allergy to Penicillin.
    # If the doctor attempts to prescribe Penicillin / Amoxicillin, it must raise ValidationError.
    with pytest.raises(ValidationError) as exc_info:
        await PractitionerService.draft_and_sign_prescription(
            session=db_session,
            care_profile_id="cp-ramesh-father",
            practitioner_id="doc-ananya-mukherjee",
            diagnosis="Dental Infection",
            medications=[{"medicine_name": "Amoxicillin / Penicillin V", "generic_name": "penicillin", "dosage": "500mg"}]
        )
    assert "CRITICAL SAFETY ALERT" in str(exc_info.value)
    assert "penicillin" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_prescription_signing_success(db_session):
    # Prescribing safe non-allergic medication with digital signature
    presc = await PractitionerService.draft_and_sign_prescription(
        session=db_session,
        care_profile_id="cp-ramesh-father",
        practitioner_id="doc-ananya-mukherjee",
        diagnosis="Hyperglycemia follow-up",
        medications=[{"medicine_name": "Glycomet GP2", "dosage": "1 tab BD"}],
        sign_now=True,
        signature_pin="1234"
    )
    assert presc.is_signed is True
    assert presc.signed_at is not None
    assert presc.signature_hash is not None
