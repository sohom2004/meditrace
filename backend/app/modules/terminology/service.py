import re
from typing import Any
from app.modules.terminology.catalogs import (
    INDIAN_DRUG_CATALOG,
    LOINC_CATALOG,
    UNIT_CONVERSION_FACTORS,
)


class TerminologyService:
    @staticmethod
    def normalize_observation(test_name: str) -> dict[str, Any]:
        """Resolves raw diagnostic test names (e.g. 'HbA1c Glycated', 'Fasting Sugar') to standard LOINC code, display name, and standard unit."""
        cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", test_name.lower()).strip()
        for key, entry in LOINC_CATALOG.items():
            if key in cleaned or entry["display_name"].lower() in cleaned:
                return entry

        # Specific alias checks
        if "hba1c" in cleaned or "glycated" in cleaned:
            return LOINC_CATALOG["hba1c"]
        if "fasting" in cleaned and ("glucose" in cleaned or "sugar" in cleaned):
            return LOINC_CATALOG["glucose_fasting"]
        if ("pp" in cleaned or "post" in cleaned) and ("glucose" in cleaned or "sugar" in cleaned):
            return LOINC_CATALOG["glucose_pp"]
        if "hemo" in cleaned or "haemo" in cleaned or "hb" in cleaned.split():
            return LOINC_CATALOG["hemoglobin"]
        if "creatinine" in cleaned:
            return LOINC_CATALOG["creatinine"]
        if "cholesterol" in cleaned:
            return LOINC_CATALOG["cholesterol_total"]
        if "platelet" in cleaned:
            return LOINC_CATALOG["platelets"]
        if "tsh" in cleaned or "thyroid" in cleaned:
            return LOINC_CATALOG["tsh"]
        if "bp" in cleaned or "blood pressure" in cleaned:
            return LOINC_CATALOG["blood_pressure_systolic"]

        return {
            "code": None,
            "display_name": test_name.strip(),
            "category": "laboratory",
            "standard_unit": None,
            "default_range": {"low": None, "high": None},
            "critical_thresholds": {}
        }

    @staticmethod
    def map_indian_drug(brand_name: str) -> dict[str, str]:
        """Maps Indian brand names to generic molecule formulation, ATC code, and drug class."""
        cleaned = brand_name.lower().strip()
        for brand, info in INDIAN_DRUG_CATALOG.items():
            if brand in cleaned or cleaned in brand:
                return {
                    "brand_name": brand_name,
                    "generic_name": info["generic"],
                    "atc_code": info["atc"],
                    "drug_class": info["class"],
                    "standard_dose": info["standard_dose"]
                }

        return {
            "brand_name": brand_name,
            "generic_name": brand_name,
            "atc_code": None,
            "drug_class": "Unmapped Medication",
            "standard_dose": None
        }

    @staticmethod
    def convert_unit(value: float, from_unit: str, to_unit: str) -> float | None:
        """Deterministically converts clinical values across units if a conversion is defined."""
        if not from_unit or not to_unit:
            return value
        f = from_unit.strip().lower()
        t = to_unit.strip().lower()
        if f == t:
            return value
        factor = UNIT_CONVERSION_FACTORS.get((f, t))
        if factor is not None:
            return round(value * factor, 3)
        return None
