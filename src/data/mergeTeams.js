// src/data/mergeTeams.js
export function mergeTeams(...teamLists) {
  const flat = teamLists.flat().filter(Boolean);

  const byId = new Map();
  for (const t of flat) {
    if (!t?.id) continue;

    // last-write-wins merge (fine for now)
    const prev = byId.get(t.id) || {};
    byId.set(t.id, {
      picksByYear: { "2026": [], "2027": [], "2028": [], ...(prev.picksByYear || {}), ...(t.picksByYear || {}) },
      players: Array.isArray(t.players) ? t.players : (prev.players ?? []),
      ...prev,
      ...t,
    });
  }

  return Array.from(byId.values());
}