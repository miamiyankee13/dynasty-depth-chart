import { useEffect, useMemo, useState } from "react";
import { Tabs } from "./components/Tabs";
import { PlayerList } from "./components/PlayerList";
import { PicksView } from "./components/PicksView";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadAppState, saveAppState } from "./services/storage";
import { parseDepthChartCsv } from "./services/parseCsv";

const TAB_ORDER = ["QB", "RB", "WR", "TE", "DEF", "TAXI", "PICKS", "SETTINGS"];

export default function App() {
  const [state, setState] = useState(() => loadAppState());
  const [activeTab, setActiveTab] = useState("QB");
  const [teamIndex, setTeamIndex] = useState(0);

  useEffect(() => {
    if (state) saveAppState(state);
  }, [state]);

  const teams = state?.teams ?? (state?.team ? [state.team] : []);
  const team = teams[teamIndex];

  function handleImportCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseDepthChartCsv(reader.result, file.name);
      setState({ teams: parsed.teams });
      setTeamIndex(0);
      setActiveTab("QB");
    } catch (err) {
      alert(err.message || "Failed to import CSV");
    }
  };
  reader.readAsText(file);
}

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

  function updateGroupOrder(group, nextList) {
    // when you reorder in a group, we renumber order 1..n
    const renumbered = nextList.map((p, idx) => ({ ...p, order: idx + 1 }));

    setState((prev) => {
      const next = structuredClone(prev);
      const t = next.teams[teamIndex];
      const others = t.players.filter((p) => p.group !== group);
      t.players = [...others, ...renumbered];
      return next;
    });
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, flex: 1 }}>Dynasty Depth Chart</h1>

        <label style={{ fontSize: 14 }}>
          Import CSV{" "}
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleImportCsv(e.target.files[0])}
          />
        </label>
      </div>

      <div style={{ marginTop: 12, opacity: 0.8 }}>
        {team ? (
          <>
            <strong>{team.name}</strong> — {team.leagueName}
          </>
        ) : (
          "Import a CSV to begin."
        )}
      </div>

      {teams.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <select value={teamIndex} onChange={(e) => setTeamIndex(Number(e.target.value))}>
            {teams.map((t, i) => (
              <option key={t.id} value={i}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Tabs tabs={TAB_ORDER} active={activeTab} onChange={setActiveTab} />
      </div>

      {!team ? null : activeTab === "PICKS" ? (
        <PicksView picksByYear={team.picksByYear} />
      ) : activeTab === "SETTINGS" ? (
        <SettingsPanel
          team={team}
          onUpdateSettings={(nextText) => {
            setState((prev) => {
              const next = structuredClone(prev);
              next.teams[teamIndex].settingsText = nextText;
              return next;
            });
          }}
        />

      ) : (
        <div style={{ marginTop: 16 }}>
          <PlayerList
            players={playersByGroup[activeTab] ?? []}
            onReorder={(next) => updateGroupOrder(activeTab, next)}
          />
        </div>
      )}
    </main>
  );
}
