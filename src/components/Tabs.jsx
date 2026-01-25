import { groupTheme } from "../theme";

export function Tabs({ tabs, active, onChange, isDark = false }) {
  return (
    <div className="ddc-tabs" style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      {tabs.map((t) => {
        const base = groupTheme[t] ?? { color: "#111827", bg: "#f3f4f6", label: t };
        const th = isDark && base.bgDark ? { ...base, bg: base.bgDark } : base;
        const qbAccent =
          t === "QB" && isDark
            ? `color-mix(in oklab, ${th.color} 78%, var(--ddc-text))`
            : th.color;

        const isActive = active === t;

        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className="ddc-tab ddc-focusable ddc-pressable"
            data-active={isActive ? "true" : "false"}
            style={{
              border: `1px solid ${isActive ? qbAccent : "var(--ddc-border)"}`,
              background: isActive ? th.bg : "var(--ddc-card-bg)",
              color: isActive ? qbAccent : "var(--ddc-text)",
              cursor: "pointer",
              fontWeight: isActive ? 800 : 600,
            }}
          >
            {th.label}
          </button>
        );
      })}
    </div>
  );
}