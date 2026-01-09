// src/data/loadTeams.js
import { mergeTeams } from "./mergeTeams";
import { loadTeamsFromSleeper } from "./sources/sleeper/sleeperAdapter";

export async function loadAllTeams({ csvTeams = [] } = {}) {
  const sleeperTeams = await loadTeamsFromSleeper();
  return mergeTeams(csvTeams, sleeperTeams);
}