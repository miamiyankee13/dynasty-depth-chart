export function getDepthChartTemplateCsv() {
  const header = "Pos,Name,Age,Team,2026 Picks,2027 Picks,2028 Picks\n";

  const rows = [];

  // Helper to push empty slots
  const addSlots = (prefix, count) => {
    for (let i = 1; i <= count; i++) {
      rows.push(`${prefix}${i},,,,,,`);
    }
  };

  // Core roster structure
  addSlots("QB", 5);
  addSlots("RB", 12);
  addSlots("WR", 12);
  addSlots("TE", 5);
  addSlots("DEF", 2);

  // Taxi
  addSlots("TX", 5);

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
