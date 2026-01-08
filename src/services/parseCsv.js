import Papa from "papaparse";

function norm(v) {
  return String(v ?? "").trim();
}

function parsePos(posRaw) {
  const p = norm(posRaw).toUpperCase();
  if (!p) return null;

  // Taxi: allow TX or TX1, TX2, etc.
  const txMatch = p.match(/^TX(\d+)?$/);
  if (txMatch) {
    const n = txMatch[1] ? Number(txMatch[1]) : 999;
    return { group: "TAXI", order: n };
  }

  const match = p.match(/^(QB|RB|WR|TE|DEF)(\d+)$/);
  if (!match) return null;

  return { group: match[1], order: Number(match[2]) };
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

  let currentLeagueName = "";
  let currentTeamName = "";

  const teamMap = new Map();

  const getOrCreateTeam = (teamName, leagueNameForTeam) => {
    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, {
        id: crypto.randomUUID(),
        leagueName: leagueNameForTeam || "League Name",
        name: teamName || "Team Name",
        players: [],
        picksByYear: { "2026": [], "2027": [], "2028": [] },
        settingsText: "",
      });
    }
    return teamMap.get(teamName);
  };

  for (const row of parsed.data) {
    // Carry-forward league name (block behavior)
    const rowLeague = norm(row["League Name"]);
    if (rowLeague) currentLeagueName = rowLeague;

    // Carry-forward team name (block behavior)
    const rowTeam = norm(row["Team Name"]);
    if (rowTeam) currentTeamName = rowTeam;

    // If we don't have a team yet, skip row
    if (!currentTeamName) continue;

    const team = getOrCreateTeam(currentTeamName, currentLeagueName);

    // If league name shows up later, update the team (safe + expected)
    if (currentLeagueName) team.leagueName = currentLeagueName;

    // Picks belong to the current team block
    team.picksByYear["2026"].push(...splitPicks(row["2026 Picks"]));
    team.picksByYear["2027"].push(...splitPicks(row["2027 Picks"]));
    team.picksByYear["2028"].push(...splitPicks(row["2028 Picks"]));

    // Players (only parse rows with valid Pos AND non-empty Name)
    const posInfo = parsePos(row.Pos);
    if (!posInfo) continue;

    const name = norm(row.Name);
    if (!name) continue;

    team.players.push({
      id: crypto.randomUUID(),
      name,
      age: norm(row.Age),
      nflTeam: norm(row.Team),
      group: posInfo.group,
      position: posInfo.group,
      order: posInfo.order,
      note: "",
    });
  }

  const teams = Array.from(teamMap.values());

  // Sort each team’s players for consistent display
  for (const t of teams) {
    t.players.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return (a.order ?? 999) - (b.order ?? 999);
    });
  }

  return { teams };
}