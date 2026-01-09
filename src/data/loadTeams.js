// src/data/loadTeams.js
import { mergeTeams } from "./mergeTeams";
import { loadTeamsFromSleeper, getSleeperUsername } from "./sources/sleeper/sleeperAdapter";

export async function loadAllTeams({ csvTeams = [] } = {}) {
  const hasSleeper = !!getSleeperUsername();

  // Sleeper-first: if configured, ignore CSV
  if (hasSleeper) {
    return await loadTeamsFromSleeper();
  }

  // Otherwise keep legacy behavior
  const sleeperTeams = await loadTeamsFromSleeper(); // will be []
  return mergeTeams(csvTeams, sleeperTeams);
}