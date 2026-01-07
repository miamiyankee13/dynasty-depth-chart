import { useState } from "react";

export function SettingsPanel({ team, onUpdateSettings }) {
  const [draft, setDraft] = useState(team.settingsText || "");

  function save() {
    onUpdateSettings(draft);
  }

  return (
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 14, background: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontWeight: 700, flex: 1 }}>League Settings</div>
        <button
          onClick={save}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Save
        </button>
      </div>

      <p style={{ marginTop: 8, marginBottom: 8, opacity: 0.75 }}>
        This is saved per team in your browser (we can later migrate it to a database).
      </p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste your scoring/roster settings here..."
        rows={10}
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: 12,
          fontFamily: "system-ui",
          fontSize: 14,
          lineHeight: 1.4,
        }}
      />
    </div>
  );
}
