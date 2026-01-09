// SettingsPanel.jsx
import { useEffect, useState } from "react";
import {
  getSleeperUsername,
  setSleeperUsername,
  clearSleeperUsername,
} from "../data/sources/sleeper/sleeperAdapter";

export function SettingsPanel({ team, onUpdateSettings }) {
  const [draft, setDraft] = useState(team?.settingsText || "");
  const [username, setUsername] = useState(getSleeperUsername() || "");

  // Keep draft synced when switching teams
  useEffect(() => {
    setDraft(team?.settingsText || "");
  }, [team?.id]);

  function saveSettings() {
    if (!team) return;
    onUpdateSettings?.(draft);
  }

  function connectSleeper() {
    if (!username.trim()) return;
    setSleeperUsername(username.trim());
    location.reload(); // simple + reliable
  }

  function disconnectSleeper() {
    clearSleeperUsername();
    location.reload();
  }

  const connectedAs = getSleeperUsername();

  return (
    <div style={{ marginTop: 16 }}>
      {/* Sleeper Connection (always visible) */}
      <div
        style={{
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 14,
          background: "white",
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Sleeper</div>

        {connectedAs ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14 }}>
              Connected as <strong>{connectedAs}</strong>
            </div>
            <button
              onClick={disconnectSleeper}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Sleeper username"
              style={{
                flex: 1,
                minWidth: 220,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                fontSize: 14,
              }}
            />
            <button
              onClick={connectSleeper}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Connect
            </button>
          </div>
        )}
      </div>

      {/* League Settings (only when a team exists) */}
      {!team ? null : (
        <div
          style={{
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 14,
            background: "white",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 700, flex: 1 }}>League Settings</div>
            <button
              onClick={saveSettings}
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
            This is saved per team in your browser.
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
      )}
    </div>
  );
}