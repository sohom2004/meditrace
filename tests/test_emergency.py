import pytest
from app.modules.assistant.safety import PreLlmEmergencyScreen


def test_emergency_english_detection():
    msg = "I am having severe chest pain and cannot breathe properly"
    res = PreLlmEmergencyScreen.screen(msg, language="en")
    assert res is not None
    assert res["is_emergency"] is True
    assert "112" in res["alert_message"]
    assert "108" in res["alert_message"]
    assert res["ui_block"]["type"] == "emergency_card"


def test_emergency_hindi_detection():
    msg = "मेरे सीने में बहुत तेज दर्द हो रहा है और सांस लेने में दिक्कत है"
    res = PreLlmEmergencyScreen.screen(msg, language="hi")
    assert res is not None
    assert res["is_emergency"] is True
    assert "112" in res["alert_message"]


def test_emergency_bengali_detection():
    msg = "আমার বুকে তীব্র ব্যথা এবং শ্বাসকষ্ট হচ্ছে"
    res = PreLlmEmergencyScreen.screen(msg, language="bn")
    assert res is not None
    assert res["is_emergency"] is True
    assert "112" in res["alert_message"]


def test_emergency_tamil_detection():
    msg = "எனக்கு கடுமையான நெஞ்சு வலி உள்ளது மற்றும் மூச்சுத் திணறல் உள்ளது"
    res = PreLlmEmergencyScreen.screen(msg, language="ta")
    assert res is not None
    assert res["is_emergency"] is True
    assert "112" in res["alert_message"]


def test_benign_medical_query_not_flagged():
    msg = "What was my HbA1c in the last blood report from August?"
    res = PreLlmEmergencyScreen.screen(msg, language="en")
    assert res is None
