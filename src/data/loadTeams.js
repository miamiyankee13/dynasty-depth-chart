// src/data/loadTeams.js
import { loadTeamsFromSleeper } from "./sources/sleeper/sleeperAdapter";

export async function loadAllTeams() {
  return await loadTeamsFromSleeper();
}