// src/data/sources/sleeper/sleeperClient.js
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Sleeper request failed (${res.status}): ${msg || url}`);
  }
  return res.json();
}

export function getUserByUsername(username) {
  return fetchJson(`https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`);
}

export function getUserLeagues(userId, season) {
  return fetchJson(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`);
}

export function getLeagueUsers(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/users`);
}

export function getLeagueRosters(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
}