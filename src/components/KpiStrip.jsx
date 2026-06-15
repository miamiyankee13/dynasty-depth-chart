import React, { useMemo } from "react";

function fmtTotal(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtPct(part, total) {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return "—";
  return `${Math.round((p / t) * 100)}%`;
}

function getPlayerValue(valuesByPlayerId, playerId) {
  if (!valuesByPlayerId) return null;
  const v = valuesByPlayerId.get(playerId);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * KpiStrip — derived metrics for the active team.
 * Shown above the position/picks/roster body.
 */
export function KpiStrip({
  team,
  playersByGroup,
  valuesByPlayerId,
  benchStartsByGroup = {},
  showBenchSplits = false,
}) {
  const data = useMemo(() => {
    if (!team) return null;

    // Player counts per group
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0, TAXI: 0 };
    for (const g of Object.keys(counts)) {
      counts[g] = playersByGroup?.[g]?.length ?? 0;
    }

    // Total team val + starter/bench split
    let teamVal = 0;
    let starterVal = 0;
    let benchVal = 0;
    let taxiVal = 0;
    let hasVal = false;

    let starterCount = 0;
    let benchCount = 0;
    let taxiCount = 0;

    for (const g of ["QB", "RB", "WR", "TE", "DEF"]) {
      const groupPlayers = playersByGroup?.[g] ?? [];
      const rawBenchStart = benchStartsByGroup?.[g];

      const benchStart =
        typeof rawBenchStart === "number"
          ? Math.max(0, Math.min(groupPlayers.length, rawBenchStart))
          : groupPlayers.length;

      groupPlayers.forEach((p, idx) => {
        const isBench = idx >= benchStart;

        if (isBench) benchCount += 1;
        else starterCount += 1;

        const n = getPlayerValue(valuesByPlayerId, p.id);
        if (n == null) return;

        teamVal += n;
        if (isBench) benchVal += n;
        else starterVal += n;
        hasVal = true;
      });
    }

    // Taxi is separate from bench.
    for (const p of playersByGroup?.TAXI ?? []) {
      taxiCount += 1;

      const n = getPlayerValue(valuesByPlayerId, p.id);
      if (n == null) continue;

      teamVal += n;
      taxiVal += n;
      hasVal = true;
    }

    // Picks per year
    const years = Object.keys(team.picksByYear ?? {})
      .filter((y) => (team.picksByYear[y]?.length ?? 0) > 0)
      .sort();

    const totalPicks = years.reduce(
      (s, y) => s + (team.picksByYear[y]?.length ?? 0),
      0
    );

    const totalPlayers = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return {
      counts,
      teamVal: hasVal ? teamVal : null,
      starterVal: hasVal ? starterVal : null,
      benchVal: hasVal ? benchVal : null,
      taxiVal: hasVal ? taxiVal : null,
      starterCount,
      benchCount,
      taxiCount,
      years,
      totalPicks,
      totalPlayers,
    };
  }, [team, playersByGroup, valuesByPlayerId, benchStartsByGroup]);

  if (!data) return null;

  return (
    <div className="ddc-kpis">
      <div className="ddc-kpi">
        <span className="ddc-kpi-lbl">Total Player Val</span>
        <div className="ddc-kpi-v amber">{fmtTotal(data.teamVal)}</div>

        {showBenchSplits ? (
          <>
            <span className="ddc-kpi-foot ddc-kpi-foot-split">
              STARTERS {fmtTotal(data.starterVal)} ({fmtPct(data.starterVal, data.teamVal)}) · BENCH {fmtTotal(data.benchVal)} ({fmtPct(data.benchVal, data.teamVal)}) · TAXI {fmtTotal(data.taxiVal)} ({fmtPct(data.taxiVal, data.teamVal)})
            </span>
            <span className="ddc-kpi-foot ddc-kpi-foot-mobile">FC · SCALED</span>
          </>
        ) : (
          <span className="ddc-kpi-foot">FC · SCALED</span>
        )}
      </div>

      <div className="ddc-kpi">
        <span className="ddc-kpi-lbl">Total Players</span>
        <div className="ddc-kpi-v amber">{data.totalPlayers}</div>

        {showBenchSplits ? (
          <>
            <span className="ddc-kpi-foot ddc-kpi-foot-split">
              STARTERS {data.starterCount} · BENCH {data.benchCount} · TAXI {data.taxiCount}
            </span>
            <span className="ddc-kpi-foot ddc-kpi-foot-mobile">ROSTERED</span>
          </>
        ) : (
          <span className="ddc-kpi-foot">ROSTERED</span>
        )}
      </div>

      <div className="ddc-kpi">
        <span className="ddc-kpi-lbl">By Position</span>
        <div className="ddc-kpi-row">
          {["QB", "RB", "WR", "TE"].map((p) => (
            <span key={p} className="ddc-kpi-pos" data-p={p}>
              {p}·<b>{data.counts[p]}</b>
            </span>
          ))}
        </div>
        <span className="ddc-kpi-foot">
          {[
            data.counts.DEF ? `DEF ${data.counts.DEF}` : null,
            data.counts.TAXI ? `TAXI ${data.counts.TAXI}` : null,
          ].filter(Boolean).join(" · ") || "ACTIVE ROSTER"}
        </span>
      </div>

      <div className="ddc-kpi">
        <span className="ddc-kpi-lbl">Picks</span>
        <div className="ddc-kpi-row">
          {data.years.length === 0 ? (
            <span className="ddc-kpi-pos">—</span>
          ) : (
            data.years.map((y) => (
              <span key={y} className="ddc-kpi-pos amber">
                {y}·<b>{team.picksByYear[y].length}</b>
              </span>
            ))
          )}
        </div>
        <span className="ddc-kpi-foot">{data.totalPicks} TOTAL</span>
      </div>
    </div>
  );
}