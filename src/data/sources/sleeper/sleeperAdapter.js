// src/data/sources/sleeper/sleeperAdapter.js
import {
  getUserByUsername,
  getUserLeagues,
  getLeagueUsers,
  getLeagueRosters,
} from "./sleeperClient";
import { getSleeperPlayersDict } from "./playersCache";

const USERNAME_KEY = "ddc.sleeper.username";

export function setSleeperUsername(username) {
  localStorage.setItem(USERNAME_KEY, String(username || "").trim());
}

export function getSleeperUsername() {
  return (localStorage.getItem(USERNAME_KEY) || "").trim();
}

function dedupeById(list) {
  const m = new Map();
  for (const x of list) m.set(x.id, x);
  return Array.from(m.values());
}

function toGroupFromPosition(pos) {
  const p = String(pos || "").toUpperCase();
  if (p === "QB" || p === "RB" || p === "WR" || p === "TE" || p === "DEF") return p;
  // ignore kickers for now or put them in TAXI:
  return null;
}

function buildPlayerRow(player, group, order) {
  const name =
    player?.full_name ||
    [player?.first_name, player?.last_name].filter(Boolean).join(" ") ||
    player?.last_name ||
    "Unknown";

  return {
    id: `sleeper-player:${player.player_id}`,
    name,
    age: player?.age ? String(player.age) : "",
    nflTeam: player?.team || "",
    group,
    position: group,
    order,
    note: "",
  };
}

function buildOwnerName(roster, usersById) {
  const u = usersById[roster.owner_id];
  return u?.display_name || u?.username || "Sleeper Team";
}

// Keep it simple for Phase 1: use current year
const DEFAULT_SEASON = new Date().getFullYear();

export async function loadTeamsFromSleeper() {
  const username = getSleeperUsername();
  if (!username) return [];

  const user = await getUserByUsername(username);
  const leagues = await getUserLeagues(user.user_id, DEFAULT_SEASON);

  // ✅ load player dict once (cached)
  const playersDict = await getSleeperPlayersDict();

  const teams = [];

  for (const lg of leagues) {
    const [users, rosters] = await Promise.all([
      getLeagueUsers(lg.league_id),
      getLeagueRosters(lg.league_id),
    ]);

    const usersById = Object.fromEntries(users.map((u) => [u.user_id, u]));
    const myRoster = rosters.find((r) => r.owner_id === user.user_id);
    if (!myRoster) continue;

    const taxiSet = new Set(myRoster.taxi || []);
    const startersSet = new Set(myRoster.starters || []);

    const rows = [];

    // 1) starters first (preserves Sleeper order)
    let starterOrderByGroup = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0 };
    for (const pid of myRoster.starters || []) {
      if (!pid) continue;
      const p = playersDict[pid];
      const group = toGroupFromPosition(p?.position);
      if (!group) continue;
      starterOrderByGroup[group] += 1;
      rows.push(buildPlayerRow(p, group, starterOrderByGroup[group]));
    }

    // 2) taxi
    let txOrder = 0;
    for (const pid of myRoster.taxi || []) {
      const p = playersDict[pid];
      if (!p) continue;
      txOrder += 1;
      rows.push(buildPlayerRow(p, "TAXI", txOrder));
    }

    // 3) remaining bench (players list includes starters + taxi sometimes; so filter)
    const seen = new Set(rows.map((r) => r.id));
    const benchOrderByGroup = { QB: starterOrderByGroup.QB, RB: starterOrderByGroup.RB, WR: starterOrderByGroup.WR, TE: starterOrderByGroup.TE, DEF: starterOrderByGroup.DEF };

    for (const pid of myRoster.players || []) {
      if (!pid) continue;
      if (startersSet.has(pid)) continue;
      if (taxiSet.has(pid)) continue;

      const p = playersDict[pid];
      const group = toGroupFromPosition(p?.position);
      if (!group) continue;

      const id = `sleeper-player:${p.player_id}`;
      if (seen.has(id)) continue;

      benchOrderByGroup[group] += 1;
      rows.push(buildPlayerRow(p, group, benchOrderByGroup[group]));
      seen.add(id);
    }

    teams.push({
      id: `sleeper:${lg.league_id}`,
      leagueName: lg.name || "Sleeper League",
      name: buildOwnerName(myRoster, usersById),

      players: rows,
      picksByYear: { "2026": [], "2027": [], "2028": [] },
      settingsText: "",

      source: "sleeper",
      external: { platform: "sleeper", leagueId: lg.league_id, userId: user.user_id },
    });
  }

  return teams;
}