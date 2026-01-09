import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "./components/Tabs";
import { PlayerList } from "./components/PlayerList";
import { PicksView } from "./components/PicksView";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadAppState, saveAppState } from "./services/storage";
import { parseDepthChartCsv } from "./services/parseCsv";
import { getDepthChartTemplateCsv, downloadCsv } from "./services/templateCsv";

export default function App() {
  const [state, setState] = useState(() => loadAppState());
  const [activeTab, setActiveTab] = useState("QB");
  const [teamIndex, setTeamIndex] = useState(0);
  const fileInputRef = useRef(null);
  const didMountTeamSwitchRef = useRef(false);

  useEffect(() => {
    if (state) saveAppState(state);
  }, [state]);

  const teams = state?.teams ?? (state?.team ? [state.team] : []);
  const team = teams[teamIndex];

  useEffect(() => {
  // Avoid forcing QB on first mount/initial load
  if (!didMountTeamSwitchRef.current) {
    didMountTeamSwitchRef.current = true;
    return;
  }
  setActiveTab("QB");
}, [teamIndex]);


  function handleImportCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseDepthChartCsv(reader.result);
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

  const visibleTabs = useMemo(() => {
  const base = ["QB", "RB", "WR", "TE"];

  // Only show DEF if this team has any DEF players
  if ((playersByGroup.DEF?.length ?? 0) > 0) base.push("DEF");

  // Always show TAXI if you want it always available;
  // or make it conditional like DEF if you prefer.
  base.push("TAXI", "PICKS", "SETTINGS");

  return base;
}, [playersByGroup]);

useEffect(() => {
  if (!visibleTabs.includes(activeTab)) {
    setActiveTab("QB");
  }
}, [visibleTabs, activeTab]);

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

  const ui = {
    card: {
      background: "white",
      border: "1px solid #eee",
      borderRadius: 16,
      padding: 14,
    },
    btn: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #ddd",
      background: "white",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 700,
    },
    btnPrimary: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #111827",
      background: "#111827",
      color: "white",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 800,
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
            <div style={{ fontSize: 13, ...ui.muted }}>
              Upload a CSV template to view your leagues as a clean depth chart.
            </div>
          </div>

          {/* League dropdown (league name only) */}
          {teams.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, ...ui.muted }}>League</div>
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

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && handleImportCsv(e.target.files[0])}
            />

            <button style={ui.btnPrimary} onClick={() => fileInputRef.current?.click()}>
              Import CSV
            </button>

            <button
              style={ui.btn}
              onClick={() =>
                downloadCsv("Dynasty Depth Charts - TEMPLATE.csv", getDepthChartTemplateCsv())
              }
            >
              Download template
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY STRIP */}
<div style={{ marginTop: 12, ...ui.card }}>
  {!team ? (
    <div style={{ fontSize: 14, ...ui.muted }}>Import a CSV to begin.</div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* League / Team */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 800, ...ui.muted }}>League — Team</div>
        <div style={{ fontSize: 16, fontWeight: 900 }}>
          {team.leagueName} — {team.name}
        </div>
      </div>

      {/* Position counts */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {["QB", "RB", "WR", "TE", "DEF", "TAXI"].map((g) => (
          <div key={g} style={ui.pill}>
            {g}: {playersByGroup[g]?.length ?? 0}
          </div>
        ))}
      </div>

      {/* Picks counts */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {["2026", "2027", "2028"].map((y) => (
          <div key={y} style={ui.pill}>
            {y} picks: {team.picksByYear?.[y]?.length ?? 0}
          </div>
        ))}
      </div>

      {/* Settings preview */}
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
          top: 12,
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
      {!team ? null : activeTab === "PICKS" ? (
        <PicksView picksByYear={team.picksByYear} />
      ) : activeTab === "SETTINGS" ? (
        <SettingsPanel
          key={team.id} // IMPORTANT: remount per team so settings don't appear "global"
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
            group={activeTab}
            players={playersByGroup[activeTab] ?? []}
            onReorder={(next) => updateGroupOrder(activeTab, next)}
          />
        </div>
      )}
    </main>
  );
}