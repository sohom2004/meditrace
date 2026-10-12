from typing import Literal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.errors import AuthorizationError
from app.db.models import AccessGrant, CareProfileMember, PractitionerProfile, User

RolePermission = Literal["read", "write", "admin", "sign"]

async def check_care_profile_access(
    session: AsyncSession,
    user_id: str,
    care_profile_id: str,
    required_permission: RolePermission = "read"
) -> bool:
    """Verifies that the user has authorized access to the specified CareProfile.

    Handles:
    1. Direct care profile membership (owner, caregiver, viewer).
    2. Practitioner access via active, unrevoked AccessGrant.
    3. Admin override.
    """
    # 1. Fetch user to check role
    user_res = await session.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise AuthorizationError(f"User {user_id} not found")

    if user.role == "admin":
        return True

    # 2. Check patient/caregiver membership in care_profile_members
    member_res = await session.execute(
        select(CareProfileMember).where(
            CareProfileMember.user_id == user_id,
            CareProfileMember.care_profile_id == care_profile_id
        )
    )
    member = member_res.scalar_one_or_none()
    if member:
        if required_permission in ["read", "write"]:
            return True
        if required_permission == "admin" and member.role == "owner":
            return True
        if required_permission == "admin" and member.role != "owner":
            raise AuthorizationError("Only care profile owners can perform administrative changes")
        return True

    # 3. If user is practitioner, check active AccessGrant
    if user.role == "practitioner":
        prac_res = await session.execute(
            select(PractitionerProfile).where(PractitionerProfile.user_id == user_id)
        )
        practitioner = prac_res.scalar_one_or_none()
        if practitioner and practitioner.is_verified:
            grant_res = await session.execute(
                select(AccessGrant).where(
                    AccessGrant.care_profile_id == care_profile_id,
                    AccessGrant.practitioner_id == practitioner.id,
                    AccessGrant.is_revoked == False
                )
            )
            grant = grant_res.scalar_one_or_none()
            if grant:
                return True

    raise AuthorizationError(
        f"Principal {user_id} lacks '{required_permission}' access to CareProfile {care_profile_id}"
    )


async def enforce_scope_integrity(
    care_profile_id: str,
    resource_profile_id: str,
    resource_type: str = "resource"
) -> None:
    """Deterministic security assertion ensuring cross-profile access is impossible."""
    if care_profile_id != resource_profile_id:
        raise AuthorizationError(
            f"Security Violation: {resource_type} belongs to {resource_profile_id}, not {care_profile_id}"
        )
