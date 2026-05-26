import React, { useMemo } from "react";

function fmtTotal(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

/**
 * KpiStrip — derived metrics for the active team.
 * Shown above the position/picks/roster body. No new inputs;
 * everything is computed from the existing team payload.
 */
export function KpiStrip({ team, playersByGroup, valuesByPlayerId }) {
  const data = useMemo(() => {
    if (!team) return null;

    // Player counts per group
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0, TAXI: 0 };
    for (const g of Object.keys(counts)) {
      counts[g] = playersByGroup?.[g]?.length ?? 0;
    }

    // Total team val (rosters + taxi)
    let teamVal = 0;
    let hasVal = false;
    if (valuesByPlayerId) {
      for (const g of ["QB","RB","WR","TE","DEF","TAXI"]) {
        for (const p of (playersByGroup?.[g] ?? [])) {
          const v = valuesByPlayerId.get(p.id);
          if (v == null) continue;
          const n = Number(v);
          if (!Number.isFinite(n)) continue;
          teamVal += n;
          hasVal = true;
        }
      }
    }

    // Picks per year
    const years = Object.keys(team.picksByYear ?? {})
      .filter((y) => (team.picksByYear[y]?.length ?? 0) > 0)
      .sort();
    const totalPicks = years.reduce((s, y) => s + (team.picksByYear[y]?.length ?? 0), 0);

    const totalPlayers = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return { counts, teamVal: hasVal ? teamVal : null, years, totalPicks, totalPlayers };
  }, [team, playersByGroup, valuesByPlayerId]);

  if (!data) return null;

  return (
    <div className="ddc-kpis">
      <div className="ddc-kpi">
        <span className="ddc-kpi-lbl">Total Team Val</span>
        <div className="ddc-kpi-v amber">{fmtTotal(data.teamVal)}</div>
        <span className="ddc-kpi-foot">FC · SCALED</span>
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
          {data.counts.DEF ? `DEF ${data.counts.DEF}` : ""}
          {data.counts.DEF && data.counts.TAXI ? " · " : ""}
          {data.counts.TAXI ? `TAXI ${data.counts.TAXI}` : ""}
          {!data.counts.DEF && !data.counts.TAXI ? "—" : ""}
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

      <div className="ddc-kpi">
        <span className="ddc-kpi-lbl">Players</span>
        <div className="ddc-kpi-v amber">{data.totalPlayers}</div>
        <span className="ddc-kpi-foot">ROSTER · TAXI</span>
      </div>
    </div>
  );
}
