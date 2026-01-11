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

const EDITS_KEY = "ddc.edits.v1";

function loadEdits() {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveEdits(next) {
  localStorage.setItem(EDITS_KEY, JSON.stringify(next));
}

function getTeamEdits(teamId) {
  const all = loadEdits();
  return all?.[teamId] || {};
}

function setTeamEdit(teamId, playerId, patch) {
  const all = loadEdits();
  const teamEdits = all[teamId] || {};
  const prev = teamEdits[playerId] || {};
  teamEdits[playerId] = { ...prev, ...patch };
  all[teamId] = teamEdits;
  saveEdits(all);
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

    // 1) From saved app state (covers normal browser refresh)
    const savedByPlayerId = new Map(
      (saved?.players || []).map((p) => [
        p.id,
        { group: p.group, order: p.order, injured: !!p.injured },
      ])
    );

    // 2) From persistent edits (covers disconnect/reconnect)
    const persistentEdits = getTeamEdits(t.id); // playerId -> {group, order, injured}

    // Track max order per group so new players can be appended
    const maxOrderByGroup = new Map();
    for (const p of t.players || []) {
      const o = Number(p.order);
      if (!Number.isFinite(o)) continue;
      const g = p.group;
      maxOrderByGroup.set(g, Math.max(maxOrderByGroup.get(g) || 0, o));
    }

    const players = (t.players || []).map((p) => {
      const e1 = savedByPlayerId.get(p.id);
      const e2 = persistentEdits?.[p.id];

      // Prefer persistent edits over saved state
      const e = e2 || e1;
      if (!e) return p;

      const sameGroup = e.group === p.group;

      const injured =
        typeof e.injured === "boolean" ? e.injured : !!p.injured;

      // Only apply order if group matches (prevents weirdness if your grouping rules change)
      if (sameGroup && e.order != null) {
        return { ...p, order: e.order, injured };
      }

      return { ...p, injured };
    });

    // Append any players that still don't have an order (new players, etc.)
    const normalized = players.map((p) => {
      const o = Number(p.order);
      if (Number.isFinite(o)) return p;

      const g = p.group;
      const nextOrder = (maxOrderByGroup.get(g) || 0) + 1;
      maxOrderByGroup.set(g, nextOrder);
      return { ...p, order: nextOrder };
    });

    return { ...t, players: normalized };
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
    clearAppState(); // clears only dynasty-depthchart.v1 (NOT ddc.edits.v1)
    location.reload(); // simple + reliable
  }

  function disconnectSleeper() {
    clearSleeperUsername();
    clearAppState();      // clears teams from saved app state
    setState({ teams: [] }); // makes teams disappear immediately in UI
    location.reload();
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

  // iPadOS Safari fix:
  // When returning to the app (after app switching or tabbing),
  // Safari may auto-focus a <select> or input and leave the page
  // in a broken interaction state (clicks / drag stop working).
  // Blurring the active element on visibility restore clears it.
  useEffect(() => {
    function blurActiveElementSoon() {
      // Use rAF so Safari finishes restoring the page first
      requestAnimationFrame(() => {
        const el = document.activeElement;
        if (el && typeof el.blur === "function") {
          el.blur();
        }
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        blurActiveElementSoon();
      }
    }

    function handlePageShow() {
      // Covers Safari BFCache restores (very common on iPadOS)
      blurActiveElementSoon();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
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

    // Persist order so disconnect/reconnect won't wipe it
    for (const p of renumbered) {
      setTeamEdit(team.id, p.id, { group, order: p.order });
    }

    setState((prev) => {
      const next = structuredClone(prev);
      const t = next.teams[teamIndex];
      const others = t.players.filter((p) => p.group !== group);
      t.players = [...others, ...renumbered];
      return next;
    });
  }

  function togglePlayerInjured(playerId) {
    if (!team) return;

    setState((prev) => {
      const next = structuredClone(prev);
      const t = next.teams[teamIndex];
      const p = t.players.find((x) => x.id === playerId);
      if (!p) return prev;

      p.injured = !p.injured;

      // Persist injured flag so disconnect/reconnect won't wipe it
      setTeamEdit(t.id, p.id, { group: p.group, injured: !!p.injured });

      return next;
    });
  }

  const ui = {
    card: {
      background: "var(--ddc-card-bg)",
      border: "1px solid var(--ddc-border)",
      borderRadius: 16,
      padding: 14,
      color: "var(--ddc-text)",
    },
    select: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--ddc-input-border)",
      background: "var(--ddc-input-bg)",
      color: "var(--ddc-text)",
      fontSize: 14,
      fontWeight: 700,
      minWidth: 280,
      appearance: "auto",
      WebkitAppearance: "auto",
    },
    pill: {
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid var(--ddc-pill-border)",
      background: "var(--ddc-pill-bg)",
      color: "var(--ddc-text)",
      fontSize: 13,
      fontWeight: 800,
    },
    muted: { color: "var(--ddc-muted)" },
  };

  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
        color: "var(--ddc-text)",
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
            <div
              style={{
                fontSize: "var(--ddc-text-xl)",
                fontWeight: "var(--ddc-weight-bold)",
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
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
                        border: "1px solid var(--ddc-input-border)",
                        background: "var(--ddc-input-bg)",
                        color: "var(--ddc-text)",
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
                      className="ddc-sleeper-input"
                      value={sleeperInput}
                      onChange={(e) => setSleeperInput(e.target.value)}
                      placeholder="Sleeper username"
                      style={{
                        minWidth: 220,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--ddc-input-border)",
                        background: "var(--ddc-input-bg)",
                        color: "var(--ddc-text)",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    />
                    <button
                      onClick={connectSleeper}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--ddc-border)",
                        background: "var(--ddc-text)",
                        color: "var(--ddc-card-bg)",
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
                      e.target.blur(); // iPadOS: don’t leave native select focused
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
            <div
              style={{
                fontSize: "var(--ddc-text-lg)",
                fontWeight: "var(--ddc-weight-bold)",
                letterSpacing: "-0.01em",
              }}
            >
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
              {["QB", "RB", "WR", "TE"]
                .concat((playersByGroup.DEF?.length ?? 0) > 0 ? ["DEF"] : [])
                .concat(["TAXI"])
                .map((g) => (
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
            background: "var(--ddc-card-bg)",
            paddingTop: 10,
            paddingBottom: 10,
            marginTop: 12,
            borderBottom: "1px solid var(--ddc-border)",
          }}
        >
          <Tabs
            key={`${team?.id || "no-team"}:${visibleTabs.join("|")}`}
            tabs={visibleTabs}
            active={activeTab}
            onChange={setActiveTab}
          />
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
            onToggleInjured={togglePlayerInjured}
          />
        </div>
      )}
    </main>
  );
}