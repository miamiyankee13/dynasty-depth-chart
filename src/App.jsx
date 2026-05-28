// src/App.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "./components/Tabs";
import { PlayerList } from "./components/PlayerList";
import { PicksView } from "./components/PicksView";
import { MacroRosterView } from "./components/MacroRosterView";
import { DepthIcon } from "./components/DepthIcon";
import { StatusBar } from "./components/StatusBar";
import { KpiStrip } from "./components/KpiStrip";
import { loadAppState, saveAppState, clearAppState } from "./services/storage";
import {
  loadTeamsFromSleeper,
  getSleeperUsername,
  setSleeperUsername,
  clearSleeperUsername,
} from "./data/sources/sleeper/sleeperAdapter";
import {
  getFantasyCalcValues,
  scaleFantasyCalcValue,
  getFantasyCalcUpdatedAt,
} from "./data/sources/fantasycalc/fantasycalc";

/* ────────────────────────────────────────────────────────────────
   Persistence helpers (UNCHANGED from production)
   ──────────────────────────────────────────────────────────────── */
const UI_KEY = "ddc.ui";
const THEME_KEY = "ddc.theme";

function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function saveTheme(t) {
  try { localStorage.setItem(THEME_KEY, t); } catch {}
}
function applyThemeToDom(t) {
  // Always set the attribute explicitly — the new index.css treats DARK as
  // the :root default and uses [data-theme="light"] for the LIGHT override,
  // so removing the attribute would silently revert to dark.
  document.documentElement.setAttribute(
    "data-theme",
    t === "dark" ? "dark" : "light"
  );
}
function loadUiPrefs() {
  try { return JSON.parse(localStorage.getItem(UI_KEY) || "{}"); } catch { return {}; }
}
function saveUiPrefs(next) {
  const prev = loadUiPrefs();
  localStorage.setItem(UI_KEY, JSON.stringify({ ...prev, ...next }));
}

const EDITS_KEY = "ddc.edits.v1";

function loadEdits() {
  try { return JSON.parse(localStorage.getItem(EDITS_KEY) || "{}"); } catch { return {}; }
}
function saveEdits(next) { localStorage.setItem(EDITS_KEY, JSON.stringify(next)); }
function getTeamEdits(teamId) { return loadEdits()?.[teamId] || {}; }

function setTeamEdit(teamId, playerId, patch) {
  const all = loadEdits();
  const teamEdits = all[teamId] || {};
  const prev = teamEdits[playerId] || {};
  teamEdits[playerId] = { ...prev, ...patch };
  all[teamId] = teamEdits;
  saveEdits(all);
}

const BENCH_STARTS_KEY = "__benchStarts";
function getTeamBenchStarts(teamId) {
  const teamEdits = getTeamEdits(teamId);
  const raw = teamEdits?.[BENCH_STARTS_KEY];
  return raw && typeof raw === "object" ? raw : {};
}
function setTeamBenchStart(teamId, group, idxOrNull) {
  const all = loadEdits();
  const teamEdits = all[teamId] || {};
  const prev = teamEdits[BENCH_STARTS_KEY];
  const benchStarts = prev && typeof prev === "object" ? { ...prev } : {};
  if (idxOrNull == null) delete benchStarts[group];
  else benchStarts[group] = idxOrNull;
  teamEdits[BENCH_STARTS_KEY] = benchStarts;
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
  const activeTab = prefs.activeTab || "QB";
  return { teamIndex, activeTab };
}

function getPickYearsForTeam(team) {
  if (Array.isArray(team?.pickYears) && team.pickYears.length > 0) {
    return team.pickYears.map(String);
  }
  return Object.keys(team?.picksByYear || {}).sort((a, b) => Number(a) - Number(b));
}

function mergeLocalEditsIntoSleeperTeams(sleeperTeams, savedTeams) {
  const savedById = new Map((savedTeams || []).map((t) => [t.id, t]));
  return (sleeperTeams || []).map((t) => {
    const saved = savedById.get(t.id);
    const savedByPlayerId = new Map(
      (saved?.players || []).map((p) => [p.id, { group: p.group, order: p.order, injured: !!p.injured }])
    );
    const persistentEdits = getTeamEdits(t.id);
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
      const e = e2 || e1;
      if (!e) return p;
      const sameGroup = e.group === p.group;
      const injured = typeof e.injured === "boolean" ? e.injured : !!p.injured;
      if (sameGroup && e.order != null) {
        return { ...p, order: e.order, injured };
      }
      return { ...p, injured };
    });
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

const TOAST_KEY = "ddc.toast.v1";
function setNextToast(message) {
  try { localStorage.setItem(TOAST_KEY, JSON.stringify({ message, ts: Date.now() })); } catch {}
}
function consumeNextToast() {
  try {
    const raw = localStorage.getItem(TOAST_KEY);
    if (!raw) return null;
    localStorage.removeItem(TOAST_KEY);
    const parsed = JSON.parse(raw);
    return parsed?.message || null;
  } catch { return null; }
}

function useToast(timeoutMs = 1800) {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), timeoutMs);
    return () => clearTimeout(t);
  }, [toast, timeoutMs]);
  return { toast, showToast: setToast, clearToast: () => setToast(null) };
}

