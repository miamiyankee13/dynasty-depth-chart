// src/data/sources/csv/csvAdapter.js
import { parseDepthChartCsv } from "../../../services/parseCsv";

export function loadTeamsFromCsvText(csvText) {
  const parsed = parseDepthChartCsv(csvText);

  // Tag source for future debugging/merging (no UI impact)
  return (parsed.teams ?? []).map((t) => ({ ...t, source: "csv" }));
}