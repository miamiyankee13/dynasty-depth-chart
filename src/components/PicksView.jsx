import { useState } from "react";
import { getLeagueDrafts, getLeague, getDraftPicks } from "../data/sources/sleeper/sleeperClient";
import { getSleeperPlayersDict } from "../data/sources/sleeper/playersCache";
import { getFantasyCalcValues } from "../data/sources/fantasycalc/fantasycalc";

function getPickRound(pick) {
  const raw = String(pick ?? "").toLowerCase();

  // numeric format: 1.01, 2.11, etc
  const numMatch = raw.match(/^(\d{1,2})\.\d{1,2}$/);
  if (numMatch) return Number(numMatch[1]);

  // text formats: 1st, 2nd, 3rd, etc
  if (raw.includes("1st")) return 1;
  if (raw.includes("2nd")) return 2;
  if (raw.includes("3rd")) return 3;
  if (raw.includes("4th")) return 4;
  if (raw.includes("5th")) return 5;

  return null;
}

const pickTheme = {
  1: { bg: "#fef9c3", color: "#854d0e" }, // light yellow
  2: { bg: "#dcfce7", color: "#166534" }, // light green
  3: { bg: "#e0f2fe", color: "#075985" }, // light blue
  4: { bg: "#ffedd5", color: "#9a3412" }, // light orange
  5: { bg: "#fce7f3", color: "#9d174d" }, // light pink
};

const pickThemeDark = {
  1: { bg: "#3a2f12", color: "#facc15" }, // warm gold
  2: { bg: "#143022", color: "#4ade80" }, // green
  3: { bg: "#12313a", color: "#22d3ee" }, // cyan/blue
  4: { bg: "#3a2312", color: "#fb923c" }, // orange
  5: { bg: "#2a1f26", color: "#f472b6" }, // pink
};

