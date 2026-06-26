import { useState } from "react";
import { PicksView } from "./PicksView";
import { ValBar } from "./ValBar";
import { ValueShape } from "./ValueShape";
import { getFantasyCalcUpdatedAt } from "../data/sources/fantasycalc/fantasycalc";

function formatVal(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function formatValTotal(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function formatValPct(part, total) {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return null;
  return `${Math.round((p / t) * 100)}%`;
}

function computeGroupTotalVal(players, valuesByPlayerId) {
  if (!valuesByPlayerId || !players?.length) return null;
  let sum = 0;
  let hasAny = false;
  for (const p of players) {
    const v = valuesByPlayerId.get(p.id);
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    sum += n;
    hasAny = true;
  }
  return hasAny ? sum : null;
}

function computeTotalPicks(picksByYear) {
  return Object.values(picksByYear || {}).reduce(
    (sum, picks) => sum + (Array.isArray(picks) ? picks.length : 0),
    0
  );
}

function ageClass(age) {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n)) return "";
  if (n <= 23) return "young";
  if (n >= 29) return "vet";
  return "";
}

/* ─── Roster Snapshot text export (unchanged from production) ─── */
function sortPickStrings(list) {
  const arr = (list ?? []).map((p) => String(p).trim()).filter(Boolean);
  function parsePickKey(pick) {
    const m = pick.match(/^(\d{1,2})\.(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 100 + Number(m[2]);
  }
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

function formatRosterSummary({ playersByGroup, picksByYear, settingsPills }) {
  const order = ["QB", "RB", "WR", "TE", "DEF", "TAXI"];
  const lines = [];
  const settings = (settingsPills ?? []).map((s) => String(s).trim()).filter(Boolean);

  if (settings.length) {
    lines.push("SETTINGS:");
    lines.push(settings.join(" | "));
    lines.push("");
  }

  let firstGroup = true;
  for (const key of order) {
    const players = playersByGroup?.[key] ?? [];
    if (!players.length) continue;
    if (!firstGroup) lines.push("");
    firstGroup = false;
    lines.push(`${key}: ${players.map((p) => p.name).join(", ")}`);
  }

  const years = Object.keys(picksByYear ?? {}).sort();
  const pickChunks = [];
  for (const y of years) {
    const picks = sortPickStrings(picksByYear?.[y] ?? []);
    if (!picks.length) continue;
    pickChunks.push(`${y} ${picks.join(", ")}`);
  }
  if (pickChunks.length) {
    lines.push("");
    lines.push("PICKS:");
    pickChunks.forEach((chunk, idx) => {
      if (idx > 0) lines.push("");
      lines.push(chunk);
    });
  }
  return lines.join("\n");
}

function normalizeClipboardText(text) {
  let out = String(text ?? "");
  if (!/%[0-9A-Fa-f]{2}/.test(out)) return out;
  out = out.replace(/\+/g, " ");
  for (let i = 0; i < 3; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(out)) break;
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch {
      break;
    }
  }
  out = out
    .replaceAll("%0A", "\n").replaceAll("%0a", "\n")
    .replaceAll("%20", " ")
    .replaceAll("%3A", ":").replaceAll("%3a", ":");
  return out;
}

function isIOS() {
  const ua = navigator?.userAgent || "";
  return (
    (navigator?.platform === "MacIntel" && navigator?.maxTouchPoints > 1) ||
    /iPad|iPhone|iPod/.test(ua)
  );
}

async function copyTextToClipboard(text) {
  const forceFallback = isIOS();
  if (!forceFallback && navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.setAttribute("aria-hidden", "true");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  ta.style.pointerEvents = "none";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/* ─── Group card ─── */
function GroupCard({ 
  title, 
  groupKey, 
  players, 
  valuesByPlayerId,
  redraftRanksByPlayerId, 
  benchStartIndex, 
  teamValue 
}) {
  const totalVal = computeGroupTotalVal(players, valuesByPlayerId);
  const valuePct = formatValPct(totalVal, teamValue);
  const maxValue = (() => {
    let m = 0;
    for (const p of players) {
      const v = valuesByPlayerId?.get(p.id);
      const n = Number(v);
      if (Number.isFinite(n) && n > m) m = n;
    }
    return m;
  })();

  return (
    <div className="ddc-panel" data-pos={groupKey}>
      <div className="ddc-panel-head">
        <span className="ddc-stamp">{groupKey}</span>
        <span className="ddc-panel-count">
          {players.length} {players.length === 1 ? "PLAYER" : "PLAYERS"} ·
        </span>
        {totalVal != null && (
          <span className="ddc-panel-count">
            VAL {formatValTotal(totalVal)}
            {valuePct ? ` · ${valuePct}` : ""}
          </span>
        )}
      </div>

      {players.length === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            fontSize: 12,
            color: "var(--ddc-dim-2)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontStyle: "italic",
          }}
        >
          // NONE
        </div>
      ) : (
        players.map((p, idx) => {
          const isBench = benchStartIndex != null && idx >= benchStartIndex;
          const isBenchStart =
            benchStartIndex != null &&
            benchStartIndex > 0 &&
            benchStartIndex < players.length &&
            idx === benchStartIndex;
          const slotLabel = groupKey === "TAXI" ? `TX${idx + 1}` : `${groupKey}${idx + 1}`;
          const val = valuesByPlayerId?.get(p.id) ?? null;
          const formattedValue = formatVal(val);
          const redraftRank = redraftRanksByPlayerId?.get(p.id) ?? null;
          const redraftLabel = redraftRank?.label || null;
          const redraftLongLabel = redraftRank?.longLabel || null;
          const redraftMobileLabel = redraftLabel ? `RDRFT ${redraftLabel}` : null;

          return (
            <div key={p.id}>
              {isBenchStart ? (
                <div className="ddc-bench-divider" aria-label="Bench Divider">
                  <div className="ddc-bench-rule" />
                  <div className="ddc-bench-label">BENCH</div>
                  <div className="ddc-bench-rule" />
                </div>
              ) : null}

              <div
                className="ddc-row compact readonly"
                data-pos={groupKey}
                data-bench={isBench ? "true" : "false"}
              >
                <div className="ddc-col-slot" style={{ paddingLeft: 18 }}>
                  <span className="ddc-slot" data-pos={groupKey}>{slotLabel}</span>
                </div>
                <div className="ddc-col-name">
                  <div className="ddc-name-wrap">
                    <div className={`ddc-name${p.injured ? " injured" : ""}`} title={p.name}>
                      {p.name}
                    </div>
                    <div className="ddc-meta-line">
                      <span className="ddc-meta-compact-desktop">
                        {p.age || "—"} · {p.nflTeam || "—"}
                        {redraftLongLabel ? ` · ${redraftLongLabel}` : ""}
                      </span>
                      <span className="ddc-meta-compact-mobile">
                        {p.age || "—"} · {p.nflTeam || "—"}
                        {redraftMobileLabel ? ` · ${redraftMobileLabel}` : ""} · VAL {formattedValue}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ddc-col-val">
                  <span className="ddc-val-num">{formatVal(val)}</span>
                  <ValBar value={val} maxValue={maxValue} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Macro view ─── */
export function MacroRosterView({
  playersByGroup,
  valuesByPlayerId,
  redraftRanksByPlayerId,
  picksByYear,
  settingsPills = [],
  benchStartsByGroup = {},
  /* isDark prop preserved for compat */
  // eslint-disable-next-line no-unused-vars
  isDark = false,
  fcParams = null,
}) {
  const teamPlayers = [
    ...(playersByGroup?.QB ?? []),
    ...(playersByGroup?.RB ?? []),
    ...(playersByGroup?.WR ?? []),
    ...(playersByGroup?.TE ?? []),
    ...(playersByGroup?.DEF ?? []),
    ...(playersByGroup?.TAXI ?? []),
  ];

  const teamValue = computeGroupTotalVal(teamPlayers, valuesByPlayerId);

  const valueShapeShares = (() => {
    const groups = ["QB", "RB", "WR", "TE", "TAXI"];
    const denominator = Number(teamValue);

    return groups.reduce((out, key) => {
      const groupVal = computeGroupTotalVal(playersByGroup?.[key] ?? [], valuesByPlayerId) ?? 0;

      out[key] =
        Number.isFinite(denominator) && denominator > 0
          ? groupVal / denominator
          : 0;

      return out;
    }, {});
  })();

  const totalPicks = computeTotalPicks(picksByYear);

  const fcUpdatedAt = fcParams ? getFantasyCalcUpdatedAt(fcParams) : null;
  const fcUpdatedLabel = fcUpdatedAt
    ? new Date(fcUpdatedAt).toLocaleString([], {
        month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : null;

  const showDEF  = (playersByGroup?.DEF?.length ?? 0) > 0;
  const showTAXI = (playersByGroup?.TAXI?.length ?? 0) > 0;

  const groupsSingle = [
    { key: "QB", title: "QB" },
    { key: "RB", title: "RB" },
    { key: "WR", title: "WR" },
    { key: "TE", title: "TE" },
    ...(showDEF  ? [{ key: "DEF",  title: "DEF"  }] : []),
    ...(showTAXI ? [{ key: "TAXI", title: "TAXI" }] : []),
  ];

  const [copied, setCopied] = useState(false);

  async function onCopySummary() {
    try {
      const raw = formatRosterSummary({ playersByGroup, picksByYear, settingsPills });
      const text = normalizeClipboardText(raw);
      await copyTextToClipboard(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ─── Snapshot header ─── */}
      {teamValue != null && (
        <ValueShape
          shares={valueShapeShares}
          showTaxi={(playersByGroup?.TAXI ?? []).length > 0}
        />
      )}
      
      <div className="ddc-macro-summary">
        
        <div className="ddc-macro-title-row">
          <button
            type="button"
            onClick={onCopySummary}
            className="ddc-btn ddc-focusable ddc-pressable"
            aria-label="Copy Roster Snapshot"
            title="Copy Roster Snapshot"
          >
            {copied ? "COPIED" : "COPY"}
          </button>
          
          <span className="ddc-macro-sub">
            ORDER REFLECTS POSITION TABS
          </span>
        </div>
      </div>
        


      {/* ─── Mobile single stack ─── */}
      <div className="ddc-macro-single">
        {groupsSingle.map((g) => (
          <GroupCard
            key={g.key}
            title={g.title}
            groupKey={g.key}
            players={playersByGroup?.[g.key] ?? []}
            valuesByPlayerId={valuesByPlayerId}
            redraftRanksByPlayerId={redraftRanksByPlayerId}
            benchStartIndex={benchStartsByGroup?.[g.key] ?? null}
            teamValue={teamValue}
          />
        ))}

        <div className="ddc-panel ddc-macro-picks-panel" data-pos="PICKS">
          <div className="ddc-panel-head">
            <span className="ddc-stamp">PICKS</span>
            <span className="ddc-panel-count">
              {totalPicks} {totalPicks === 1 ? "PICK" : "PICKS"}
            </span>
            <div className="ddc-panel-meta">
              <a
                href="https://rookie-board.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="ddc-rookie-link ddc-focusable"
              >
                OPEN ROOKIE BOARD →
              </a>
            </div>
          </div>
          <div className="ddc-macro-picks-embed">
            <PicksView picksByYear={picksByYear} />
          </div>
        </div>
      </div>

      {/* ─── Desktop 2-column ─── */}
      <div className="ddc-macro-columns">
        <div className="ddc-macro-col">
          <GroupCard title="QB" groupKey="QB"
            players={playersByGroup?.QB ?? []}
            valuesByPlayerId={valuesByPlayerId}
            redraftRanksByPlayerId={redraftRanksByPlayerId}
            benchStartIndex={benchStartsByGroup?.QB ?? null} 
            teamValue={teamValue} />
          <GroupCard title="WR" groupKey="WR"
            players={playersByGroup?.WR ?? []}
            valuesByPlayerId={valuesByPlayerId}
            redraftRanksByPlayerId={redraftRanksByPlayerId}
            benchStartIndex={benchStartsByGroup?.WR ?? null} 
            teamValue={teamValue} />
          {showDEF && (
            <GroupCard title="DEF" groupKey="DEF"
              players={playersByGroup?.DEF ?? []}
              valuesByPlayerId={valuesByPlayerId}
              redraftRanksByPlayerId={redraftRanksByPlayerId}
              benchStartIndex={benchStartsByGroup?.DEF ?? null} 
              teamValue={teamValue} />
          )}
          {showTAXI && (
            <GroupCard title="TAXI" groupKey="TAXI"
              players={playersByGroup?.TAXI ?? []}
              valuesByPlayerId={valuesByPlayerId}
              redraftRanksByPlayerId={redraftRanksByPlayerId}
              benchStartIndex={benchStartsByGroup?.TAXI ?? null} 
              teamValue={teamValue} />
          )}
        </div>

        <div className="ddc-macro-col">
          <GroupCard title="RB" groupKey="RB"
            players={playersByGroup?.RB ?? []}
            valuesByPlayerId={valuesByPlayerId}
            redraftRanksByPlayerId={redraftRanksByPlayerId}
            benchStartIndex={benchStartsByGroup?.RB ?? null} 
            teamValue={teamValue} />
          <GroupCard title="TE" groupKey="TE"
            players={playersByGroup?.TE ?? []}
            valuesByPlayerId={valuesByPlayerId}
            redraftRanksByPlayerId={redraftRanksByPlayerId}
            benchStartIndex={benchStartsByGroup?.TE ?? null} 
            teamValue={teamValue} />

          <div className="ddc-panel ddc-macro-picks-panel" data-pos="PICKS">
          <div className="ddc-panel-head">
            <span className="ddc-stamp">PICKS</span>
            <span className="ddc-panel-count">
              {totalPicks} {totalPicks === 1 ? "PICK" : "PICKS"}
            </span>
              <div className="ddc-panel-meta">
                <a
                  href="https://rookie-board.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="ddc-rookie-link ddc-focusable"
                  title="Open Rookie Board"
                >
                  OPEN ROOKIE BOARD →
                </a>
              </div>
            </div>
            <div className="ddc-macro-picks-embed">
              <PicksView picksByYear={picksByYear} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}