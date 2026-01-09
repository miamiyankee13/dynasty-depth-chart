import { groupTheme } from "../theme";

export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {tabs.map((t) => {
        const th = groupTheme[t] ?? { color: "#111827", bg: "#f3f4f6", label: t };
        const isActive = active === t;

        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className="ddc-tab"
            data-active={isActive ? "true" : "false"}
            style={{
              border: `1px solid ${isActive ? th.color : "#e5e7eb"}`,
              background: isActive ? th.bg : "white",
              color: isActive ? th.color : "#111827",
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