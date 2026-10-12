from typing import Any

# Standard LOINC Mappings for common Indian diagnostic lab panels (PathLabs, SRL, Lal PathLabs)
LOINC_CATALOG: dict[str, dict[str, Any]] = {
    "hba1c": {
        "code": "4548-4",
        "display_name": "Hemoglobin A1c (HbA1c)",
        "category": "laboratory",
        "standard_unit": "%",
        "default_range": {"low": 4.0, "high": 5.6},
        "critical_thresholds": {"high": 10.0}
    },
    "glucose_fasting": {
        "code": "1558-6",
        "display_name": "Fasting Blood Glucose",
        "category": "laboratory",
        "standard_unit": "mg/dL",
        "default_range": {"low": 70.0, "high": 99.0},
        "critical_thresholds": {"low": 50.0, "high": 250.0}
    },
    "glucose_pp": {
        "code": "1521-4",
        "display_name": "Post-Prandial Blood Glucose",
        "category": "laboratory",
        "standard_unit": "mg/dL",
        "default_range": {"low": 90.0, "high": 140.0},
        "critical_thresholds": {"low": 50.0, "high": 300.0}
    },
    "hemoglobin": {
        "code": "718-7",
        "display_name": "Hemoglobin",
        "category": "hematology",
        "standard_unit": "g/dL",
        "default_range": {"low": 12.0, "high": 16.0},
        "critical_thresholds": {"low": 7.0, "high": 20.0}
    },
    "creatinine": {
        "code": "2160-0",
        "display_name": "Serum Creatinine",
        "category": "biochemistry",
        "standard_unit": "mg/dL",
        "default_range": {"low": 0.6, "high": 1.2},
        "critical_thresholds": {"high": 3.0}
    },
    "cholesterol_total": {
        "code": "2093-3",
        "display_name": "Total Cholesterol",
        "category": "lipid_profile",
        "standard_unit": "mg/dL",
        "default_range": {"low": 125.0, "high": 200.0},
        "critical_thresholds": {"high": 300.0}
    },
    "platelets": {
        "code": "777-3",
        "display_name": "Platelet Count",
        "category": "hematology",
        "standard_unit": "10^3/uL",
        "default_range": {"low": 150.0, "high": 450.0},
        "critical_thresholds": {"low": 50.0}
    },
    "tsh": {
        "code": "3016-3",
        "display_name": "Thyroid Stimulating Hormone (TSH)",
        "category": "endocrinology",
        "standard_unit": "uIU/mL",
        "default_range": {"low": 0.4, "high": 4.5},
        "critical_thresholds": {"high": 15.0}
    },
    "blood_pressure_systolic": {
        "code": "8480-6",
        "display_name": "Systolic Blood Pressure",
        "category": "vitals",
        "standard_unit": "mmHg",
        "default_range": {"low": 90.0, "high": 120.0},
        "critical_thresholds": {"high": 180.0, "low": 75.0}
    },
    "blood_pressure_diastolic": {
        "code": "8462-4",
        "display_name": "Diastolic Blood Pressure",
        "category": "vitals",
        "standard_unit": "mmHg",
        "default_range": {"low": 60.0, "high": 80.0},
        "critical_thresholds": {"high": 110.0, "low": 45.0}
    }
}