/* ────────────────────────────────────────────────────────────────
   Loading skeleton (restyled with Terminal vars)
   ──────────────────────────────────────────────────────────────── */
function SkeletonHome() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="ddc-skel ddc-shimmer">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="ddc-skel-line lg" style={{ width: "70%" }} />
          <div className="ddc-skel-line md" style={{ width: "45%" }} />
          <div className="ddc-skel-line md" style={{ width: "55%" }} />
        </div>
      </div>
      <div className="ddc-skel ddc-shimmer">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="ddc-skel-line md"
                 style={{ width: 52 + (i % 3) * 18, height: 30 }} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="ddc-skel-row ddc-shimmer" />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   App
   ──────────────────────────────────────────────────────────────── */
export default function App() {
  const [state, setState] = useState(() => loadAppState());
  const initialUi = computeInitialUiFromSavedState(state);

  const [teamIndex, setTeamIndex] = useState(initialUi.teamIndex);
  const [activeTab, setActiveTab] = useState(initialUi.activeTab);
  const { toast, showToast, clearToast } = useToast(1800);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [fcValues, setFcValues] = useState(new Map());
  const [theme, setTheme] = useState(() => loadTheme());
  const [draftResultsByLeague, setDraftResultsByLeague] = useState({});

  useEffect(() => {
    applyThemeToDom(theme);
    saveTheme(theme);
  }, [theme]);

  const didHydrateRef = useRef(false);

  const [sleeperInput, setSleeperInput] = useState(getSleeperUsername() || "");

  function connectSleeper() {
    const u = sleeperInput.trim();
    if (!u) return;
    setSleeperUsername(u);
    clearAppState();
    setNextToast(`Connected to Sleeper as ${u}`);
    location.reload();
  }

  function disconnectSleeper() {
    clearSleeperUsername();
    clearAppState();
    setState({ teams: [] });
    setNextToast("Disconnected from Sleeper (Local Order Preserved)");
    location.reload();
  }

  const connectedAs = getSleeperUsername();
  const teams = state?.teams ?? [];
  const team = teams[teamIndex];
  const pickYears = useMemo(() => getPickYearsForTeam(team), [team]);

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

  const benchSplitEnabled = !!team && activeTab !== "TAXI" && !team?.isBestBall;

  const valuesByPlayerId = useMemo(() => {
    const out = new Map();
    for (const p of team?.players ?? []) {
      const sid = String(p.id).split(":")[1];
      if (!sid) continue;
      const raw = fcValues.get(String(sid));
      const scaled = scaleFantasyCalcValue(raw);
      if (scaled != null) out.set(p.id, scaled);
    }
    return out;
  }, [team, fcValues]);

  const fcUpdatedAt = team?.external?.fantasycalc ? getFantasyCalcUpdatedAt(team.external.fantasycalc) : null;
  const fcUpdatedLabel = fcUpdatedAt
    ? new Date(fcUpdatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const visibleTabs = useMemo(() => {
    if (!team) return [];
    const base = ["QB", "RB", "WR", "TE"];
    if ((playersByGroup.DEF?.length ?? 0) > 0) base.push("DEF");
    if (!team.isBestBall) base.push("TAXI");
    base.push("PICKS");
    base.push("ROSTER");
    return base;
  }, [team, playersByGroup]);

  /* ───── Bootstrap Sleeper + restore UI prefs (unchanged) ───── */
  useEffect(() => {
    (async () => {
      try {
        const username = getSleeperUsername();
        if (!username) {
          didHydrateRef.current = true;
          return;
        }
        setLoadError("");
        setIsLoadingTeams(true);
        const sleeperTeams = await loadTeamsFromSleeper();
        const saved = loadAppState();
        const mergedTeams = mergeLocalEditsIntoSleeperTeams(sleeperTeams, saved?.teams ?? []);
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
        console.warn("Failed to Load Sleeper Teams:", e);
        setLoadError("Couldn’t Load Sleeper Leagues. Check Username and Try Again.");
        showToast("Couldn’t Load Sleeper Leagues. Check Username and Try Again.");
        didHydrateRef.current = true;
      } finally {
        setIsLoadingTeams(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───── iPadOS visibility blur (unchanged) ───── */
  useEffect(() => {
    function blurActiveElementSoon() {
      requestAnimationFrame(() => {
        const el = document.activeElement;
        if (el && typeof el.blur === "function") el.blur();
      });
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") blurActiveElementSoon();
    }
    function handlePageShow() { blurActiveElementSoon(); }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => { if (state) saveAppState(state); }, [state]);

  /* ───── FantasyCalc values fetch (unchanged) ───── */
  useEffect(() => {
    (async () => {
      try {
        const params = team?.external?.fantasycalc;
        if (!params) return;
        const { values } = await getFantasyCalcValues(params);
        setFcValues(values);
      } catch (e) {
        console.warn("FantasyCalc Values Fetch Failed:", e);
      }
    })();
  }, [team?.id]);

  /* ───── Persist active tab / team ───── */
  useEffect(() => {
    if (!didHydrateRef.current) return;
    if (!activeTab) return;
    saveUiPrefs({ activeTab });
  }, [activeTab]);

  useEffect(() => {
    if (!didHydrateRef.current) return;
    const t = teams?.[teamIndex];
    if (!t?.id) return;
    saveUiPrefs({ activeTeamId: t.id });
  }, [teams, teamIndex]);

  useEffect(() => {
    const msg = consumeNextToast();
    if (msg) showToast(msg);
  }, [showToast]);

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? "QB");
    }
  }, [visibleTabs, activeTab]);

  /* ───── Handlers (unchanged) ───── */
  function updateGroupOrder(group, nextList) {
    const renumbered = nextList.map((p, idx) => ({ ...p, order: idx + 1 }));
    for (const p of renumbered) setTeamEdit(team.id, p.id, { group, order: p.order });
    setState((prev) => {
      const next = structuredClone(prev);
      const t = next.teams[teamIndex];
      const others = t.players.filter((p) => p.group !== group);
      t.players = [...others, ...renumbered];
      return next;
    });
    showToast(`${group} Order Saved`);
  }

  function togglePlayerInjured(playerId) {
    if (!team) return;
    setState((prev) => {
      const next = structuredClone(prev);
      const t = next.teams[teamIndex];
      const p = t.players.find((x) => x.id === playerId);
      if (!p) return prev;
      p.injured = !p.injured;
      showToast(p.injured ? "Marked Injured" : "Marked Healthy");
      setTeamEdit(t.id, p.id, { group: p.group, injured: !!p.injured });
      return next;
    });
  }

  const benchStartsForTeam = team?.id ? getTeamBenchStarts(team.id) : {};
  const benchStartIndex =
    typeof benchStartsForTeam?.[activeTab] === "number" ? benchStartsForTeam[activeTab] : null;

  /* ───── Render ───── */
  return (
    <main className="ddc-app">
      <StatusBar connected={!!connectedAs} username={connectedAs} fcUpdated={fcUpdatedLabel} />

      <div className="ddc-header">
        <div className="ddc-brand">
          <div style={{ minWidth: 0 }}>
            <div className="ddc-title">
              Dynasty Depth Chart
            </div>
          </div>

          <div className="ddc-logo" aria-hidden>
            <DepthIcon size={20} />
          </div>
        </div>

        <div className="ddc-utility">
        {connectedAs && (
          <>
            {teams.length > 0 && (
              <span className="ddc-league-count">
                {teams.length} {teams.length === 1 ? "LEAGUE" : "LEAGUES"}
              </span>
            )}
            
            {teams.length > 0 && (
              <select
                className="ddc-select ddc-focusable"
                value={teamIndex}
                onChange={(e) => {
                  setTeamIndex(Number(e.target.value));
                  setActiveTab("QB");
                  e.target.blur();
                }}
                aria-label="Select league"
              >
                {teams.map((t, i) => (
                  <option key={t.id} value={i}>{t.leagueName}</option>
                ))}
              </select>
            )}

            <button
              className="ddc-btn ddc-focusable ddc-pressable"
              onClick={disconnectSleeper}
            >
              DISCONNECT
            </button>

            {/* Mobile theme toggle (shown only on mobile, only when connected) */}
            <button
              className="ddc-btn icon ddc-theme-mobile ddc-focusable ddc-pressable"
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              title="Toggle Theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </>
        )}

          {/* Desktop/iPad theme toggle (always visible on ≥521px) */}
          <button
            className="ddc-btn icon ddc-theme-desktop ddc-focusable ddc-pressable"
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="Toggle Theme"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>

      {/* SUMMARY*/}
      <div className="ddc-summary-sticky">
        <div className={`ddc-summary${!connectedAs ? " ddc-summary-connect" : ""}`}>
                {loadError ? (
            <div style={{ fontSize: 12, color: "var(--ddc-rose)", fontWeight: 500, letterSpacing: ".06em" }}>
              {loadError}
            </div>
          ) : connectedAs && isLoadingTeams ? (
            <div style={{ fontSize: 12, color: "var(--ddc-dim)", letterSpacing: ".08em" }}>
              // LOADING LEAGUES FROM SLEEPER…
            </div>
          ) : !connectedAs ? (
            <div className="ddc-connect-card" style={{ margin: "20px auto" }}>
              <div className="ddc-connect-title">// Connect Sleeper</div>
              <div className="ddc-connect-sub">Enter your Sleeper username to load leagues</div>
              <div className="ddc-connect-row">
                <input
                  className="ddc-input ddc-focusable"
                  value={sleeperInput}
                  onChange={(e) => setSleeperInput(e.target.value)}
                  placeholder="sleeper username"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      connectSleeper();
                    }
                  }}
                />
                <button
                  className="ddc-btn primary ddc-focusable ddc-pressable"
                  onClick={connectSleeper}
                >
                  CONNECT
                </button>
              </div>
            </div>
          ) : !team ? null : (
            <>
              <div className="ddc-summary-top">
                <div className="ddc-league ddc-sans">
                  {team.leagueName}
                  <em>· {team.name}</em>
                </div>
                {fcUpdatedLabel && (
                  <div className="ddc-fc-updated">
                    FC UPDATED · <b>{fcUpdatedLabel.toUpperCase()}</b>
                  </div>
                )}
              </div>

              {(team.settingsPills ?? []).length > 0 && (
                <div className="ddc-settings">
                  {team.settingsPills.map((s) => (
                    <span key={s} className="ddc-setting">{s}</span>
                  ))}
                </div>
              )}

              <KpiStrip
                team={team}
                playersByGroup={playersByGroup}
                valuesByPlayerId={valuesByPlayerId}
                benchStartsByGroup={benchStartsForTeam}
                showBenchSplits={!team?.isBestBall}
              />
            </>
          )}
        </div>
      </div>

      {/* TABS */}
      {visibleTabs.length > 0 && !(connectedAs && isLoadingTeams) && (
        <div className="ddc-tabs-sticky">
          <Tabs
            key={`${team?.id || "no-team"}:${visibleTabs.join("|")}`}
            tabs={visibleTabs}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>
      )}

      {/* CONTENT */}
      <div className="ddc-body">
        {connectedAs && isLoadingTeams ? (
          <SkeletonHome />
        ) : !team ? null : activeTab === "PICKS" ? (
          <PicksView
            picksByYear={team.picksByYear}
            pickYears={pickYears}
            leagueId={team?.external?.leagueId}
            rosterId={team?.external?.rosterId}
            draftResultsByLeague={draftResultsByLeague}
            setDraftResultsByLeague={setDraftResultsByLeague}
            fcParams={team?.external?.fantasycalc}
          />
        ) : activeTab === "ROSTER" ? (
          <MacroRosterView
            playersByGroup={playersByGroup}
            valuesByPlayerId={valuesByPlayerId}
            picksByYear={team.picksByYear}
            settingsPills={team.settingsPills}
            benchStartsByGroup={benchStartsForTeam}
            fcParams={team?.external?.fantasycalc}
          />
        ) : (
          <PlayerList
            key={`${team.id}:${activeTab}`}
            group={activeTab}
            players={playersByGroup[activeTab] ?? []}
            valuesByPlayerId={valuesByPlayerId}
            onReorder={(next) => updateGroupOrder(activeTab, next)}
            onToggleInjured={togglePlayerInjured}
            {...(benchSplitEnabled
              ? {
                  benchStartIndex,
                  onSetBenchStart: (idx) => {
                    if (!team?.id) return;
                    setTeamBenchStart(team.id, activeTab, idx);
                    const name = (playersByGroup[activeTab] ?? [])[idx]?.name;
                    showToast(name ? `Bench Starts at ${name}` : "Bench Split Saved");
                  },
                  onClearBenchStart: () => {
                    if (!team?.id) return;
                    setTeamBenchStart(team.id, activeTab, null);
                    showToast("Bench Split Cleared");
                  },
                }
              : {})}
          />
        )}
      </div>

      {/* FOOTER */}
      <div className="ddc-footer">
        <span>© 2026 Anthony D'Amico. All rights reserved.</span>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="ddc-toast" role="status" aria-live="polite">
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {toast}
          </span>
          <button className="ddc-focusable" onClick={clearToast} aria-label="Dismiss toast">✕</button>
        </div>
      )}
    </main>
  );
}
