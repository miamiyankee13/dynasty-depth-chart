import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "./components/Tabs";
import { PlayerList } from "./components/PlayerList";
import { PicksView } from "./components/PicksView";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadAppState, saveAppState } from "./services/storage";
import {
  loadTeamsFromSleeper,
  getSleeperUsername,
} from "./data/sources/sleeper/sleeperAdapter";

export default function App() {
  const [state, setState] = useState(() => loadAppState());
  const [activeTab, setActiveTab] = useState("QB");
  const [teamIndex, setTeamIndex] = useState(0);
  const didMountTeamSwitchRef = useRef(false);

  // Bootstrap from Sleeper if connected
  useEffect(() => {
    (async () => {
      try {
        const username = getSleeperUsername();
        if (!username) return;

        const sleeperTeams = await loadTeamsFromSleeper();
        setState({ teams: sleeperTeams });
        setTeamIndex(0);
        setActiveTab("QB");
      } catch (e) {
        console.warn("Failed to load Sleeper teams:", e);
      }
    })();
  }, []);

  // Persist state locally
  useEffect(() => {
    if (state) saveAppState(state);
  }, [state]);

  const teams = state?.teams ?? [];
  const team = teams[teamIndex];

  // On team switch, reset tab to QB (but not on initial mount)
  useEffect(() => {
    if (!didMountTeamSwitchRef.current) {
      didMountTeamSwitchRef.current = true;
      return;
    }
    setActiveTab("QB");
  }, [teamIndex]);

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
    if (!team) return ["SETTINGS"];

    const base = ["QB", "RB", "WR", "TE"];
    if ((playersByGroup.DEF?.length ?? 0) > 0) base.push("DEF");
    base.push("TAXI", "PICKS", "SETTINGS");
    return base;
  }, [team, playersByGroup]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? "SETTINGS");
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Dynasty Depth Chart</div>
          </div>

          {/* League dropdown */}
          {teams.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <select
                value={teamIndex}
                onChange={(e) => setTeamIndex(Number(e.target.value))}
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

      {/* SUMMARY STRIP */}
      <div style={{ marginTop: 12, ...ui.card }}>
        {!team ? (
          <div style={{ fontSize: 14, ...ui.muted }}>
            Connect Sleeper in Settings to load your leagues.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>
              {team.leagueName} — {team.name}
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

            <div>
              <div style={{ fontSize: 12, fontWeight: 800, ...ui.muted, marginBottom: 6 }}>
                League settings (optional)
              </div>
              <div
                style={{
                  fontSize: 13,
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 10,
                  background: "#fafafa",
                  ...ui.muted,
                }}
              >
                {team.settingsText?.trim()
                  ? team.settingsText.trim().slice(0, 220) +
                    (team.settingsText.trim().length > 220 ? "…" : "")
                  : "Add settings on the Settings tab (format/notes are flexible)."}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
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

      {/* Content */}
      {activeTab === "SETTINGS" ? (
        <SettingsPanel
          key={team?.id || "no-team"}
          team={team}
          onUpdateSettings={(nextText) => {
            if (!team) return;
            setState((prev) => {
              const next = structuredClone(prev);
              next.teams[teamIndex].settingsText = nextText;
              return next;
            });
          }}
        />
      ) : !team ? null : activeTab === "PICKS" ? (
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