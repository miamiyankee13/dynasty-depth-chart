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

function normalizePickToken(token) {
  const t = norm(token);

  // Already properly formatted (e.g., 1.01, 2.03, 4.10, 3.12)
  if (/^\d{1,2}\.\d{2}$/.test(t)) return t;

  // One decimal digit (e.g., 4.1) often comes from 4.10 in Sheets/Excel
  // We'll interpret:
  //   R.1  -> R.10
  //   R.2  -> R.02  (shorthand)
  //   R.9  -> R.09
  const m1 = t.match(/^(\d{1,2})\.(\d)$/);
  if (m1) {
    const round = m1[1];
    const d = m1[2];
    if (d === "1") return `${round}.10`;     // fix the common trailing-zero loss case
    return `${round}.0${d}`;                 // treat as shorthand for 01–09
  }

  // Two or more digits after decimal but not zero-padded (e.g., 2.3 as 2.03 is handled above; 3.12 stays)
  const m2 = t.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m2) {
    const round = m2[1];
    const pick = m2[2];
    if (pick.length === 1) {
      // would have matched m1, but just in case
      if (pick === "1") return `${round}.10`;
      return `${round}.0${pick}`;
    }
    // if it's already 2 digits, keep it
    return `${round}.${pick}`;
  }

  // Anything else (e.g., "2026 1st", "Early 2nd", notes) leave untouched
  return t;
}

function splitPicks(cell) {
  if (!cell) return [];
  return norm(cell)
    .split(/[,;/|]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizePickToken);
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