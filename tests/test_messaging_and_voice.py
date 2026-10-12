import pytest
from app.modules.practitioners.service import PractitionerService
from app.modules.operations.service import OperationsService
from app.voice.service import VoiceService


@pytest.mark.asyncio
async def test_doctor_patient_messaging_service(db_session):
    care_profile_id = "cp-ramesh-father"
    practitioner_id = "doc-ananya-mukherjee"

    # Patient sends a message
    p_msg = await PractitionerService.send_doctor_patient_message(
        session=db_session,
        care_profile_id=care_profile_id,
        practitioner_id=practitioner_id,
        sender_role="patient",
        content="Doctor, I noticed a slight rise in my morning fasting blood sugar."
    )
    assert p_msg.id is not None
    assert p_msg.sender_role == "patient"
    assert "blood sugar" in p_msg.content

    # Doctor sends a response
    d_msg = await PractitionerService.send_doctor_patient_message(
        session=db_session,
        care_profile_id=care_profile_id,
        practitioner_id=practitioner_id,
        sender_role="doctor",
        content="Please log your readings over the next 3 days and continue Telma 40 as scheduled."
    )
    assert d_msg.sender_role == "doctor"

    # Retrieve conversation thread
    history = await PractitionerService.get_doctor_patient_messages(
        session=db_session,
        care_profile_id=care_profile_id,
        practitioner_id=practitioner_id
    )
    assert len(history) >= 2
    assert history[-1].sender_role == "doctor"


@pytest.mark.asyncio
async def test_medication_restock_and_order_flow(db_session):
    care_profile_id = "cp-ramesh-father"

    # Check supply status
    restock_status = await OperationsService.get_medication_restock_status(
        session=db_session,
        care_profile_id=care_profile_id
    )
    assert isinstance(restock_status, list)
    assert len(restock_status) >= 1
    # Check that each medication has days_supply_left computed
    first_med = restock_status[0]
    assert "days_supply_left" in first_med
    assert "is_low_supply" in first_med

    # Create pharmacy order
    order = await OperationsService.create_pharmacy_order(
        session=db_session,
        care_profile_id=care_profile_id,
        items=[{"medicine_name": first_med["medicine_name"], "quantity": 30}],
        delivery_address="Salt Lake Sector 2, Kolkata"
    )
    assert order.id is not None
    assert order.status == "processing"
    assert order.delivery_address == "Salt Lake Sector 2, Kolkata"


@pytest.mark.asyncio
async def test_doctor_practice_stats_service(db_session):
    stats = await OperationsService.get_doctor_practice_stats(
        session=db_session,
        practitioner_id="doc-ananya-mukherjee"
    )
    assert stats["total_active_patients"] >= 1
    assert stats["upcoming_appointments_count"] >= 0
    assert "medical_council_status" in stats


@pytest.mark.asyncio
async def test_doctor_voice_query_and_rx_dictation(db_session):
    care_profile_id = "cp-ramesh-father"

    # 1. Doctor voice query on patient chart
    query_res = await VoiceService.process_doctor_voice_query(
        session=db_session,
        query="What is the patient HbA1c and creatinine trend?",
        patient_id=care_profile_id
    )
    assert "spoken_answer" in query_res
    assert len(query_res["spoken_answer"]) > 10

    # 2. Doctor voice dictation with safe medications
    safe_dictation = "Hypertension management. Prescribe Telma 40 one tablet OD daily."
    rx_res = await VoiceService.parse_voice_to_prescription(
        session=db_session,
        care_profile_id=care_profile_id,
        dictation_text=safe_dictation
    )
    assert rx_res["allergy_warning"] is None
    assert rx_res["is_safe"] is True
    assert len(rx_res["medications"]) >= 1

    # 3. Doctor voice dictation with Penicillin / Amoxicillin (Allergy Cross-Check block)
    allergic_dictation = "Infection. Prescribe Amoxicillin 500mg three times daily."
    allergic_rx = await VoiceService.parse_voice_to_prescription(
        session=db_session,
        care_profile_id=care_profile_id,
        dictation_text=allergic_dictation
    )
    assert allergic_rx["is_safe"] is False
    assert allergic_rx["allergy_warning"] is not None
    assert "Penicillin" in allergic_rx["allergy_warning"]


