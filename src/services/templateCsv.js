export function getDepthChartTemplateCsv() {
  const header =
    "League Name,Team Name,Pos,Name,Age,Team,2026 Picks,2027 Picks,2028 Picks\n";

  const rows = [];

  const addSlots = (prefix, count) => {
    for (let i = 1; i <= count; i++) {
      // League/Team left blank on purpose (user can fill once on first row)
      rows.push(`,,${prefix}${i},,,,,,`);
    }
  };

  addSlots("QB", 5);
  addSlots("RB", 12);
  addSlots("WR", 12);
  addSlots("TE", 5);
  addSlots("DEF", 2);
  addSlots("TX", 5);

  // Put a helpful hint row at the very top (still blank players)
  // so users see where to type League/Team immediately.
  rows.unshift(`League Name,Team Name,QB1,,,,,,`);

  return header + rows.join("\n");
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