from typing import Any
from app.modules.terminology.catalogs import LOINC_CATALOG

class IngestionRules:
    @staticmethod
    def evaluate_observation_flags(
        test_key: str | None,
        val: float | None,
        ref_low: float | None,
        ref_high: float | None
    ) -> tuple[str, bool]:
        """Evaluates normal/abnormal/critical flags deterministically from reference ranges.

        Returns (flag, is_critical).
        """
        if val is None:
            return "normal", False

        # Check standard critical thresholds if available
        if test_key and test_key in LOINC_CATALOG:
            crit = LOINC_CATALOG[test_key].get("critical_thresholds", {})
            if "high" in crit and val >= crit["high"]:
                return "critical_high", True
            if "low" in crit and val <= crit["low"]:
                return "critical_low", True

        if ref_high is not None and val > ref_high:
            # If greater than 1.5x upper limit, consider critical
            if val >= ref_high * 1.5:
                return "critical_high", True
            return "abnormal_high", False

        if ref_low is not None and val < ref_low:
            if val <= ref_low * 0.6:
                return "critical_low", True
            return "abnormal_low", False

        return "normal", False

    @staticmethod
    def should_require_patient_review(
        fact_type: str,
        is_critical: bool,
        confidence: float,
        is_handwritten: bool = False
    ) -> bool:
        """Review Fatigue Mitigator:

        Only triggers mandatory review prompts for:
        1. Handwritten medications (name/dose/frequency).
        2. Documented allergies.
        3. Critical-value observations.
        4. Any fact with confidence < 0.70.
        All other standard printed facts are stored as 'unreviewed' with a badge without blocking.
        """
        if fact_type == "allergy":
            return True
        if fact_type == "medication" and is_handwritten:
            return True
        if is_critical:
            return True
        if confidence < 0.70:
            return True
        return False