@pytest.mark.asyncio
async def test_patient_voice_turn_service(db_session):
    care_profile_id = "cp-ramesh-father"

    # Query triggering HbA1c comparison
    voice_res = await VoiceService.process_patient_voice_turn(
        session=db_session,
        care_profile_id=care_profile_id,
        user_id="user-sohom",
        speech_input="What is my latest HbA1c and how has it changed?",
        language="en"
    )
    assert "speech_output" in voice_res
    assert "HbA1c" in voice_res["speech_output"]
    assert "Calculated diagnostic trend" in voice_res["model_activity"]

    # Query triggering appointment proposal
    appt_res = await VoiceService.process_patient_voice_turn(
        session=db_session,
        care_profile_id=care_profile_id,
        user_id="user-sohom",
        speech_input="Book an appointment with Dr. Mukherjee for tomorrow at 10 AM",
        language="en"
    )
    assert "appointment" in appt_res["speech_output"].lower() or "mukherjee" in appt_res["speech_output"].lower()
    assert len(appt_res["pending_actions"]) >= 1


@pytest.mark.asyncio
async def test_e2e_api_messaging_operations_and_voice(client):
    # Verify auth
    ver_res = await client.post("/api/v1/auth/otp/verify", json={"phone": "+919876543210", "otp": "123456"})
    token = ver_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    pid = "cp-ramesh-father"

    # 1. Doctor Messages Endpoints
    post_msg = await client.post(
        "/api/v1/doctor-messages",
        headers=headers,
        json={
            "care_profile_id": pid,
            "practitioner_id": "doc-ananya-mukherjee",
            "sender_role": "patient",
            "content": "Hello doctor via API"
        }
    )
    assert post_msg.status_code == 200
    assert post_msg.json()["sender_role"] == "patient"

    get_msgs = await client.get(
        f"/api/v1/doctor-messages?care_profile_id={pid}&practitioner_id=doc-ananya-mukherjee",
        headers=headers
    )
    assert get_msgs.status_code == 200
    assert len(get_msgs.json()) >= 1

    # 2. Operations Restock Status & Order
    restock_res = await client.get(f"/api/v1/operations/restock-status?care_profile_id={pid}", headers=headers)
    assert restock_res.status_code == 200
    assert isinstance(restock_res.json(), list)
    assert len(restock_res.json()) >= 1

    order_res = await client.post(
        "/api/v1/operations/orders",
        headers=headers,
        json={
            "care_profile_id": pid,
            "items": [{"medicine_name": "Telma 40", "quantity": 30}],
            "delivery_address": "Kolkata, WB"
        }
    )
    assert order_res.status_code == 200
    assert order_res.json()["status"] == "processing"

    # 3. Doctor Practice Stats (Authenticate as Doctor)
    doc_ver = await client.post("/api/v1/auth/otp/verify", json={"phone": "+919876543211", "otp": "123456"})
    doc_token = doc_ver.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    stats_res = await client.get("/api/v1/doctor/practice-stats", headers=doc_headers)
    assert stats_res.status_code == 200
    assert stats_res.json()["total_active_patients"] >= 1

    # 4. Doctor Voice Query
    doc_voice_res = await client.post(
        "/api/v1/doctor/voice-query",
        headers=doc_headers,
        json={"query": "Summary of active medications", "patient_id": pid}
    )
    assert doc_voice_res.status_code == 200
    assert "spoken_answer" in doc_voice_res.json()

    # 5. Doctor Voice-to-Prescription (Allergy check)
    rx_res = await client.post(
        "/api/v1/doctor/voice-to-prescription",
        headers=doc_headers,
        json={"care_profile_id": pid, "dictation_text": "Amoxicillin 500mg tab TDS"}
    )
    assert rx_res.status_code == 200
    assert rx_res.json()["is_safe"] is False
    assert "Penicillin" in rx_res.json()["allergy_warning"]

    # 6. Patient Voice Turn
    turn_res = await client.post(
        "/api/v1/voice/turn",
        headers=headers,
        json={"care_profile_id": pid, "speech_input": "What is my latest HbA1c?", "language": "en"}
    )
    assert turn_res.status_code == 200
    assert "speech_output" in turn_res.json()
