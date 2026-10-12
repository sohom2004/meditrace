import pytest
from app.core.errors import AuthorizationError
from app.policy.authorization import check_care_profile_access, enforce_scope_integrity


@pytest.mark.asyncio
async def test_caregiver_and_owner_access(db_session):
    # Aarav Sharma is owner of Self and caregiver for Father
    can_access_self = await check_care_profile_access(db_session, "usr-patient-aarav", "cp-aarav-self", "read")
    assert can_access_self is True

    can_access_father = await check_care_profile_access(db_session, "usr-patient-aarav", "cp-ramesh-father", "read")
    assert can_access_father is True


@pytest.mark.asyncio
async def test_cross_patient_access_denial(db_session):
    # A random unauthorized user cannot access another patient's profile
    with pytest.raises(AuthorizationError):
        await check_care_profile_access(db_session, "usr-unauthorized-random", "cp-ramesh-father", "read")


@pytest.mark.asyncio
async def test_doctor_access_via_grant(db_session):
    # Dr. Ananya Mukherjee has an active access grant for Father (Ramesh Sharma)
    can_access = await check_care_profile_access(db_session, "usr-doctor-ananya", "cp-ramesh-father", "read")
    assert can_access is True

    # Dr. Ananya Mukherjee does NOT have a grant for Aarav's self profile
    with pytest.raises(AuthorizationError):
        await check_care_profile_access(db_session, "usr-doctor-ananya", "cp-aarav-self", "read")


@pytest.mark.asyncio
async def test_enforce_scope_integrity():
    # Calling with matched ID succeeds
    await enforce_scope_integrity("cp-ramesh-father", "cp-ramesh-father")

    # Mismatched ID must fail deterministically
    with pytest.raises(AuthorizationError):
        await enforce_scope_integrity("cp-ramesh-father", "cp-other-profile")
