import { useState } from "react";
import { getLeagueDrafts, getLeague, getDraftPicks } from "../data/sources/sleeper/sleeperClient";
import { getSleeperPlayersDict } from "../data/sources/sleeper/playersCache";
import { getFantasyCalcValues } from "../data/sources/fantasycalc/fantasycalc";

/* Parses both "1.05" (numeric, slot known) and "1st" / "2nd via btd5008" (text) */
function getPickRound(pick) {
  const raw = String(pick ?? "").toLowerCase();
  const numMatch = raw.match(/^(\d{1,2})\.\d{1,2}$/);
  if (numMatch) return Number(numMatch[1]);
  if (raw.includes("1st")) return 1;
  if (raw.includes("2nd")) return 2;
  if (raw.includes("3rd")) return 3;
  if (raw.includes("4th")) return 4;
  if (raw.includes("5th")) return 5;
  return null;
}

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

function PickChip({ text }) {
  const round = getPickRound(text);
  return (
    <span className="ddc-pick" data-r={round || undefined}>
      {text}
    </span>
  );
}

function isLikelyRookieDraft(draft) {
  if (!draft) return false;
  if (String(draft?.draft_type || "").toLowerCase() === "rookie") return true;
  const rounds = Number(draft?.settings?.rounds);
  return Number.isFinite(rounds) && rounds > 0 && rounds <= 10;
}

function findMostRecentCompletedRookieDraft(drafts) {
  return (drafts || []).find(
    (d) => String(d?.status || "").toLowerCase() === "complete" && isLikelyRookieDraft(d)
  ) || null;
}

const DRAFT_GRADE_BASELINES = { 1: 3000, 2: 1500, 3: 1000, 4: 800, 5: 600 };

function getDraftGrade(rawValue, round) {
  const value = Number(rawValue);
  const baseline = DRAFT_GRADE_BASELINES[Number(round)];
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline <= 0) return null;
  const ratio = value / baseline;
  if (ratio >= 1.5) return "A";
  if (ratio >= 1.0) return "B";
  if (ratio >= 0.65) return "C";
  if (ratio >= 0.35) return "D";
  return "F";
}

function GradeBadge({ grade }) {
  return (
    <span className="ddc-grade" data-g={grade || undefined} title={grade ? `Draft Grade: ${grade}` : "Ungraded"}>
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
  /* isDark prop preserved for compat — Terminal palette handles theming via CSS vars */
  // eslint-disable-next-line no-unused-vars
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
          [leagueId]: { season: null, picks: [] },
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

          return { label, name, pickNo, round, rawValue, grade };
        })
        .filter(Boolean)
        .sort((a, b) => a.pickNo - b.pickNo);

      setDraftResultsByLeague((prev) => ({
        ...prev,
        [leagueId]: { season: String(foundDraft.season || ""), picks: formatted },
      }));
    } catch (e) {
      console.error("Failed to load draft results:", e);
      setDraftResultsByLeague((prev) => ({
        ...prev,
        [leagueId]: { season: null, picks: [] },
      }));
    } finally {
      setLoadingDraft(false);
    }
  }

  return (
    <div className="ddc-picks-view" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {years.map((y) => {
        const picks = sortPicks(picksByYear?.[y] ?? []);
        const hasAny = picks.length > 0;
        return (
          <div key={y} className="ddc-panel" data-pos="PICKS">
            <div className="ddc-panel-head">
              <span className="ddc-stamp">{y}</span>
              <span className="ddc-panel-title">Rookie Picks</span>
              <span className="ddc-panel-count">
                {hasAny ? `${picks.length} ${picks.length === 1 ? "PICK" : "PICKS"}` : "NONE"}
              </span>
            </div>
            <div className="ddc-picks-body">
              {hasAny ? (
                <div className="ddc-picks-grid">
                  {picks.map((p, idx) => (
                    <PickChip key={`${y}-${p}-${idx}`} text={p} />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--ddc-dim)", letterSpacing: "0.04em" }}>
                  No picks listed for {y}.
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Draft Results Section */}
      {leagueId && rosterId ? (
        <div className="ddc-panel" data-pos="PICKS">
          <div className="ddc-panel-head">
            <span className="ddc-stamp">DR</span>
            <span className="ddc-panel-title">Last Completed Rookie Draft</span>
            <div className="ddc-panel-meta">
              {draftSeason && showDraft ? (
                <span>SEASON · <b className="amber">{draftSeason}</b></span>
              ) : null}
              <button
                className="ddc-btn ddc-focusable ddc-pressable"
                type="button"
                onClick={async () => {
                  const next = !showDraft;
                  setShowDraft(next);
                  if (next) await loadLastDraft();
                }}
              >
                {showDraft ? "HIDE" : "VIEW DRAFT"}
              </button>
            </div>
          </div>

          {showDraft && (
            <>
              {loadingDraft ? (
                <div className="ddc-picks-body" style={{ color: "var(--ddc-dim)", fontSize: 12 }}>
                  // LOADING DRAFT…
                </div>
              ) : !draftResults.length ? (
                <div className="ddc-picks-body" style={{ color: "var(--ddc-dim)", fontSize: 12 }}>
                  // NO COMPLETED DRAFT FOUND
                </div>
              ) : (
                <>
                <div className="ddc-draft-row head">
                  <div>Pick</div>
                  <div>Player</div>
                  <div style={{ textAlign: "center" }}>Grade</div>
                </div>
                {draftResults.map((p) => (
                  <div key={p.label} className="ddc-draft-row">
                    <div><PickChip text={p.label} /></div>
                    <div className="ddc-draft-name" title={p.name}>{p.name}</div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <GradeBadge grade={p.grade} />
                    </div>
                  </div>
                ))}
                </>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
