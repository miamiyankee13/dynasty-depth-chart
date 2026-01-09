// src/data/mergeTeams.js
export function mergeTeams(...teamLists) {
  const flat = teamLists.flat().filter(Boolean);

  // Ensure fields exist so UI never breaks
  return flat.map((t) => ({
    picksByYear: { "2026": [], "2027": [], "2028": [], ...(t.picksByYear || {}) },
    settingsText: t.settingsText ?? "",
    players: Array.isArray(t.players) ? t.players : [],
    ...t,
  }));
}