import pytest


@pytest.mark.asyncio
async def test_health_check_endpoint(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_otp_auth_flow(client):
    # Request OTP
    req_res = await client.post("/api/v1/auth/otp/request", json={"phone": "+919876543210"})
    assert req_res.status_code == 200
    assert req_res.json()["status"] == "otp_sent"

    # Verify OTP
    ver_res = await client.post("/api/v1/auth/otp/verify", json={"phone": "+919876543210", "otp": "123456"})
    assert ver_res.status_code == 200
    token_data = ver_res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # Access /auth/me with Bearer token
    me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["phone"] == "+919876543210"


@pytest.mark.asyncio
async def test_care_profiles_and_snapshot_api(client):
    # Authenticate
    ver_res = await client.post("/api/v1/auth/otp/verify", json={"phone": "+919876543210", "otp": "123456"})
    token = ver_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List CareProfiles
    cp_res = await client.get("/api/v1/care-profiles", headers=headers)
    assert cp_res.status_code == 200
    profiles = cp_res.json()
    assert len(profiles) >= 1

    father_profile = next((p for p in profiles if p["relationship"] == "father"), profiles[0])
    pid = father_profile["id"]

    # Get Snapshot
    snap_res = await client.get(f"/api/v1/care-profiles/{pid}/snapshot", headers=headers)
    assert snap_res.status_code == 200
    snap = snap_res.json()
    assert "active_medications" in snap
    assert "recent_observations" in snap

    # Get Timeline
    tl_res = await client.get(f"/api/v1/care-profiles/{pid}/timeline", headers=headers)
    assert tl_res.status_code == 200


@pytest.mark.asyncio
async def test_chat_and_propose_confirm_flow(client):
    ver_res = await client.post("/api/v1/auth/otp/verify", json={"phone": "+919876543210", "otp": "123456"})
    token = ver_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Conversation
    conv_res = await client.post("/api/v1/conversations?care_profile_id=cp-ramesh-father", headers=headers)
    assert conv_res.status_code == 200
    conv_id = conv_res.json()["id"]

    # Send Chat Message (Asking to book an appointment)
    chat_res = await client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        headers=headers,
        json={
            "care_profile_id": "cp-ramesh-father",
            "message": "Please book an appointment with Dr. Mukherjee for diabetic checkup",
            "language": "en"
        }
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert len(chat_data["pending_actions"]) >= 1

    action_id = chat_data["pending_actions"][0]["id"]

    # User confirms proposed action
    confirm_res = await client.post(f"/api/v1/pending-actions/{action_id}/confirm", headers=headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_voice_token_endpoint(client):
    ver_res = await client.post("/api/v1/auth/otp/verify", json={"phone": "+919876543210", "otp": "123456"})
    token = ver_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    voice_res = await client.post("/api/v1/voice/token?care_profile_id=cp-ramesh-father", headers=headers)
    assert voice_res.status_code == 200
    v_data = voice_res.json()
    assert "token" in v_data
    assert "room_name" in v_data
