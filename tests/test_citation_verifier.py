import pytest
from app.modules.assistant.citation_verifier import DeterministicCitationVerifier


@pytest.mark.asyncio
async def test_valid_citation_verification(db_session):
    # Ramesh Sharma has FACT-OBS-HBA1C-2026 and FACT-MED-GLYCOMET
    text = (
        "Your recent HbA1c is 7.4% [fact_id: FACT-OBS-HBA1C-2026]. "
        "You are currently taking Glycomet GP2 [fact_id: FACT-MED-GLYCOMET]."
    )
    result = await DeterministicCitationVerifier.verify_citations(
        session=db_session,
        care_profile_id="cp-ramesh-father",
        text=text
    )
    assert result.is_valid is True
    assert len(result.verified_sources) == 2
    assert len(result.violations) == 0


@pytest.mark.asyncio
async def test_fabricated_citation_fails(db_session):
    text = "Your calcium level is 9.5 [fact_id: FACT-FAKE-OBS-9999]."
    result = await DeterministicCitationVerifier.verify_citations(
        session=db_session,
        care_profile_id="cp-ramesh-father",
        text=text
    )
    assert result.is_valid is False
    assert len(result.violations) == 1
    assert "FACT-FAKE-OBS-9999" in result.violations[0]


@pytest.mark.asyncio
async def test_cross_profile_citation_fails(db_session):
    # Attempting to cite a fact that exists in another profile but not this one
    text = "Here is a reading [fact_id: FACT-OBS-HBA1C-2026]"
    # Calling on Aarav's self profile where this fact does NOT belong
    result = await DeterministicCitationVerifier.verify_citations(
        session=db_session,
        care_profile_id="cp-aarav-self",
        text=text
    )
    assert result.is_valid is False
    assert len(result.violations) == 1
