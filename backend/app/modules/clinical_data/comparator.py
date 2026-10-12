from typing import Literal
from app.core.errors import ValidationError
from app.modules.terminology.service import TerminologyService

class ObservationComparator:
    @staticmethod
    def compare(
        test_name: str,
        current_val: float,
        current_unit: str,
        current_date_str: str,
        prev_val: float | None = None,
        prev_unit: str | None = None,
        prev_date_str: str | None = None,
        target_unit: str | None = None,
        ref_low: float | None = None,
        ref_high: float | None = None,
        crit_threshold: float | None = None
    ) -> dict[str, any]:
        """Calculates deterministic numerical deltas, unit alignment, and trends.

        The assistant runtime consumes this structured result directly.
        The LLM explains it; code computes it!
        """
        # Resolve target unit
        norm_info = TerminologyService.normalize_observation(test_name)
        active_unit = target_unit or norm_info.get("standard_unit") or current_unit or ""

        # Normalize current value
        c_norm = current_val
        if current_unit and active_unit and current_unit.lower() != active_unit.lower():
            converted = TerminologyService.convert_unit(current_val, current_unit, active_unit)
            if converted is None:
                raise ValidationError(
                    f"Unit Incompatibility: Cannot safely convert current unit '{current_unit}' to '{active_unit}' for {test_name}"
                )
            c_norm = converted

        # If no previous reading, return single point summary
        if prev_val is None:
            flag = ObservationComparator.determine_flag(c_norm, ref_low, ref_high, crit_threshold)
            return {
                "test_name": test_name,
                "normalized_unit": active_unit,
                "current_value": round(c_norm, 2),
                "current_date": current_date_str,
                "previous_value": None,
                "previous_date": None,
                "delta": None,
                "delta_percentage": None,
                "trend_direction": "first_reading",
                "status_flag": flag,
                "interpretation_note": f"Initial recorded value: {round(c_norm, 2)} {active_unit} ({flag}). No prior baseline for comparison."
            }

        # Normalize previous value
        p_norm = prev_val
        if prev_unit and active_unit and prev_unit.lower() != active_unit.lower():
            converted = TerminologyService.convert_unit(prev_val, prev_unit, active_unit)
            if converted is None:
                raise ValidationError(
                    f"Unit Incompatibility: Cannot safely convert previous unit '{prev_unit}' to '{active_unit}' for {test_name}"
                )
            p_norm = converted

        # Calculate exact deltas
        delta = round(c_norm - p_norm, 2)
        pct_delta = round((delta / p_norm * 100), 2) if p_norm != 0 else 0.0

        if abs(delta) < 0.01:
            direction: Literal["up", "down", "stable", "first_reading"] = "stable"
        elif delta > 0:
            direction = "up"
        else:
            direction = "down"

        flag = ObservationComparator.determine_flag(c_norm, ref_low, ref_high, crit_threshold)

        note = (
            f"Observed {direction} by {abs(delta)} {active_unit} ({abs(pct_delta)}%) "
            f"from {round(p_norm, 2)} on {prev_date_str} to {round(c_norm, 2)} on {current_date_str}. "
            f"Current status: {flag}."
        )

        return {
            "test_name": test_name,
            "normalized_unit": active_unit,
            "current_value": round(c_norm, 2),
            "current_date": current_date_str,
            "previous_value": round(p_norm, 2),
            "previous_date": prev_date_str,
            "delta": delta,
            "delta_percentage": pct_delta,
            "trend_direction": direction,
            "status_flag": flag,
            "interpretation_note": note
        }

    @staticmethod
    def determine_flag(
        val: float,
        ref_low: float | None = None,
        ref_high: float | None = None,
        crit_threshold: float | None = None
    ) -> str:
        if crit_threshold is not None and val >= crit_threshold:
            return "critical_high"
        if ref_high is not None and val > ref_high:
            return "abnormal_high"
        if ref_low is not None and val < ref_low:
            return "abnormal_low"
        return "normal"
