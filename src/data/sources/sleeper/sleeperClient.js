// src/data/sources/sleeper/sleeperClient.js

function withCacheBust(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Date.now()}`;
}

async function fetchJson(url) {
  const finalUrl = withCacheBust(url);

  const res = await fetch(finalUrl, {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Sleeper request failed (${res.status}): ${msg || finalUrl}`);
  }

  return res.json();
}

export function getUserByUsername(username) {
  return fetchJson(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`
  );
}

export function getUserLeagues(userId, season) {
  return fetchJson(
    `https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`
  );
}

export function getLeagueUsers(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/users`);
}

export function getLeagueRosters(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
}

export function getLeague(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}`);
}

export function getLeagueTradedPicks(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/traded_picks`);
}

export function getLeagueDrafts(leagueId) {
  return fetchJson(`https://api.sleeper.app/v1/league/${leagueId}/drafts`);
}

export function getDraft(draftId) {
  return fetchJson(`https://api.sleeper.app/v1/draft/${draftId}`);
}

export function getDraftPicks(draftId) {
  return fetchJson(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
}