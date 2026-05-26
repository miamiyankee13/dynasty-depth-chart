import React from "react";

/**
 * Tabs — Terminal-styled sticky tab strip.
 * API preserved: `tabs`, `active`, `onChange`, `isDark` (kept for compat, no longer
 * used — both themes share the same Terminal palette).
 *
 * Optional `counts` map (e.g. { QB: 4, RB: 7, ... }) shows small per-tab numbers.
 */
export function Tabs({ tabs, active, onChange, counts }) {
  return (
    <div className="ddc-tabs" role="tablist">
      {tabs.map((t) => {
        const isActive = active === t;
        const count = counts && counts[t];
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={isActive}
            className="ddc-tab ddc-focusable ddc-pressable"
            data-active={isActive ? "true" : "false"}
            data-pos={t}
            onClick={() => onChange(t)}
          >
            {t}
            {typeof count === "number" && (
              <span className="ddc-tab-count">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
