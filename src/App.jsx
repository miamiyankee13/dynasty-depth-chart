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

  // Default tab: restore preference if present, else QB if a team exists, else SETTINGS
  const teamExists = teams.length > 0;
  const activeTab = prefs.activeTab || (teamExists ? "QB" : "SETTINGS");

  return { teamIndex, activeTab };
}

// ---- merge local edits (settingsText + order) back onto fresh Sleeper data ----
function mergeLocalEditsIntoSleeperTeams(sleeperTeams, savedTeams) {
  const savedById = new Map((savedTeams || []).map((t) => [t.id, t]));

  return (sleeperTeams || []).map((t) => {
    const saved = savedById.get(t.id);
    if (!saved) return t;

    const settingsText = saved.settingsText ?? t.settingsText ?? "";

    const savedOrderByPlayerId = new Map(
      (saved.players || []).map((p) => [p.id, { order: p.order, group: p.group }])
    );

    const players = (t.players || []).map((p) => {
      const o = savedOrderByPlayerId.get(p.id);
      if (!o) return p;
      if (o.group !== p.group) return p;
      return { ...p, order: o.order };
    });

    return { ...t, settingsText, players };
  });
}

export default function App() {
  const [state, setState] = useState(() => loadAppState());

  const initialUi = computeInitialUiFromSavedState(state);

  const [teamIndex, setTeamIndex] = useState(initialUi.teamIndex);
  const [activeTab, setActiveTab] = useState(initialUi.activeTab);

  // Prevent UI prefs from being overwritten by defaults before we restore them
  const didHydrateRef = useRef(false);

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

        const nextTeam = mergedTeams[nextIndex];
        const fallbackTab = nextTeam ? "QB" : "SETTINGS";
        const nextTab = prefs.activeTab || fallbackTab;

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

  // Persist state locally (teams + settingsText + order)
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