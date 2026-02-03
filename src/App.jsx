// src/App.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "./components/Tabs";
import { PlayerList } from "./components/PlayerList";
import { PicksView } from "./components/PicksView";
import { MacroRosterView } from "./components/MacroRosterView";
import { DepthIcon } from "./components/DepthIcon";
import { loadAppState, saveAppState, clearAppState } from "./services/storage";
import { loadTeamsFromSleeper, getSleeperUsername, setSleeperUsername, clearSleeperUsername } from "./data/sources/sleeper/sleeperAdapter";
import { getFantasyCalcValues, scaleFantasyCalcValue } from "./data/sources/fantasycalc/fantasycalc";

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

  if (idxOrNull == null) {
    delete benchStarts[group];
  } else {
    benchStarts[group] = idxOrNull;
  }

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

// ---- toast helpers (tiny, reload-safe) ----
const TOAST_KEY = "ddc.toast.v1";

function setNextToast(message) {
  try {
    localStorage.setItem(TOAST_KEY, JSON.stringify({ message, ts: Date.now() }));
  } catch {}
}

function consumeNextToast() {
  try {
    const raw = localStorage.getItem(TOAST_KEY);
    if (!raw) return null;
    localStorage.removeItem(TOAST_KEY);
    const parsed = JSON.parse(raw);
    return parsed?.message || null;
  } catch {
    return null;
  }
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

function SkeletonHome() {
  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary strip skeleton */}
      <div className="ddc-skel ddc-shimmer">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="ddc-skel-line lg" style={{ width: "70%" }} />
          <div className="ddc-skel-line md" style={{ width: "45%" }} />
          <div className="ddc-skel-line md" style={{ width: "55%" }} />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="ddc-skel ddc-shimmer">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="ddc-skel-line md"
              style={{ width: 52 + (i % 3) * 18, borderRadius: 999, height: 30 }}
            />
          ))}
        </div>
      </div>

      {/* List skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="ddc-skel-row ddc-shimmer" />
        ))}
      </div>
    </div>
  );
}

function usePrefersDark() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e) => setIsDark(!!e.matches);

    // Modern browsers
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }

    // Safari fallback
    if (typeof mql.addListener === "function") {
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  }, []);

  return isDark;
}

export default function App() {
  const [state, setState] = useState(() => loadAppState());

  const initialUi = computeInitialUiFromSavedState(state);

  const [teamIndex, setTeamIndex] = useState(initialUi.teamIndex);
  const [activeTab, setActiveTab] = useState(initialUi.activeTab);
  const { toast, showToast, clearToast } = useToast(1800);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [fcValues, setFcValues] = useState(new Map());
  const isDark = usePrefersDark();

  const summaryRef = useRef(null);

  // Prevent UI prefs from being overwritten by defaults before we restore them
  const didHydrateRef = useRef(false);

  // Header Sleeper connect state
  const [sleeperInput, setSleeperInput] = useState(getSleeperUsername() || "");

  function connectSleeper() {
    const u = sleeperInput.trim();
    if (!u) return;
    setSleeperUsername(u);
    clearAppState(); // clears only dynasty-depthchart.v1 (NOT ddc.edits.v1)
    setNextToast(`Connected to Sleeper as ${u}`);
    location.reload(); // simple + reliable
  }

  function disconnectSleeper() {
    clearSleeperUsername();
    clearAppState();      // clears teams from saved app state
    setState({ teams: [] }); // makes teams disappear immediately in UI
    setNextToast("Disconnected from Sleeper (Local Order Preserved)");
    location.reload();
  }

  const connectedAs = getSleeperUsername();

  const teams = state?.teams ?? [];
  const team = teams[teamIndex];

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

  // Bench split availability
  const isBestBall = (team?.settingsPills ?? []).some((s) =>
    /best ball/i.test(String(s))
  );

  const benchSplitEnabled = !!team && activeTab !== "TAXI" && !team?.isBestBall;

  const valuesByPlayerId = useMemo(() => {
    const out = new Map();

    for (const p of team?.players ?? []) {
      // p.id is "sleeper-player:1234"
      const sid = String(p.id).split(":")[1];
      if (!sid) continue;

      const raw = fcValues.get(String(sid));
      const scaled = scaleFantasyCalcValue(raw);

      if (scaled != null) {
        out.set(p.id, scaled);
      }
    }

    return out;
  }, [team, fcValues]);

  const visibleTabs = useMemo(() => {
  if (!team) return [];

  const base = ["QB", "RB", "WR", "TE"];
  if ((playersByGroup.DEF?.length ?? 0) > 0) base.push("DEF");

  // Hide TAXI in Best Ball (no lineup context)
  if (!team.isBestBall) base.push("TAXI");

  base.push("PICKS");
  base.push("ROSTER");
  return base;
}, [team, playersByGroup]);

  // Bootstrap Sleeper + restore UI prefs
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
        console.warn("Failed to Load Sleeper Teams:", e);
        setLoadError("Couldn’t Load Sleeper Leagues. Check Username and Try Again.");
        showToast("Couldn’t Load Sleeper Leagues. Check Username and Try Again.");
        didHydrateRef.current = true;
      } finally {
        setIsLoadingTeams(false);
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

  useLayoutEffect(() => {
    const el = summaryRef.current;
    if (!el) return;

    const root = document.documentElement;

    function setVar() {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      root.style.setProperty("--ddc-summary-h", `${h}px`);
    }

    setVar();

    const ro = new ResizeObserver(() => setVar());
    ro.observe(el);

    window.addEventListener("resize", setVar);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", setVar);
      root.style.removeProperty("--ddc-summary-h");
    };
  }, [team?.id]);

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

      // Persist injured flag so disconnect/reconnect won't wipe it
      setTeamEdit(t.id, p.id, { group: p.group, injured: !!p.injured });

      return next;
    });
  }

  const benchStartsForTeam = team?.id ? getTeamBenchStarts(team.id) : {};

  const benchStartIndex =
    typeof benchStartsForTeam?.[activeTab] === "number"
      ? benchStartsForTeam[activeTab]
      : null;

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
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Title */}
            <div className="ddc-brand">
              <div
                className="ddc-title"
                style={{
                  fontSize: "var(--ddc-text-xl)",
                  fontWeight: "var(--ddc-weight-bold)",
                  lineHeight: 1.18,
                  letterSpacing: "-0.01em",
                }}
              >
                Dynasty Depth Chart
              </div>

              <span className="ddc-logo" aria-hidden="true">
                <DepthIcon size={24} />
              </span>
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
                      className="ddc-focusable ddc-pressable"
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
                      className="ddc-sleeper-input ddc-focusable"
                      value={sleeperInput}
                      onChange={(e) => setSleeperInput(e.target.value)}
                      placeholder="Sleeper username"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          connectSleeper();
                        }
                      }}
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
                      className="ddc-focusable ddc-pressable"
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
                    className="ddc-focusable"
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
      <div ref={summaryRef} className="ddc-summary-sticky" style={{ marginTop: 12 }}>
        <div style={ui.card}>
          {loadError ? (
            <div style={{ fontSize: 14, color: "var(--ddc-danger)", fontWeight: 600 }}>
              {loadError}
            </div>
          ) : connectedAs && isLoadingTeams ? (
            <div style={{ fontSize: 14, ...ui.muted }}>
              Loading Leagues from Sleeper…
            </div>
          ) : !connectedAs ? (
            <div style={{ fontSize: 14, ...ui.muted }}>
              Connect Sleeper Above to Load Your Leagues
            </div>
          ) : !team ? null : (
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

              {/* Settings pills */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(team.settingsPills ?? []).map((s) => (
                  <div key={s} style={ui.pill}>
                    {s}
                  </div>
                ))}
              </div>

              {/* Counts */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {["QB", "RB", "WR", "TE"]
                  .concat((playersByGroup.DEF?.length ?? 0) > 0 ? ["DEF"] : [])
                  .concat(!team.isBestBall ? ["TAXI"] : [])
                  .map((g) => (
                    <div key={g} style={ui.pill}>
                      {g}: {playersByGroup[g]?.length ?? 0}
                    </div>
                  ))}
              </div>

              {/* Picks counts */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {["2026", "2027", "2028"].map((y) => (
                  <div key={y} style={ui.pill}>
                    {y} Picks: {team.picksByYear?.[y]?.length ?? 0}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Tabs */}
      {visibleTabs.length > 0 && (
        <div
          className="ddc-tabs-sticky"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            background: "var(--ddc-card-bg)",
            paddingTop: 10,
            paddingBottom: 10,
            marginTop: 12,
            borderBottom: "1px solid var(--ddc-border)",
          }}
        >
          {connectedAs && isLoadingTeams ? null : (
            <Tabs
              key={`${team?.id || "no-team"}:${visibleTabs.join("|")}`}
              tabs={visibleTabs}
              active={activeTab}
              onChange={setActiveTab}
              isDark={isDark}
            />
          )}
        </div>
      )}

      {/* Content */}
      {connectedAs && isLoadingTeams ? (
        <SkeletonHome />
      ) : !team ? null : activeTab === "PICKS" ? (
        <PicksView picksByYear={team.picksByYear} isDark={isDark} />
      ) : activeTab === "ROSTER" ? (
        <MacroRosterView
          playersByGroup={playersByGroup}
          valuesByPlayerId={valuesByPlayerId}
          picksByYear={team.picksByYear}
          benchStartsByGroup={benchStartsForTeam}
          isDark={isDark}
          fcParams={team?.external?.fantasycalc} 
        />
      ) : (
        <div style={{ marginTop: 18 }}>
          <PlayerList
            key={`${team.id}:${activeTab}`}
            group={activeTab}
            players={playersByGroup[activeTab] ?? []}
            valuesByPlayerId={valuesByPlayerId}
            onReorder={(next) => updateGroupOrder(activeTab, next)}
            onToggleInjured={togglePlayerInjured}
            {...(benchSplitEnabled
              ? {
                  benchStartIndex: benchStartIndex,
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
            isDark={isDark}
          />
        </div>
      )}

    {toast && (
      <div className="ddc-toast" role="status" aria-live="polite">
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {toast}
        </span>
        <button className="ddc-focusable" onClick={clearToast} aria-label="Dismiss toast">
          ✕
        </button>
      </div>
    )}
    </main>
  );
}
