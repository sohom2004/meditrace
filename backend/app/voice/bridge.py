import json
import logging
from typing import Any

logger = logging.getLogger("meditrace.voice_bridge")

_active_room: Any | None = None

def set_active_room(room: Any | None) -> None:
    global _active_room
    _active_room = room

async def publish_event(payload: dict[str, Any]) -> None:
    """Publishes a UI event to the WebRTC data channel (e.g., model activity, citation cards, confirmation cards)."""
    global _active_room
    if _active_room is None:
        logger.debug("No active LiveKit room; skipping data channel publish: %s", payload.get("type"))
        return
    try:
        data_str = json.dumps(payload, default=str)
        # livekit.rtc room publish_data
        await _active_room.local_participant.publish_data(data_str.encode("utf-8"), reliable=True)
    except Exception as exc:
        logger.warning("Failed to publish WebRTC event %s: %s", payload.get("type"), exc)
