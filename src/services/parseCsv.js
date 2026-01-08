import Papa from "papaparse";

/**
 * Final parser optimized for Anthony's Depth Chart CSV
 *
 * Expected columns:
 * Pos, Name, Age, Team, 2026 Picks, 2027 Picks, 2028 Picks
 */

function norm(v) {
  return String(v ?? "").trim();
}

function parsePos(posRaw) {
  const p = norm(posRaw).toUpperCase();

  if (!p) return null;

  if (p === "TX") {
    return { group: "TAXI", order: 999 };
  }

  const match = p.match(/^(QB|RB|WR|TE|DEF)(\d+)$/);
  if (!match) return null;

  return {
    group: match[1],
    order: Number(match[2]),
  };
}

function splitPicks(cell) {
  if (!cell) return [];
  return norm(cell)
    .split(/[,;/|]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function parseDepthChartCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const players = [];
  const picksByYear = {
    "2026": [],
    "2027": [],
    "2028": [],
  };

  let taxiCounter = 1;

  for (const row of parsed.data) {
    // Picks (can appear on any row)
    picksByYear["2026"].push(...splitPicks(row["2026 Picks"]));
    picksByYear["2027"].push(...splitPicks(row["2027 Picks"]));
    picksByYear["2028"].push(...splitPicks(row["2028 Picks"]));

    // Player parsing
    const posInfo = parsePos(row.Pos);
    if (!posInfo) continue;

    const name = norm(row.Name);
    if (!name) continue;

    const order =
      posInfo.group === "TAXI" ? taxiCounter++ : posInfo.order;

    players.push({
      id: crypto.randomUUID(),
      name,
      age: norm(row.Age),
      nflTeam: norm(row.Team),
      group: posInfo.group,
      position: posInfo.group,
      order,
      note: "",
    });
  }

  // Sort players by group + order
  players.sort((a, b) => {
    if (a.group !== b.group) {
      return a.group.localeCompare(b.group);
    }
    return (a.order ?? 999) - (b.order ?? 999);
  });

  return {
    teams: [
      {
        id: crypto.randomUUID(),
        name: "Team Name",
        leagueName: "League Name",
        players,
        picksByYear,
        settingsText: "",
      },
    ],
  };
}
