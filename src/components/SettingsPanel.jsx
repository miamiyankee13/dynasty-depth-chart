// SettingsPanel.jsx
import { useEffect, useState } from "react";
import { clearAppState } from "../services/storage";
import {
  getSleeperUsername,
  setSleeperUsername,
  clearSleeperUsername,
} from "../data/sources/sleeper/sleeperAdapter";

export function SettingsPanel() {

  const [username, setUsername] = useState(getSleeperUsername() || "");

  function connectSleeper() {
    if (!username.trim()) return;
    setSleeperUsername(username.trim());
    location.reload(); // simple + reliable
  }

  function disconnectSleeper() {
    clearSleeperUsername();
    clearAppState();      //clears saved teams/settings
    location.reload();    //starts clean
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
    </div>
  );
}