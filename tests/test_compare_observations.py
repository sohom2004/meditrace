import pytest
from app.core.errors import ValidationError
from app.modules.clinical_data.comparator import ObservationComparator


def test_observation_comparator_trend_down():
    # Comparing HbA1c: baseline 8.1% -> current 7.4%
    res = ObservationComparator.compare(
        test_name="Hemoglobin A1c (HbA1c)",
        current_val=7.4,
        current_unit="%",
        current_date_str="2026-08-10",
        prev_val=8.1,
        prev_unit="%",
        prev_date_str="2026-03-05",
        ref_low=4.0,
        ref_high=5.6
    )
    assert res["test_name"] == "Hemoglobin A1c (HbA1c)"
    assert res["trend_direction"] == "down"
    assert res["delta"] == -0.7
    assert res["current_value"] == 7.4
    assert res["previous_value"] == 8.1
    assert "Observed down by 0.7 %" in res["interpretation_note"]


def test_observation_comparator_initial_reading():
    res = ObservationComparator.compare(
        test_name="Serum Creatinine",
        current_val=1.05,
        current_unit="mg/dL",
        current_date_str="2026-08-10",
        prev_val=None,
        ref_low=0.6,
        ref_high=1.2
    )
    assert res["trend_direction"] == "first_reading"
    assert res["delta"] is None
    assert res["status_flag"] == "normal"


def test_observation_unit_conversion():
    # Glucose: 7.0 mmol/L should convert to ~126.13 mg/dL
    res = ObservationComparator.compare(
        test_name="Fasting Blood Glucose",
        current_val=7.0,
        current_unit="mmol/L",
        current_date_str="2026-08-10",
        prev_val=140.0,
        prev_unit="mg/dL",
        prev_date_str="2026-03-05",
        target_unit="mg/dL"
    )
    assert res["normalized_unit"] == "mg/dL"
    assert round(res["current_value"], 0) == 126.0
    assert res["trend_direction"] == "down"


def test_observation_incompatible_unit_error():
    # Attempting to compare blood pressure (mmHg) to glucose (mg/dL) must raise ValidationError
    with pytest.raises(ValidationError):
        ObservationComparator.compare(
            test_name="Fasting Blood Glucose",
            current_val=120.0,
            current_unit="mmHg",
            current_date_str="2026-08-10",
            target_unit="mg/dL"
        )