function parsePickKey(pick) {
  const raw = String(pick ?? "").trim();
  const m = raw.match(/^(\d{1,2})\.(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number(m[2]);
}

function sortPicks(list) {
  const arr = (list ?? []).map((p) => String(p).trim()).filter(Boolean);

  const standard = [];
  const other = [];

  for (const p of arr) {
    const key = parsePickKey(p);
    if (key == null) other.push(p);
    else standard.push({ p, key });
  }

  standard.sort((a, b) => a.key - b.key);
  other.sort((a, b) => a.localeCompare(b));

  return [...standard.map((x) => x.p), ...other];
}

function PickChip({ text, isDark }) {
  const round = getPickRound(text);
  const theme = (isDark ? pickThemeDark : pickTheme)[round];

  return (
    <span
      className="ddc-num"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${theme ? `color-mix(in oklab, ${theme.color} 55%, transparent)` : "var(--ddc-pill-border)"}`,
        background: theme ? theme.bg : "var(--ddc-pill-bg)",
        color: theme ? theme.color : "var(--ddc-text)",
        fontSize: "var(--ddc-text-sm)",
        fontWeight: "var(--ddc-weight-bold)",
        letterSpacing: "0.01em",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function isLikelyRookieDraft(draft) {
  if (!draft) return false;

  if (String(draft?.draft_type || "").toLowerCase() === "rookie") {
    return true;
  }

  const rounds = Number(draft?.settings?.rounds);
  return Number.isFinite(rounds) && rounds > 0 && rounds <= 10;
}

function findMostRecentCompletedRookieDraft(drafts) {
  return (drafts || []).find(
    (d) => String(d?.status || "").toLowerCase() === "complete" && isLikelyRookieDraft(d)
  ) || null;
}

const DRAFT_GRADE_BASELINES = {
  1: 3000,
  2: 1500,
  3: 1000,
  4: 800,
  5: 600,
};

function getDraftGrade(rawValue, round) {
  const value = Number(rawValue);
  const baseline = DRAFT_GRADE_BASELINES[Number(round)];

  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) {
    return null;
  }

  const ratio = value / baseline;

  if (ratio >= 1.5) return "A";
  if (ratio >= 1.0) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.35) return "D";
  return "F";
}

function GradeBadge({ grade, isDark }) {
  const styles = {
    A: {
      bg: isDark ? "#143022" : "#dcfce7",
      color: isDark ? "#4ade80" : "#166534",
    },
    B: {
      bg: isDark ? "#12313a" : "#e0f2fe",
      color: isDark ? "#22d3ee" : "#075985",
    },
    C: {
      bg: isDark ? "#3a2f12" : "#fef9c3",
      color: isDark ? "#facc15" : "#854d0e",
    },
    D: {
      bg: isDark ? "#3a2312" : "#ffedd5",
      color: isDark ? "#fb923c" : "#9a3412",
    },
    F: {
      bg: isDark ? "#2a1f26" : "#fce7f3",
      color: isDark ? "#f472b6" : "#9d174d",
    },
  };

  const theme = styles[grade] || {
    bg: "var(--ddc-pill-bg)",
    color: "var(--ddc-text)",
  };

  return (
    <span
      className="ddc-num"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 28,
        padding: "6px 8px",
        borderRadius: 999,
        background: theme.bg,
        color: theme.color,
        border: `1px solid color-mix(in oklab, ${theme.color} 55%, transparent)`,
        fontSize: "var(--ddc-text-sm)",
        fontWeight: "var(--ddc-weight-bold)",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
      title={grade ? `Draft Grade: ${grade}` : "Ungraded"}
    >
      {grade || "—"}
    </span>
  );
}

export function PicksView({   
  picksByYear,
  pickYears,
  leagueId = null,
  rosterId = null,
  draftResultsByLeague = {},
  setDraftResultsByLeague = null,
  fcParams = null,
  isDark = false, 
}) {

  const years =
    Array.isArray(pickYears) && pickYears.length > 0
      ? pickYears.map(String)
      : Object.keys(picksByYear || {}).sort((a, b) => Number(a) - Number(b));
  
  const [showDraft, setShowDraft] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const draftData = leagueId ? draftResultsByLeague[leagueId] ?? null : null;
  const draftResults = draftData?.picks ?? [];
  const draftSeason = draftData?.season ?? null;

  async function loadLastDraft() {
    if (!leagueId || !rosterId || !setDraftResultsByLeague || draftResultsByLeague[leagueId]) return;

    try {
      setLoadingDraft(true);

      let currentLeagueId = String(leagueId);
      let foundDraft = null;

      // Walk current league -> previous league(s) until we find
      // the most recent completed rookie draft
      for (let i = 0; i < 5; i++) {
        if (!currentLeagueId) break;

        const [league, drafts] = await Promise.all([
          getLeague(currentLeagueId),
          getLeagueDrafts(currentLeagueId),
        ]);

        const completedRookieDraft = findMostRecentCompletedRookieDraft(drafts);

        if (completedRookieDraft?.draft_id) {
          foundDraft = completedRookieDraft;
          break;
        }

        currentLeagueId = league?.previous_league_id ? String(league.previous_league_id) : "";
      }
      
      if (!foundDraft?.draft_id) {
        setDraftResultsByLeague((prev) => ({
          ...prev,
          [leagueId]: {
            season: null,
            picks: [],
          },
        }));
        return;
      }

      const picks = await getDraftPicks(foundDraft.draft_id);
      const playersDict = await getSleeperPlayersDict();
      const myRosterId = String(rosterId);

      let fcValues = new Map();
      if (fcParams) {
        try {
          const { values } = await getFantasyCalcValues(fcParams);
          fcValues = values;
        } catch (e) {
          console.warn("FantasyCalc Values Fetch Failed for Draft Grades:", e);
        }
      }

      const formatted = (picks || [])
        .filter((p) => String(p.roster_id) === myRosterId)
        .map((p) => {
          const pickNo = Number(p.pick_no);
          if (!Number.isFinite(pickNo)) return null;

          const round = Number(p.round);
          const draftSlot = Number(p.draft_slot);

          if (!Number.isFinite(round) || !Number.isFinite(draftSlot)) return null;

          const label = `${round}.${String(draftSlot).padStart(2, "0")}`;

          const player = playersDict[p.player_id];
          const name =
            player?.full_name ||
            [player?.first_name, player?.last_name].filter(Boolean).join(" ") ||
            "Unknown";

          const rawValue = fcValues.get(String(p.player_id)) ?? null;
          const grade = getDraftGrade(rawValue, round);

          return {
            label,
            name,
            pickNo,
            round,
            rawValue,
            grade,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.pickNo - b.pickNo);

      setDraftResultsByLeague((prev) => ({
        ...prev,
        [leagueId]: {
          season: String(foundDraft.season || ""),
          picks: formatted,
        },
      }));
    } catch (e) {
      console.error("Failed to load draft results:", e);
      setDraftResultsByLeague((prev) => ({
        ...prev,
        [leagueId]: {
          season: null,
          picks: [],
        },
      }));
    } finally {
      setLoadingDraft(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      {years.map((y) => {
        const picks = sortPicks(picksByYear?.[y] ?? []);
        const hasAny = picks.length > 0;

        return (
          <div
            key={y}
            style={{
              background: "var(--ddc-card-bg)",
              border: "1px solid var(--ddc-border)",
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
              color: "var(--ddc-text)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--ddc-text)" }}>
                {y} Picks
              </div>
              <div
                style={{
                  fontSize: "var(--ddc-text-xs)",
                  color: "var(--ddc-muted)",
                  fontWeight: "var(--ddc-weight-medium)",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {hasAny ? `${picks.length} total` : "None"}
              </div>
            </div>

            {!hasAny ? (
              <div style={{ fontSize: 13, color: "var(--ddc-muted)" }}>
                No picks listed for {y}.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {picks.map((p, idx) => (
                  <PickChip key={`${y}-${p}-${idx}`} text={p} isDark={isDark} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {/* Draft Results Section */}
      {leagueId && rosterId ? (
        <div
          style={{
            marginTop: 8,
            background: "var(--ddc-card-bg)",
            border: "1px solid var(--ddc-border)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--ddc-text)" }}>
              Last Completed Rookie Draft
            </div>

            <button
              className="ddc-focusable ddc-pressable"
              type="button"
              onClick={async () => {
                const next = !showDraft;
                setShowDraft(next);
                if (next) await loadLastDraft();
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid var(--ddc-input-border)",
                background: "var(--ddc-input-bg)",
                color: "var(--ddc-text)",
                cursor: "pointer",
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              {showDraft ? "Hide" : "View Draft"}
            </button>
          </div>

          {showDraft && (
            <>
              {loadingDraft ? (
                <div style={{ fontSize: 13, color: "var(--ddc-muted)" }}>
                  Loading draft...
                </div>
              ) : !draftResults.length ? (
                <div style={{ fontSize: 13, color: "var(--ddc-muted)" }}>
                  No completed draft found.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {draftSeason ? (
                    <div
                      style={{
                        fontSize: "var(--ddc-text-xs)",
                        color: "var(--ddc-muted)",
                        fontWeight: "var(--ddc-weight-medium)",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      {draftSeason} Draft Results
                    </div>
                  ) : null}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "64px minmax(0, 320px) 52px",
                        alignItems: "center",
                        columnGap: 10,
                        marginBottom: 2,
                      }}
                    >
                      <div />
                      <div />
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: "var(--ddc-text-xs)",
                          color: "var(--ddc-muted)",
                          fontWeight: "var(--ddc-weight-medium)",
                          letterSpacing: "0.02em",
                          textTransform: "uppercase",
                        }}
                      >
                        Grade
                      </div>
                    </div>
                    {draftResults.map((p) => (
                      <div
                        key={p.label}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "64px minmax(0, 320px) 52px",
                          alignItems: "center",
                          columnGap: 10,
                        }}
                      >
                        <div>
                          <PickChip text={p.label} isDark={isDark} />
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                            fontSize: "var(--ddc-text-md)",
                            fontWeight: "var(--ddc-weight-bold)",
                            color: "var(--ddc-text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={p.name}
                        >
                          {p.name}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <GradeBadge grade={p.grade} isDark={isDark} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
