import re
from typing import Any

# Multi-lingual Emergency / Red-Flag Keyword Patterns
EMERGENCY_PATTERNS: dict[str, list[str]] = {
    "en": [
        r"\bchest\s+pain\b",
        r"\bcrushing\s+(chest\s+)?pain\b",
        r"\bheart\s+attack\b",
        r"\bsevere\s+(shortness\s+of\s+breath|difficulty\s+breathing)\b",
        r"\bcan\'?t\s+breathe\b",
        r"\bcannot\s+breathe\b",
        r"\bstroke\b",
        r"\bface\s+droop(ing)?\b",
        r"\bslurred\s+speech\b",
        r"\bunconscious\b",
        r"\bunresponsive\b",
        r"\bprofuse\s+bleed(ing)?\b",
        r"\bheavy\s+bleed(ing)?\b",
        r"\bcoughing\s+(up\s+)?blood\b",
        r"\banaphylaxis\b",
        r"\bswelling\s+of\s+(tongue|throat)\b",
        r"\bseizure(s)?\b",
    ],
    "hi": [
        r"छाती\s+में\s+दर्द",
        r"सीने\s+में\s+दर्द",
        r"दिल\s+का\s+दौरा",
        r"सांस\s+लेने\s+में\s+(तकलीफ|दिक्कत)",
        r"सांस\s+फूल\s+रही",
        r"बेहोश",
        r"अचेत",
        r"खून\s+की\s+उल्टी",
        r"बहुत\s+खून\s+बह",
    ],
    "bn": [
        r"বুকে\s+ব্যথা",
        r"বুকের\s+ব্যথা",
        r"হার্ট\s+অ্যাটাক",
        r"শ্বাসকষ্ট",
        r"নিশ্বাস\s+নিতে\s+কষ্ট",
        r"জ্ঞান\s+হারি(য়ে)?",
        r"অচেতন",
        r"রক্ত\s+বমি",
        r"প্রচুর\s+রক্তপাত",
    ],
    "ta": [
        r"நெஞ்சு\s+வலி",
        r"மாரடைப்பு",
        r"மூச்சுத்\s+திணறல்",
        r"சுவாசிக்க\s+முடியவில்லை",
        r"மயக்கம்",
        r"நினைவிழந்த",
        r"இரத்தப்போக்கு",
    ],
}

EMERGENCY_RESPONSES: dict[str, str] = {
    "en": (
        "EMERGENCY MEDICAL ALERT: Your symptoms may indicate an acute, life-threatening medical emergency. "
        "Please call 112 (National Emergency) or 108 (Ambulance) IMMEDIATELY, or proceed to the nearest hospital casualty/emergency room. "
        "MediTrace cannot provide emergency medical care."
    ),
    "hi": (
        "आपातकालीन चिकित्सा चेतावनी: आपके लक्षण एक गंभीर आपातकालीन स्थिति का संकेत हो सकते हैं। "
        "कृपया तुरंत 112 (राष्ट्रीय आपातकाल) या 108 (एम्बुलेंस) पर कॉल करें या तुरंत नजदीकी अस्पताल के आपातकालीन विभाग में जाएं।"
    ),
    "bn": (
        "জরুরী চিকিৎসা সতর্কতা: আপনার লক্ষণগুলি একটি সংকটজনক জরুরী পরিস্থিতি নির্দেশ করতে পারে। "
        "অনুগ্রহ করে অবিলম্বে 112 (জাতীয় জরুরী পরিষেবা) অথবা 108 (অ্যাম্বুলেন্স) এ কল করুন বা নিকটস্থ হাসপাতালের জরুরী বিভাগে যান।"
    ),
    "ta": (
        "அவசர மருத்துவ எச்சரிக்கை: உங்கள் அறிகுறிகள் உயிருக்கு ஆபத்தான அவசரநிலையைக் குறிக்கலாம். "
        "உடனடியாக 112 அல்லது 108 (ஆம்புலன்ஸ்) எண்ணிற்கு அழைக்கவும் அல்லது அருகிலுள்ள மருத்துவமனையின் அவசர சிகிச்சைப் பிரிவிற்குச் செல்லவும்."
    ),
}


class PreLlmEmergencyScreen:
    @staticmethod
    def screen(user_message: str, language: str = "en") -> dict[str, Any] | None:
        """Deterministically inspects the user message for acute red-flag symptoms.

        Returns an Emergency payload if detected; None if clear.
        """
        text = user_message.lower().strip()
        matched = False
        detected_category = "acute_symptom"

        # Check all patterns across languages to prevent language mismatch bypasses
        for lang_code, patterns in EMERGENCY_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, text, re.IGNORECASE):
                    matched = True
                    break
            if matched:
                break

        if not matched:
            return None

        lang = language if language in EMERGENCY_RESPONSES else "en"
        response_text = EMERGENCY_RESPONSES[lang]

        return {
            "is_emergency": True,
            "category": detected_category,
            "alert_message": response_text,
            "helplines": ["112", "108", "102"],
            "disclaimer_shown": True,
            "ui_block": {
                "type": "emergency_card",
                "resource_id": "emergency_banner",
                "data": {
                    "alert_message": response_text,
                    "helplines": ["112 (National Emergency)", "108 (Ambulance)", "102 (Medical Services)"],
                    "priority": "HIGH_URGENCY"
                }
            }
        }
