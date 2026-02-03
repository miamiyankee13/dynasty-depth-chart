// src/components/MacroRosterView.jsx
import { useState } from "react";
import { groupTheme } from "../theme";
import { PicksView } from "./PicksView";

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

function formatRosterSummary({ playersByGroup, picksByYear }) {
  const order = ["QB", "RB", "WR", "TE", "DEF", "TAXI"];
  const lines = [];
  let firstGroup = true;

  for (const key of order) {
    const players = playersByGroup?.[key] ?? [];
    if (!players.length) continue;

    if (!firstGroup) lines.push(""); // blank line between groups
    firstGroup = false;

    lines.push(`${key}: ${players.map((p) => p.name).join("; ")}`);
  }

  const years = Object.keys(picksByYear ?? {}).sort(); // YYYY keys
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
      if (idx > 0) lines.push(""); // blank line between years
      lines.push(chunk);
    });
  }

  return lines.join("\n");
}

async function copyTextToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers / permissions edge cases
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function GroupCard({ title, groupKey, players, valuesByPlayerId, benchStartIndex, isDark }) {
  const base = groupTheme[groupKey] ?? { color: "var(--ddc-text)", bg: "var(--ddc-pill-bg)" };
  const th = isDark && base.bgDark ? { ...base, bg: base.bgDark } : base;

  // match your QB dark-mode accent trick (optional but consistent with Tabs/Row)
  const accent =
    groupKey === "QB" && isDark
      ? `color-mix(in oklab, ${th.color} 78%, var(--ddc-text))`
      : th.color;

  return (
    <div
      className="ddc-macro-card"
      style={{
        background: "var(--ddc-card-bg)",
        border: "1px solid var(--ddc-border)",
        borderRadius: 16,
        padding: 14,
        color: "var(--ddc-text)",
      }}
    >
  {(() => {
    const totalVal = computeGroupTotalVal(players, valuesByPlayerId);

    const metaStyle = {
      fontSize: "var(--ddc-text-xs)",
      color: "var(--ddc-muted)",
      fontWeight: "var(--ddc-weight-medium)",
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    };

    return (
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        {/* Left: Title + count */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: accent,
              boxShadow: `0 0 0 3px color-mix(in oklab, ${accent} 18%, transparent)`,
              flex: "0 0 auto",
            }}
          />
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em" }}>
              {title}
            </div>
            <div style={metaStyle}>{players.length} total</div>
          </div>
        </div>

        {/* Right: Total Val */}
        <div className="ddc-group-totalval" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={metaStyle}>Total {title} Val</div>
          <div style={metaStyle}>{formatValTotal(totalVal)}</div>
        </div>
      </div>
    );
  })()}

      {players.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--ddc-muted)", fontStyle: "italic" }}>
          None
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {players.map((p, idx) => {
            const val = valuesByPlayerId?.get(p.id) ?? null;

            const showBenchMarker =
              typeof benchStartIndex === "number" &&
              benchStartIndex > 0 &&
              benchStartIndex < players.length &&
              idx === benchStartIndex;

            return (
              <div key={p.id}>
                {showBenchMarker ? (
                  <div
                    aria-label="Bench Divider"
                    className="ddc-bench-divider"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      margin: "10px 2px 12px",
                      opacity: 0.75,
                      userSelect: "none",
                    }}
                  >
                    <div style={{ height: 1, flex: 1, background: "var(--ddc-border)" }} />
                    <div
                      style={{
                        fontSize: "var(--ddc-text-xs)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--ddc-muted)",
                        fontWeight: "var(--ddc-weight-bold)",
                      }}
                    >
                      Bench
                    </div>
                    <div style={{ height: 1, flex: 1, background: "var(--ddc-border)" }} />
                  </div>
                ) : null}

                <div
                  className="ddc-row"
                  data-bench={
                    typeof benchStartIndex === "number" && idx >= benchStartIndex ? "true" : "false"
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderLeft: `5px solid ${accent}`,
                    marginBottom: 6,
                  }}
                >
                  {/* Slot pill (read-only) */}
                  <div
                    className="ddc-col-slot"
                    style={{
                      width: 60,
                      textAlign: "center",
                      fontSize: "var(--ddc-text-xs)",
                      fontWeight: "var(--ddc-weight-bold)",
                      padding: "5px 6px",
                      borderRadius: 999,
                      background: th.bg ?? "var(--ddc-pill-bg)",
                      color: accent,
                      border: `1px solid color-mix(in oklab, ${accent} 55%, transparent)`,
                      userSelect: "none",
                      letterSpacing: "0.02em",
                      lineHeight: 1,
                      flex: "0 0 auto",
                    }}
                    title="Saved Order"
                  >
                    {groupKey === "TAXI" ? `TX${idx + 1}` : `${groupKey}${idx + 1}`}
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "var(--ddc-text-md)",
                          fontWeight: "var(--ddc-weight-bold)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontStyle: p.injured ? "italic" : "normal",
                          color: p.injured ? "var(--ddc-danger)" : "var(--ddc-text)",
                        }}
                        title={p.name}
                      >
                        {p.name}
                      </div>

                      <div className="ddc-meta">
                        {p.nflTeam || "—"} • {p.age || "—"}
                      </div>

                      {p.injured ? (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 999,
                            border: "1px solid var(--ddc-border)",
                            color: "var(--ddc-danger)",
                            background: "color-mix(in oklab, var(--ddc-danger) 10%, transparent)",
                            fontWeight: 900,
                            letterSpacing: "0.02em",
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                          }}
                          title="Marked Injured"
                        >
                          INJ
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="ddc-col-age" style={{ width: 60, textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "var(--ddc-text-xs)",
                        color: "var(--ddc-muted)",
                        fontWeight: "var(--ddc-weight-medium)",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      Age
                    </div>
                    <div style={{ fontSize: "var(--ddc-text-md)", fontWeight: "var(--ddc-weight-bold)" }}>
                      {p.age || "—"}
                    </div>
                  </div>

                  <div className="ddc-col-team" style={{ width: 76, textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "var(--ddc-text-xs)",
                        color: "var(--ddc-muted)",
                        fontWeight: "var(--ddc-weight-medium)",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      Team
                    </div>
                    <div style={{ fontSize: "var(--ddc-text-md)", fontWeight: "var(--ddc-weight-bold)" }}>
                      {p.nflTeam || "—"}
                    </div>
                  </div>

                  <div className="ddc-col-val" style={{ width: 58, textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "var(--ddc-text-xs)",
                        color: "var(--ddc-muted)",
                        fontWeight: "var(--ddc-weight-medium)",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                      }}
                    >
                      Val
                    </div>
                    <div style={{ fontSize: "var(--ddc-text-md)", fontWeight: "var(--ddc-weight-bold)" }}>
                      {formatVal(val)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MacroRosterView({ playersByGroup, valuesByPlayerId, picksByYear, benchStartsByGroup = {}, isDark = false }) {
    // Total Team Val (includes TAXI)
  const teamPlayers = [
    ...(playersByGroup?.QB ?? []),
    ...(playersByGroup?.RB ?? []),
    ...(playersByGroup?.WR ?? []),
    ...(playersByGroup?.TE ?? []),
    ...(playersByGroup?.DEF ?? []),
    ...(playersByGroup?.TAXI ?? []),
  ];

  const totalTeamVal = computeGroupTotalVal(teamPlayers, valuesByPlayerId);
  
  // Only show meaningful groups (keeps it clean)
  const showDEF = (playersByGroup?.DEF?.length ?? 0) > 0;
  const showTAXI = (playersByGroup?.TAXI?.length ?? 0) > 0;

  const groups = [
    { key: "QB", title: "QB" },
    { key: "RB", title: "RB" },
    { key: "WR", title: "WR" },
    { key: "TE", title: "TE" },
    ...(showDEF ? [{ key: "DEF", title: "DEF" }] : []),
    ...(showTAXI ? [{ key: "TAXI", title: "TAXI" }] : []),
  ];

  const [copied, setCopied] = useState(false);

  async function onCopySummary() {
    try {
      const text = formatRosterSummary({ playersByGroup, picksByYear });
      await copyTextToClipboard(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 12 }}>
        {/* Line 1: Title + total player value */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em" }}>
              Roster Snapshot
            </div>

            {/* Desktop-only: Total Player Val */}
            <div
              className="ddc-team-totalval"
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: "var(--ddc-text-xs)",
                  color: "var(--ddc-muted)",
                  fontWeight: "var(--ddc-weight-medium)",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                Total Player Val
              </div>
              <div
                style={{
                  fontSize: "var(--ddc-text-xs)",
                  color: "var(--ddc-text)",
                  fontWeight: "var(--ddc-weight-medium)",
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {formatValTotal(totalTeamVal)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCopySummary}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--ddc-border)",
              background: "var(--ddc-card-bg)",
              color: "var(--ddc-text)",
              fontSize: "var(--ddc-text-xs)",
              fontWeight: "var(--ddc-weight-medium)",
              letterSpacing: "0.01em",
              cursor: "pointer",
              whiteSpace: "nowrap",
              opacity: 0.9,
            }}
            aria-label="Copy Roster Snapshot"
            title="Copy Roster Snapshot"
          >
            {copied ? "Copied" : "Copy Snapshot"}
          </button>
        </div>

        {/* Line 2: Mode / description */}
        <div
          style={{
            fontSize: "var(--ddc-text-xs)",
            color: "var(--ddc-muted)",
            fontWeight: "var(--ddc-weight-medium)",
            marginTop: 2,
          }}
        >
        Edit Order in Position Tabs
        </div>
      </div>

    {/* Mobile: single stack in natural order */}
    <div className="ddc-macro-single">
        {groups.map((g) => (
            <GroupCard
            key={g.key}
            title={g.title}
            groupKey={g.key}
            players={playersByGroup?.[g.key] ?? []}
            valuesByPlayerId={valuesByPlayerId}
            isDark={isDark}
            />
        ))}

        {/* Picks card */}
        <div
            className="ddc-macro-card"
            style={{
            background: "var(--ddc-card-bg)",
            border: "1px solid var(--ddc-border)",
            borderRadius: 16,
            padding: 14,
            color: "var(--ddc-text)",
            }}
        >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: groupTheme.PICKS.color,
                  boxShadow: `0 0 0 3px color-mix(in oklab, ${groupTheme.PICKS.color} 18%, transparent)`,
                  flex: "0 0 auto",
                }}
              />
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em" }}>
                PICKS
              </div>
            </div>

            <div style={{ marginTop: -8 }}>
                <PicksView picksByYear={picksByYear} isDark={isDark} />
            </div>
        </div>
    </div>

        {/* Desktop: explicit two columns with deterministic order */}
        <div className="ddc-macro-columns">
        <div className="ddc-macro-col">
            {/* Left column: QB, WR, (DEF if any), TAXI */}
            <GroupCard
            title="QB"
            groupKey="QB"
            players={playersByGroup?.QB ?? []}
            valuesByPlayerId={valuesByPlayerId}
            benchStartIndex={benchStartsByGroup?.QB ?? null}
            isDark={isDark}
            />

            <GroupCard
            title="WR"
            groupKey="WR"
            players={playersByGroup?.WR ?? []}
            valuesByPlayerId={valuesByPlayerId}
            benchStartIndex={benchStartsByGroup?.WR ?? null}
            isDark={isDark}
            />

            {(playersByGroup?.DEF?.length ?? 0) > 0 ? (
            <GroupCard
                title="DEF"
                groupKey="DEF"
                players={playersByGroup?.DEF ?? []}
                valuesByPlayerId={valuesByPlayerId}
                benchStartIndex={benchStartsByGroup?.DEF ?? null}
                isDark={isDark}
            />
            ) : null}

            {(playersByGroup?.TAXI?.length ?? 0) > 0 ? (
            <GroupCard
                title="TAXI"
                groupKey="TAXI"
                players={playersByGroup?.TAXI ?? []}
                valuesByPlayerId={valuesByPlayerId}
                benchStartIndex={benchStartsByGroup?.TAXI ?? null}
                isDark={isDark}
            />
            ) : null}
        </div>

        <div className="ddc-macro-col">
            {/* Right column: RB, TE, Picks */}
            <GroupCard
            title="RB"
            groupKey="RB"
            players={playersByGroup?.RB ?? []}
            valuesByPlayerId={valuesByPlayerId}
            benchStartIndex={benchStartsByGroup?.RB ?? null}
            isDark={isDark}
            />

            <GroupCard
            title="TE"
            groupKey="TE"
            players={playersByGroup?.TE ?? []}
            valuesByPlayerId={valuesByPlayerId}
            benchStartIndex={benchStartsByGroup?.TE ?? null}
            isDark={isDark}
            />

            {/* Picks card */}
            <div
            className="ddc-macro-card"
            style={{
                background: "var(--ddc-card-bg)",
                border: "1px solid var(--ddc-border)",
                borderRadius: 16,
                padding: 14,
                color: "var(--ddc-text)",
            }}
            >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: groupTheme.PICKS.color,
                      boxShadow: `0 0 0 3px color-mix(in oklab, ${groupTheme.PICKS.color} 18%, transparent)`,
                      flex: "0 0 auto",
                    }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em" }}>
                    PICKS
                  </div>
                </div>

                <div style={{ marginTop: -8 }}>
                    <PicksView picksByYear={picksByYear} isDark={isDark} />
                </div>
            </div>
        </div>
    </div>

      <style>{`
            /* Shared spacing between cards */
            .ddc-macro-card {
                margin: 0 0 16px 0;
                box-sizing: border-box;
            }

            /* Hide Age/Team columns in Full Roster snapshot (your fix #1) */
            .ddc-macro-single .ddc-col-age,
            .ddc-macro-single .ddc-col-team,
            .ddc-macro-columns .ddc-col-age,
            .ddc-macro-columns .ddc-col-team {
                display: none !important;
            }

            /* Narrow slot pill in Full Roster snapshot (your fix #2) */
            .ddc-macro-single .ddc-col-slot,
            .ddc-macro-columns .ddc-col-slot {
                width: 48px !important;
            }

            /* Mobile default: show single stack, hide desktop columns */
            .ddc-macro-single {
                display: block;
            }
            .ddc-macro-columns {
                display: none;
            }

            /* Desktop: show explicit 2-column layout */
            @media (min-width: 860px) {
                .ddc-macro-single {
                display: none;
                }

                .ddc-macro-columns {
                display: flex;
                gap: 16px;
                align-items: flex-start;
                }

                .ddc-macro-col {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                }
            }
            
            /* Full Roster snapshot is read-only — disable row hover affordance */
            .ddc-macro-single .ddc-row:hover,
            .ddc-macro-columns .ddc-row:hover {
                box-shadow: none !important;
                background-color: var(--ddc-card-bg) !important;
            }

            @media (max-width: 520px) {
                /* Full Roster: hide group Total Val on mobile portrait */
                .ddc-macro-single .ddc-group-totalval,
                .ddc-macro-columns .ddc-group-totalval {
                    display: none !important;
                }

                .ddc-team-totalval {
                  display: none !important;
                }
            }
        `}</style>
    </div>
  );
}