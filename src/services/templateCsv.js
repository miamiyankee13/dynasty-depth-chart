function buildTeamBlock({ leagueName, teamName }) {
  const rows = [];
  const headerRow = `${leagueName},${teamName},`;

  const addSlots = (prefix, count) => {
    for (let i = 1; i <= count; i++) {
      // League/Team only on the first row of the block; carry-forward handles the rest
      const lead = rows.length === 0 ? headerRow : ",,";
      rows.push(`${lead}${prefix}${i},,,,,,`);
    }
  };

  addSlots("QB", 5);
  addSlots("RB", 12);
  addSlots("WR", 12);
  addSlots("TE", 5);
  addSlots("DEF", 2);
  addSlots("TX", 5);

  return rows.join("\n");
}

export function getDepthChartTemplateCsv() {
  const header =
    "League Name,Team Name,Pos,Name,Age,Team,2026 Picks,2027 Picks,2028 Picks\n";

  const league = "League Name";

  const block1 = buildTeamBlock({ leagueName: league, teamName: "Team Name 1" });
  const block2 = buildTeamBlock({ leagueName: league, teamName: "Team Name 2" });

  return header + block1 + "\n\n" + block2 + "\n";
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}