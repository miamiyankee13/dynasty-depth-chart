// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "./components/Tabs";
import { PlayerList } from "./components/PlayerList";
import { PicksView } from "./components/PicksView";
import { loadAppState, saveAppState, clearAppState } from "./services/storage";
import {
  loadTeamsFromSleeper,
  getSleeperUsername,
  setSleeperUsername,
  clearSleeperUsername,
} from "./data/sources/sleeper/sleeperAdapter";

// ---- UI prefs helpers (team/tab persistence) ----
const UI_KEY = "ddc.ui";

function loadUiPrefs() {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUiPrefs(next) {
  const prev = loadUiPrefs();
  localStorage.setItem(UI_KEY, JSON.stringify({ ...prev, ...next }));
}

function computeInitialUiFromSavedState(savedState) {
  const prefs = loadUiPrefs();

  const teams = savedState?.teams ?? [];
  let teamIndex = 0;

  if (prefs.activeTeamId && teams.length) {
    const idx = teams.findIndex((t) => t.id === prefs.activeTeamId);
    if (idx >= 0) teamIndex = idx;
  }

  // Default tab: restore preference if present, else QB
  const activeTab = prefs.activeTab || "QB";

  return { teamIndex, activeTab };
}

// ---- merge local edits (order) back onto fresh Sleeper data ----
function mergeLocalEditsIntoSleeperTeams(sleeperTeams, savedTeams) {
  const savedById = new Map((savedTeams || []).map((t) => [t.id, t]));

  return (sleeperTeams || []).map((t) => {
    const saved = savedById.get(t.id);
    if (!saved) return t;

    const savedOrderByPlayerId = new Map(
      (saved.players || []).map((p) => [p.id, { order: p.order, group: p.group }])
    );

    const players = (t.players || []).map((p) => {
      const o = savedOrderByPlayerId.get(p.id);
      if (!o) return p;
      if (o.group !== p.group) return p;
      return { ...p, order: o.order };
    });

    return { ...t, players };
  });
}

export default function App() {
  const [state, setState] = useState(() => loadAppState());

  const initialUi = computeInitialUiFromSavedState(state);

  const [teamIndex, setTeamIndex] = useState(initialUi.teamIndex);
  const [activeTab, setActiveTab] = useState(initialUi.activeTab);

  // Prevent UI prefs from being overwritten by defaults before we restore them
  const didHydrateRef = useRef(false);

  // Header Sleeper connect state
  const [sleeperInput, setSleeperInput] = useState(getSleeperUsername() || "");

  function connectSleeper() {
    const u = sleeperInput.trim();
    if (!u) return;
    setSleeperUsername(u);
    location.reload(); // simple + reliable
  }

  function disconnectSleeper() {
    clearSleeperUsername();
    clearAppState(); // clears saved teams/order/etc
    location.reload(); // starts clean
  }

  const connectedAs = getSleeperUsername();

  // Bootstrap Sleeper + restore UI prefs
  useEffect(() => {
    (async () => {
      try {
        const username = getSleeperUsername();
        if (!username) {
          didHydrateRef.current = true;
          return;
        }

        const sleeperTeams = await loadTeamsFromSleeper();

        const saved = loadAppState();
        const mergedTeams = mergeLocalEditsIntoSleeperTeams(
          sleeperTeams,
          saved?.teams ?? []
        );

        const prefs = loadUiPrefs();

        let nextIndex = 0;
        if (prefs.activeTeamId) {
          const idx = mergedTeams.findIndex((t) => t.id === prefs.activeTeamId);
          if (idx >= 0) nextIndex = idx;
        }

        const nextTab = prefs.activeTab || "QB";

        setState({ teams: mergedTeams });
        setTeamIndex((prev) => (prev === nextIndex ? prev : nextIndex));
        setActiveTab((prev) => (prev === nextTab ? prev : nextTab));

        didHydrateRef.current = true;
      } catch (e) {
        console.warn("Failed to load Sleeper teams:", e);
        didHydrateRef.current = true;
      }
    })();
  }, []);

  // Persist state locally (teams + order)
  useEffect(() => {
    if (state) saveAppState(state);
  }, [state]);

  const teams = state?.teams ?? [];
  const team = teams[teamIndex];

  // Persist active tab (AFTER hydrate)
  useEffect(() => {
    if (!didHydrateRef.current) return;
    if (!activeTab) return;
    saveUiPrefs({ activeTab });
  }, [activeTab]);

  // Persist active team id (AFTER hydrate)
  useEffect(() => {
    if (!didHydrateRef.current) return;
    const t = teams?.[teamIndex];
    if (!t?.id) return;
    saveUiPrefs({ activeTeamId: t.id });
  }, [teams, teamIndex]);

  const playersByGroup = useMemo(() => {
    const groups = { QB: [], RB: [], WR: [], TE: [], DEF: [], TAXI: [] };
    for (const p of team?.players ?? []) {
      if (groups[p.group]) groups[p.group].push(p);
    }
    for (const g of Object.keys(groups)) {
      groups[g].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }
    return groups;
  }, [team]);

  const visibleTabs = useMemo(() => {
    if (!team) return [];

    const base = ["QB", "RB", "WR", "TE"];
    if ((playersByGroup.DEF?.length ?? 0) > 0) base.push("DEF");
    base.push("TAXI", "PICKS");
    return base;
  }, [team, playersByGroup]);

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? "QB");
    }
  }, [visibleTabs, activeTab]);

  function updateGroupOrder(group, nextList) {
    const renumbered = nextList.map((p, idx) => ({ ...p, order: idx + 1 }));

    setState((prev) => {
      const next = structuredClone(prev);
      const t = next.teams[teamIndex];
      const others = t.players.filter((p) => p.group !== group);
      t.players = [...others, ...renumbered];
      return next;
    });
  }

  const ui = {
    card: {
      background: "white",
      border: "1px solid #eee",
      borderRadius: 16,
      padding: 14,
    },
    select: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      background: "white",
      fontSize: 14,
      fontWeight: 700,
      minWidth: 280,
    },
    pill: {
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid #eee",
      background: "#fafafa",
      fontSize: 13,
      fontWeight: 800,
    },
    muted: { opacity: 0.75 },
  };

  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {/* APP BAR */}
      <div style={ui.card}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Title */}
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              Dynasty Depth Chart
            </div>

            {/* Controls row under title */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {/* Sleeper connect (always visible) */}
              <div>
                {connectedAs ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                      Sleeper: <span style={{ fontWeight: 900 }}>{connectedAs}</span>
                    </div>
                    <button
                      onClick={disconnectSleeper}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      value={sleeperInput}
                      onChange={(e) => setSleeperInput(e.target.value)}
                      placeholder="Sleeper username"
                      style={{
                        minWidth: 220,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        fontSize: 14,
                        fontWeight: 700,
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
                        fontWeight: 900,
                      }}
                    >
                      Connect
                    </button>
                  </div>
                )}
              </div>

              {/* League dropdown */}
              {teams.length > 0 && (
                <div>
                  <select
                    value={teamIndex}
                    onChange={(e) => {
                      setTeamIndex(Number(e.target.value));
                      setActiveTab("QB");
                    }}
                    style={ui.select}
                  >
                    {teams.map((t, i) => (
                      <option key={t.id} value={i}>
                        {t.leagueName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY STRIP */}
      <div style={{ marginTop: 12, ...ui.card }}>
        {!team ? (
          <div style={{ fontSize: 14, ...ui.muted }}>
            Connect Sleeper above to load your leagues.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>
              {team.leagueName} — {team.name}
            </div>

            {/* Settings pills (ABOVE counts, as requested) */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(team.settingsPills ?? []).map((s) => (
                <div key={s} style={ui.pill}>
                  {s}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["QB", "RB", "WR", "TE", "DEF", "TAXI"].map((g) => (
                <div key={g} style={ui.pill}>
                  {g}: {playersByGroup[g]?.length ?? 0}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["2026", "2027", "2028"].map((y) => (
                <div key={y} style={ui.pill}>
                  {y} picks: {team.picksByYear?.[y]?.length ?? 0}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {visibleTabs.length > 0 && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#fff",
            paddingTop: 10,
            paddingBottom: 10,
            marginTop: 12,
            borderBottom: "1px solid #eee",
          }}
        >
          <Tabs tabs={visibleTabs} active={activeTab} onChange={setActiveTab} />
        </div>
      )}

      {/* Content */}
      {!team ? null : activeTab === "PICKS" ? (
        <PicksView picksByYear={team.picksByYear} />
      ) : (
        <div style={{ marginTop: 18 }}>
          <PlayerList
            group={activeTab}
            players={playersByGroup[activeTab] ?? []}
            onReorder={(next) => updateGroupOrder(activeTab, next)}
          />
        </div>
      )}
    </main>
  );
}