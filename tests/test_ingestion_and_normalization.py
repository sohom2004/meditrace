import pytest
from app.modules.ingestion.extractor import DocumentExtractor
from app.modules.ingestion.service import IngestionService
from app.modules.terminology.service import TerminologyService


def test_terminology_drug_and_loinc_mapping():
    # Drug mapping
    d1 = TerminologyService.map_indian_drug("Dolo 650")
    assert d1["generic_name"] == "Paracetamol 650mg"
    assert d1["atc_code"] == "N02BE01"

    d2 = TerminologyService.map_indian_drug("Augmentin 625")
    assert "Amoxicillin" in d2["generic_name"]

    # LOINC mapping
    l1 = TerminologyService.normalize_observation("HbA1c Glycated")
    assert l1["code"] == "4548-4"
    assert l1["standard_unit"] == "%"

    l2 = TerminologyService.normalize_observation("Fasting Blood Sugar")
    assert l2["code"] == "1558-6"
    assert l2["standard_unit"] == "mg/dL"


@pytest.mark.asyncio
async def test_document_ingestion_pipeline(db_session):
    # Simulated medical text content
    report_text = """
    LAL PATHLABS CLINICAL REPORT
    Patient: Ramesh Sharma, 68 Y / Male
    TEST RESULTS:
    HbA1c: 7.2 %
    Fasting Blood Sugar: 135.0 mg/dL
    Hemoglobin: 14.1 g/dL
    Serum Creatinine: 1.1 mg/dL
    MEDICATIONS PRESCRIBED:
    Glycomet GP2 1 Tab BD
    Telma 40 1 Tab OD
    ALLERGIES:
    Allergic to Sulfa Drugs
    """
    file_bytes = report_text.encode("utf-8")

    # Step 1: Initiate upload
    init = await IngestionService.initiate_upload(
        session=db_session,
        care_profile_id="cp-ramesh-father",
        user_id="usr-patient-aarav",
        filename="LalPathLabs_Test_Report.txt",
        mime_type="text/plain",
        size_bytes=len(file_bytes)
    )
    doc_id = init["document_id"]

    # Step 2: Complete upload and process
    doc = await IngestionService.process_document_content(
        session=db_session,
        document_id=doc_id,
        file_bytes=file_bytes
    )
    # The allergy ("Sulfa Drugs") triggers targeted review prompt
    assert doc.status in ["needs_review", "completed"]