# Indian Brand Name -> Generic & ATC Mapping
INDIAN_DRUG_CATALOG: dict[str, dict[str, str]] = {
    "dolo 650": {
        "generic": "Paracetamol 650mg",
        "atc": "N02BE01",
        "class": "Analgesic / Antipyretic",
        "standard_dose": "650mg TDS/SOS"
    },
    "calpol 650": {
        "generic": "Paracetamol 650mg",
        "atc": "N02BE01",
        "class": "Analgesic / Antipyretic",
        "standard_dose": "650mg SOS"
    },
    "augmentin 625": {
        "generic": "Amoxicillin (500mg) + Clavulanic Acid (125mg)",
        "atc": "J01CR02",
        "class": "Broad-spectrum Antibiotic",
        "standard_dose": "625mg BD"
    },
    "moxikind cv 625": {
        "generic": "Amoxicillin (500mg) + Clavulanic Acid (125mg)",
        "atc": "J01CR02",
        "class": "Broad-spectrum Antibiotic",
        "standard_dose": "625mg BD"
    },
    "glycomet gp2": {
        "generic": "Metformin (500mg) + Glimepiride (2mg)",
        "atc": "A10BD02",
        "class": "Oral Antidiabetic",
        "standard_dose": "1 tablet BD after food"
    },
    "glimisave m2": {
        "generic": "Metformin (500mg) + Glimepiride (2mg)",
        "atc": "A10BD02",
        "class": "Oral Antidiabetic",
        "standard_dose": "1 tablet BD"
    },
    "telma 40": {
        "generic": "Telmisartan 40mg",
        "atc": "C09CA07",
        "class": "Angiotensin II Receptor Blocker (Antihypertensive)",
        "standard_dose": "40mg OD morning"
    },
    "telmisat 40": {
        "generic": "Telmisartan 40mg",
        "atc": "C09CA07",
        "class": "Antihypertensive",
        "standard_dose": "40mg OD"
    },
    "pantocid 40": {
        "generic": "Pantoprazole 40mg",
        "atc": "A02BC02",
        "class": "Proton Pump Inhibitor (Antacid)",
        "standard_dose": "40mg OD before breakfast"
    },
    "pan 40": {
        "generic": "Pantoprazole 40mg",
        "atc": "A02BC02",
        "class": "Proton Pump Inhibitor",
        "standard_dose": "40mg OD empty stomach"
    },
    "ecosprin 75": {
        "generic": "Acetylsalicylic Acid (Aspirin 75mg)",
        "atc": "B01AC06",
        "class": "Antiplatelet / Blood Thinner",
        "standard_dose": "75mg OD after dinner"
    },
    "ecosprin 150": {
        "generic": "Acetylsalicylic Acid (Aspirin 150mg)",
        "atc": "B01AC06",
        "class": "Antiplatelet",
        "standard_dose": "150mg OD"
    },
    "thyronorm 50": {
        "generic": "Levothyroxine Sodium 50mcg",
        "atc": "H03AA01",
        "class": "Thyroid Hormone",
        "standard_dose": "50mcg OD early morning empty stomach"
    },
    "rosuvas 10": {
        "generic": "Rosuvastatin 10mg",
        "atc": "C10AA07",
        "class": "Statin (Lipid lowering)",
        "standard_dose": "10mg OD bedtime"
    },
    "montair lc": {
        "generic": "Montelukast (10mg) + Levocetirizine (5mg)",
        "atc": "R03DC53",
        "class": "Antiallergic / Antiasthmatic",
        "standard_dose": "1 tablet OD night"
    },
    "azithral 500": {
        "generic": "Azithromycin 500mg",
        "atc": "J01FA10",
        "class": "Macrolide Antibiotic",
        "standard_dose": "500mg OD for 3-5 days"
    }
}

# Unit Conversions for Clinical Comparisons
UNIT_CONVERSION_FACTORS: dict[tuple[str, str], float] = {
    # Glucose: mmol/L -> mg/dL
    ("mmol/l", "mg/dl"): 18.0182,
    ("mg/dl", "mmol/l"): 0.0555,
    # Hemoglobin: mmol/L -> g/dL
    ("mmol/l", "g/dl"): 1.611,
    ("g/dl", "mmol/l"): 0.6207,
    # Cholesterol: mmol/L -> mg/dL
    ("mmol/l_chol", "mg/dl"): 38.67,
    # Creatinine: umol/L -> mg/dL
    ("umol/l", "mg/dl"): 0.0113,
    ("mg/dl", "umol/l"): 88.4,
}
