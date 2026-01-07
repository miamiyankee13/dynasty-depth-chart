export function SettingsPanel({ settingsText }) {
  return (
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>League Settings</div>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "system-ui", opacity: 0.85 }}>
        {settingsText || "No settings found in CSV (we can add them manually later)."}
      </pre>
    </div>
  );
}
