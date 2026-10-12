import asyncio
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.db.models import (
    AccessGrant,
    Allergy,
    AvailabilitySlot,
    CareProfile,
    CareProfileMember,
    ClinicalObservation,
    Condition,
    ConsentRecord,
    Document,
    DocumentChunk,
    MedicationStatement,
    PractitionerProfile,
    TimelineEvent,
    User,
)
from app.db.session import Base, async_session_maker, engine
from app.modules.assistant.snapshot import PatientSnapshotService


async def init_db_and_seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # Check if already seeded
        res = await session.execute(select(User).limit(1))
        if res.scalar_one_or_none():
            return

        # 1. Users
        patient_user = User(
            id="usr-patient-aarav",
            phone="+919876543210",
            full_name="Aarav Sharma",
            role="patient",
            is_active=True,
            is_verified=True
        )
        doctor_user = User(
            id="usr-doctor-ananya",
            phone="+919876543211",
            full_name="Dr. Ananya Mukherjee",
            role="practitioner",
            is_active=True,
            is_verified=True
        )
        session.add_all([patient_user, doctor_user])
        await session.flush()

        # 2. Care Profiles (Self, Father, Mother)
        p_self = CareProfile(
            id="cp-aarav-self",
            full_name="Aarav Sharma",
            relationship="self",
            date_of_birth="1991-04-15",
            gender="Male",
            blood_group="B+",
            abha_address="aarav.sharma@abdm"
        )
        p_father = CareProfile(
            id="cp-ramesh-father",
            full_name="Ramesh Sharma",
            relationship="father",
            date_of_birth="1958-09-22",
            gender="Male",
            blood_group="O+",
            abha_address="ramesh.sharma@abdm"
        )
        p_mother = CareProfile(
            id="cp-sunita-mother",
            full_name="Sunita Sharma",
            relationship="mother",
            date_of_birth="1962-11-05",
            gender="Female",
            blood_group="A+",
            abha_address="sunita.sharma@abdm"
        )
        session.add_all([p_self, p_father, p_mother])
        await session.flush()

        # CareProfile memberships
        session.add_all([
            CareProfileMember(user_id=patient_user.id, care_profile_id=p_self.id, role="owner"),
            CareProfileMember(user_id=patient_user.id, care_profile_id=p_father.id, role="caregiver"),
            CareProfileMember(user_id=patient_user.id, care_profile_id=p_mother.id, role="caregiver"),
        ])

        # 3. Practitioner Profile
        doctor_profile = PractitionerProfile(
            id="doc-ananya-mukherjee",
            user_id=doctor_user.id,
            name="Dr. Ananya Mukherjee, MD, DM",
            council_reg_number="WBMC/2014/19823",
            council_name="West Bengal Medical Council",
            specialty="Cardiology & Diabetology",
            qualification="MBBS, MD (Medicine), DM (Cardiology)",
            is_verified=True,
            verification_date=datetime.now(timezone.utc),
            bio="Senior Interventional Cardiologist & Consultant Diabetologist with 12+ years experience in chronic metabolic care."
        )
        session.add(doctor_profile)
        await session.flush()

        # Availability slots for booking
        now = datetime.now(timezone.utc)
        for i in range(1, 5):
            slot_start = now + timedelta(days=i, hours=10)
            slot_end = slot_start + timedelta(minutes=30)
            session.add(
                AvailabilitySlot(
                    practitioner_id=doctor_profile.id,
                    start_time=slot_start,
                    end_time=slot_end,
                    is_booked=False
                )
            )

        # 4. Access Grant & DPDP Consent for Father
        grant = AccessGrant(
            care_profile_id=p_father.id,
            practitioner_id=doctor_profile.id,
            purpose="chronic_disease_management",
            valid_from=now - timedelta(days=30),
            valid_until=now + timedelta(days=180),
            is_revoked=False,
            permissions_json="read_all,draft_prescriptions"
        )
        consent = ConsentRecord(
            care_profile_id=p_father.id,
            user_id=patient_user.id,
            policy_version="DPDP_2026_V1",
            purpose="teleconsultation_and_records_sharing"
        )
        session.add_all([grant, consent])

        # 5. Documents for Father (Ramesh Sharma)
        doc1 = Document(
            id="doc-srl-report-01",
            care_profile_id=p_father.id,
            uploaded_by_user_id=patient_user.id,
            filename="SRL_Pathology_Comprehensive_Blood_Panel.pdf",
            file_path="storage_data/SRL_Pathology_Comprehensive_Blood_Panel.pdf",
            mime_type="application/pdf",
            size_bytes=425100,
            checksum="a89e1b439c09c256a9081e7d23f7902e88a032fec4b8d1a10023e1987f6e012a",
            status="completed"
        )
        session.add(doc1)
        await session.flush()

        # 6. Clinical Observations for Father
        obs_date_recent = now - timedelta(days=14)
        obs_date_old = now - timedelta(days=120)

        obs_hba1c_recent = ClinicalObservation(
            fact_id="FACT-OBS-HBA1C-2026",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_loinc="4548-4",
            display_name="Hemoglobin A1c (HbA1c)",
            category="laboratory",
            value_numeric=7.4,
            unit="%",
            reference_range_low=4.0,
            reference_range_high=5.6,
            flag="abnormal_high",
            observed_at=obs_date_recent,
            confidence=0.98,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "HbA1c (Glycated Hemoglobin): 7.4% (Ref: 4.0 - 5.6%)"})
        )
        obs_hba1c_old = ClinicalObservation(
            fact_id="FACT-OBS-HBA1C-2025",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_loinc="4548-4",
            display_name="Hemoglobin A1c (HbA1c)",
            category="laboratory",
            value_numeric=8.1,
            unit="%",
            reference_range_low=4.0,
            reference_range_high=5.6,
            flag="abnormal_high",
            observed_at=obs_date_old,
            confidence=0.97,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "HbA1c: 8.1% (Previous Baseline)"})
        )
        obs_glucose_recent = ClinicalObservation(
            fact_id="FACT-OBS-GLUC-FAST",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_loinc="1558-6",
            display_name="Fasting Blood Glucose",
            category="laboratory",
            value_numeric=142.0,
            unit="mg/dL",
            reference_range_low=70.0,
            reference_range_high=99.0,
            flag="abnormal_high",
            observed_at=obs_date_recent,
            confidence=0.99,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Fasting Blood Sugar: 142.0 mg/dL"})
        )
        obs_hb = ClinicalObservation(
            fact_id="FACT-OBS-HB",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_loinc="718-7",
            display_name="Hemoglobin",
            category="hematology",
            value_numeric=13.8,
            unit="g/dL",
            reference_range_low=12.0,
            reference_range_high=16.0,
            flag="normal",
            observed_at=obs_date_recent,
            confidence=0.99,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Hemoglobin: 13.8 g/dL"})
        )
        obs_creat = ClinicalObservation(
            fact_id="FACT-OBS-CREAT",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_loinc="2160-0",
            display_name="Serum Creatinine",
            category="biochemistry",
            value_numeric=1.05,
            unit="mg/dL",
            reference_range_low=0.6,
            reference_range_high=1.2,
            flag="normal",
            observed_at=obs_date_recent,
            confidence=0.99,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Serum Creatinine: 1.05 mg/dL"})
        )
        obs_bp = ClinicalObservation(
            fact_id="FACT-OBS-BP-SYS",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_loinc="8480-6",
            display_name="Systolic Blood Pressure",
            category="vitals",
            value_numeric=138.0,
            unit="mmHg",
            reference_range_low=90.0,
            reference_range_high=120.0,
            flag="abnormal_high",
            observed_at=obs_date_recent,
            confidence=0.95,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "BP: 138/88 mmHg"})
        )
        session.add_all([obs_hba1c_recent, obs_hba1c_old, obs_glucose_recent, obs_hb, obs_creat, obs_bp])

        # 7. Medications for Father
        med1 = MedicationStatement(
            fact_id="FACT-MED-GLYCOMET",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            medicine_name="Glycomet GP2",
            generic_name="Metformin (500mg) + Glimepiride (2mg)",
            atc_code="A10BD02",
            dosage="1 tablet",
            frequency="BD after meals",
            duration="Ongoing",
            is_active=True,
            confidence=0.95,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Tab Glycomet GP 2 BD after food"})
        )
        med2 = MedicationStatement(
            fact_id="FACT-MED-TELMA",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            medicine_name="Telma 40",
            generic_name="Telmisartan 40mg",
            atc_code="C09CA07",
            dosage="40mg",
            frequency="OD morning",
            duration="Ongoing",
            is_active=True,
            confidence=0.95,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Tab Telma 40 OD morning"})
        )
        med3 = MedicationStatement(
            fact_id="FACT-MED-PANTOCID",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            medicine_name="Pantocid 40",
            generic_name="Pantoprazole 40mg",
            atc_code="A02BC02",
            dosage="40mg",
            frequency="OD before breakfast",
            duration="30 days",
            is_active=True,
            confidence=0.95,
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Tab Pantocid 40 OD empty stomach"})
        )
        session.add_all([med1, med2, med3])

        # 8. Allergies and Conditions
        allergy_penicillin = Allergy(
            fact_id="FACT-ALLERGY-PENICILLIN",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            allergen="Penicillin",
            reaction="Severe Urticaria & Facial Angioedema",
            severity="severe",
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Known Allergy: Penicillin (severe rash/swelling)"})
        )
        cond_diabetes = Condition(
            fact_id="FACT-COND-DIABETES",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_snomed="44054006",
            name="Type 2 Diabetes Mellitus",
            clinical_status="active",
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "T2DM uncontrolled on dual oral agents"})
        )
        cond_htn = Condition(
            fact_id="FACT-COND-HYPERTENSION",
            care_profile_id=p_father.id,
            document_id=doc1.id,
            code_snomed="59621000",
            name="Essential Hypertension",
            clinical_status="active",
            verification_status="patient_confirmed",
            provenance_json=json.dumps({"page": 1, "excerpt": "Systemic Hypertension Grade 1"})
        )
        session.add_all([allergy_penicillin, cond_diabetes, cond_htn])

        # 9. Timeline Events
        session.add_all([
            TimelineEvent(
                care_profile_id=p_father.id,
                event_type="lab_report",
                event_date=obs_date_recent,
                title="SRL Comprehensive Blood Panel Processed",
                summary="HbA1c improved to 7.4% from baseline 8.1%. Fasting glucose at 142 mg/dL. Creatinine normal at 1.05 mg/dL.",
                document_id=doc1.id,
                source_fact_id=obs_hba1c_recent.fact_id
            ),
            TimelineEvent(
                care_profile_id=p_father.id,
                event_type="prescription",
                event_date=obs_date_recent - timedelta(days=3),
                title="Prescription Refill Updated",
                summary="Active prescription for Glycomet GP2 (Metformin + Glimepiride) and Telma 40 verified.",
                document_id=doc1.id,
                source_fact_id=med1.fact_id
            ),
        ])

        # 10. Chunks for Hybrid Retrieval
        chunk1 = DocumentChunk(
            care_profile_id=p_father.id,
            document_id=doc1.id,
            page_number=1,
            chunk_text=(
                "SRL Pathology Diagnostic Report for Ramesh Sharma (68/M). "
                "HbA1c Glycated Hemoglobin is 7.4% (previous baseline was 8.1%). "
                "Fasting Blood Glucose is 142.0 mg/dL. Serum Creatinine is 1.05 mg/dL. "
                "Hemoglobin is 13.8 g/dL. Blood Pressure is 138/88 mmHg. "
                "Current Medications: Glycomet GP2, Telma 40, Pantocid 40. "
                "Known Allergy: Penicillin (severe urticaria and facial swelling)."
            ),
            embedding_json=None
        )
        session.add(chunk1)
        await session.commit()

        # Compute initial PatientSnapshot
        await PatientSnapshotService.compute_snapshot(session, p_father.id)
        await PatientSnapshotService.compute_snapshot(session, p_self.id)
        await PatientSnapshotService.compute_snapshot(session, p_mother.id)
