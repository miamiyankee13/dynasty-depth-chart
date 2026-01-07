export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid #ddd",
            background: active === t ? "#f2f2f2" : "white",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
