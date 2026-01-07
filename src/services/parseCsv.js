import Papa from "papaparse";

function parsePosCell(posRaw) {
  // Examples: "QB1", "RB8", "TE2", "DEF1", "TX (WR)"
  const s = String(posRaw || "").trim().toUpperCase();
  if (!s) return null;

  if (s.startsWith("TX")) {
    // "TX (WR)" or "TX (RB)" etc.
    const match = s.match(/\((QB|RB|WR|TE)\)/);
    return { group: "TAXI", position: match?.[1] ?? "FLEX", order: 999 };
  }

  const match = s.match(/^(QB|RB|WR|TE|DEF)(\d+)?$/);
  if (!match) return null;

  const position = match[1];
  const order = match[2] ? Number(match[2]) : 999;
  return {
    group: position === "DEF" ? "DEF" : position, // group tab
    position,
    order,
  };
}

function normalizePickCell(value) {
  const v = String(value || "").trim();
  return v ? v : null;
}

export function parseDepthChartCsv(csvText) {
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const players = [];
  const picksByYear = { "2026": [], "2027": [], "2028": [] };
  let settingsText = "";

  for (const row of data) {
    const posInfo = parsePosCell(row.Pos);

    // Settings lines often show up with text in Name column, etc.
    // We’ll capture anything that looks like settings and isn’t a player row.
    const name = String(row.Name || "").trim();
    const nflTeam = String(row.Team || "").trim();

    // Picks are in dedicated columns in your sheet export
    const p2026 = normalizePickCell(row["2026 Picks"]);
    const p2027 = normalizePickCell(row["2027 Picks"]);
    const p2028 = normalizePickCell(row["2028 Picks"]);
    if (p2026) picksByYear["2026"].push(p2026);
    if (p2027) picksByYear["2027"].push(p2027);
    if (p2028) picksByYear["2028"].push(p2028);

    // Detect settings rows (very lightweight v1)
    if (!posInfo && name && !nflTeam && /settings|ppr|passing|team|start/i.test(name)) {
      settingsText += (settingsText ? "\n" : "") + name;
      continue;
    }

    if (!posInfo) continue;
    if (!name) continue; // skip empty

    // Build player record
    players.push({
      id: crypto.randomUUID(),
      name,
      age: row.Age ? String(row.Age).trim() : "",
      nflTeam,
      group: posInfo.group,     // QB/RB/WR/TE/DEF/TAXI
      position: posInfo.position,
      order: posInfo.order,
    });
  }

  // Clean picks lists (remove duplicates/empties)
  for (const y of Object.keys(picksByYear)) {
    picksByYear[y] = picksByYear[y].filter(Boolean);
  }

  return {
    team: {
      id: crypto.randomUUID(),
      name: "Team 1",
      leagueName: "Dynasty Depth Chart",
      settingsText: settingsText || "",
      players,
      picksByYear,
    },
  };
}
