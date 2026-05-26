import React from "react";

/**
 * ValBar — derived amber bar. Width = value / max in the same group, clamped 0–100%.
 * The `value` field is already-scaled FantasyCalc output (raw / 100), matching
 * what the production `scaleFantasyCalcValue` returns.
 */
export function ValBar({ value, maxValue }) {
  const n = Number(value);
  const m = Number(maxValue);
  const pct =
    Number.isFinite(n) && Number.isFinite(m) && m > 0
      ? Math.min(100, Math.max(0, (n / m) * 100))
      : 0;
  return (
    <span className="ddc-val-bar" aria-hidden>
      <i style={{ width: pct + "%" }} />
    </span>
  );
}
