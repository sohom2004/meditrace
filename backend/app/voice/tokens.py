import json
import uuid
from typing import Any
from app.core.config import settings

def create_voice_session_token(
    care_profile_id: str,
    user_id: str,
    room_name: str | None = None,
    identity: str | None = None,
    language: str = "en"
) -> dict[str, Any]:
    """Generates LiveKit WebRTC access token for browser / mobile voice session."""
    room = room_name or f"meditrace-{care_profile_id[:8]}-{uuid.uuid4().hex[:6]}"
    user_identity = identity or f"user-{user_id[:8]}"

    metadata = {
        "care_profile_id": care_profile_id,
        "user_id": user_id,
        "language": language
    }

    token_str = ""
    if settings.LIVEKIT_API_KEY and settings.LIVEKIT_API_SECRET:
        try:
            from livekit import api
            token = (
                api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
                .with_identity(user_identity)
                .with_name(f"MediTrace Client ({care_profile_id[:6]})")
                .with_metadata(json.dumps(metadata))
                .with_grants(
                    api.VideoGrants(
                        room_join=True,
                        room=room,
                        can_publish=True,
                        can_subscribe=True,
                        can_publish_data=True
                    )
                )
                .to_jwt()
            )
            token_str = token
        except Exception:
            token_str = f"mock-livekit-jwt-{uuid.uuid4().hex}"
    else:
        token_str = f"mock-livekit-jwt-{uuid.uuid4().hex}"

    return {
        "token": token_str,
        "room_name": room,
        "identity": user_identity,
        "url": settings.LIVEKIT_URL or "wss://meditrace.livekit.cloud",
        "metadata": metadata
    }
