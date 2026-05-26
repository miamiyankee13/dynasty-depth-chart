import React from "react";

/**
 * StatusBar — top chrome strip.
 * Left slot: status pulse + label.
 * Right slot: connected user / updated state.
 * When `connected` is false, the pulse turns rose ("OFFLINE").
 */
export function StatusBar({ connected, username, fcUpdated }) {
  return (
    <div className={`ddc-statusbar${connected ? "" : " offline"}`}>
      <div>
        <span className="pulse" />
        <b className="label">{connected ? "LIVE" : "OFFLINE"}</b>
        {" · LOCAL · AUTOSAVED"}
      </div>

      <div className="clock">
        {connected && username
          ? `CONNECTED · ${String(username).toUpperCase()}`
          : fcUpdated
            ? `UPDATED · ${String(fcUpdated).toUpperCase()}`
            : "AWAITING CONNECTION"}
      </div>
    </div>
  );
}